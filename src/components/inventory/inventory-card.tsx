"use client";

import {
  Battery,
  Box,
  Cpu,
  Edit,
  Layers,
  Loader2,
  type LucideIcon,
  Trash2,
  User,
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
import { STOCK_WARNING_THRESHOLDS } from "@/lib/constants";
import type { InventoryItem } from "@/lib/db/schema";
import type { InventoryCategory } from "@/lib/domain/enums";
import { cn, formatMMK } from "@/lib/utils";

interface InventoryCardProps {
  item: InventoryItem;
  canEdit: boolean;
  onEdit: (item: InventoryItem) => void;
}

const categoryIcons: Record<InventoryCategory, LucideIcon> = {
  panel: Zap,
  inverter: Cpu,
  battery: Battery,
  mounting: Layers,
  cable: Box,
  accessory: Wrench,
  labor: User,
};

const categoryLabels: Record<InventoryCategory, string> = {
  panel: "Panel",
  inverter: "Inverter",
  battery: "Battery",
  mounting: "Mounting",
  cable: "Cable",
  accessory: "Accessory",
  labor: "Labor",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stringifySpec = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const numberSpec = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

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

function getSpecSummary(item: InventoryItem): string | null {
  if (!isRecord(item.specifications)) return null;
  const specs = item.specifications;

  switch (item.category) {
    case "panel": {
      const wattage = numberSpec(specs["wattageW"]);
      const cellType = stringifySpec(specs["cellType"]);
      const brandModel = stringifySpec(specs["brandModel"]);
      if (wattage === null || cellType === null || brandModel === null) {
        return null;
      }
      return `${wattage}W - ${cellType.replace("_", "-")} - ${brandModel}`;
    }
    case "battery": {
      const voltageV = numberSpec(specs["voltageV"]);
      const capacityAh = numberSpec(specs["capacityAh"]);
      const chemistryType = stringifySpec(specs["chemistryType"]);
      if (voltageV === null || capacityAh === null || chemistryType === null) {
        return null;
      }
      return `${voltageV}V - ${capacityAh}Ah - ${chemistryType.toUpperCase()}`;
    }
    case "accessory": {
      const type = stringifySpec(specs["type"]);
      const ratingAmpere = numberSpec(specs["ratingAmpere"]);
      const voltageRating = stringifySpec(specs["voltageRating"]);
      if (type === null || ratingAmpere === null || voltageRating === null) {
        return null;
      }
      return `${type} - ${ratingAmpere}A - ${voltageRating}`;
    }
    case "inverter": {
      const systemType = stringifySpec(specs["systemType"]);
      const ratedPower = stringifySpec(specs["ratedPower"]);
      const phase = stringifySpec(specs["phase"]);
      if (systemType === null || ratedPower === null || phase === null) {
        return null;
      }
      return `${ratedPower} - ${systemType.replace("_", "-")} - ${phase.replace("_", "-")}`;
    }
    case "mounting":
      return stringifySpec(specs["type"]);
    case "cable": {
      const cableType = stringifySpec(specs["cableType"]);
      const sizeCrossSection = stringifySpec(specs["sizeCrossSection"]);
      if (cableType === null || sizeCrossSection === null) return null;
      return `${cableType.replace("_", " ")} - ${sizeCrossSection}`;
    }
    case "labor":
      return null;
    default:
      return null;
  }
}

export function InventoryCard({ item, canEdit, onEdit }: InventoryCardProps): React.JSX.Element {
  const Icon = categoryIcons[item.category];
  const { mutate: updateItem, isPending: isUpdating } = useUpdateInventoryItem();
  const { mutate: deleteItem } = useDeleteInventoryItem();

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [price, setPrice] = useState(item.unitPrice);
  const [stock, setStock] = useState(String(item.stockQty));
  const specSummary = getSpecSummary(item);

  const getStockColor = (qty: number): string => {
    const threshold = STOCK_WARNING_THRESHOLDS[item.category];
    if (qty === 0) return "bg-red-500/10 text-red-500 border-red-500/20";
    if (qty <= threshold) return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  };

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

  const handleStockSave = (): void => {
    const val = parseInt(stock, 10);
    if (Number.isNaN(val) || val < 0) {
      toast.error("Invalid stock quantity");
      setStock(String(item.stockQty));
      setIsEditingStock(false);
      return;
    }
    if (val !== item.stockQty) {
      updateItem({ id: item.id, data: { stockQty: val } });
    }
    setIsEditingStock(false);
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
              <Icon className="h-6 w-6" />
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
              <span className="text-muted-foreground text-sm">Stock Level</span>
              <div className="flex items-center gap-2">
                {isEditingStock ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      type="number"
                      className="h-8 w-20 text-right font-mono"
                      value={stock}
                      onChange={(e) => {
                        setStock(e.target.value);
                      }}
                      onBlur={handleStockSave}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleStockSave();
                      }}
                    />
                    {isUpdating && (
                      <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                    )}
                  </div>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-2 py-0.5 font-mono text-xs tracking-wider uppercase",
                      getStockColor(item.stockQty),
                      canEdit && "cursor-pointer",
                    )}
                    onClick={() => {
                      if (canEdit) setIsEditingStock(true);
                    }}
                  >
                    {item.stockQty} {item.unit}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Category</span>
              <Badge variant="secondary">{categoryLabels[item.category]}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
