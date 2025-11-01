import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
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

    const { archived } = await request.json();

    // Verify email belongs to user
    const email = await prisma.email.findFirst({
      where: {
        id: params.id,
        gmailAccount: {
          userId: user.id,
        },
      },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Update archived status
    const updatedEmail = await prisma.email.update({
      where: { id: params.id },
      data: { archived },
    });

    return NextResponse.json(updatedEmail);
  } catch (error) {
    console.error('Error archiving email:', error);
    return NextResponse.json(
      { error: 'Failed to archive email' },
      { status: 500 }
    );
  }
}
