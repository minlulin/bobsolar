'use client';

import { useState } from 'react';
import { Plus, Search, Loader2, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuotationCard } from '@/components/quotations/quotation-card';
import { useQuotations } from '@/hooks/use-quotations';
import { useRouter } from 'next/navigation';
import { type QuotationStatus, quotationStatusEnum } from '@/lib/db/schema';

const TABS: { id: string; label: string; status?: QuotationStatus }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts', status: 'draft' },
  { id: 'sent', label: 'Sent', status: 'sent' },
  { id: 'accepted', label: 'Accepted', status: 'accepted' },
  { id: 'rejected', label: 'Rejected', status: 'rejected' },
];

export default function QuotationsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');

  const { data: response, isLoading } = useQuotations({
    search,
    status:
      status === 'all'
        ? undefined
        : (status as QuotationStatus),
  });

  const quotations = response?.success ? response.data.items : [];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            Quotations
          </h1>
          <p className="text-muted-foreground">
            Create and manage professional solar quotes for your clients.
          </p>
        </div>
        <Button
          onClick={() => router.push('/quotations/new')}
          className="bg-solar shadow-solar hover:bg-solar/90 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Quote
        </Button>
      </div>

      {/* Filters & Tabs Section */}
      <div className="flex flex-col gap-6">
        <Tabs defaultValue="all" className="w-full" onValueChange={setStatus}>
          <TabsList className="h-11 w-full justify-start gap-2 border-b border-white/5 bg-transparent p-0">
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
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-solar h-8 w-8 animate-spin" />
        </div>
      ) : quotations.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {quotations.map((quote) => (
            <QuotationCard key={quote.id} quotation={quote} />
          ))}
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/5 bg-white/5 py-24 text-center">
          <div className="text-muted-foreground flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
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
              onClick={() => router.push('/quotations/new')}
            >
              Create your first quote
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
