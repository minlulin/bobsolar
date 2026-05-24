"use client";

import { Edit, Mail, MapPin, MoreVertical, Phone, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteCustomer } from "@/hooks/use-customers";
import type { Customer } from "@/lib/db/schema";

interface CustomerCardProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onDelete?: (id: string) => void;
}

export function CustomerCard({ customer, onEdit, onDelete }: CustomerCardProps): React.JSX.Element {
  const { mutate: deleteCustomer } = useDeleteCustomer();
  const router = useRouter();
  const customerDetailHref = `/customers/${customer.id}`;

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
      <Card
        className="group border-border bg-muted/25 hover:bg-muted/45 relative cursor-pointer transition-colors"
        role="button"
        tabIndex={0}
        onClick={() => {
          router.push(customerDetailHref);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push(customerDetailHref);
          }
        }}
      >
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="bg-solar border-border/70 h-9 w-9 border">
                <AvatarFallback className="text-foreground bg-transparent text-xs font-bold">
                  {getInitials(customer.name)}
                </AvatarFallback>
              </Avatar>

              <div>
                <h3 className="font-heading text-foreground text-sm font-semibold tracking-tight">
                  {customer.name}
                </h3>
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Open actions for ${customer.name}`}
                  className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    onEdit(customer);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (confirm("Are you sure you want to delete this customer?")) {
                      onDelete?.(customer.id);
                      deleteCustomer(customer.id, {
                        onError: () => {
                          toast.error("Failed to delete customer. Restoring customer list.");
                          router.refresh();
                        },
                        onSuccess: (res) => {
                          if (!res.success) {
                            toast.error(res.error ?? "Failed to delete customer");
                            router.refresh();
                          }
                        },
                      });
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-3 grid gap-2">
            {customer.email && (
              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <div className="bg-muted/45 flex h-5 w-5 items-center justify-center rounded">
                  <Mail className="h-3 w-3" />
                </div>
                {customer.email}
              </div>
            )}

            {customer.address && (
              <div className="text-muted-foreground flex items-start gap-3 text-xs">
                <div className="bg-muted/45 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded">
                  <MapPin className="h-3 w-3" />
                </div>
                <span className="line-clamp-2">
                  {customer.address}
                  {customer.city ? `, ${customer.city}` : ""}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
