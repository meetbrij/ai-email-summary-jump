import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
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

    // Get all emails with unsubscribe links
    const emails = await prisma.email.findMany({
      where: {
        gmailAccount: {
          userId: user.id,
        },
        unsubscribeLink: {
          not: null,
        },
      },
      include: {
        unsubscribeAttempts: {
          orderBy: {
            attemptedAt: 'desc',
          },
        },
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });

    return NextResponse.json(emails);
  } catch (error) {
    console.error('Error fetching unsubscribe emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unsubscribe emails' },
      { status: 500 }
    );
  }
}
