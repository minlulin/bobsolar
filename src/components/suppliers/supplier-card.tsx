"use client";

import { Building2, Edit, Mail, MapPin, MoreVertical, Phone, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteSupplier } from "@/hooks/use-suppliers";
import type { Supplier } from "@/lib/db/schema";
import { formatMMK } from "@/lib/utils";

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onDelete?: (id: string) => void;
}

export function SupplierCard({ supplier, onEdit, onDelete }: SupplierCardProps): React.JSX.Element {
  const { mutate: deleteSupplier } = useDeleteSupplier();

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group border-border bg-muted/25 hover:bg-muted/45 relative cursor-default transition-colors">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="bg-indigo-500 shadow-sm border-border/70 h-10 w-10 border">
                <AvatarFallback className="text-white bg-transparent text-xs font-bold">
                  {getInitials(supplier.name)}
                </AvatarFallback>
              </Avatar>

              <div>
                <h3 className="font-heading text-foreground text-sm font-semibold tracking-tight">
                  {supplier.name}
                </h3>
                {supplier.companyName ? (
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs mt-1">
                    <Building2 className="h-3 w-3" />
                    {supplier.companyName}
                  </div>
                ) : null}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Open actions for ${supplier.name}`}
                  className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    onEdit(supplier);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this supplier?")) {
                      onDelete?.(supplier.id);
                      deleteSupplier(supplier.id);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="bg-background/50 border-border/50 rounded-xl border p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span className="truncate">{supplier.phone || "No phone"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{supplier.email || "No email"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{supplier.address || "No address"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Owed</span>
            <span className="text-sm font-semibold tracking-tight text-rose-500">
              {formatMMK(parseFloat(supplier.totalOwed))}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
