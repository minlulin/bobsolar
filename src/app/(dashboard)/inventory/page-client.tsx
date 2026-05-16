'use client';

import { useState } from 'react';
import { useInventoryItems } from '@/hooks/use-inventory';
import dynamic from 'next/dynamic';
import { InventoryCard } from '@/components/inventory/inventory-card';

const InventoryDialog = dynamic(
  () =>
    import('@/components/inventory/inventory-dialog').then(
      (mod) => mod.InventoryDialog,
    ),
  { ssr: false },
);
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, PackageSearch } from 'lucide-react';
import { type InventoryItem, inventoryCategoryEnum } from '@/lib/db/schema';
import { motion } from 'motion/react';
import { staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { ListGridSkeleton } from '@/components/skeletons/list-grid-skeleton';

type InventoryPageClientProps = {
  canEdit: boolean;
};

type PaginatedItems = { items: InventoryItem[]; total: number };

export function InventoryPageClient({
  canEdit,
}: InventoryPageClientProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const { data: rawResponse, isLoading } = useInventoryItems({
    search,
    category: category as InventoryItem['category'] | undefined,
    limit: 50,
  });

  const response = rawResponse as PaginatedItems | undefined;

  const handleEdit = (item: InventoryItem): void => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleAddNew = (): void => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const categories = ['all', ...inventoryCategoryEnum.enumValues];

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">
            Inventory & Pricing
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your solar components, prices, and stock levels.
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAddNew} className="bg-solar group text-white">
            <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
            Add New Item
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search items, brands, models..."
            className="glass pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>

        <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat === 'all' ? null : cat);
              }}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
                category === cat || (cat === 'all' && category === null)
                  ? 'bg-solar border-transparent text-white'
                  : 'bg-card/50 text-muted-foreground border-border hover:bg-card',
              )}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ListGridSkeleton count={8} />
      ) : response && response.items.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {response.items.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onEdit={handleEdit}
            />
          ))}
        </motion.div>
      ) : (
        <div className="glass flex flex-col items-center justify-center rounded-3xl border-dashed py-32 text-center">
          <div className="bg-muted/20 mb-4 rounded-full p-4">
            <PackageSearch className="text-muted-foreground h-12 w-12" />
          </div>
          <h3 className="text-xl font-semibold">No items found</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            We couldn&lsquo;t find any items matching your search or filters.
          </p>
          <Button
            variant="link"
            className="text-solar-amber mt-4"
            onClick={() => {
              setSearch('');
              setCategory(null);
            }}
          >
            Clear all filters
          </Button>
        </div>
      )}

      {canEdit && isDialogOpen && (
        <InventoryDialog
          item={editingItem}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </div>
  );
}
