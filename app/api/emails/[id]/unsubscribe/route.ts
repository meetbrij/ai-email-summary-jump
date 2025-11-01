import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

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

    if (!email) {
      return NextResponse.json(
        { error: 'Email not found or has no unsubscribe link' },
        { status: 404 }
      );
    }

    // Create unsubscribe attempt
    const attempt = await prisma.unsubscribeAttempt.create({
      data: {
        emailId: email.id,
        status: 'pending',
        method: email.unsubscribeMethod || 'link',
      },
    });

    // In a real implementation, you would trigger a background job here
    // to actually perform the unsubscribe action (e.g., using a queue system)
    // For now, we'll just create the attempt record

    // Example: You could use a library like 'bull' or 'agenda' to queue the job
    // await unsubscribeQueue.add({ attemptId: attempt.id, emailId: email.id });

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      message: 'Unsubscribe attempt initiated',
    });
  } catch (error) {
    console.error('Error initiating unsubscribe:', error);
    return NextResponse.json(
      { error: 'Failed to initiate unsubscribe' },
      { status: 500 }
    );
  }
}
