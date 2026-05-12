const fs = require('fs');

let content = fs.readFileSync('src/components/ui/card.tsx', 'utf8');

// We want to add the `premium` prop to Card, without removing data-slots, size or CardAction
content = content.replace(
  /function Card\(\{\n  className,\n  size = 'default',\n  \.\.\.props\n\}: React\.ComponentProps\<'div'\> & \{\n  size\?: 'default' \| 'sm';\n\}\): React\.JSX\.Element \{\n  return \(\n    \<div\n      data-slot="card"\n      data-size=\{size\}\n      className=\{cn\(\n        'group\/card bg-card text-card-foreground ring-foreground\/10 flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1 has-data-\[slot=card-footer\]:pb-0 has-\[\>img:first-child\]:pt-0 data-\[size=sm\]:gap-3 data-\[size=sm\]:py-3 data-\[size=sm\]:has-data-\[slot=card-footer\]:pb-0 \*\:\[img:first-child\]:rounded-t-xl \*\:\[img:last-child\]:rounded-b-xl',\n        className,\n      \)\}/,
  `function Card({
  className,
  size = 'default',
  premium = false,
  ...props
}: React.ComponentProps<'div'> & {
  size?: 'default' | 'sm';
  premium?: boolean;
}): React.JSX.Element {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'group/card text-card-foreground flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',

        premium
          ? [
              'relative overflow-hidden',
              'bg-card/40 backdrop-blur-2xl shadow-[var(--shadow-card-rest),var(--shadow-glass-inset)]',
              'border border-[rgba(255,255,255,0.08)]',
              'transition-apple duration-500 hover:-translate-y-[2px] hover:scale-[1.01]',
              'hover:shadow-[var(--shadow-card-hover),var(--shadow-glass-inset)]',
              'after:absolute after:inset-0 after:z-[-1] after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-500 after:pointer-events-none',
              'after:bg-gradient-to-br after:from-white/10 after:to-transparent',
            ]
          : 'bg-card ring-foreground/10 ring-1 shadow-xs',

        className,
      )}`
);

fs.writeFileSync('src/components/ui/card.tsx', content);
