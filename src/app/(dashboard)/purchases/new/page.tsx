"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInventoryItems } from "@/hooks/use-inventory";
import { useCreatePurchaseOrder } from "@/hooks/use-purchases";
import { useSuppliers } from "@/hooks/use-suppliers";
import { formatMMK } from "@/lib/utils";
import { type CreatePurchaseOrder, createPurchaseOrderSchema } from "@/lib/validators/purchase";

export default function NewPurchasePage(): React.JSX.Element {
  const router = useRouter();
  const { data: suppliers } = useSuppliers();
  const { data: inventoryData } = useInventoryItems({ limit: 50 });
  const { mutate: createPurchase, isPending } = useCreatePurchaseOrder();

  const form = useForm<CreatePurchaseOrder>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: {
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      supplierId: "",
      billDate: null,
      dueDate: null,
      notes: "",
      items: [{ itemId: "", description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = (data: CreatePurchaseOrder) => {
    createPurchase(data, {
      onSuccess: (res) => {
        if (res.success) {
          router.push(`/purchases/${res.data.id}`);
        }
      },
    });
  };

  const inventoryItems = inventoryData?.items || [];

  // Calculate total
  const items = form.watch("items");
  const totalAmount = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <BackButton />
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Create Purchase Order</h1>
        <p className="text-muted-foreground mt-1">
          Draft a new purchase order for warehouse inventory.
        </p>
      </div>

      <div className="bg-card border-border rounded-2xl border p-6 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="poNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO Number</FormLabel>
                    <FormControl>
                      <Input placeholder="PO-12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier (SSoT)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}{" "}
                            {supplier.companyName ? `(${supplier.companyName})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={
                          field.value
                            ? format(new Date(field.value as string | number | Date), "yyyy-MM-dd")
                            : ""
                        }
                        onChange={(e) =>
                          field.onChange(e.target.value ? new Date(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={
                          field.value
                            ? format(new Date(field.value as string | number | Date), "yyyy-MM-dd")
                            : ""
                        }
                        onChange={(e) =>
                          field.onChange(e.target.value ? new Date(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Order Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0 })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Row
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex flex-col md:flex-row gap-4 items-start bg-muted/20 p-4 rounded-xl border border-border/50"
                  >
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemId`}
                      render={({ field: itemField }) => (
                        <FormItem className="flex-[2]">
                          <FormLabel className="text-xs">Catalog Item (SSoT)</FormLabel>
                          <Select
                            onValueChange={(val) => {
                              itemField.onChange(val);
                              // Auto-fill description and price from catalog
                              const selected = inventoryItems.find((i) => i.id === val);
                              if (selected) {
                                form.setValue(`items.${index}.description`, selected.name);
                                form.setValue(
                                  `items.${index}.unitPrice`,
                                  Number(selected.costPrice),
                                );
                              }
                            }}
                            defaultValue={itemField.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {inventoryItems.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field: descField }) => (
                        <FormItem className="flex-[2]">
                          <FormLabel className="text-xs">Description</FormLabel>
                          <FormControl>
                            <Input {...descField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: qtyField }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Qty</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...qtyField}
                              value={qtyField.value as string | number | undefined}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field: priceField }) => (
                        <FormItem className="flex-[1.5]">
                          <FormLabel className="text-xs">Unit Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...priceField}
                              value={priceField.value as string | number | undefined}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-8">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t pt-6 md:flex-row md:items-start md:justify-between">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="w-full md:max-w-md">
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Terms, delivery instructions..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-primary/5 rounded-xl border border-primary/20 p-6 min-w-[250px]">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">
                  Total Order Amount
                </p>
                <p className="text-3xl font-bold tracking-tight text-primary">
                  {formatMMK(totalAmount)}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4 border-t pt-6">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-fuchsia-600 text-white hover:bg-fuchsia-700"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Draft PO
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
