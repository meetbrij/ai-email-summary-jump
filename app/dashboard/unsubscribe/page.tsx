'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  ChevronLeft,
  Search,
  Mail,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface EmailWithUnsubscribe {
  id: string;
  subject: string;
  from: string;
  unsubscribeLink: string;
  unsubscribeMethod: string | null;
  receivedAt: string;
  unsubscribeAttempts: {
    id: string;
    status: string;
    method: string | null;
    errorMessage: string | null;
    attemptedAt: string;
  }[];
}

export default function UnsubscribePage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'success' | 'failed'>('all');

  const { data: emails, isLoading } = useQuery<EmailWithUnsubscribe[]>({
    queryKey: ['unsubscribe-emails'],
    queryFn: async () => {
      const res = await fetch('/api/emails/unsubscribe');
      if (!res.ok) throw new Error('Failed to fetch emails');
      return res.json();
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const res = await fetch(`/api/emails/${emailId}/unsubscribe`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to unsubscribe');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unsubscribe-emails'] });
      toast.success('Unsubscribe initiated');
    },
    onError: () => {
      toast.error('Failed to unsubscribe');
    },
  });

  const getLatestAttempt = (email: EmailWithUnsubscribe) => {
    if (email.unsubscribeAttempts.length === 0) return null;
    return email.unsubscribeAttempts.reduce((latest, current) =>
      new Date(current.attemptedAt) > new Date(latest.attemptedAt) ? current : latest
    );
  };

  const filteredEmails = emails?.filter((email) => {
    const matchesSearch =
      !searchQuery ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;

    const latestAttempt = getLatestAttempt(email);
    if (!latestAttempt && filterStatus === 'pending') return true;
    if (latestAttempt && latestAttempt.status === filterStatus) return true;

    return false;
  });

  const stats = {
    total: emails?.length || 0,
    pending: emails?.filter(e => getLatestAttempt(e)?.status === 'pending' || !getLatestAttempt(e)).length || 0,
    success: emails?.filter(e => getLatestAttempt(e)?.status === 'success').length || 0,
    failed: emails?.filter(e => getLatestAttempt(e)?.status === 'failed').length || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                  Unsubscribe Manager
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage newsletter subscriptions
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Mail className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Success</p>
                  <p className="text-2xl font-bold">{stats.success}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('all')}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'pending' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('pending')}
                >
                  Pending
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'success' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('success')}
                >
                  Success
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'failed' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('failed')}
                >
                  Failed
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : filteredEmails && filteredEmails.length > 0 ? (
          <div className="space-y-4">
            {filteredEmails.map((email) => {
              const latestAttempt = getLatestAttempt(email);
              const status = latestAttempt?.status || 'none';

              return (
                <Card key={email.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {email.subject}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          From: {email.from}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>
                            Received: {new Date(email.receivedAt).toLocaleDateString()}
                          </span>
                          {email.unsubscribeMethod && (
                            <Badge variant="secondary" className="text-xs">
                              Method: {email.unsubscribeMethod}
                            </Badge>
                          )}
                        </div>

                        {latestAttempt && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <div className="flex items-center gap-2 mb-1">
                              {status === 'success' && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                              {status === 'failed' && (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              {status === 'pending' && (
                                <Clock className="h-4 w-4 text-yellow-500" />
                              )}
                              <span className="text-sm font-medium">
                                Last attempt:{' '}
                                {new Date(latestAttempt.attemptedAt).toLocaleString()}
                              </span>
                            </div>
                            {latestAttempt.errorMessage && (
                              <p className="text-xs text-red-600 dark:text-red-400">
                                {latestAttempt.errorMessage}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {status === 'success' ? (
                          <Badge variant="success">Unsubscribed</Badge>
                        ) : (
                          <>
                            <a
                              href={email.unsubscribeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Manual
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              onClick={() => unsubscribeMutation.mutate(email.id)}
                              disabled={unsubscribeMutation.isPending || status === 'pending'}
                            >
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Auto Unsubscribe
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || filterStatus !== 'all'
                  ? 'No emails found matching your filters.'
                  : 'No emails with unsubscribe links found.'}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
