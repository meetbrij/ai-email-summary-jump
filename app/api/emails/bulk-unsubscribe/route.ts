import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { unsubscribeEmail } from '@/lib/unsubscribe-agent';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for bulk operations

const bulkUnsubscribeSchema = z.object({
  emailIds: z.array(z.string()).min(1, 'At least one email ID is required'),
});

interface UnsubscribeResult {
  emailId: string;
  success: boolean;
  message: string;
  method?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = bulkUnsubscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { emailIds } = validation.data;

    console.log(`[Bulk Unsubscribe] Starting bulk unsubscribe for ${emailIds.length} emails`);

    // Fetch emails to verify ownership and check for unsubscribe links
    const emails = await prisma.email.findMany({
      where: {
        id: { in: emailIds },
        gmailAccount: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        subject: true,
        unsubscribeLink: true,
        unsubscribeMethod: true,
      },
    });

    if (emails.length === 0) {
      return NextResponse.json(
        { error: 'No emails found or you do not have permission to unsubscribe from these emails' },
        { status: 404 }
      );
    }

    console.log(`[Bulk Unsubscribe] Found ${emails.length} emails owned by user`);

    // Filter emails that have unsubscribe links
    const unsubscribableEmails = emails.filter((email) => email.unsubscribeLink);
    const nonUnsubscribableCount = emails.length - unsubscribableEmails.length;

    console.log(`[Bulk Unsubscribe] ${unsubscribableEmails.length} emails have unsubscribe links`);
    if (nonUnsubscribableCount > 0) {
      console.log(`[Bulk Unsubscribe] ${nonUnsubscribableCount} emails skipped (no unsubscribe link)`);
    }

    if (unsubscribableEmails.length === 0) {
      return NextResponse.json(
        {
          error: 'None of the selected emails have unsubscribe links',
          skipped: nonUnsubscribableCount,
        },
        { status: 400 }
      );
    }

    const results: UnsubscribeResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each email sequentially (to avoid rate limiting and resource exhaustion)
    for (const email of unsubscribableEmails) {
      console.log(`\n[Bulk Unsubscribe] Processing email ${email.id}: "${email.subject}"`);

      try {
        // Create unsubscribe attempt
        const attempt = await prisma.unsubscribeAttempt.create({
          data: {
            emailId: email.id,
            status: 'pending',
            method: email.unsubscribeMethod || 'link',
          },
        });

        // Execute unsubscribe automation
        const result = await unsubscribeEmail(email.unsubscribeLink!, attempt.id);

        // Update attempt with result
        await prisma.unsubscribeAttempt.update({
          where: { id: attempt.id },
          data: {
            status: result.success ? 'success' : 'failed',
            method: result.method,
            errorMessage: result.error || null,
            screenshotPath: result.screenshotPaths?.after || result.screenshotPaths?.before || null,
            completedAt: new Date(),
          },
        });

        results.push({
          emailId: email.id,
          success: result.success,
          message: result.message,
          method: result.method,
          error: result.error,
        });

        if (result.success) {
          successCount++;
          console.log(`[Bulk Unsubscribe] ✓ Success for email ${email.id}`);
        } else {
          failureCount++;
          console.log(`[Bulk Unsubscribe] ✗ Failed for email ${email.id}: ${result.message}`);
        }

        // Add small delay between unsubscribes to be respectful
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`[Bulk Unsubscribe] Error processing email ${email.id}:`, error);

        // Try to mark attempt as failed
        try {
          const failedAttempt = await prisma.unsubscribeAttempt.findFirst({
            where: { emailId: email.id },
            orderBy: { attemptedAt: 'desc' },
          });

          if (failedAttempt) {
            await prisma.unsubscribeAttempt.update({
              where: { id: failedAttempt.id },
              data: {
                status: 'failed',
                errorMessage: error.message || 'Unknown error',
                completedAt: new Date(),
              },
            });
          }
        } catch (dbError) {
          console.error(`[Bulk Unsubscribe] Failed to update attempt for email ${email.id}:`, dbError);
        }

        results.push({
          emailId: email.id,
          success: false,
          message: `Error: ${error.message}`,
          error: error.message,
        });

        failureCount++;
      }
    }

    const totalProcessed = successCount + failureCount;

    console.log(`\n[Bulk Unsubscribe] Completed: ${successCount} succeeded, ${failureCount} failed, ${nonUnsubscribableCount} skipped`);

    return NextResponse.json({
      success: successCount > 0,
      totalRequested: emailIds.length,
      processed: totalProcessed,
      succeeded: successCount,
      failed: failureCount,
      skipped: nonUnsubscribableCount,
      results,
      message:
        successCount > 0 && failureCount === 0
          ? `Successfully unsubscribed from ${successCount} email(s).`
          : successCount > 0 && failureCount > 0
          ? `Unsubscribed from ${successCount} email(s). ${failureCount} failed.`
          : `Failed to unsubscribe from all emails. ${failureCount} failed.`,
    });
  } catch (error: any) {
    console.error('[Bulk Unsubscribe] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
