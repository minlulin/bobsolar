"use client";

import {
  Battery,
  Box,
  Cpu,
  Edit,
  Layers,
  Loader2,
  type LucideIcon,
  Shield,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDeleteInventoryItem, useUpdateInventoryItem } from "@/hooks/use-inventory";
import type { InventoryItem } from "@/lib/db/schema";
import { formatInventorySpecSummary, getInventoryCategoryLabel } from "@/lib/domain/inventory";
import { cn, formatMMK } from "@/lib/utils";

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
  protection: Shield,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stringifySpec = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

function getSpecBrandModel(item: InventoryItem): string | null {
  if (!isRecord(item.specifications)) return null;
  return stringifySpec(item.specifications["brandModel"]);
}

function getItemLabel(item: InventoryItem): string | null {
  const brand = stringifySpec(item.brand);
  const modelNumber = stringifySpec(item.modelNumber);
  if (brand || modelNumber) {
    return `${brand ?? ""}${brand && modelNumber ? " - " : ""}${modelNumber ?? ""}`.trim();
  }
  return getSpecBrandModel(item);
}

export function InventoryCard({ item, canEdit, onEdit }: InventoryCardProps): React.JSX.Element {
  const Icon = categoryIcons[item.category];
  const { mutate: updateItem, isPending: isUpdating } = useUpdateInventoryItem();
  const { mutate: deleteItem } = useDeleteInventoryItem();

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [price, setPrice] = useState(item.unitPrice);
  const specSummary = formatInventorySpecSummary(item);

  const handlePriceSave = (): void => {
    const val = parseFloat(price);
    if (Number.isNaN(val) || val < 0) {
      toast.error("Invalid unit price");
      setPrice(item.unitPrice);
      setIsEditingPrice(false);
      return;
    }
    if (val !== Number(item.unitPrice)) {
      updateItem({ id: item.id, data: { unitPrice: val } });
    }
    setIsEditingPrice(false);
  };

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
                aria-label={`Edit ${item.name}`}
                className="h-8 w-8"
                onClick={() => {
                  onEdit(item);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${item.name}`}
                    className="text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone and will permanently remove {item.name}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        deleteItem(item.id);
                      }}
                    >
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
            <div className="bg-solar/10 text-solar-amber rounded-xl p-3">
              {Icon ? <Icon className="h-6 w-6" /> : <Box className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading mb-1 truncate text-lg leading-none font-semibold">
                {item.name}
              </h3>
              <p className="text-muted-foreground truncate text-sm">{getItemLabel(item) ?? ""}</p>
              {specSummary && (
                <p className="text-muted-foreground mt-1 truncate text-xs">{specSummary}</p>
              )}
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
                      onChange={(e) => {
                        setPrice(e.target.value);
                      }}
                      onBlur={handlePriceSave}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePriceSave();
                      }}
                    />
                    {isUpdating && (
                      <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (canEdit) setIsEditingPrice(true);
                    }}
                    className={cn(
                      "hover:text-solar-amber font-mono text-lg font-bold transition-colors",
                      canEdit && "cursor-pointer",
                    )}
                  >
                    {formatMMK(item.unitPrice)}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Category</span>
              <Badge variant="secondary">{getInventoryCategoryLabel(item.category)}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
