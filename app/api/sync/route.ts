import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { fetchNewEmails, archiveEmail } from '@/lib/gmail';
import { extractUnsubscribeInfo } from '@/lib/unsubscribe-detector';
import { classifyEmail, summarizeEmail } from '@/lib/openai';

/**
 * POST /api/sync
 * Fetch new emails from all active Gmail accounts
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active Gmail accounts for the user
    const gmailAccounts = await prisma.gmailAccount.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });

    if (gmailAccounts.length === 0) {
      return NextResponse.json(
        { error: 'No active Gmail accounts found' },
        { status: 400 }
      );
    }

    // Get user's categories for AI classification
    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, description: true },
    });

    let totalNewEmails = 0;
    let totalProcessed = 0;
    const errors: string[] = [];
    const accountsProcessed = gmailAccounts.length;

    // Process each account
    for (const account of gmailAccounts) {
      try {
        // Fetch new emails
        const emails = await fetchNewEmails(account.id);

        // Insert emails into database and process with AI
        for (const emailData of emails) {
          try {
            // Extract unsubscribe info from body
            const unsubscribeInfo = extractUnsubscribeInfo(
              emailData.body,
              emailData.headers
            );

            // If we found a better unsubscribe link in the body, use it
            if (
              unsubscribeInfo.method === 'link' &&
              unsubscribeInfo.url
            ) {
              emailData.unsubscribeLink = unsubscribeInfo.url;
              emailData.unsubscribeMethod = 'link';
            }

            // Check if email already exists
            const existingEmail = await prisma.email.findUnique({
              where: { gmailId: emailData.gmailId },
            });

            if (existingEmail) {
              continue; // Skip duplicate
            }

            // Generate AI summary
            let summary: string | null = null;
            let categoryId: string | null = null;

            try {
              // Always generate summary
              summary = await summarizeEmail({
                subject: emailData.subject,
                from: emailData.from,
                body: emailData.body,
              });

              // Only classify if user has categories
              if (categories.length > 0) {
                const classification = await classifyEmail(
                  {
                    subject: emailData.subject,
                    from: emailData.from,
                    body: emailData.body,
                  },
                  categories
                );
                categoryId = classification.categoryId;
              }

              totalProcessed++;
            } catch (aiError) {
              console.error('AI processing error:', aiError);
              // Continue without summary/classification if AI fails
            }

            // Create email with summary and category
            await prisma.email.create({
              data: {
                gmailId: emailData.gmailId,
                gmailAccountId: account.id,
                subject: emailData.subject,
                from: emailData.from,
                body: emailData.body,
                bodyTruncated: emailData.bodyTruncated,
                receivedAt: emailData.receivedAt,
                unsubscribeLink: emailData.unsubscribeLink,
                unsubscribeMethod: emailData.unsubscribeMethod,
                summary,
                categoryId,
                archived: false,
              },
            });

            // Archive email in Gmail (remove from INBOX)
            try {
              await archiveEmail(account.id, emailData.gmailId);
            } catch (archiveError) {
              console.error(`Failed to archive email ${emailData.gmailId} in Gmail:`, archiveError);
              // Continue even if archive fails
            }

            totalNewEmails++;
          } catch (error: any) {
            // Skip if duplicate (gmailId unique constraint)
            if (error.code === 'P2002') {
              continue;
            }
            throw error;
          }
        }

        // Update last synced timestamp
        await prisma.gmailAccount.update({
          where: { id: account.id },
          data: { lastSyncedAt: new Date() },
        });
      } catch (error) {
        console.error(`Error syncing account ${account.email}:`, error);
        errors.push(`${account.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      accountsProcessed,
      totalNewEmails,
      totalProcessed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in /api/sync:', error);
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    );
  }
}
