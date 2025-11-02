import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gmail/add-account
 * Initiate custom OAuth flow to add an additional Gmail account
 * This does NOT use NextAuth - it's a manual OAuth flow
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        gmailAccounts: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check account limit
    if (user.gmailAccounts.length >= 5) {
      return NextResponse.json(
        { error: 'Maximum of 5 Gmail accounts allowed per user' },
        { status: 400 }
      );
    }

    // Create encrypted state with user context
    const stateData = {
      userId: user.id,
      action: 'add-account',
      timestamp: Date.now(),
    };
    const encryptedState = encrypt(JSON.stringify(stateData));

    // Build OAuth URL for custom callback
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/gmail/callback`,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent select_account',
      state: encryptedState,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({
      authUrl,
      currentAccountCount: user.gmailAccounts.length,
      maxAccounts: 5,
    });
  } catch (error) {
    console.error('Error in /api/gmail/add-account:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
