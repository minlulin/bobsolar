'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Customer, Quotation } from '@/lib/db/schema';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

import { useQuotation } from '@/hooks/use-quotations';
import { useConvertToProject } from '@/hooks/use-projects';

type QuotationDraft = Quotation & {
  customer: Customer;
  project: { id: string } | null;
};

function defaultInstallationSite(quotation: QuotationDraft): string {
  const parts = [quotation.customer.address, quotation.customer.city]
    .map((fragment) => (fragment ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

function QuotationConversionForm({
  quoteId,
  quotation,
}: {
  quoteId: string;
  quotation: QuotationDraft;
}): React.JSX.Element | null {
  const router = useRouter();
  const convertProject = useConvertToProject();

  const [siteAddress, setSiteAddress] = React.useState(() =>
    defaultInstallationSite(quotation),
  );
  const [systemSize, setSystemSize] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (quotation.project) {
      router.replace(`/projects/${quotation.project.id}`);
    }
  }, [quotation.project, router]);

  if (quotation.project) return null;

  function handleSubmit(ev: React.SyntheticEvent): void {
    ev.preventDefault();
    convertProject.mutate(
      {
        quotationId: quoteId,
        siteAddress,
        systemSizeKwp: systemSize ? Number(systemSize) : undefined,
        notes,
      },
      {
        onSuccess: (res) => {
          if (res.success) router.replace(`/projects/${res.data.id}`);
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-7 rounded-[2rem] border border-white/15 bg-black/45 px-10 py-12 backdrop-blur"
    >
      <div className="space-y-2">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.45em] uppercase">
          Originating blueprint ·{' '}
          <span className="text-orange-400">{quotation.quoteNumber}</span>
        </p>
        <h1 className="font-heading text-3xl tracking-tighter text-white uppercase">
          Convert to orbital project
        </h1>
        <p className="text-muted-foreground text-sm">
          Client ·{' '}
          <span className="text-emerald-200">{quotation.customer.name}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label>Site dossier · address narrative</Label>
        <Textarea
          rows={5}
          value={siteAddress}
          onChange={(e) => { setSiteAddress(e.target.value); }}
          required
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label>System sizing · kWp (optional)</Label>
          <Input
            placeholder="Eg. 5.5"
            type="number"
            step={0.1}
            value={systemSize}
            onChange={(e) => { setSystemSize(e.target.value); }}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Risk chatter / logistics overlays</Label>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => { setNotes(e.target.value); }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          asChild
        >
          <Link href={`/quotations/${quoteId}`}>Abort</Link>
        </Button>
        <Button
          className="rounded-full bg-gradient-to-r from-orange-500 to-orange-700 px-10 font-bold uppercase"
          disabled={convertProject.isPending || !siteAddress.trim()}
          type="submit"
        >
          {convertProject.isPending ? (
            <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          ) : null}
          Launch commissioning
        </Button>
      </div>
    </form>
  );
}

function ConversionFlow(): React.JSX.Element | null {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quoteId');

  const {
    data: quotation,
    isFetching,
    error,
    isError,
  } = useQuotation(quoteId ?? '');

  if (!quoteId) {
    return (
      <div className="border-border rounded-[2rem] border bg-black/55 p-10 text-center text-sm leading-relaxed">
        Anchor this flow from{' '}
        <span className="text-orange-400">Convert to Project</span> on accepted
        quotes OR append <code>?quoteId=uuid</code> when deep-linking.
        <Button
          asChild
          variant="outline"
          className="mt-6 rounded-full border-white/35"
        >
          <Link href="/quotations">Quotations constellation</Link>
        </Button>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="flex h-[62vh] items-center justify-center">
        <Loader2 className="text-solar h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-border rounded-[2rem] border bg-black/65 p-10 text-center">
        {error instanceof Error ? error.message : 'Unable to open quote'}
        <div className="mt-4">
          <Button asChild variant="ghost">
            <Link href={`/quotations/${quoteId}`}>Back to blueprint</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!quotation) return null;

  if (quotation.status !== 'accepted') {
    return (
      <div className="border-border rounded-[2rem] border bg-black/70 p-10 text-center leading-relaxed text-white">
        This conversion gate opens after the customer signs off on acceptance.
      </div>
    );
  }

  return (
    <QuotationConversionForm
      key={quotation.id}
      quoteId={quoteId}
      quotation={quotation}
    />
  );
}

export default function ConvertProjectBlueprintPage(): React.JSX.Element {
  return (
    <div className="space-y-6 pb-36">
      <Suspense
        fallback={
          <div className="flex h-[62vh] items-center justify-center">
            <Loader2 className="text-solar h-10 w-10 animate-spin" />
          </div>
        }
      >
        <ConversionFlow />
      </Suspense>
    </div>
  );
}
