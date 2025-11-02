import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const uncategorized = searchParams.get('uncategorized') === 'true';
    const archived = searchParams.get('archived') === 'true';
    const gmailAccountId = searchParams.get('gmailAccountId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {
      gmailAccount: {
        userId: user.id,
      },
      archived,
    };

    // Filter by specific Gmail account if provided
    if (gmailAccountId) {
      where.gmailAccountId = gmailAccountId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (uncategorized) {
      where.categoryId = null;
    }

    const emails = await prisma.email.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        gmailAccount: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        receivedAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
