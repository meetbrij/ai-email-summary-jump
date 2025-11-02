import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    const { categoryId } = await request.json();

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

    // If categoryId is provided, verify it belongs to the user
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId: user.id,
        },
      });

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
    }

    // Update category
    const updatedEmail = await prisma.email.update({
      where: { id: params.id },
      data: { categoryId },
      include: {
        category: true,
      },
    });

    return NextResponse.json(updatedEmail);
  } catch (error) {
    console.error('Error updating email category:', error);
    return NextResponse.json(
      { error: 'Failed to update email category' },
      { status: 500 }
    );
  }
}
