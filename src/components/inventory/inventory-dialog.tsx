'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type InventoryCategory,
  type InventoryItem,
  inventoryCategoryEnum,
  inventoryUnitEnum,
  type InventoryItem as DBInventoryItem,
} from '@/lib/db/schema';
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
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from '@/hooks/use-inventory';
import { Loader2 } from 'lucide-react';

interface InventoryDialogProps {
  item?: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultSpecificationsByCategory: Record<InventoryCategory, unknown> = {
  panel: { brandModel: '', cellType: 'n_type', wattageW: 0, warranty: '' },
  inverter: {
    brandModel: '',
    systemType: 'hybrid',
    ratedPower: '',
    phase: 'single_phase',
    maxPvInput: '',
    warranty: '',
  },
  battery: {
    brandModel: '',
    chemistryType: 'lifepo4',
    voltageV: 0,
    capacityAh: 0,
    warranty: '',
  },
  mounting: { type: '' },
  cable: { cableType: 'dc_cable', sizeCrossSection: '', unitOfMeasurement: '' },
  accessory: { type: '', ratingAmpere: 0, voltageRating: '' },
  labor: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getDefaultSpecifications = (category: InventoryCategory): unknown => {
  const value = defaultSpecificationsByCategory[category];
  return value === null ? null : { ...value };
};

const getText = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === 'string' ? value : '';
};

const getSelectValue = (
  record: Record<string, unknown>,
  key: string,
  fallback: string,
): string => {
  const value = record[key];
  return typeof value === 'string' ? value : fallback;
};

const getNumberInputValue = (
  record: Record<string, unknown>,
  key: string,
): string => {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : '0';
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
          onSet(fieldKey, Number(e.target.value));
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

function deriveInventoryName(
  category: InventoryCategory,
  specifications: unknown,
  fallbackName: string,
): string {
  const trimmedFallback = fallbackName.trim();
  if (!isRecord(specifications)) {
    return trimmedFallback.length > 0 ? trimmedFallback : `${category} item`;
  }
  if (
    (category === 'panel' ||
      category === 'inverter' ||
      category === 'battery') &&
    typeof specifications['brandModel'] === 'string' &&
    specifications['brandModel'].trim().length > 0
  ) {
    return specifications['brandModel'].trim();
  }
  if (
    (category === 'mounting' || category === 'accessory') &&
    typeof specifications['type'] === 'string' &&
    specifications['type'].trim().length > 0
  ) {
    return specifications['type'].trim();
  }
  if (
    category === 'cable' &&
    typeof specifications['sizeCrossSection'] === 'string' &&
    specifications['sizeCrossSection'].trim().length > 0
  ) {
    return specifications['sizeCrossSection'].trim();
  }
  return trimmedFallback.length > 0 ? trimmedFallback : `${category} item`;
}

function renderSpecificationFields(
  category: InventoryCategory,
  currentSpecs: Record<string, unknown>,
  setSpecValue: SpecSetter,
): React.JSX.Element {
  if (category === 'panel') {
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
          options={[
            { value: 'n_type', label: 'N-Type' },
            { value: 'p_type', label: 'P-Type' },
          ]}
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

  if (category === 'inverter') {
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
          options={[
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'off_grid', label: 'Off Grid' },
            { value: 'on_grid', label: 'On Grid' },
          ]}
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
          options={[
            { value: 'single_phase', label: 'Single Phase' },
            { value: 'three_phase', label: 'Three Phase' },
          ]}
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

  if (category === 'battery') {
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
          options={[
            { value: 'lifepo4', label: 'LiFePO4' },
            { value: 'gel', label: 'GEL' },
            { value: 'lead_acid', label: 'Lead Acid' },
          ]}
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

  if (category === 'mounting') {
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

  if (category === 'cable') {
    return (
      <>
        <SpecSelectInput
          label="Cable Type"
          placeholder="Cable Type"
          record={currentSpecs}
          fieldKey="cableType"
          fallback="dc_cable"
          onSet={setSpecValue}
          options={[
            { value: 'dc_cable', label: 'DC Cable' },
            { value: 'ac_cable', label: 'AC Cable' },
            { value: 'earth_wire', label: 'Earth Wire' },
          ]}
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

  if (category === 'accessory') {
    return (
      <>
        <SpecTextInput
          label="Accessory Type"
          placeholder="Accessory Type"
          record={currentSpecs}
          fieldKey="type"
          onSet={setSpecValue}
        />
        <SpecNumberInput
          label="Rating (A)"
          placeholder="Rating (A)"
          record={currentSpecs}
          fieldKey="ratingAmpere"
          onSet={setSpecValue}
        />
        <SpecTextInput
          label="Voltage Rating"
          className="md:col-span-2"
          placeholder="Voltage Rating"
          record={currentSpecs}
          fieldKey="voltageRating"
          onSet={setSpecValue}
        />
      </>
    );
  }

  return (
    <p className="text-muted-foreground text-sm md:col-span-2">
      No technical specifications required for labor items.
    </p>
  );
}

export function InventoryDialog({
  item,
  open,
  onOpenChange,
}: InventoryDialogProps): React.JSX.Element {
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
      specifications: getDefaultSpecifications('panel'),
      isActive: true,
    },
  });

  const selectedCategory = useWatch({
    control: form.control,
    name: 'category',
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        category: item.category,
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        stockQty: item.stockQty,
        brand: item.brand || '',
        modelNumber: item.modelNumber || '',
        specifications:
          item.specifications ?? getDefaultSpecifications(item.category),
        isActive: item.isActive,
      });
      return;
    }

    form.reset({
      name: '',
      category: 'panel',
      unit: 'pcs',
      unitPrice: 0,
      stockQty: 0,
      brand: '',
      modelNumber: '',
      specifications: getDefaultSpecifications('panel'),
      isActive: true,
    });
  }, [item, form, open]);

  const onSubmit = (data: CreateInventoryItem): void => {
    const normalizedData: CreateInventoryItem = {
      ...data,
      name: deriveInventoryName(data.category, data.specifications, data.name),
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
          <DialogTitle>{isEdit ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
            className="space-y-4 py-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={(value: DBInventoryItem['category']) => {
                        field.onChange(value);
                        form.setValue(
                          'specifications',
                          getDefaultSpecifications(value),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        );
                      }}
                      value={field.value}
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
                  const nextSpecs = isRecord(field.value)
                    ? { ...field.value }
                    : {};
                  nextSpecs[key] = value;
                  field.onChange(nextSpecs);
                };

                return (
                  <FormItem>
                    <FormLabel>Technical Specifications</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2">
                        {renderSpecificationFields(
                          selectedCategory,
                          currentSpecs,
                          setSpecValue,
                        )}
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
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price (MMK)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value}
                        onChange={(e) => {
                          field.onChange(Number(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stockQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Stock</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value}
                        onChange={(e) => {
                          field.onChange(parseInt(e.target.value, 10));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {['panel', 'inverter', 'battery'].includes(selectedCategory) ? (
              <p className="text-muted-foreground text-sm">
                Use the category-specific Brand/Model field in the technical
                specifications section instead of the generic Brand and Model
                fields.
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
                          value={field.value || ''}
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
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
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
