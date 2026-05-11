'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type InventoryItem } from '@/lib/db/schema';
import {
  createInventoryItemSchema,
  type CreateInventoryItem,
} from '@/lib/validators/inventory';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  inventoryCategoryEnum,
  inventoryUnitEnum,
  type InventoryItem as DBInventoryItem,
} from '@/lib/db/schema';
import {
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from '@/hooks/use-inventory';
import { Loader2 } from 'lucide-react';

interface InventoryDialogProps {
  item?: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryDialog({
  item,
  open,
  onOpenChange,
}: InventoryDialogProps) {
  const isEdit = !!item;
  const { mutate: createItem, isPending: isCreating } =
    useCreateInventoryItem();
  const { mutate: updateItem, isPending: isUpdating } =
    useUpdateInventoryItem();

  const form = useForm<CreateInventoryItem>({
    resolver: zodResolver(createInventoryItemSchema),
    defaultValues: {
      name: '',
      category: inventoryCategoryEnum
        .enumValues[0] as DBInventoryItem['category'],
      unit: inventoryUnitEnum.enumValues[0] as DBInventoryItem['unit'],
      unitPrice: 0,
      stockQty: 0,
      brand: '',
      modelNumber: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        category: item.category,
        unit: item.unit,
        unitPrice: parseFloat(item.unitPrice.toString()),
        stockQty: item.stockQty,
        brand: item.brand || '',
        modelNumber: item.modelNumber || '',
        isActive: item.isActive,
      });
    } else {
      form.reset({
        name: '',
        category: 'panel',
        unit: 'pcs',
        unitPrice: 0,
        stockQty: 0,
        brand: '',
        modelNumber: '',
        isActive: true,
      });
    }
  }, [item, form]);

  const onSubmit = (data: CreateInventoryItem) => {
    if (isEdit && item) {
      updateItem(
        { id: item.id, data },
        {
          onSuccess: (res) => {
            if (res.success) onOpenChange(false);
          },
        },
      );
    } else {
      createItem(data, {
        onSuccess: (res) => {
          if (res.success) onOpenChange(false);
        },
      });
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-width-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            <FormField<CreateInventoryItem, 'name'>
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 550W Mono Half-cut Panel"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField<CreateInventoryItem, 'category'>
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inventoryCategoryEnum.enumValues.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField<CreateInventoryItem, 'unit'>
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inventoryUnitEnum.enumValues.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField<CreateInventoryItem, 'unitPrice'>
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price (MMK)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          { field.onChange(parseFloat(e.target.value)); }
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField<CreateInventoryItem, 'stockQty'>
                control={form.control}
                name="stockQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Stock</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          { field.onChange(parseInt(e.target.value)); }
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField<CreateInventoryItem, 'brand'>
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Jinko Solar"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField<CreateInventoryItem, 'modelNumber'>
                control={form.control}
                name="modelNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. JKM550M-72HL4"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { onOpenChange(false); }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-solar text-white"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create Item'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
