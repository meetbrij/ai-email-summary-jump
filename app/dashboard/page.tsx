'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Mail,
  Inbox,
  Archive,
  Tag,
  TrendingUp,
  RefreshCw,
  Settings,
  LogOut
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface DashboardStats {
  totalEmails: number;
  categorizedEmails: number;
  uncategorizedEmails: number;
  archivedEmails: number;
  categoriesCount: number;
  gmailAccountsCount: number;
  recentActivity: {
    date: string;
    count: number;
  }[];
}

interface Category {
  id: string;
  name: string;
  color: string;
  _count: {
    emails: number;
  };
}

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/emails/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      // Refresh stats after sync
      window.location.reload();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/process', { method: 'POST' });
      if (!res.ok) throw new Error('Process failed');
      // Refresh stats after processing
      window.location.reload();
    } catch (error) {
      console.error('Process error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (statsLoading || categoriesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI Email Sorter
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Intelligent email organization dashboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSync}
                disabled={isSyncing || isProcessing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Emails'}
              </Button>
              <Button
                onClick={handleProcess}
                disabled={isProcessing || isSyncing}
                variant="outline"
                size="sm"
              >
                <TrendingUp className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                {isProcessing ? 'Processing...' : 'Process Emails'}
              </Button>
              <Link href="/dashboard/settings">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <Button
                onClick={() => signOut({ callbackUrl: '/login' })}
                variant="outline"
                size="sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
              <Mail className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalEmails || 0}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Across all accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categorized</CardTitle>
              <Tag className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.categorizedEmails || 0}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {stats?.totalEmails
                  ? Math.round((stats.categorizedEmails / stats.totalEmails) * 100)
                  : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uncategorized</CardTitle>
              <Inbox className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.uncategorizedEmails || 0}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Need processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Archived</CardTitle>
              <Archive className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.archivedEmails || 0}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Cleaned up
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Link href="/dashboard/emails" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Inbox className="h-5 w-5 mr-2 text-blue-600" />
                  View Emails
                </CardTitle>
                <CardDescription>Browse and manage your emails</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/categories" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tag className="h-5 w-5 mr-2 text-green-600" />
                  Manage Categories
                </CardTitle>
                <CardDescription>Create and edit email categories</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/unsubscribe" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
                  Unsubscribe
                </CardTitle>
                <CardDescription>Manage newsletter subscriptions</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Categories Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Categories Overview</CardTitle>
            <CardDescription>
              Email distribution across your categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categories && categories.length > 0 ? (
              <div className="space-y-4">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {category.name}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {category._count?.emails || 0} emails
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No categories yet. Create your first category to start organizing emails.
                </p>
                <Link href="/dashboard/categories">
                  <Button>Create Category</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
