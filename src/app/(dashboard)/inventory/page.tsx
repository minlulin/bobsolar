'use client';

import { useState } from 'react';
import { useInventoryItems } from '@/hooks/use-inventory';
import { InventoryCard } from '@/components/inventory/inventory-card';
import { InventoryDialog } from '@/components/inventory/inventory-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Loader2, PackageSearch } from 'lucide-react';
import {
  type InventoryItem,
  inventoryCategoryEnum,
  type InventoryItem as DBInventoryItem,
} from '@/lib/db/schema';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';
// If ui-store doesn't have role, we might need a separate auth hook/store.
// For now, I'll assume all users can see, but only admin can edit (handled in server actions)
// I'll check user role from a mock or session if possible.

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const { data: response, isLoading } = useInventoryItems({
    search,
    category: category as DBInventoryItem['category'],
  });

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
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
        <Button
          onClick={handleAddNew}
          className="bg-solar shadow-glow-solar group text-white"
        >
          <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
          Add New Item
        </Button>
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search items, brands, models..."
            className="glass pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat === 'all' ? null : cat)}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
                category === cat || (cat === 'all' && category === null)
                  ? 'bg-solar shadow-glow-solar border-transparent text-white'
                  : 'bg-card/50 text-muted-foreground border-border hover:bg-card',
              )}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="text-solar-amber h-10 w-10 animate-spin" />
          <p className="text-muted-foreground animate-pulse">
            Scanning inventory...
          </p>
        </div>
      ) : response?.success && response.data.items.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {response.data.items.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              canEdit={true} // In real app, check role
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
            We couldn&apos;t find any items matching your search or filters.
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

      <InventoryDialog
        item={editingItem}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}
