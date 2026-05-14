'use client';

import React, { useMemo, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuotationCard } from '@/components/quotations/quotation-card';
import { useQuotations } from '@/hooks/use-quotations';
import { useRouter, useSearchParams } from 'next/navigation';
import { type QuotationStatus } from '@/lib/db/schema';
import { ListGridSkeleton } from '@/components/skeletons/list-grid-skeleton';
import { useDebounce } from '@/hooks/use-debounce';
import type { QuotationWithCustomer } from '@/actions/quotation-actions';

const TABS: { id: string; label: string; status?: QuotationStatus }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts', status: 'draft' },
  { id: 'sent', label: 'Sent', status: 'sent' },
  { id: 'accepted', label: 'Accepted', status: 'accepted' },
  { id: 'rejected', label: 'Rejected', status: 'rejected' },
  { id: 'archive', label: 'Archive' },
];

interface QuotationsGridClientProps {
  initialData: {
    items: QuotationWithCustomer[];
    total: number;
  };
}

export function QuotationsGridClient({
  initialData,
}: QuotationsGridClientProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const debouncedSearch = useDebounce(search, 300);
  const page = Number(searchParams.get('page') ?? '1');
  const currentPage = Number.isNaN(page) || page < 1 ? 1 : page;
  const limit = 20;

  const queryFilters = useMemo(() => {
    const selectedTab = TABS.find((tab) => tab.id === status);
    return {
      search: debouncedSearch,
      archived: status === 'archive' ? true : false,
      status: selectedTab?.status,
      page: currentPage,
      limit,
    };
  }, [currentPage, debouncedSearch, status]);

  const isDefault = status === 'all' && !debouncedSearch && currentPage === 1;
  const { data: response, isLoading } = useQuotations(
    queryFilters,
    isDefault ? initialData : undefined,
  );

  const quotations = response?.items ?? [];
  const total = response?.total ?? 0;
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage * limit < total;

  const navigatePage = (nextPage: number): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`/quotations?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Tabs Section */}
      <div className="flex flex-col gap-6">
        <Tabs defaultValue="all" className="w-full" onValueChange={setStatus}>
          <TabsList className="border-border/60 h-11 w-full justify-start gap-2 border-b bg-transparent p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="text-muted-foreground data-[state=active]:border-solar data-[state=active]:text-solar relative h-11 rounded-none border-b-2 border-transparent bg-transparent px-4 pt-2 pb-3 font-medium transition-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by quote number..."
            className="pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <ListGridSkeleton count={8} />
      ) : quotations.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quotations.map((quote) => (
            <QuotationCard key={quote.id} quotation={quote} />
          ))}
        </div>
      ) : (
        <div className="border-border/60 bg-muted/45 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center">
          <div className="text-muted-foreground bg-muted/45 flex h-20 w-20 items-center justify-center rounded-full">
            <FileText className="h-10 w-10 opacity-20" />
          </div>
          <h3 className="text-foreground mt-6 text-xl font-semibold">
            No quotations found
          </h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {search || status !== 'all'
              ? "We couldn't find any quotations matching your filters."
              : 'Start by creating your first solar quotation for a customer.'}
          </p>
          {!search && status === 'all' && (
            <Button
              variant="link"
              className="text-solar hover:text-solar/80 mt-4"
              onClick={() => {
                router.push('/quotations/new');
              }}
            >
              Create your first quote
            </Button>
          )}
        </div>
      )}

      {quotations.length > 0 && (
        <div className="border-border/60 flex items-center justify-between border-t pt-4">
          <p className="text-muted-foreground text-sm">
            Page {currentPage} of {Math.max(1, Math.ceil(total / limit))}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigatePage(currentPage - 1);
              }}
              disabled={!hasPrevious}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigatePage(currentPage + 1);
              }}
              disabled={!hasNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
