import { NextRequest, NextResponse } from 'next/server';
import { decrypt, encrypt } from '@/lib/encryption';
import { prisma } from '@/lib/db';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gmail/callback
 * Custom OAuth callback handler for adding additional Gmail accounts
 * This bypasses NextAuth to avoid creating a new user session
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(
          `/dashboard/accounts?error=${encodeURIComponent('OAuth authorization failed')}`,
          req.url
        )
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?error=' +
            encodeURIComponent('Missing authorization code or state'),
          req.url
        )
      );
    }

    // Decrypt and validate state
    let stateData: { userId: string; action: string; timestamp: number };
    try {
      stateData = JSON.parse(decrypt(state));
    } catch (error) {
      console.error('Failed to decrypt state:', error);
      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?error=' +
            encodeURIComponent('Invalid or expired authorization request'),
          req.url
        )
      );
    }

    // Validate state
    if (stateData.action !== 'add-account') {
      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?error=' + encodeURIComponent('Invalid request type'),
          req.url
        )
      );
    }

    // Check if state is expired (5 minutes)
    const FIVE_MINUTES = 5 * 60 * 1000;
    if (Date.now() - stateData.timestamp > FIVE_MINUTES) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?error=' +
            encodeURIComponent('Authorization request expired. Please try again'),
          req.url
        )
      );
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/gmail/callback`
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?error=' +
            encodeURIComponent(
              'No refresh token received. Please try again and grant all permissions'
            ),
          req.url
        )
      );
    }

    // Get user info from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    if (!userInfo.data.email) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?error=' +
            encodeURIComponent('Failed to retrieve email from Google'),
          req.url
        )
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: stateData.userId },
      include: {
        gmailAccounts: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?error=' + encodeURIComponent('User not found'),
          req.url
        )
      );
    }

    // Check account limit
    if (user.gmailAccounts.length >= 5) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?error=' +
            encodeURIComponent('Maximum of 5 Gmail accounts allowed'),
          req.url
        )
      );
    }

    // Check if this email is already connected
    const existingAccount = await prisma.gmailAccount.findFirst({
      where: {
        userId: user.id,
        email: userInfo.data.email,
      },
    });

    if (existingAccount) {
      // Update existing account
      await prisma.gmailAccount.update({
        where: { id: existingAccount.id },
        data: {
          refreshToken: encrypt(tokens.refresh_token),
          accessToken: tokens.access_token || null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          isActive: true,
        },
      });

      return NextResponse.redirect(
        new URL(
          '/dashboard/accounts?success=' +
            encodeURIComponent('Gmail account reconnected successfully'),
          req.url
        )
      );
    }

    // Create new Gmail account
    await prisma.gmailAccount.create({
      data: {
        userId: user.id,
        email: userInfo.data.email,
        refreshToken: encrypt(tokens.refresh_token),
        accessToken: tokens.access_token || null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive: true,
      },
    });

    console.log(`✅ Added new Gmail account: ${userInfo.data.email} for user: ${user.id}`);

    return NextResponse.redirect(
      new URL(
        '/dashboard/accounts?success=' +
          encodeURIComponent('Gmail account added successfully'),
        req.url
      )
    );
  } catch (error) {
    console.error('Error in /api/gmail/callback:', error);
    return NextResponse.redirect(
      new URL(
        '/dashboard/accounts?error=' +
          encodeURIComponent('Failed to add Gmail account. Please try again'),
        req.url
      )
    );
  }
}
