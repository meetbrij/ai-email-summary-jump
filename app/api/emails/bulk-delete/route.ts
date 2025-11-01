import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getGmailClient } from '@/lib/gmail';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  emailIds: z.array(z.string()).min(1, 'At least one email ID is required'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { emailIds } = validation.data;

    // Fetch emails to verify ownership and get Gmail IDs
    const emails = await prisma.email.findMany({
      where: {
        id: { in: emailIds },
        gmailAccount: {
          userId: session.user.id,
        },
      },
      include: {
        gmailAccount: true,
      },
    });

    if (emails.length === 0) {
      return NextResponse.json(
        { error: 'No emails found or you do not have permission to delete these emails' },
        { status: 404 }
      );
    }

    // Group emails by Gmail account for batch operations
    const emailsByAccount = emails.reduce((acc, email) => {
      const accountId = email.gmailAccountId;
      if (!acc[accountId]) {
        acc[accountId] = [];
      }
      acc[accountId].push(email);
      return acc;
    }, {} as Record<string, typeof emails>);

    let deletedFromGmail = 0;
    let failedGmailDeletes = 0;

    // Delete from Gmail for each account
    for (const [accountId, accountEmails] of Object.entries(emailsByAccount)) {
      const gmailAccount = accountEmails[0].gmailAccount;

      try {
        const gmail = await getGmailClient(gmailAccount.id);

        // Delete emails from Gmail (move to trash)
        for (const email of accountEmails) {
          try {
            await gmail.users.messages.trash({
              userId: 'me',
              id: email.gmailId,
            });
            deletedFromGmail++;
          } catch (error) {
            console.error(`Failed to delete email ${email.gmailId} from Gmail:`, error);
            failedGmailDeletes++;
          }
        }
      } catch (error) {
        console.error(`Failed to get Gmail client for account ${accountId}:`, error);
        failedGmailDeletes += accountEmails.length;
      }
    }

    // Delete from database
    const deleteResult = await prisma.email.deleteMany({
      where: {
        id: { in: emailIds },
      },
    });

    const hasGmailFailures = failedGmailDeletes > 0;

    return NextResponse.json({
      success: !hasGmailFailures, // Only success if all Gmail deletes worked
      deleted: deleteResult.count,
      deletedFromGmail,
      failedGmailDeletes,
      warning: hasGmailFailures ? `${failedGmailDeletes} email(s) could not be deleted from Gmail. Please check your Gmail account connection.` : undefined,
      message: hasGmailFailures
        ? `Deleted ${deleteResult.count} email(s) from app, but ${failedGmailDeletes} failed to delete from Gmail.`
        : `Successfully deleted ${deleteResult.count} email(s) from both app and Gmail.`,
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
