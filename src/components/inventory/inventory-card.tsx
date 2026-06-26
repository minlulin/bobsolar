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
import React, { useState } from "react";
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
import { Button } from "@/components/ui/button";
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

const categoryAccentColors: Record<string, string> = {
  panel: "text-amber-500 bg-amber-500/8",
  inverter: "text-sky-500 bg-sky-500/8",
  battery: "text-emerald-500 bg-emerald-500/8",
  mounting: "text-slate-500 bg-slate-500/8",
  cable: "text-violet-500 bg-violet-500/8",
  accessory: "text-orange-500 bg-orange-500/8",
  protection: "text-rose-500 bg-rose-500/8",
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

export const InventoryCard = React.memo(function InventoryCard({
  item,
  canEdit,
  onEdit,
}: InventoryCardProps): React.JSX.Element {
  const Icon = categoryIcons[item.category];
  const { mutate: updateItem, isPending: isUpdating } = useUpdateInventoryItem();
  const { mutate: deleteItem } = useDeleteInventoryItem();

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [price, setPrice] = useState(item.unitPrice);
  const specSummary = formatInventorySpecSummary(item);
  const itemLabel = getItemLabel(item);
  const accentColor = categoryAccentColors[item.category] ?? "text-muted-foreground bg-muted/40";

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
    >
      <div className="group relative flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border/60 hover:bg-muted/30">
        {/* Category icon */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            accentColor,
          )}
        >
          {Icon ? <Icon className="h-4 w-4" /> : <Box className="h-4 w-4" />}
        </div>

        {/* Name + spec */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium leading-tight">{item.name}</span>
            <span className="text-muted-foreground/60 hidden text-[10px] font-medium uppercase tracking-wider sm:inline">
              {getInventoryCategoryLabel(item.category)}
            </span>
          </div>
          {(itemLabel || specSummary) && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {itemLabel && specSummary
                ? `${itemLabel} · ${specSummary}`
                : (itemLabel ?? specSummary)}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="flex shrink-0 items-center gap-2">
          {isEditingPrice ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                className="h-7 w-28 text-right font-mono text-sm"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                }}
                onBlur={handlePriceSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePriceSave();
                }}
              />
              {isUpdating && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (canEdit) setIsEditingPrice(true);
              }}
              className={cn(
                "font-mono text-sm font-semibold tabular-nums transition-colors",
                canEdit && "cursor-pointer hover:text-solar-amber",
              )}
            >
              {formatMMK(item.unitPrice)}
            </button>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Edit ${item.name}`}
              className="h-7 w-7"
              onClick={() => {
                onEdit(item);
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${item.name}`}
                  className="text-destructive h-7 w-7"
                >
                  <Trash2 className="h-3.5 w-3.5" />
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
    </motion.div>
  );
});
