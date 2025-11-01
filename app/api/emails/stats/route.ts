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

    // Get total emails count
    const totalEmails = await prisma.email.count({
      where: {
        gmailAccount: {
          userId: user.id,
        },
      },
    });

    // Get categorized emails count
    const categorizedEmails = await prisma.email.count({
      where: {
        gmailAccount: {
          userId: user.id,
        },
        categoryId: {
          not: null,
        },
      },
    });

    // Get uncategorized emails count
    const uncategorizedEmails = totalEmails - categorizedEmails;

    // Get archived emails count
    const archivedEmails = await prisma.email.count({
      where: {
        gmailAccount: {
          userId: user.id,
        },
        archived: true,
      },
    });

    // Get categories count
    const categoriesCount = await prisma.category.count({
      where: {
        userId: user.id,
      },
    });

    // Get Gmail accounts count
    const gmailAccountsCount = await prisma.gmailAccount.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    // Get recent activity (emails received in the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentEmails = await prisma.email.findMany({
      where: {
        gmailAccount: {
          userId: user.id,
        },
        receivedAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        receivedAt: true,
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });

    // Group emails by date
    const activityByDate: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      activityByDate[dateKey] = 0;
    }

    recentEmails.forEach((email: any) => {
      const dateKey = email.receivedAt.toISOString().split('T')[0];
      if (activityByDate[dateKey] !== undefined) {
        activityByDate[dateKey]++;
      }
    });

    const recentActivity = Object.entries(activityByDate).map(([date, count]) => ({
      date,
      count,
    }));

    return NextResponse.json({
      totalEmails,
      categorizedEmails,
      uncategorizedEmails,
      archivedEmails,
      categoriesCount,
      gmailAccountsCount,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
