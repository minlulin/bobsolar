'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  FileCheck,
  Calculator,
  Settings2,
} from 'lucide-react';
import {
  createQuotationSchema,
  type CreateQuotation,
} from '@/lib/validators/quotation';
import { useCreateQuotation } from '@/hooks/use-quotations';
import { useInventoryItems } from '@/hooks/use-inventory';
import { useDebounce } from '@/hooks/use-debounce';
import { type InventoryItem } from '@/lib/db/schema';
import { calculateQuotation, formatMMK } from '@/lib/pricing/engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerSelector } from '@/components/quotations/customer-selector';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { motion, AnimatePresence } from 'framer-motion';

export default function NewQuotationPage() {
  const router = useRouter();
  const { mutate: createQuote, isPending: isSubmitting } = useCreateQuotation();

  const form = useForm<CreateQuotation>({
    resolver: zodResolver(createQuotationSchema),
    defaultValues: {
      customerId: '',
      items: [
        { description: '', quantity: 1, unitPrice: 0, discountPercentage: 0 },
      ],
      discountPercent: 0,
      taxPercent: 5,
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchAllFields = useWatch({ control: form.control });

  const pricing = calculateQuotation(
    (watchAllFields.items || []).map((item) => ({
      quantity: Number(item?.quantity || 0),
      unitPrice: Number(item?.unitPrice || 0),
      discountPercentage: Number(item?.discountPercentage || 0),
    })),
    Number(watchAllFields.discountPercent || 0),
    Number(watchAllFields.taxPercent || 0),
  );

  const handleCreate = (data: CreateQuotation) => {
    createQuote(data, {
      onSuccess: (res) => {
        if (res.success) router.push(`/quotations/${res.data.id}`);
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/quotations')}
            className="rounded-full bg-white/5 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">
              New Quotation
            </h1>
            <p className="text-muted-foreground text-sm">
              Draft a new proposal for your customer.
            </p>
          </div>
        </div>

        <Button
          onClick={(e) => {
            e.preventDefault();
            form.handleSubmit(handleCreate)(e);
          }}
          disabled={isSubmitting}
          className="bg-solar shadow-solar hover:bg-solar/90 text-white"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileCheck className="mr-2 h-4 w-4" />
          )}
          Save Quote
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-white/5 bg-white/5 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Plus className="text-solar h-5 w-5" /> Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-2">
                <label className="text-foreground text-sm font-medium">
                  Customer
                </label>
                <Controller
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <CustomerSelector
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </div>

              <Separator className="bg-white/5" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-solar text-xs font-bold tracking-widest uppercase">
                    Line Items
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      append({
                        description: '',
                        quantity: 1,
                        unitPrice: 0,
                        discountPercentage: 0,
                      })
                    }
                    className="text-solar hover:bg-solar/10"
                  >
                    Add Item
                  </Button>
                </div>

                <AnimatePresence mode="popLayout">
                  {fields.map((fieldItem, index) => (
                    <motion.div
                      key={fieldItem.id}
                      className="grid gap-4 rounded-xl border border-white/5 bg-white/5 p-4 sm:grid-cols-12"
                    >
                      <div className="sm:col-span-6">
                        <Controller
                          control={form.control}
                          name={`items.${index}.description` as const}
                          render={({ field }) => (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase opacity-50">
                                Description
                              </label>
                              <InventorySearchSelector
                                onSelect={(invItem) => {
                                  form.setValue(
                                    `items.${index}.description`,
                                    invItem.name,
                                  );
                                  form.setValue(
                                    `items.${index}.unitPrice`,
                                    parseFloat(invItem.unitPrice.toString()),
                                  );
                                  form.setValue(
                                    `items.${index}.itemId`,
                                    invItem.id,
                                  );
                                }}
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </div>
                          )}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Controller
                          control={form.control}
                          name={`items.${index}.quantity` as const}
                          render={({ field }) => (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase opacity-50">
                                Qty
                              </label>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          )}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Controller
                          control={form.control}
                          name={`items.${index}.unitPrice` as const}
                          render={({ field }) => (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase opacity-50">
                                Price
                              </label>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          )}
                        />
                      </div>
                      <div className="flex items-end justify-center sm:col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="text-muted-foreground hover:text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-white/5">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <Textarea
                    placeholder="Include warranty terms, validity period, or special instructions..."
                    className="min-h-[120px] border-white/10 bg-transparent"
                    {...field}
                    value={field.value || ''}
                  />
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24 overflow-hidden border-white/5 bg-white/10 shadow-2xl">
            <div className="bg-solar h-1.5 w-full" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Calculator className="text-solar h-5 w-5" /> Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-white">
                    {formatMMK(pricing.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground text-sm">
                    Discount (%)
                  </span>
                  <Input
                    type="number"
                    className="h-8 w-20 bg-white/5 text-right"
                    {...form.register('discountPercent', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground text-sm">Tax (%)</span>
                  <Input
                    type="number"
                    className="h-8 w-20 bg-white/5 text-right"
                    {...form.register('taxPercent', { valueAsNumber: true })}
                  />
                </div>
              </div>
              <Separator className="bg-white/5" />
              <div className="flex flex-col gap-1 pt-2">
                <span className="text-solar text-xs font-bold tracking-widest uppercase">
                  Total Amount
                </span>
                <span className="font-heading text-3xl font-bold text-white">
                  {formatMMK(pricing.total)}
                </span>
              </div>
              <div className="bg-solar/10 text-solar flex items-start gap-2 rounded-lg p-3 text-xs">
                <Settings2 className="h-4 w-4 shrink-0" />
                <p>Prices are snapshots from current inventory.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InventorySearchSelector({
  onSelect,
  value,
  onChange,
}: {
  onSelect: (item: InventoryItem) => void;
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data: response, isLoading } = useInventoryItems({
    search: debouncedSearch,
  });
  const items = response?.success ? response.data.items : [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          placeholder="Search inventory..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSearch(e.target.value);
            setOpen(true);
          }}
          className="border-white/10 bg-white/5"
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading && (
              <div className="p-4 text-center">
                <Loader2 className="text-solar inline h-4 w-4 animate-spin" />
              </div>
            )}
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="text-muted-foreground flex w-full justify-between text-[10px]">
                    <span>{item.brand}</span>
                    <span className="text-solar font-bold">
                      {formatMMK(parseFloat(item.unitPrice.toString()))}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
