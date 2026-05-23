"use client";

import { format } from "date-fns";
import { Archive, ArchiveRestore, Calendar, Eye, MoreVertical, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  archiveQuotation,
  deleteQuotation,
  type QuotationWithCustomer,
  restoreQuotation,
} from "@/actions/quotation-actions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_CONFIG } from "@/lib/constants";
import { cn, formatMMK } from "@/lib/utils";

interface QuotationCardProps {
  quotation: QuotationWithCustomer;
}

export function QuotationCard({ quotation }: QuotationCardProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const config = STATUS_CONFIG[quotation.status];
  const Icon = config.icon;

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation();
    startTransition((): void => {
      void (async (): Promise<void> => {
        const result = await deleteQuotation(quotation.id);
        if (result.success) {
          toast.success("Draft deleted successfully");
        } else {
          toast.error(result.error || "Failed to delete draft");
        }
      })();
    });
  };

  const handleArchive = (e: React.MouseEvent): void => {
    e.stopPropagation();
    startTransition((): void => {
      void (async (): Promise<void> => {
        const result = await archiveQuotation(quotation.id);
        if (result.success) {
          toast.success("Quotation archived");
        } else {
          toast.error(result.error || "Failed to archive quotation");
        }
      })();
    });
  };

  const handleRestore = (e: React.MouseEvent): void => {
    e.stopPropagation();
    startTransition((): void => {
      void (async (): Promise<void> => {
        const result = await restoreQuotation(quotation.id);
        if (result.success) {
          toast.success("Quotation restored");
        } else {
          toast.error(result.error || "Failed to restore quotation");
        }
      })();
    });
  };

  return (
    <div className="transition-all hover:-translate-y-1">
      <Card
        className="bg-card border-border group hover:bg-muted/30 cursor-pointer border transition-colors"
        onClick={() => {
          router.push(`/quotations/${quotation.id}`);
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-solar text-xs font-bold tracking-wider uppercase">
                  {quotation.quoteNumber}
                </span>
                <Badge className={cn("px-1.5 py-0 text-[10px] font-bold uppercase", config.color)}>
                  <Icon className="mr-1 h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              <h3 className="font-heading text-foreground line-clamp-1 text-sm font-semibold">
                {quotation.customer.name}
              </h3>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Open actions for quotation ${quotation.quoteNumber}`}
                  className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/quotations/${quotation.id}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {!quotation.isArchived && quotation.status === "rejected" && (
                  <DropdownMenuItem onClick={handleArchive} disabled={isPending}>
                    <Archive className="mr-2 h-4 w-4" />
                    {isPending ? "Archiving..." : "Archive"}
                  </DropdownMenuItem>
                )}
                {quotation.isArchived && (
                  <DropdownMenuItem onClick={handleRestore} disabled={isPending}>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    {isPending ? "Restoring..." : "Restore"}
                  </DropdownMenuItem>
                )}
                {quotation.status === "draft" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={(e) => {
                          e.preventDefault();
                        }}
                        disabled={isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isPending ? "Deleting..." : "Delete Draft"}
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete draft quotation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete Draft</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Total Amount</span>
              <span className="font-heading text-foreground font-bold">
                {formatMMK(parseFloat(quotation.total))}
              </span>
            </div>

            <div className="text-muted-foreground flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {format(new Date(quotation.createdAt), "MMM d, yyyy")}
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                {quotation.createdBy.name || "Sales Team"}
              </div>
            </div>
          </div>

          <div className="border-border/60 mt-5 flex items-center gap-2 border-t pt-4">
            <div className="bg-solar h-1.5 w-1.5 animate-pulse rounded-full" />
            <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Ready for Export
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
