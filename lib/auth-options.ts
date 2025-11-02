import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import type { Adapter } from 'next-auth/adapters';

// Wrap PrismaAdapter to filter out unknown fields from Google OAuth
function createFilteredAdapter(): Adapter {
  const baseAdapter = PrismaAdapter(prisma);

  return {
    ...baseAdapter,
    linkAccount: async (account: any) => {
      // Remove fields that aren't in our Prisma schema
      const { refresh_token_expires_in, ...filteredAccount } = account as any;

      return baseAdapter.linkAccount!(filteredAccount);
    },
  } as Adapter;
}

export const authOptions: NextAuthOptions = {
  adapter: createFilteredAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      console.log('📍 SESSION CALLBACK:', { session, user });
      if (session.user) {
        session.user.id = user.id;
        session.user.image = user.image;
        session.user.createdAt = user.createdAt;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      console.log('📍 SIGNIN CALLBACK FIRED:', {
        userId: user?.id,
        userEmail: user?.email,
        provider: account?.provider,
        hasRefreshToken: !!account?.refresh_token,
        hasAccessToken: !!account?.access_token,
        accountKeys: account ? Object.keys(account) : [],
      });

      // When using database sessions, the account object is only available during OAuth callback
      // For existing users signing in, we need to fetch the Account from database
      try {
        if (!user?.id || !user?.email) {
          console.log('⚠️ No user ID or email in signIn callback');
          return true;
        }

        // Fetch the Google Account record from database
        const googleAccount = await prisma.account.findFirst({
          where: {
            userId: user.id,
            provider: 'google',
          },
        });

        if (!googleAccount || !googleAccount.refresh_token) {
          console.log('⚠️ No Google account or refresh token found for user');
          return true;
        }

        console.log('📍 SIGNIN CALLBACK - Creating/updating GmailAccount with stored tokens');

        // Use the refresh token from the database (it's already stored by the adapter)
        // We need to re-encrypt it with our encryption key
        const encryptedRefreshToken = encrypt(googleAccount.refresh_token);

        // Check if this Gmail account is already connected
        const existingGmailAccount = await prisma.gmailAccount.findFirst({
          where: {
            userId: user.id,
            email: user.email,
          },
        });

        if (existingGmailAccount) {
          // Update existing account
          await prisma.gmailAccount.update({
            where: { id: existingGmailAccount.id },
            data: {
              refreshToken: encryptedRefreshToken,
              accessToken: googleAccount.access_token || null,
              expiresAt: googleAccount.expires_at
                ? new Date(googleAccount.expires_at * 1000)
                : null,
              isActive: true,
            },
          });
          console.log('✅ Updated existing GmailAccount');
        } else {
          // Create new Gmail account record
          await prisma.gmailAccount.create({
            data: {
              userId: user.id,
              email: user.email,
              refreshToken: encryptedRefreshToken,
              accessToken: googleAccount.access_token || null,
              expiresAt: googleAccount.expires_at
                ? new Date(googleAccount.expires_at * 1000)
                : null,
              isActive: true,
            },
          });
          console.log('✅ Created new GmailAccount');
        }
      } catch (error) {
        console.error('❌ Error in signIn callback:', error);
      }

      return true; // Always allow sign-in to proceed
    },
    async redirect({ url, baseUrl }) {
      console.log('📍 REDIRECT CALLBACK:', { url, baseUrl });
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async linkAccount({ account, user, profile }) {
      // This event is called after the adapter creates the Account record
      // Now we can safely create our GmailAccount record
      if (account.provider === 'google' && account.refresh_token && user.email) {
        try {
          // Encrypt the refresh token before storing
          const encryptedRefreshToken = encrypt(account.refresh_token);

          // Check if this Gmail account is already connected
          const existingGmailAccount = await prisma.gmailAccount.findFirst({
            where: {
              userId: user.id,
              email: user.email,
            },
          });

          if (existingGmailAccount) {
            // Update existing account
            await prisma.gmailAccount.update({
              where: { id: existingGmailAccount.id },
              data: {
                refreshToken: encryptedRefreshToken,
                accessToken: account.access_token || null,
                expiresAt: account.expires_at
                  ? new Date(account.expires_at * 1000)
                  : null,
                isActive: true,
              },
            });
          } else {
            // Create new Gmail account record
            await prisma.gmailAccount.create({
              data: {
                userId: user.id,
                email: user.email,
                refreshToken: encryptedRefreshToken,
                accessToken: account.access_token || null,
                expiresAt: account.expires_at
                  ? new Date(account.expires_at * 1000)
                  : null,
                isActive: true,
              },
            });
          }
        } catch (error) {
          console.error('Error storing Gmail account:', error);
        }
      }
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'database',
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
