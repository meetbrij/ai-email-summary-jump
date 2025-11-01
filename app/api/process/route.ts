import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { classifyEmail, summarizeEmail } from '@/lib/openai';
import { archiveEmail } from '@/lib/gmail';

/**
 * POST /api/process
 * Process unclassified emails: classify, summarize, and archive
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's categories
    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, description: true },
    });

    if (categories.length === 0) {
      return NextResponse.json(
        { error: 'Please create categories first' },
        { status: 400 }
      );
    }

    // Get unprocessed emails (categoryId is null)
    const maxToProcess = parseInt(
      process.env.MAX_EMAILS_PER_PROCESS || '20'
    );

    const emails = await prisma.email.findMany({
      where: {
        categoryId: null,
        gmailAccount: {
          userId: session.user.id,
        },
      },
      include: {
        gmailAccount: true,
      },
      take: maxToProcess,
      orderBy: {
        receivedAt: 'desc',
      },
    });

    if (emails.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No unprocessed emails found',
      });
    }

    let processed = 0;
    const failed: Array<{ emailId: string; error: string }> = [];

    // Process sequentially to avoid rate limits
    for (const email of emails) {
      try {
        // 1. Classify email
        const classification = await classifyEmail(
          {
            subject: email.subject,
            from: email.from,
            body: email.body,
          },
          categories
        );

        // 2. Summarize email
        const summary = await summarizeEmail({
          subject: email.subject,
          from: email.from,
          body: email.body,
        });

        // 3. Update email with classification and summary
        await prisma.email.update({
          where: { id: email.id },
          data: {
            categoryId: classification.categoryId,
            summary,
          },
        });

        // 4. Archive in Gmail
        const archiveSuccess = await archiveEmail(
          email.gmailAccountId,
          email.gmailId
        );

        if (archiveSuccess) {
          await prisma.email.update({
            where: { id: email.id },
            data: { archived: true },
          });
        }

        processed++;
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        failed.push({
          emailId: email.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed: failed.length,
      errors: failed.length > 0 ? failed : undefined,
    });
  } catch (error) {
    console.error('Error in /api/process:', error);
    return NextResponse.json(
      { error: 'Failed to process emails' },
      { status: 500 }
    );
  }
}
