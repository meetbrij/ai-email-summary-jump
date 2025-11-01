'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import Link from 'next/link';

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

export default function EmailsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const { data: emails, isLoading } = useQuery<Email[]>({
    queryKey: ['emails', selectedCategory, showArchived],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('categoryId', selectedCategory);
      if (selectedCategory === 'uncategorized') params.set('uncategorized', 'true');
      params.set('archived', showArchived.toString());

      const res = await fetch(`/api/emails?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch emails');
      return res.json();
    },
  });

  const handleArchive = async (emailId: string, archived: boolean) => {
    try {
      const res = await fetch(`/api/emails/${emailId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error('Failed to archive email');
      // Refresh emails list
      window.location.reload();
    } catch (error) {
      console.error('Archive error:', error);
    }
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
                    onChange={(e) => setSelectedCategory(e.target.value)}
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

                {/* Show Archived */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showArchived"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label
                    htmlFor="showArchived"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Show Archived
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email List */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : filteredEmails && filteredEmails.length > 0 ? (
              <div className="space-y-4">
                {filteredEmails.map((email) => (
                  <Card
                    key={email.id}
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${
                      selectedEmail === email.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedEmail(email.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {email.subject}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {email.from}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(email.receivedAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {email.gmailAccount.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {email.category && (
                            <Badge
                              style={{
                                backgroundColor: email.category.color,
                              }}
                            >
                              {email.category.name}
                            </Badge>
                          )}
                          {email.archived && (
                            <Badge variant="secondary">Archived</Badge>
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
                        {email.archived ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchive(email.id, false);
                            }}
                          >
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Unarchive
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchive(email.id, true);
                            }}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </Button>
                        )}
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
