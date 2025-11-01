import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * GET /api/gmail/accounts
 * Fetch all Gmail accounts for the logged-in user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accounts = await prisma.gmailAccount.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        lastSyncedAt: true,
        createdAt: true,
        _count: {
          select: {
            emails: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedAccounts = accounts.map((account: any) => ({
      id: account.id,
      email: account.email,
      isActive: account.isActive,
      lastSyncedAt: account.lastSyncedAt,
      createdAt: account.createdAt,
      _count: account._count,
    }));

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error('Error in GET /api/gmail/accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Gmail accounts' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gmail/accounts/[id]
 * Soft delete a Gmail account (set isActive = false)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this account
    const account = await prisma.gmailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Gmail account not found' },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/gmail/accounts:', error);
    return NextResponse.json(
      { error: 'Failed to delete Gmail account' },
      { status: 500 }
    );
  }
}
