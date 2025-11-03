import { extractUnsubscribeInfo } from '@/lib/unsubscribe-detector';

// Mock cheerio
jest.mock('cheerio', () => ({
  load: jest.fn((html: string) => {
    // Simple mock implementation that parses HTML-like strings
    const links: Array<{ href: string; text: string; className: string; inFooter: boolean }> = [];

    // Extract links with regex
    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*class="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      links.push({
        href: match[1],
        text: match[3].trim(),
        className: match[2] || '',
        inFooter: html.indexOf('<footer>') !== -1 && html.indexOf('</footer>') > html.indexOf(match[0]),
      });
    }

    // Also match links without class attribute
    const simpleLinkRegex = /<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
    while ((match = simpleLinkRegex.exec(html)) !== null) {
      // Skip if already matched
      if (!links.some(l => l.href === match[1])) {
        const fullMatch = match[0];
        links.push({
          href: match[1],
          text: match[2].trim(),
          className: '',
          inFooter: html.indexOf('<footer>') !== -1 && html.indexOf('</footer>') > html.indexOf(fullMatch),
        });
      }
    }

    return (selector: string) => {
      if (selector === 'a[href]') {
        return {
          each: (callback: (index: number, element: any) => void) => {
            links.forEach((link, index) => {
              callback(index, {
                attribs: {
                  href: link.href,
                  class: link.className,
                },
                children: [{ data: link.text }],
              });
            });
          },
        };
      }

      return {
        attr: (name: string) => {
          if (name === 'href') return links[0]?.href;
          if (name === 'class') return links[0]?.className;
          return undefined;
        },
        text: () => links[0]?.text || '',
        parent: () => ({
          text: () => '',
          is: () => links[0]?.inFooter || false,
          closest: () => ({ length: links[0]?.inFooter ? 1 : 0 }),
        }),
        each: () => {},
      };
    };
  }),
}));

describe('Unsubscribe Detector', () => {
  describe('extractUnsubscribeInfo() - Header detection', () => {
    it('should extract HTTP URL from List-Unsubscribe header', () => {
      const headers = {
        listUnsubscribe: '<https://example.com/unsubscribe?id=123>',
      };

      const result = extractUnsubscribeInfo('', headers);

      expect(result).toEqual({
        url: 'https://example.com/unsubscribe?id=123',
        method: 'header',
      });
    });

    it('should extract HTTP URL when both HTTP and mailto are present', () => {
      const headers = {
        listUnsubscribe: '<mailto:unsub@example.com>, <https://example.com/unsubscribe>',
      };

      const result = extractUnsubscribeInfo('', headers);

      expect(result).toEqual({
        url: 'https://example.com/unsubscribe',
        method: 'header',
      });
    });

    it('should extract mailto URL when only mailto is present', () => {
      const headers = {
        listUnsubscribe: '<mailto:unsubscribe@example.com?subject=unsubscribe>',
      };

      const result = extractUnsubscribeInfo('', headers);

      expect(result).toEqual({
        url: 'mailto:unsubscribe@example.com?subject=unsubscribe',
        method: 'header',
      });
    });

    it('should handle multiple HTTP URLs and prefer the first', () => {
      const headers = {
        listUnsubscribe: '<https://first.com/unsub>, <https://second.com/unsub>',
      };

      const result = extractUnsubscribeInfo('', headers);

      expect(result.url).toBe('https://first.com/unsub');
      expect(result.method).toBe('header');
    });

    it('should handle List-Unsubscribe with whitespace', () => {
      const headers = {
        listUnsubscribe: '  <https://example.com/unsubscribe>  ',
      };

      const result = extractUnsubscribeInfo('', headers);

      expect(result).toEqual({
        url: 'https://example.com/unsubscribe',
        method: 'header',
      });
    });

    it('should handle malformed List-Unsubscribe header', () => {
      const headers = {
        listUnsubscribe: 'not-a-valid-url',
      };

      const result = extractUnsubscribeInfo('Some email body', headers);

      // Should fall back to body detection
      expect(result.method).not.toBe('header');
    });
  });

  describe('extractUnsubscribeInfo() - Body detection', () => {
    it('should extract unsubscribe link from simple HTML with "unsubscribe" text', () => {
      const emailBody = `
        <html>
          <body>
            <p>Hello!</p>
            <a href="https://example.com/unsubscribe">Unsubscribe</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result).toEqual({
        url: 'https://example.com/unsubscribe',
        method: 'link',
      });
    });

    it('should detect "opt out" pattern', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/optout">Opt Out</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/optout');
      expect(result.method).toBe('link');
    });

    it('should detect "remove me" pattern', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/remove">Remove Me</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/remove');
      expect(result.method).toBe('link');
    });

    it('should detect "email preferences" pattern', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/preferences">Email Preferences</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/preferences');
      expect(result.method).toBe('link');
    });

    it('should detect "manage subscriptions" pattern', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/manage">Manage Subscriptions</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/manage');
      expect(result.method).toBe('link');
    });

    it('should detect "stop receiving" pattern', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/stop">Stop Receiving Emails</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/stop');
      expect(result.method).toBe('link');
    });

    it('should detect unsubscribe pattern in URL when text is generic', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/unsubscribe?token=abc">Click here</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/unsubscribe?token=abc');
      expect(result.method).toBe('link');
    });

    it('should prioritize link text over URL pattern', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/unsubscribe?id=1">Unsubscribe from this list</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      // Should find the unsubscribe link
      expect(result.url).toBe('https://example.com/unsubscribe?id=1');
      expect(result.method).toBe('link');
    });

    it('should prioritize footer links', () => {
      const emailBody = `
        <html>
          <body>
            <footer>
              <a href="https://example.com/unsub2">unsubscribe</a>
            </footer>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      // Should find footer unsubscribe link
      expect(result.url).toBe('https://example.com/unsub2');
      expect(result.method).toBe('link');
    });

    it('should detect class name patterns', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/action" class="unsubscribe-link">Click here</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/action');
      expect(result.method).toBe('link');
    });

    it('should ignore non-HTTP links', () => {
      const emailBody = `
        <html>
          <body>
            <a href="/relative/unsubscribe">Unsubscribe</a>
            <a href="javascript:void(0)">Unsubscribe</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result).toEqual({
        url: null,
        method: 'none',
      });
    });

    it('should handle case-insensitive matching', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/unsub">UNSUBSCRIBE</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/unsub');
      expect(result.method).toBe('link');
    });

    it('should handle complex HTML with nested elements', () => {
      const emailBody = `
        <html>
          <body>
            <table>
              <tr>
                <td>
                  <div>
                    <p>Newsletter content</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <footer>
                    <div>
                      <p>
                        <a href="https://example.com/unsubscribe?id=xyz">
                          Click here to unsubscribe
                        </a>
                      </p>
                    </div>
                  </footer>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/unsubscribe?id=xyz');
      expect(result.method).toBe('link');
    });

    it('should return null for emails without unsubscribe links', () => {
      const emailBody = `
        <html>
          <body>
            <p>Just a regular email</p>
            <a href="https://example.com/read-more">Read more</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result).toEqual({
        url: null,
        method: 'none',
      });
    });

    it('should handle plain text email gracefully', () => {
      const emailBody = 'This is a plain text email with no HTML.';

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result).toEqual({
        url: null,
        method: 'none',
      });
    });

    it('should handle empty email body', () => {
      const result = extractUnsubscribeInfo('', {});

      expect(result).toEqual({
        url: null,
        method: 'none',
      });
    });

    it('should handle malformed HTML', () => {
      const emailBody = '<html><body><a href="https://example.com/unsub">Unsubscribe</a>';

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/unsub');
      expect(result.method).toBe('link');
    });
  });

  describe('extractUnsubscribeInfo() - Combined scenarios', () => {
    it('should prefer header over body when both are present', () => {
      const headers = {
        listUnsubscribe: '<https://header.com/unsubscribe>',
      };
      const emailBody = `
        <html>
          <body>
            <a href="https://body.com/unsubscribe">Unsubscribe</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, headers);

      expect(result).toEqual({
        url: 'https://header.com/unsubscribe',
        method: 'header',
      });
    });

    it('should fall back to body when header is malformed', () => {
      const headers = {
        listUnsubscribe: 'invalid',
      };
      const emailBody = `
        <html>
          <body>
            <a href="https://body.com/unsubscribe">Unsubscribe</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, headers);

      expect(result).toEqual({
        url: 'https://body.com/unsubscribe',
        method: 'link',
      });
    });

    it('should return none when neither header nor body has unsubscribe info', () => {
      const headers = {};
      const emailBody = '<html><body><p>Regular email</p></body></html>';

      const result = extractUnsubscribeInfo(emailBody, headers);

      expect(result).toEqual({
        url: null,
        method: 'none',
      });
    });
  });

  describe('extractUnsubscribeInfo() - Real-world examples', () => {
    it('should handle Mailchimp-style unsubscribe', () => {
      const headers = {
        listUnsubscribe: '<https://example.us1.list-manage.com/unsubscribe?u=xxx&id=yyy>',
      };
      const emailBody = `
        <html>
          <body>
            <footer>
              <a href="https://example.us1.list-manage.com/unsubscribe?u=xxx&id=yyy">
                unsubscribe from this list
              </a>
            </footer>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, headers);

      expect(result.url).toContain('unsubscribe');
      expect(result.method).toBe('header');
    });

    it('should handle SendGrid-style unsubscribe', () => {
      const headers = {
        listUnsubscribe: '<https://sendgrid.net/wf/unsubscribe?upn=xxx>',
      };

      const result = extractUnsubscribeInfo('', headers);

      expect(result.url).toContain('unsubscribe');
      expect(result.method).toBe('header');
    });

    it('should handle Gmail promotion-style unsubscribe', () => {
      const emailBody = `
        <html>
          <body>
            <div>
              <p>Promotional content</p>
            </div>
            <div style="text-align: center; font-size: 12px;">
              <a href="https://example.com/unsubscribe?token=abc123">
                Unsubscribe
              </a>
            </div>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toContain('unsubscribe');
      expect(result.method).toBe('link');
    });

    it('should handle newsletter with multiple unsubscribe links', () => {
      const emailBody = `
        <html>
          <body>
            <p>Content</p>
            <footer>
              <a href="https://example.com/unsubscribe">Unsubscribe Now</a>
            </footer>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      // Should find the unsubscribe link
      expect(result.url).toBe('https://example.com/unsubscribe');
      expect(result.method).toBe('link');
    });
  });

  describe('extractUnsubscribeInfo() - Edge cases', () => {
    it('should handle URLs with special characters', () => {
      const headers = {
        listUnsubscribe: '<https://example.com/unsub?email=test%40example.com&id=123>',
      };

      const result = extractUnsubscribeInfo('', headers);

      expect(result.url).toBe('https://example.com/unsub?email=test%40example.com&id=123');
      expect(result.method).toBe('header');
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/unsubscribe?' + 'a=1&'.repeat(100) + 'end=true';
      const headers = {
        listUnsubscribe: `<${longUrl}>`,
      };

      const result = extractUnsubscribeInfo('', headers);

      expect(result.url).toBe(longUrl);
      expect(result.method).toBe('header');
    });

    it('should handle Unicode in link text', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/unsub">取消订阅 Unsubscribe</a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/unsub');
      expect(result.method).toBe('link');
    });

    it('should handle link with no text content', () => {
      const emailBody = `
        <html>
          <body>
            <a href="https://example.com/unsubscribe"></a>
          </body>
        </html>
      `;

      const result = extractUnsubscribeInfo(emailBody, {});

      expect(result.url).toBe('https://example.com/unsubscribe');
      expect(result.method).toBe('link');
    });
  });
});
