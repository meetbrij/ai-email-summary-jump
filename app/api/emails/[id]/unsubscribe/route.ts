import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unsubscribeEmail } from '@/lib/unsubscribe-agent';

export const dynamic = 'force-dynamic';

// Increase timeout for this route (browser automation can take time)
export const maxDuration = 60; // 60 seconds

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify email belongs to user and has unsubscribe link
    const email = await prisma.email.findFirst({
      where: {
        id: params.id,
        gmailAccount: {
          userId: user.id,
        },
        unsubscribeLink: {
          not: null,
        },
      },
    });

    if (!email || !email.unsubscribeLink) {
      return NextResponse.json(
        { error: 'Email not found or has no unsubscribe link' },
        { status: 404 }
      );
    }

    console.log(`\n[Unsubscribe API] Starting unsubscribe for email ${email.id}`);
    console.log(`[Unsubscribe API] Unsubscribe URL: ${email.unsubscribeLink}`);

    // Create unsubscribe attempt
    const attempt = await prisma.unsubscribeAttempt.create({
      data: {
        emailId: email.id,
        status: 'pending',
        method: email.unsubscribeMethod || 'link',
      },
    });

    console.log(`[Unsubscribe API] Created attempt ${attempt.id}`);

    // Execute unsubscribe automation
    try {
      const result = await unsubscribeEmail(email.unsubscribeLink, attempt.id);

      // Update attempt with result
      const updatedAttempt = await prisma.unsubscribeAttempt.update({
        where: { id: attempt.id },
        data: {
          status: result.success ? 'success' : 'failed',
          method: result.method,
          errorMessage: result.error || null,
          screenshotPath: result.screenshotPaths?.after || result.screenshotPaths?.before || null,
          completedAt: new Date(),
        },
      });

      console.log(`[Unsubscribe API] Attempt ${attempt.id} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`[Unsubscribe API] Method: ${result.method}`);
      console.log(`[Unsubscribe API] Message: ${result.message}`);

      return NextResponse.json({
        success: result.success,
        attemptId: updatedAttempt.id,
        method: result.method,
        message: result.message,
        screenshotPaths: result.screenshotPaths,
      });
    } catch (automationError: any) {
      console.error(`[Unsubscribe API] Automation error:`, automationError);

      // Update attempt as failed
      await prisma.unsubscribeAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'failed',
          errorMessage: automationError.message || 'Unknown automation error',
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: false,
        attemptId: attempt.id,
        message: `Automation failed: ${automationError.message}`,
        error: automationError.message,
      });
    }
  } catch (error: any) {
    console.error('[Unsubscribe API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate unsubscribe', details: error.message },
      { status: 500 }
    );
  }
}
