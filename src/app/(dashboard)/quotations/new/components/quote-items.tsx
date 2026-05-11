'use client';

import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Trash2, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useQuoteBuilderStore,
  type QuoteBuilderItem,
} from '@/stores/quote-builder-store';
import { formatMMK } from '@/lib/utils';

export function QuoteItems(): React.JSX.Element {
  const items = useQuoteBuilderStore((state) => state.items);
  const setItems = useQuoteBuilderStore((state) => state.setItems);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/5 bg-white/[0.02] py-12">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <Hash className="text-muted-foreground h-6 w-6" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">
          No items added yet
        </p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          Search and add items to start building your quote
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table-like header */}
      <div className="text-muted-foreground/60 grid grid-cols-[30px_1fr_100px_150px_120px_40px] gap-4 px-4 py-2 text-[10px] font-bold tracking-wider uppercase">
        <div className="flex justify-center">#</div>
        <div>Description</div>
        <div className="text-right">Quantity</div>
        <div className="text-right">Unit Price</div>
        <div className="text-right">Total</div>
        <div></div>
      </div>

      <Reorder.Group
        axis="y"
        values={items}
        onReorder={setItems}
        className="space-y-2"
      >
        {items.map((item, index) => (
          <ItemRow
            key={item.id ?? `${item.itemId ?? 'item'}-${index}`}
            item={item}
            index={index}
          />
        ))}
      </Reorder.Group>
    </div>
  );
}

function ItemRow({
  item,
  index,
}: {
  item: QuoteBuilderItem;
  index: number;
}): React.JSX.Element {
  const updateItemQuantity = useQuoteBuilderStore(
    (state) => state.updateItemQuantity,
  );
  const updateItemPrice = useQuoteBuilderStore(
    (state) => state.updateItemPrice,
  );
  const removeItem = useQuoteBuilderStore((state) => state.removeItem);
  const updateItemDescription = useQuoteBuilderStore(
    (state) => state.updateItemDescription,
  );

  const controls = useDragControls();

  const total =
    item.quantity * item.unitPrice * (1 - item.discountPercentage / 100);

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="group grid grid-cols-[30px_1fr_100px_150px_120px_40px] items-center gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:border-amber-500/30 hover:bg-white/[0.05]"
    >
      <div
        className="text-muted-foreground flex cursor-grab justify-center transition-colors group-hover:text-amber-500 active:cursor-grabbing"
        onPointerDown={(e) => { controls.start(e); }}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div>
        <Input
          id={`quote-item-description-${index}`}
          aria-label={`Item ${index + 1} description`}
          value={item.description}
          onChange={(e) => { updateItemDescription(index, e.target.value); }}
          className="focus:bg-background/40 h-9 border-transparent bg-transparent text-sm font-medium transition-all hover:border-white/10 focus:border-white/20"
        />
      </div>

      <div>
        <Input
          id={`quote-item-quantity-${index}`}
          aria-label={`Item ${index + 1} quantity`}
          type="number"
          value={item.quantity}
          min={1}
          step={1}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(parsed)) {
              updateItemQuantity(index, parsed);
            }
          }}
          className="focus:bg-background/40 h-9 border-transparent bg-transparent text-right font-mono text-sm font-bold transition-all hover:border-white/10 focus:border-white/20"
        />
      </div>

      <div>
        <div className="relative">
          <Input
            id={`quote-item-unit-price-${index}`}
            aria-label={`Item ${index + 1} unit price`}
            type="number"
            value={item.unitPrice}
            onChange={(e) =>
              { updateItemPrice(index, parseInt(e.target.value) || 0); }
            }
            className="focus:bg-background/40 h-9 border-transparent bg-transparent pr-2 text-right font-mono text-sm font-bold text-amber-500 transition-all hover:border-white/10 focus:border-white/20"
          />
        </div>
      </div>

      <div className="text-right font-mono text-sm font-bold">
        {formatMMK(total)}
      </div>

      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove item ${index + 1}`}
          onClick={() => { removeItem(index); }}
          className="text-muted-foreground h-8 w-8 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Reorder.Item>
  );
}
