import { getSession, requireAuth, getUserId, requireUserId } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

// Mock next-auth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

// Mock authOptions
jest.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('Auth Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSession()', () => {
    it('should return session when user is authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          image: 'https://example.com/avatar.jpg',
          createdAt: new Date('2024-01-01'),
        },
        expires: '2024-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await getSession();

      expect(session).toEqual(mockSession);
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const session = await getSession();

      expect(session).toBeNull();
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should handle session with minimal user data', async () => {
      const mockSession = {
        user: {
          id: 'user-456',
          email: 'minimal@example.com',
        },
        expires: '2024-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await getSession();

      expect(session).toEqual(mockSession);
      expect(session?.user.id).toBe('user-456');
      expect(session?.user.email).toBe('minimal@example.com');
    });
  });

  describe('requireAuth()', () => {
    it('should return session when user is authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-789',
          email: 'authenticated@example.com',
          name: 'Authenticated User',
        },
        expires: '2024-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await requireAuth();

      expect(session).toEqual(mockSession);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should redirect to login when session is null', async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockRedirect.mockImplementation((url: string) => {
        throw new Error(`NEXT_REDIRECT: ${url}`);
      });

      await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT: /login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect to login when session.user is undefined', async () => {
      mockGetServerSession.mockResolvedValue({
        expires: '2024-12-31',
      } as any);
      mockRedirect.mockImplementation((url: string) => {
        throw new Error(`NEXT_REDIRECT: ${url}`);
      });

      await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT: /login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect to login when session.user is null', async () => {
      mockGetServerSession.mockResolvedValue({
        user: null,
        expires: '2024-12-31',
      } as any);
      mockRedirect.mockImplementation((url: string) => {
        throw new Error(`NEXT_REDIRECT: ${url}`);
      });

      await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT: /login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('getUserId()', () => {
    it('should return user ID when user is authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-abc',
          email: 'user@example.com',
        },
        expires: '2024-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const userId = await getUserId();

      expect(userId).toBe('user-abc');
    });

    it('should return null when session is null', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const userId = await getUserId();

      expect(userId).toBeNull();
    });

    it('should return null when session.user is undefined', async () => {
      mockGetServerSession.mockResolvedValue({
        expires: '2024-12-31',
      } as any);

      const userId = await getUserId();

      expect(userId).toBeNull();
    });

    it('should return null when session.user.id is undefined', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          email: 'no-id@example.com',
        },
        expires: '2024-12-31',
      } as any);

      const userId = await getUserId();

      expect(userId).toBeNull();
    });

    it('should handle different user ID types', async () => {
      const mockSession = {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000', // UUID
          email: 'uuid@example.com',
        },
        expires: '2024-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const userId = await getUserId();

      expect(userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('requireUserId()', () => {
    it('should return user ID when user is authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-xyz',
          email: 'hasid@example.com',
        },
        expires: '2024-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const userId = await requireUserId();

      expect(userId).toBe('user-xyz');
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should redirect to login when session is null', async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockRedirect.mockImplementation((url: string) => {
        throw new Error(`NEXT_REDIRECT: ${url}`);
      });

      await expect(requireUserId()).rejects.toThrow('NEXT_REDIRECT: /login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should return UUID format user ID', async () => {
      const mockSession = {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'uuid-user@example.com',
          name: 'UUID User',
        },
        expires: '2024-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const userId = await requireUserId();

      expect(userId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle getServerSession throwing an error', async () => {
      mockGetServerSession.mockRejectedValue(new Error('NextAuth error'));

      await expect(getSession()).rejects.toThrow('NextAuth error');
    });

    it('should handle multiple sequential calls to getSession', async () => {
      const mockSession1 = {
        user: { id: 'user-1', email: 'user1@example.com' },
        expires: '2024-12-31',
      };
      const mockSession2 = {
        user: { id: 'user-2', email: 'user2@example.com' },
        expires: '2024-12-31',
      };

      mockGetServerSession
        .mockResolvedValueOnce(mockSession1)
        .mockResolvedValueOnce(mockSession2);

      const session1 = await getSession();
      const session2 = await getSession();

      expect(session1?.user.id).toBe('user-1');
      expect(session2?.user.id).toBe('user-2');
      expect(mockGetServerSession).toHaveBeenCalledTimes(2);
    });

    it('should handle session with extra properties', async () => {
      const mockSession = {
        user: {
          id: 'user-extra',
          email: 'extra@example.com',
          name: 'Extra User',
          customField: 'custom value',
        },
        expires: '2024-12-31',
        extraProperty: 'extra',
      } as any;

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await getSession();

      expect(session?.user.id).toBe('user-extra');
      expect((session as any)?.user.customField).toBe('custom value');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle authenticated user flow end-to-end', async () => {
      const mockSession = {
        user: {
          id: 'integration-user',
          email: 'integration@example.com',
          name: 'Integration Test',
        },
        expires: '2024-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      // Test all functions return correct values for authenticated user
      const session = await getSession();
      const requiredSession = await requireAuth();
      const userId = await getUserId();
      const requiredUserId = await requireUserId();

      expect(session?.user.id).toBe('integration-user');
      expect(requiredSession.user.id).toBe('integration-user');
      expect(userId).toBe('integration-user');
      expect(requiredUserId).toBe('integration-user');
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should handle unauthenticated user flow end-to-end', async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockRedirect.mockImplementation((url: string) => {
        throw new Error(`NEXT_REDIRECT: ${url}`);
      });

      // Test all functions handle unauthenticated state correctly
      const session = await getSession();
      const userId = await getUserId();

      expect(session).toBeNull();
      expect(userId).toBeNull();

      // These should redirect
      await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT: /login');
      await expect(requireUserId()).rejects.toThrow('NEXT_REDIRECT: /login');

      expect(mockRedirect).toHaveBeenCalledTimes(2);
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
  });
});
