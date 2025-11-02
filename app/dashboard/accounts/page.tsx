'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  ChevronLeft,
  Mail,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface GmailAccount {
  id: string;
  email: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  _count?: {
    emails: number;
  };
}

function AccountsPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle success/error messages from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      toast.success(success);
      // Clear URL params
      window.history.replaceState({}, '', '/dashboard/accounts');
      // Refetch accounts
      queryClient.invalidateQueries({ queryKey: ['gmail-accounts'] });
    }

    if (error) {
      toast.error(error);
      // Clear URL params
      window.history.replaceState({}, '', '/dashboard/accounts');
    }
  }, [searchParams, queryClient]);

  const { data: accounts, isLoading } = useQuery<GmailAccount[]>({
    queryKey: ['gmail-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/gmail/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      return res.json();
    },
  });

  const handleConnectAccount = async () => {
    try {
      setIsConnecting(true);
      // Fetch OAuth URL from custom endpoint
      const res = await fetch('/api/gmail/add-account');
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to initiate OAuth flow');
        return;
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error connecting account:', error);
      toast.error('Failed to connect Gmail account');
      setIsConnecting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/gmail/accounts/${accountId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete account');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-accounts'] });
      toast.success('Gmail account removed successfully');
    },
    onError: () => {
      toast.error('Failed to remove Gmail account');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/gmail/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle account status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-accounts'] });
      toast.success('Account status updated');
    },
    onError: () => {
      toast.error('Failed to update account status');
    },
  });

  const handleDelete = (accountId: string) => {
    if (
      confirm(
        'Are you sure you want to remove this Gmail account? All associated emails will be deleted.'
      )
    ) {
      deleteMutation.mutate(accountId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Gmail Accounts
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connect and manage your Gmail accounts {accounts && `(${accounts.length}/5)`}
                </p>
              </div>
            </div>
            <Button
              onClick={handleConnectAccount}
              disabled={isConnecting || (accounts && accounts.length >= 5)}
              title={(accounts && accounts.length >= 5) ? 'Maximum of 5 accounts reached' : ''}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isConnecting ? 'Connecting...' : 'Add Account'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Account Limit Warning */}
        {accounts && accounts.length >= 5 && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  Account Limit Reached
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  You have reached the maximum of 5 Gmail accounts. To add a new account, please remove an existing one first.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>
              Manage your Gmail accounts and view email statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : accounts && accounts.length > 0 ? (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <Link
                    key={account.id}
                    href={`/dashboard/accounts/${account.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {account.email}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <span>{account._count?.emails || 0} emails</span>
                            {account.lastSyncedAt && (
                              <span>
                                Last synced:{' '}
                                {new Date(account.lastSyncedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {account.isActive ? (
                          <Badge variant="success" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            toggleActiveMutation.mutate({
                              id: account.id,
                              isActive: !account.isActive,
                            });
                          }}
                          disabled={toggleActiveMutation.isPending}
                        >
                          {account.isActive ? 'Deactivate' : 'Activate'}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(account.id);
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No Gmail accounts connected yet
                </p>
                <Button onClick={handleConnectAccount}>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Your First Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    }>
      <AccountsPageContent />
    </Suspense>
  );
}
