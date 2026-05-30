"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type * as React from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  deriveInventoryName,
  extractSpecErrorMessage,
  formatNumericInputValue,
  parseNumericInput,
} from "@/components/inventory/inventory-form-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useCreateInventoryItem, useUpdateInventoryItem } from "@/hooks/use-inventory";
import {
  type InventoryItem as DBInventoryItem,
  type InventoryCategory,
  type InventoryItem,
  inventoryUnitEnum,
} from "@/lib/db/schema";
import {
  BATTERY_CHEMISTRY_TYPE_LABELS,
  BATTERY_CHEMISTRY_TYPES,
  CABLE_TYPE_LABELS,
  CABLE_TYPES,
  DEFAULT_SPECIFICATIONS_BY_CATEGORY,
  extractBrandModel,
  INVERTER_PHASE_LABELS,
  INVERTER_PHASES,
  INVERTER_SYSTEM_TYPE_LABELS,
  INVERTER_SYSTEM_TYPES,
  PANEL_CELL_TYPE_LABELS,
  PANEL_CELL_TYPES,
} from "@/lib/domain/inventory";
import { type CreateInventoryItem, createInventoryItemSchema } from "@/lib/validators/inventory";

interface InventoryDialogProps {
  item?: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getDefaultSpecifications = (category: InventoryCategory): unknown => {
  const value = DEFAULT_SPECIFICATIONS_BY_CATEGORY[category];
  return value === null ? null : { ...(value as object) };
};

const getText = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === "string" ? value : "";
};

const getSelectValue = (record: Record<string, unknown>, key: string, fallback: string): string => {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
};

const getNumberInputValue = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === "number"
    ? formatNumericInputValue(value)
    : formatNumericInputValue(undefined);
};

type SpecSetter = (key: string, value: unknown) => void;

function SpecTextInput({
  label,
  placeholder,
  record,
  fieldKey,
  onSet,
  className,
}: {
  label: string;
  placeholder: string;
  record: Record<string, unknown>;
  fieldKey: string;
  onSet: SpecSetter;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium">{label}</p>
      <Input
        placeholder={placeholder}
        value={getText(record, fieldKey)}
        onChange={(e) => {
          onSet(fieldKey, e.target.value);
        }}
      />
    </div>
  );
}

function SpecNumberInput({
  label,
  placeholder,
  record,
  fieldKey,
  onSet,
  className,
}: {
  label: string;
  placeholder: string;
  record: Record<string, unknown>;
  fieldKey: string;
  onSet: SpecSetter;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium">{label}</p>
      <Input
        type="number"
        placeholder={placeholder}
        value={getNumberInputValue(record, fieldKey)}
        onChange={(e) => {
          onSet(fieldKey, parseNumericInput(e.target.value));
        }}
      />
    </div>
  );
}

function SpecSelectInput({
  label,
  placeholder,
  record,
  fieldKey,
  fallback,
  onSet,
  options,
  className,
}: {
  label: string;
  placeholder: string;
  record: Record<string, unknown>;
  fieldKey: string;
  fallback: string;
  onSet: SpecSetter;
  options: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium">{label}</p>
      <Select
        value={getSelectValue(record, fieldKey, fallback)}
        onValueChange={(value) => {
          onSet(fieldKey, value);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function renderSpecificationFields(
  category: InventoryCategory,
  currentSpecs: Record<string, unknown>,
  setSpecValue: SpecSetter,
): React.JSX.Element {
  if (category === "panel") {
    return (
      <>
        <SpecTextInput
          label="Item Name (Brand/Model)"
          placeholder="Brand/Model"
          record={currentSpecs}
          fieldKey="brandModel"
          onSet={setSpecValue}
        />
        <SpecSelectInput
          label="Cell Type"
          placeholder="Cell Type"
          record={currentSpecs}
          fieldKey="cellType"
          fallback="n_type"
          onSet={setSpecValue}
          options={PANEL_CELL_TYPES.map((val) => ({
            value: val,
            label: PANEL_CELL_TYPE_LABELS[val] as string,
          }))}
        />
        <SpecNumberInput
          label="Wattage (W)"
          placeholder="Wattage (W)"
          record={currentSpecs}
          fieldKey="wattageW"
          onSet={setSpecValue}
        />
        <SpecTextInput
          label="Warranty"
          placeholder="Warranty"
          record={currentSpecs}
          fieldKey="warranty"
          onSet={setSpecValue}
        />
      </>
    );
  }

  if (category === "inverter") {
    return (
      <>
        <SpecTextInput
          label="Item Name (Brand/Model)"
          placeholder="Brand/Model"
          record={currentSpecs}
          fieldKey="brandModel"
          onSet={setSpecValue}
        />
        <SpecSelectInput
          label="System Type"
          placeholder="System Type"
          record={currentSpecs}
          fieldKey="systemType"
          fallback="hybrid"
          onSet={setSpecValue}
          options={INVERTER_SYSTEM_TYPES.map((val) => ({
            value: val,
            label: INVERTER_SYSTEM_TYPE_LABELS[val] as string,
          }))}
        />
        <SpecTextInput
          label="Rated Power"
          placeholder="Rated Power"
          record={currentSpecs}
          fieldKey="ratedPower"
          onSet={setSpecValue}
        />
        <SpecSelectInput
          label="Phase"
          placeholder="Phase"
          record={currentSpecs}
          fieldKey="phase"
          fallback="single_phase"
          onSet={setSpecValue}
          options={INVERTER_PHASES.map((val) => ({
            value: val,
            label: INVERTER_PHASE_LABELS[val] as string,
          }))}
        />
        <SpecTextInput
          label="Max PV Input"
          placeholder="Max PV Input"
          record={currentSpecs}
          fieldKey="maxPvInput"
          onSet={setSpecValue}
        />
        <SpecTextInput
          label="Warranty"
          placeholder="Warranty"
          record={currentSpecs}
          fieldKey="warranty"
          onSet={setSpecValue}
        />
      </>
    );
  }

  if (category === "battery") {
    return (
      <>
        <SpecTextInput
          label="Item Name (Brand/Model)"
          placeholder="Brand/Model"
          record={currentSpecs}
          fieldKey="brandModel"
          onSet={setSpecValue}
        />
        <SpecSelectInput
          label="Chemistry Type"
          placeholder="Chemistry Type"
          record={currentSpecs}
          fieldKey="chemistryType"
          fallback="lifepo4"
          onSet={setSpecValue}
          options={BATTERY_CHEMISTRY_TYPES.map((val) => ({
            value: val,
            label: BATTERY_CHEMISTRY_TYPE_LABELS[val] as string,
          }))}
        />
        <SpecNumberInput
          label="Voltage (V)"
          placeholder="Voltage (V)"
          record={currentSpecs}
          fieldKey="voltageV"
          onSet={setSpecValue}
        />
        <SpecNumberInput
          label="Capacity (Ah)"
          placeholder="Capacity (Ah)"
          record={currentSpecs}
          fieldKey="capacityAh"
          onSet={setSpecValue}
        />
        <SpecTextInput
          label="Warranty"
          className="md:col-span-2"
          placeholder="Warranty"
          record={currentSpecs}
          fieldKey="warranty"
          onSet={setSpecValue}
        />
      </>
    );
  }

  if (category === "mounting") {
    return (
      <SpecTextInput
        label="Mounting Type"
        className="md:col-span-2"
        placeholder="Mounting Type"
        record={currentSpecs}
        fieldKey="type"
        onSet={setSpecValue}
      />
    );
  }

  if (category === "cable") {
    return (
      <>
        <SpecSelectInput
          label="Cable Type"
          placeholder="Cable Type"
          record={currentSpecs}
          fieldKey="cableType"
          fallback="dc_cable"
          onSet={setSpecValue}
          options={CABLE_TYPES.map((val) => ({
            value: val,
            label: CABLE_TYPE_LABELS[val] as string,
          }))}
        />
        <SpecTextInput
          label="Cross Section"
          placeholder="Cross Section (e.g. 6mm²)"
          record={currentSpecs}
          fieldKey="sizeCrossSection"
          onSet={setSpecValue}
        />
        <SpecTextInput
          label="Unit of Measurement"
          className="md:col-span-2"
          placeholder="Unit of Measurement"
          record={currentSpecs}
          fieldKey="unitOfMeasurement"
          onSet={setSpecValue}
        />
      </>
    );
  }

  if (category === "accessory") {
    return (
      <>
        <SpecTextInput
          label="Accessory Type"
          placeholder="e.g. DC Isolator, Junction Box"
          record={currentSpecs}
          fieldKey="type"
          onSet={setSpecValue}
          className="md:col-span-2"
        />
        <SpecNumberInput
          label="Ampere Rating (Optional)"
          placeholder="e.g. 32"
          record={currentSpecs}
          fieldKey="ratingAmpere"
          onSet={setSpecValue}
        />
        <SpecTextInput
          label="Voltage Rating (Optional)"
          placeholder="e.g. 1000V DC"
          record={currentSpecs}
          fieldKey="voltageRating"
          onSet={setSpecValue}
        />
      </>
    );
  }

  if (category === "protection") {
    return (
      <>
        <SpecTextInput
          label="Protection Type"
          placeholder="e.g. Breaker, Fuse, SPD, Surge Protector"
          record={currentSpecs}
          fieldKey="type"
          onSet={setSpecValue}
          className="md:col-span-2"
        />
        <SpecNumberInput
          label="Ampere Rating (Optional)"
          placeholder="e.g. 63"
          record={currentSpecs}
          fieldKey="ratingAmpere"
          onSet={setSpecValue}
        />
        <SpecTextInput
          label="Voltage Rating (Optional)"
          placeholder="e.g. 400V AC"
          record={currentSpecs}
          fieldKey="voltageRating"
          onSet={setSpecValue}
        />
      </>
    );
  }

  if (category === "labor" || category === "service") {
    return (
      <SpecTextInput
        label="Description / Note (Optional)"
        placeholder="e.g. Installation labor for 3kWp system"
        record={currentSpecs}
        fieldKey="note"
        onSet={setSpecValue}
        className="md:col-span-2"
      />
    );
  }

  // biome-ignore lint/complexity/noUselessFragments: Needed because React.JSX.Element doesn't accept null here
  return <></>;
}

export function InventoryDialog({
  item,
  open,
  onOpenChange,
}: InventoryDialogProps): React.JSX.Element {
  const isEdit = !!item;
  const { mutate: createItem, isPending: isCreating } = useCreateInventoryItem();
  const { mutate: updateItem, isPending: isUpdating } = useUpdateInventoryItem();

  const form = useForm<CreateInventoryItem>({
    resolver: zodResolver(createInventoryItemSchema),
    defaultValues: {
      name: "",
      category: "panel",
      unit: inventoryUnitEnum.enumValues[0] as DBInventoryItem["unit"],
      costPrice: 0,
      unitPrice: 0,
      stockQty: 0,
      brand: "",
      modelNumber: "",
      specifications: getDefaultSpecifications("panel"),
      durationMonths: 0,
      isActive: true,
    },
  });

  const selectedCategory = useWatch({
    control: form.control,
    name: "category",
  });
  const selectedSpecs = useWatch({
    control: form.control,
    name: "specifications",
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        category: item.category as CreateInventoryItem["category"],
        unit: item.unit,
        costPrice: Number(item.costPrice),
        unitPrice: Number(item.unitPrice),
        stockQty: item.stockQty,
        brand: item.brand || "",
        modelNumber: item.modelNumber || "",
        specifications:
          item.specifications ??
          getDefaultSpecifications(item.category as CreateInventoryItem["category"]),
        durationMonths: item.durationMonths ?? 0,
        isActive: item.isActive,
      });
      return;
    }

    form.reset({
      name: "",
      category: "panel",
      unit: "pcs",
      costPrice: 0,
      unitPrice: 0,
      stockQty: 0,
      brand: "",
      modelNumber: "",
      specifications: getDefaultSpecifications("panel"),
      durationMonths: 0,
      isActive: true,
    });
  }, [item, form]);

  useEffect(() => {
    const currentName = form.getValues("name");
    const derivedName = deriveInventoryName(selectedCategory, selectedSpecs, currentName);
    if (derivedName !== currentName) {
      form.setValue("name", derivedName, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [form, selectedCategory, selectedSpecs]);

  const onSubmit = (data: CreateInventoryItem): void => {
    const extracted = extractBrandModel(
      data.category,
      data.specifications,
      data.brand,
      data.modelNumber,
    );

    const normalizedData: CreateInventoryItem = {
      ...data,
      name: deriveInventoryName(data.category, data.specifications, data.name),
      brand: extracted.brand || null,
      modelNumber: extracted.modelNumber || null,
    };

    if (item) {
      updateItem(
        { id: item.id, data: normalizedData },
        {
          onSuccess: (res) => {
            if (res.success) {
              onOpenChange(false);
            }
          },
        },
      );
      return;
    }

    createItem(normalizedData, {
      onSuccess: (res) => {
        if (res.success) {
          onOpenChange(false);
        }
      },
    });
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Item" : "Add New Item"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={(value: DBInventoryItem["category"]) => {
                        field.onChange(value);
                        form.setValue("specifications", getDefaultSpecifications(value), {
                          shouldDirty: true,
                          shouldValidate: false,
                        });
                        form.clearErrors("specifications");
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[
                          "panel",
                          "inverter",
                          "battery",
                          "mounting",
                          "cable",
                          "accessory",
                          "protection",
                          "labor",
                          "service",
                        ].map((cat) => (
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

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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

            <FormField
              control={form.control}
              name="specifications"
              render={({ field }) => {
                const currentSpecs = isRecord(field.value) ? field.value : {};
                const setSpecValue = (key: string, value: unknown): void => {
                  const nextSpecs = isRecord(field.value) ? { ...field.value } : {};
                  nextSpecs[key] = value;
                  field.onChange(nextSpecs);
                };

                return (
                  <FormItem>
                    <FormLabel>Technical Specifications</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2">
                        {renderSpecificationFields(selectedCategory, currentSpecs, setSpecValue)}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={formatNumericInputValue(field.value)}
                        onChange={(e) => {
                          const parsed = parseNumericInput(e.target.value);
                          field.onChange(parsed !== undefined ? Math.max(0, parsed) : 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell Price (Customer) MMK</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={formatNumericInputValue(field.value)}
                        onChange={(e) => {
                          field.onChange(parseNumericInput(e.target.value) ?? 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {["panel", "inverter", "battery"].includes(selectedCategory) ? (
              <p className="text-muted-foreground text-sm">
                Use the category-specific Brand/Model field in the technical specifications section
                instead of the generic Brand and Model fields.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Jinko Solar"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modelNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. JKM550M-72HL4"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter className="pt-4">
              {extractSpecErrorMessage(form.formState.errors.specifications) && (
                <p className="text-destructive w-full text-xs">
                  {extractSpecErrorMessage(form.formState.errors.specifications)}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-solar text-white">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
