'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Tag,
  RefreshCw,
  Settings,
  TrendingUp,
  AlertCircle,
  Users,
  Plus
} from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  _count: {
    emails: number;
  };
}

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);

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
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Sync failed');
        setIsSyncing(false);
        return;
      }

      // Refresh stats after sync
      window.location.reload();
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to sync emails. Please try again.');
      setIsSyncing(false);
    }
  };

  const canSync = (categories?.length || 0) >= 2;

  if (categoriesLoading) {
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="w-[70vw] sm:w-auto">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI Email Sorter
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Intelligent email organization dashboard
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Button
                onClick={handleSync}
                disabled={isSyncing || !canSync}
                variant="outline"
                size="sm"
                title={!canSync ? 'Create at least 2 categories to start syncing' : ''}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Emails'}
              </Button>
              <Link href="/dashboard/settings" className="w-full sm:w-auto">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Warning Banner for Insufficient Categories */}
        {!canSync && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  Setup Required: Create Categories
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  You need at least 2 categories before syncing emails. Categories help AI organize your emails automatically.
                </p>
                <Link href="/dashboard/categories">
                  <Button size="sm" variant="outline" className="border-yellow-600 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900/40">
                    <Tag className="h-4 w-4 mr-2" />
                    Create Categories Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Link href="/dashboard/accounts" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  View Accounts
                </CardTitle>
                <CardDescription>Manage your Gmail accounts and emails</CardDescription>
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

        {/* Email Categories Section */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Email Categories
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select any category below to view your emails
          </p>
        </div>

        {/* Categories Grid */}
        {categories && categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/dashboard/emails?categoryId=${category.id}`}
                className="block"
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        >
                          <Tag className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
                            {category.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {category.description || `emails that talks about ${category.name.toLowerCase()}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {category._count?.emails || 0} emails
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create at least 2 categories to start organizing your emails
              </p>
              <Link href="/dashboard/categories">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Category
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
