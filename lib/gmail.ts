import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from './db';
import { decrypt, encrypt } from './encryption';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { gmail_v1 } from 'googleapis';

// Rate limiting: max 5 concurrent requests
const queue = new PQueue({ concurrency: 5 });

// Maximum email body size to store (50KB)
const MAX_BODY_SIZE = 50 * 1024;

/**
 * Get an authenticated Gmail client for a specific account
 * Handles automatic token refresh
 */
export async function getGmailClient(
  gmailAccountId: string
): Promise<gmail_v1.Gmail> {
  // Fetch Gmail account from database
  const account = await prisma.gmailAccount.findUnique({
    where: { id: gmailAccountId },
  });

  if (!account) {
    throw new Error('Gmail account not found');
  }

  if (!account.isActive) {
    throw new Error('Gmail account is inactive');
  }

  // Decrypt refresh token
  const refreshToken = decrypt(account.refreshToken);

  // Initialize OAuth2 client
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: account.accessToken || undefined,
  });

  // Check if access token is expired and refresh if needed
  if (account.expiresAt && new Date(account.expiresAt) <= new Date()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update tokens in database
      await prisma.gmailAccount.update({
        where: { id: gmailAccountId },
        data: {
          accessToken: credentials.access_token,
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
      });

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw new Error('Failed to refresh Gmail access token');
    }
  }

  // Create and return Gmail client
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetch new emails from a Gmail account
 * @param gmailAccountId - The Gmail account ID
 * @param maxResults - Maximum number of emails to fetch (default: 50)
 * @returns Array of email objects
 */
export async function fetchNewEmails(
  gmailAccountId: string,
  maxResults: number = parseInt(process.env.MAX_EMAILS_PER_SYNC || '50')
): Promise<any[]> {
  return await pRetry(
    async () => {
      const gmail = await getGmailClient(gmailAccountId);
      const account = await prisma.gmailAccount.findUnique({
        where: { id: gmailAccountId },
      });

      if (!account) {
        throw new Error('Gmail account not found');
      }

      // Build query to fetch emails from the last 24 hours or since last sync
      let afterDate: Date;
      if (account.lastSyncedAt) {
        afterDate = new Date(account.lastSyncedAt);
      } else {
        // First sync: get emails from last 24 hours
        afterDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }

      const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
      const query = `after:${afterTimestamp} -label:spam -label:trash`;

      // List messages
      const listResponse = await queue.add(() =>
        gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
        })
      );

      const messages = listResponse?.data?.messages || [];

      if (messages.length === 0) {
        return [];
      }

      // Fetch full message details
      const emails = await Promise.all(
        messages.map(async (message) => {
          try {
            const messageData = await queue.add(() =>
              gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'full',
              })
            );

            return messageData?.data;
          } catch (error) {
            console.error(`Failed to fetch message ${message.id}:`, error);
            return null;
          }
        })
      );

      // Filter out null results and already processed emails
      const validEmails = emails.filter((email) => email !== null);

      // Check which emails are already in the database
      const gmailIds = validEmails.map((email) => email!.id!);
      const existingEmails = await prisma.email.findMany({
        where: { gmailId: { in: gmailIds } },
        select: { gmailId: true },
      });

      const existingGmailIds = new Set(
        existingEmails.map((e: any) => e.gmailId)
      );

      // Filter out existing emails
      const newEmails = validEmails.filter(
        (email) => !existingGmailIds.has(email!.id!)
      );

      // Parse and return email data
      return newEmails.map((message) => parseEmailMessage(message!));
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        console.log(
          `Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
        );
      },
    }
  );
}

/**
 * Parse Gmail message into our email format
 */
function parseEmailMessage(message: gmail_v1.Schema$Message): any {
  const headers = message.payload?.headers || [];

  // Extract headers
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value || '';

  const subject = getHeader('Subject');
  const from = getHeader('From');
  const date = getHeader('Date');
  const listUnsubscribe = getHeader('List-Unsubscribe');

  // Get email body
  const body = getEmailBody(message);

  // Truncate body if too large
  let truncatedBody = body;
  let bodyTruncated = false;
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_SIZE) {
    truncatedBody = body.substring(0, MAX_BODY_SIZE);
    bodyTruncated = true;
  }

  // Parse unsubscribe information
  let unsubscribeLink = null;
  let unsubscribeMethod = 'none';

  if (listUnsubscribe) {
    // Extract URL from List-Unsubscribe header
    const urlMatch = listUnsubscribe.match(/<(https?:\/\/[^>]+)>/);
    if (urlMatch) {
      unsubscribeLink = urlMatch[1];
      unsubscribeMethod = 'header';
    }
  }

  return {
    gmailId: message.id!,
    subject,
    from,
    body: truncatedBody,
    bodyTruncated,
    receivedAt: date ? new Date(date) : new Date(),
    unsubscribeLink,
    unsubscribeMethod,
    headers: {
      listUnsubscribe,
    },
  };
}

/**
 * Extract email body from Gmail message
 * Handles multipart messages and base64 decoding
 */
export function getEmailBody(message: gmail_v1.Schema$Message): string {
  let body = '';

  function extractBody(part: gmail_v1.Schema$MessagePart): string {
    if (part.body?.data) {
      // Decode base64 content
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }

    if (part.parts) {
      // Handle multipart messages
      // Prefer HTML, fallback to plain text
      const htmlPart = part.parts.find((p) => p.mimeType === 'text/html');
      if (htmlPart) {
        return extractBody(htmlPart);
      }

      const textPart = part.parts.find((p) => p.mimeType === 'text/plain');
      if (textPart) {
        return extractBody(textPart);
      }

      // Recursively search for body in nested parts
      for (const subPart of part.parts) {
        const result = extractBody(subPart);
        if (result) return result;
      }
    }

    return '';
  }

  if (message.payload) {
    body = extractBody(message.payload);
  }

  return body;
}

/**
 * Archive an email in Gmail (remove from INBOX)
 * @param gmailAccountId - The Gmail account ID
 * @param gmailId - The Gmail message ID
 * @returns true if successful
 */
export async function archiveEmail(
  gmailAccountId: string,
  gmailId: string
): Promise<boolean> {
  try {
    return await pRetry(
      async () => {
        const gmail = await getGmailClient(gmailAccountId);

        await queue.add(() =>
          gmail.users.messages.modify({
            userId: 'me',
            id: gmailId,
            requestBody: {
              removeLabelIds: ['INBOX'],
            },
          })
        );

        return true;
      },
      {
        retries: 2,
        onFailedAttempt: (error) => {
          console.log(
            `Archive attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          );
        },
      }
    );
  } catch (error) {
    console.error(`Failed to archive email ${gmailId}:`, error);
    return false;
  }
}
