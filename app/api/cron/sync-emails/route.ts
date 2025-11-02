import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchNewEmails, archiveEmail } from '@/lib/gmail';
import { extractUnsubscribeInfo } from '@/lib/unsubscribe-detector';
import { classifyEmail, summarizeEmail } from '@/lib/openai';

/**
 * POST /api/cron/sync-emails
 * Cron job endpoint to automatically sync emails from all active Gmail accounts
 * This endpoint should be called by a cron service (e.g., Render Cron Jobs)
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET environment variable not set');
      return NextResponse.json(
        { error: 'Cron job not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Invalid cron secret provided');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 [CRON] Starting automated email sync...');

    // Get all active Gmail accounts across all users
    const gmailAccounts = await prisma.gmailAccount.findMany({
      where: {
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (gmailAccounts.length === 0) {
      console.log('✅ [CRON] No active Gmail accounts found');
      return NextResponse.json({
        success: true,
        message: 'No active accounts to sync',
        accountsProcessed: 0,
        totalNewEmails: 0,
      });
    }

    console.log(`📧 [CRON] Found ${gmailAccounts.length} active Gmail accounts to sync`);

    let totalNewEmails = 0;
    let totalProcessed = 0;
    const errors: string[] = [];
    const results: any[] = [];

    // Process each account
    for (const account of gmailAccounts) {
      try {
        console.log(`📬 [CRON] Syncing account: ${account.email} (User: ${account.user.email})`);

        // Get user's categories for AI classification
        const categories = await prisma.category.findMany({
          where: { userId: account.userId },
          select: { id: true, name: true, description: true },
        });

        // Skip accounts without minimum 2 categories
        if (categories.length < 2) {
          console.log(`⚠️  [CRON] Skipping ${account.email}: Needs at least 2 categories`);
          results.push({
            account: account.email,
            status: 'skipped',
            reason: 'Minimum 2 categories required',
          });
          continue;
        }

        // Fetch new emails
        const emails = await fetchNewEmails(account.id);
        console.log(`📨 [CRON] Found ${emails.length} new emails for ${account.email}`);

        let accountNewEmails = 0;
        let accountProcessed = 0;

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

            // Generate AI summary and classification
            let summary: string | null = null;
            let categoryId: string | null = null;

            try {
              // Always generate summary
              summary = await summarizeEmail({
                subject: emailData.subject,
                from: emailData.from,
                body: emailData.body,
              });

              // Classify into categories
              const classification = await classifyEmail(
                {
                  subject: emailData.subject,
                  from: emailData.from,
                  body: emailData.body,
                },
                categories
              );
              categoryId = classification.categoryId;

              accountProcessed++;
            } catch (aiError) {
              console.error(`⚠️  [CRON] AI processing error for email ${emailData.gmailId}:`, aiError);
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
              console.error(`⚠️  [CRON] Failed to archive email ${emailData.gmailId} in Gmail:`, archiveError);
              // Continue even if archive fails
            }

            accountNewEmails++;
          } catch (error: any) {
            // Skip if duplicate (gmailId unique constraint)
            if (error.code === 'P2002') {
              continue;
            }
            console.error(`❌ [CRON] Error processing email ${emailData.gmailId}:`, error);
          }
        }

        // Update last synced timestamp
        await prisma.gmailAccount.update({
          where: { id: account.id },
          data: { lastSyncedAt: new Date() },
        });

        totalNewEmails += accountNewEmails;
        totalProcessed += accountProcessed;

        results.push({
          account: account.email,
          status: 'success',
          newEmails: accountNewEmails,
          processed: accountProcessed,
        });

        console.log(`✅ [CRON] Synced ${accountNewEmails} new emails for ${account.email}`);
      } catch (error) {
        const errorMsg = `${account.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ [CRON] Error syncing account ${account.email}:`, error);
        errors.push(errorMsg);
        results.push({
          account: account.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`✅ [CRON] Sync complete: ${totalNewEmails} new emails, ${totalProcessed} processed with AI`);

    return NextResponse.json({
      success: true,
      accountsProcessed: gmailAccounts.length,
      totalNewEmails,
      totalProcessed,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [CRON] Critical error in sync job:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync emails',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
