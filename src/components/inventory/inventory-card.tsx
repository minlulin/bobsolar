'use client';

import { useState } from 'react';
import { type InventoryItem } from '@/lib/db/schema';
import { formatMMK, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package,
  Edit,
  Trash2,
  Box,
  Cpu,
  Battery,
  Layers,
  Zap,
  Wrench,
  User,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  useUpdateInventoryItem,
  useDeleteInventoryItem,
} from '@/hooks/use-inventory';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { STOCK_WARNING_THRESHOLDS } from '@/lib/constants';

interface InventoryCardProps {
  item: InventoryItem;
  canEdit: boolean;
  onEdit: (item: InventoryItem) => void;
}

const categoryIcons: Record<string, LucideIcon> = {
  panel: Zap,
  inverter: Cpu,
  battery: Battery,
  mounting: Layers,
  cable: Box,
  accessory: Wrench,
  labor: User,
};

export function InventoryCard({ item, canEdit, onEdit }: InventoryCardProps) {
  const Icon = categoryIcons[item.category] || Package;
  const { mutate: updateItem, isPending: isUpdating } =
    useUpdateInventoryItem();
  const { mutate: deleteItem } = useDeleteInventoryItem();

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [price, setPrice] = useState(item.unitPrice.toString());
  const [stock, setStock] = useState(item.stockQty.toString());

  const getStockColor = (qty: number) => {
    const threshold =
      STOCK_WARNING_THRESHOLDS[item.category] ??
      STOCK_WARNING_THRESHOLDS.default;
    if (qty === 0) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (qty <= threshold)
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  };

  const handlePriceSave = () => {
    const val = parseFloat(price);
    if (isNaN(val) || val < 0) {
      toast.error('Invalid unit price');
      setPrice(item.unitPrice.toString());
      setIsEditingPrice(false);
      return;
    }
    if (val !== Number(item.unitPrice)) {
      updateItem({ id: item.id, data: { unitPrice: val } });
    }
    setIsEditingPrice(false);
  };

  const handleStockSave = () => {
    const val = parseInt(stock);
    if (isNaN(val) || val < 0) {
      toast.error('Invalid stock quantity');
      setStock(item.stockQty.toString());
      setIsEditingStock(false);
      return;
    }
    if (val !== item.stockQty) {
      updateItem({ id: item.id, data: { stockQty: val } });
    }
    setIsEditingStock(false);
  };

  const handleDelete = () => deleteItem(item.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="glass group relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-0 transition-opacity group-hover:opacity-100">
          {canEdit && (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onEdit(item)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone and will permanently remove{' '}
                      {item.name}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="bg-solar/10 text-solar-amber shadow-glow-solar rounded-xl p-3">
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading mb-1 truncate text-lg leading-none font-semibold">
                {item.name}
              </h3>
              <p className="text-muted-foreground truncate text-sm">
                {item.brand} {item.modelNumber && `• ${item.modelNumber}`}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Unit Price</span>
              <div className="relative flex items-center gap-2">
                {isEditingPrice ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      className="h-8 w-32 text-right font-mono"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      onBlur={handlePriceSave}
                      onKeyDown={(e) => e.key === 'Enter' && handlePriceSave()}
                    />
                    {isUpdating && (
                      <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => canEdit && setIsEditingPrice(true)}
                    className={cn(
                      'hover:text-solar-amber font-mono text-lg font-bold transition-colors',
                      canEdit && 'cursor-pointer',
                    )}
                  >
                    {formatMMK(item.unitPrice)}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Stock Level</span>
              <div className="flex items-center gap-2">
                {isEditingStock ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      type="number"
                      className="h-8 w-20 text-right font-mono"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      onBlur={handleStockSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleStockSave()}
                    />
                    {isUpdating && (
                      <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                    )}
                  </div>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      'px-2 py-0.5 font-mono text-xs tracking-wider uppercase',
                      getStockColor(item.stockQty),
                      canEdit && 'cursor-pointer',
                    )}
                    onClick={() => canEdit && setIsEditingStock(true)}
                  >
                    {item.stockQty} {item.unit}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
