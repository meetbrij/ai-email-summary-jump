'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Mail,
  Search,
  Filter,
  ChevronLeft,
  Calendar,
  User,
  Trash2,
  CheckSquare,
  Square,
  Inbox,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Email {
  id: string;
  gmailId: string;
  subject: string;
  from: string;
  summary: string | null;
  archived: boolean;
  receivedAt: string;
  category: {
    id: string;
    name: string;
    color: string;
  } | null;
  gmailAccount: {
    email: string;
  };
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface GmailAccount {
  id: string;
  email: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  _count: {
    emails: number;
  };
}

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

function EmailsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get('categoryId') || 'all'
  );
  const [selectedAccount, setSelectedAccount] = useState<string>(
    searchParams.get('gmailAccountId') || 'all'
  );
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state with URL changes (for browser back/forward navigation)
  useEffect(() => {
    const categoryId = searchParams.get('categoryId');
    const gmailAccountId = searchParams.get('gmailAccountId');

    if (categoryId) {
      setSelectedCategory(categoryId);
    } else {
      setSelectedCategory('all');
    }

    if (gmailAccountId) {
      setSelectedAccount(gmailAccountId);
    } else {
      setSelectedAccount('all');
    }
  }, [searchParams]);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/emails/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: gmailAccounts } = useQuery<GmailAccount[]>({
    queryKey: ['gmail-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/gmail/accounts');
      if (!res.ok) throw new Error('Failed to fetch Gmail accounts');
      return res.json();
    },
  });

  const { data: emails, isLoading } = useQuery<Email[]>({
    queryKey: ['emails', selectedCategory, selectedAccount],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('categoryId', selectedCategory);
      if (selectedCategory === 'uncategorized') params.set('uncategorized', 'true');
      if (selectedAccount !== 'all') params.set('gmailAccountId', selectedAccount);
      params.set('archived', 'false'); // Always show non-archived emails

      const res = await fetch(`/api/emails?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch emails');
      return res.json();
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (emailIds: string[]) => {
      const res = await fetch('/api/emails/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds }),
      });
      if (!res.ok) throw new Error('Failed to delete emails');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      setSelectedEmails(new Set());
      setShowDeleteConfirm(false);

      if (data.warning) {
        toast.error(data.warning);
      } else {
        toast.success('Emails deleted successfully from both app and Gmail');
      }
    },
    onError: () => {
      toast.error('Failed to delete emails');
    },
  });

  const handleSelectAll = () => {
    if (selectedEmails.size === filteredEmails?.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails?.map((e) => e.id) || []));
    }
  };

  const handleSelectEmail = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedEmails.size > 0) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedEmails));
  };

  const filteredEmails = emails?.filter((email) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.from.toLowerCase().includes(query) ||
      email.summary?.toLowerCase().includes(query)
    );
  });

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
                  Emails
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredEmails?.length || 0} emails found
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search emails..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Category
                  </label>
                  <Select
                    value={selectedCategory}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setSelectedCategory(newValue);

                      // Update URL params
                      const params = new URLSearchParams(searchParams.toString());
                      if (newValue === 'all') {
                        params.delete('categoryId');
                        params.delete('uncategorized');
                      } else if (newValue === 'uncategorized') {
                        params.delete('categoryId');
                        params.set('uncategorized', 'true');
                      } else {
                        params.delete('uncategorized');
                        params.set('categoryId', newValue);
                      }

                      // Update URL
                      const newUrl = params.toString()
                        ? `/dashboard/emails?${params.toString()}`
                        : '/dashboard/emails';
                      router.push(newUrl);
                    }}
                  >
                    <option value="all">All Categories</option>
                    <option value="uncategorized">Uncategorized</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Account Filter */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Account
                  </label>
                  <Select
                    value={selectedAccount}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setSelectedAccount(newValue);

                      // Update URL params
                      const params = new URLSearchParams(searchParams.toString());
                      if (newValue === 'all') {
                        params.delete('gmailAccountId');
                      } else {
                        params.set('gmailAccountId', newValue);
                      }

                      // Update URL
                      const newUrl = params.toString()
                        ? `/dashboard/emails?${params.toString()}`
                        : '/dashboard/emails';
                      router.push(newUrl);
                    }}
                  >
                    <option value="all">All Accounts</option>
                    {gmailAccounts?.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.email} ({account._count.emails})
                      </option>
                    ))}
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email List */}
          <div className="lg:col-span-3">
            {/* Bulk Actions Toolbar */}
            {selectedEmails.size > 0 && (
              <Card className="mb-4 bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {selectedEmails.size} email(s) selected
                    </span>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedEmails(new Set())}
                      >
                        Clear Selection
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <Card className="max-w-md w-full mx-4">
                  <CardHeader>
                    <CardTitle>Confirm Delete</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Are you sure you want to delete {selectedEmails.size} email(s)?
                      This will remove them from both the app and Gmail (move to trash).
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={bulkDeleteMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={confirmDelete}
                        disabled={bulkDeleteMutation.isPending}
                      >
                        {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Select All Checkbox */}
            {filteredEmails && filteredEmails.length > 0 && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {selectedEmails.size === filteredEmails.length ? (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                  Select All
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : filteredEmails && filteredEmails.length > 0 ? (
              <div className="space-y-4">
                {filteredEmails.map((email) => (
                  <Card
                    key={email.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectEmail(email.id);
                          }}
                          className="mt-1"
                        >
                          {selectedEmails.has(email.id) ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>

                        {/* Email Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white mb-1 break-words">
                                {email.subject}
                              </h3>
                              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-1 break-all">
                                  <User className="h-3 w-3 flex-shrink-0" />
                                  <span className="break-all">{email.from}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 flex-shrink-0" />
                                  <span>{new Date(email.receivedAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-1 break-all">
                                  <Mail className="h-3 w-3 flex-shrink-0" />
                                  <span className="break-all">{email.gmailAccount.email}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {email.category && (
                                <Badge
                                  style={{
                                    backgroundColor: email.category.color,
                                  }}
                                >
                                  {email.category.name}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {email.summary && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                              {email.summary}
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <Link href={`/dashboard/emails/${email.id}`}>
                              <Button size="sm" variant="outline">
                                View Details
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No emails found matching your filters.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function EmailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    }>
      <EmailsPageContent />
    </Suspense>
  );
}
