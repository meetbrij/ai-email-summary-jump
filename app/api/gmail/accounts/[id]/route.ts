import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
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

    // Fetch account with email count
    const account = await prisma.gmailAccount.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      include: {
        _count: {
          select: {
            emails: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error('Error fetching Gmail account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Gmail account' },
      { status: 500 }
    );
  }
}

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

    const { isActive } = await request.json();

    // Verify account belongs to user
    const account = await prisma.gmailAccount.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Update account status
    const updatedAccount = await prisma.gmailAccount.update({
      where: { id: params.id },
      data: { isActive },
    });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error('Error updating Gmail account:', error);
    return NextResponse.json(
      { error: 'Failed to update Gmail account' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify account belongs to user
    const account = await prisma.gmailAccount.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Delete account (cascade will delete associated emails)
    await prisma.gmailAccount.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Gmail account:', error);
    return NextResponse.json(
      { error: 'Failed to delete Gmail account' },
      { status: 500 }
    );
  }
}
