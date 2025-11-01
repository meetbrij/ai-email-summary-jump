'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  ChevronLeft,
  Calendar,
  User,
  Mail,
  Tag,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import DOMPurify from 'isomorphic-dompurify';

interface Email {
  id: string;
  gmailId: string;
  subject: string;
  from: string;
  body: string;
  bodyTruncated: boolean;
  summary: string | null;
  unsubscribeLink: string | null;
  unsubscribeMethod: string | null;
  archived: boolean;
  receivedAt: string;
  category: {
    id: string;
    name: string;
    color: string;
  } | null;
  categoryId: string | null;
  gmailAccount: {
    email: string;
  };
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function EmailDetailPage() {
  const params = useParams();
  const emailId = params.id as string;
  const queryClient = useQueryClient();

  const { data: email, isLoading } = useQuery<Email>({
    queryKey: ['email', emailId],
    queryFn: async () => {
      const res = await fetch(`/api/emails/${emailId}`);
      if (!res.ok) throw new Error('Failed to fetch email');
      return res.json();
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (categoryId: string | null) => {
      const res = await fetch(`/api/emails/${emailId}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) throw new Error('Failed to update category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', emailId] });
      toast.success('Category updated successfully');
    },
    onError: () => {
      toast.error('Failed to update category');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      const res = await fetch(`/api/emails/${emailId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error('Failed to archive email');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', emailId] });
      toast.success(email?.archived ? 'Email unarchived' : 'Email archived');
    },
    onError: () => {
      toast.error('Failed to archive email');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Email not found</p>
      </div>
    );
  }

  const sanitizedBody = DOMPurify.sanitize(email.body, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard/emails">
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Emails
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              {email.archived ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => archiveMutation.mutate(false)}
                  disabled={archiveMutation.isPending}
                >
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Unarchive
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => archiveMutation.mutate(true)}
                  disabled={archiveMutation.isPending}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Email Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-3">{email.subject}</CardTitle>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">From:</span> {email.from}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="font-medium">Account:</span>{' '}
                    {email.gmailAccount.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">Received:</span>{' '}
                    {new Date(email.receivedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              {email.archived && <Badge variant="secondary">Archived</Badge>}
            </div>

            {/* Category Selection */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                <Tag className="h-4 w-4 inline mr-2" />
                Category
              </label>
              <div className="flex items-center gap-3">
                <Select
                  value={email.categoryId || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateCategoryMutation.mutate(value === '' ? null : value);
                  }}
                  className="max-w-xs"
                >
                  <option value="">Uncategorized</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                {email.category && (
                  <Badge style={{ backgroundColor: email.category.color }}>
                    {email.category.name}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* AI Summary */}
        {email.summary && (
          <Card className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300">{email.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Email Body */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Email Content</CardTitle>
            {email.bodyTruncated && (
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                This email was truncated due to size limits. Some content may be missing.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizedBody }}
            />
          </CardContent>
        </Card>

        {/* Unsubscribe Info */}
        {email.unsubscribeLink && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Unsubscribe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    This email contains an unsubscribe link
                  </p>
                  <Badge variant="secondary">
                    Method: {email.unsubscribeMethod || 'link'}
                  </Badge>
                </div>
                <a
                  href={email.unsubscribeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Unsubscribe
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
