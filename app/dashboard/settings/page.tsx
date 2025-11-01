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
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

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

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery<GmailAccount[]>({
    queryKey: ['gmail-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/gmail/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      return res.json();
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/gmail/connect');
      if (!res.ok) throw new Error('Failed to initiate connection');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: () => {
      toast.error('Failed to connect Gmail account');
    },
  });

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
                  Settings
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage your Gmail accounts and preferences
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Gmail Accounts Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Gmail Accounts</CardTitle>
                <CardDescription>
                  Connect and manage your Gmail accounts
                </CardDescription>
              </div>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : accounts && accounts.length > 0 ? (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
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
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: account.id,
                            isActive: !account.isActive,
                          })
                        }
                        disabled={toggleActiveMutation.isPending}
                      >
                        {account.isActive ? 'Deactivate' : 'Activate'}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(account.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No Gmail accounts connected yet
                </p>
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Your First Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Settings</CardTitle>
            <CardDescription>
              Configure how emails are synchronized
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    Auto-categorize new emails
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically categorize emails using AI when syncing
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    Generate AI summaries
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create AI-powered summaries for all emails
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    Detect unsubscribe links
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Identify and extract unsubscribe links from newsletters
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
