import * as cheerio from 'cheerio';

interface UnsubscribeInfo {
  url: string | null;
  method: 'header' | 'link' | 'none';
}

/**
 * Extract unsubscribe information from email headers and body
 * @param emailBody - HTML or plain text email body
 * @param headers - Email headers object
 * @returns Unsubscribe information with URL and method
 */
export function extractUnsubscribeInfo(
  emailBody: string,
  headers: { listUnsubscribe?: string }
): UnsubscribeInfo {
  // 1. Check List-Unsubscribe header (RFC 8058)
  if (headers.listUnsubscribe) {
    const headerUrl = extractFromHeader(headers.listUnsubscribe);
    if (headerUrl) {
      return {
        url: headerUrl,
        method: 'header',
      };
    }
  }

  // 2. Parse HTML body for unsubscribe links
  const bodyUrl = extractFromBody(emailBody);
  if (bodyUrl) {
    return {
      url: bodyUrl,
      method: 'link',
    };
  }

  // 3. Nothing found
  return {
    url: null,
    method: 'none',
  };
}

/**
 * Extract unsubscribe URL from List-Unsubscribe header
 * Supports both <URL> and <mailto:> formats, prefers HTTP
 */
function extractFromHeader(headerValue: string): string | null {
  // Extract URLs from angle brackets
  const urlMatches = headerValue.match(/<([^>]+)>/g);

  if (!urlMatches) {
    return null;
  }

  // Remove angle brackets and split by comma
  const urls = urlMatches.map((match) => match.slice(1, -1).trim());

  // Prefer HTTP/HTTPS over mailto
  const httpUrl = urls.find((url) => url.startsWith('http'));
  if (httpUrl) {
    return httpUrl;
  }

  // Fallback to mailto (we won't handle these in MVP but detect them)
  const mailtoUrl = urls.find((url) => url.startsWith('mailto:'));
  if (mailtoUrl) {
    return mailtoUrl;
  }

  return null;
}

/**
 * Extract unsubscribe URL from email HTML body
 * Looks for links with common unsubscribe patterns
 */
function extractFromBody(emailBody: string): string | null {
  try {
    const $ = cheerio.load(emailBody);

    // Common unsubscribe text patterns (case-insensitive)
    const unsubscribePatterns = [
      /unsubscribe/i,
      /opt.?out/i,
      /remove.?me/i,
      /email.?preferences/i,
      /manage.?subscriptions?/i,
      /stop.?receiving/i,
    ];

    // Find all links
    const links = $('a[href]');
    const candidateLinks: Array<{ href: string; priority: number }> = [];

    links.each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      const className = $(element).attr('class') || '';

      if (!href || !href.startsWith('http')) {
        return;
      }

      let priority = 0;

      // Check href for unsubscribe patterns
      const hrefLower = href.toLowerCase();
      if (
        unsubscribePatterns.some((pattern) => pattern.test(hrefLower))
      ) {
        priority += 3;
      }

      // Check link text for unsubscribe patterns
      if (
        unsubscribePatterns.some((pattern) => pattern.test(text))
      ) {
        priority += 5;
      }

      // Check class name for unsubscribe patterns
      if (
        unsubscribePatterns.some((pattern) => pattern.test(className))
      ) {
        priority += 2;
      }

      // Prioritize links in footer
      const parent = $(element).parent();
      const parentText = parent.text().toLowerCase();
      if (
        parentText.includes('footer') ||
        parent.is('footer') ||
        parent.closest('footer').length > 0
      ) {
        priority += 1;
      }

      if (priority > 0) {
        candidateLinks.push({ href, priority });
      }
    });

    // Sort by priority and return highest
    if (candidateLinks.length > 0) {
      candidateLinks.sort((a, b) => b.priority - a.priority);
      return candidateLinks[0].href;
    }

    return null;
  } catch (error) {
    console.error('Error parsing email body for unsubscribe link:', error);
    return null;
  }
}
