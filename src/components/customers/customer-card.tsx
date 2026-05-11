'use client';

import {
  Phone,
  Mail,
  MapPin,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { type Customer } from '@/lib/db/schema';
import { useDeleteCustomer } from '@/hooks/use-customers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface CustomerCardProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
}

export function CustomerCard({ customer, onEdit }: CustomerCardProps) {
  const { mutate: deleteCustomer } = useDeleteCustomer();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
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
      <Card className="group relative overflow-hidden border-white/5 bg-white/5 backdrop-blur-sm transition-all hover:bg-white/10">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="bg-solar shadow-solar h-12 w-12 border-2 border-white/10">
                <AvatarFallback className="bg-transparent text-lg font-bold text-white">
                  {getInitials(customer.name)}
                </AvatarFallback>
              </Avatar>

              <div>
                <h3 className="font-heading text-foreground text-lg font-semibold tracking-tight">
                  {customer.name}
                </h3>
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
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
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => { onEdit(customer); }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    if (
                      confirm('Are you sure you want to delete this customer?')
                    ) {
                      deleteCustomer(customer.id);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-6 grid gap-3">
            {customer.email && (
              <div className="text-muted-foreground flex items-center gap-3 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                {customer.email}
              </div>
            )}

            {customer.address && (
              <div className="text-muted-foreground flex items-start gap-3 text-sm">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <span className="line-clamp-2">
                  {customer.address}
                  {customer.city ? `, ${customer.city}` : ''}
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/5 pt-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <FileText className="text-solar h-3 w-3" />
              <span>0 Quotations</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-solar/10 hover:text-solar h-8 gap-2 text-xs"
            >
              View History
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
