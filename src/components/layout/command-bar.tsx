'use client';

import * as React from 'react';
import {
  Search,
  Plus,
  LayoutDashboard,
  FileText,
  Zap,
  Package,
  Users,
  Moon,
  Sun,
  Laptop,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useAppTheme } from '@/components/providers';

export function CommandBar() {
  const [open, setOpen] = React.useState(false);
  const { setTheme } = useAppTheme();
  const router = useRouter();

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => { document.removeEventListener('keydown', down); };
  }, []);

  const runCommand = React.useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  return (
    <>
      <Button
        variant="outline"
        aria-label="Open command menu"
        className="bg-muted/50 text-muted-foreground hover:text-foreground relative h-9 w-9 rounded-xl border-none p-0 transition-all duration-200 xl:h-10 xl:w-64 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => { setOpen(true); }}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden text-sm xl:inline-flex">
          Search or command...
        </span>
        <kbd className="bg-muted/80 pointer-events-none absolute top-2 right-2 hidden h-6 items-center gap-1 rounded border border-white/10 px-1.5 font-mono text-[10px] font-medium opacity-100 select-none xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() =>
                  { runCommand(() => { router.push('/quotations/new'); }); }
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>New Quotation</span>
                <CommandShortcut>⌘Q</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => { runCommand(() => { router.push('/customers/new'); }); }}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>New Customer</span>
              </CommandItem>
              <CommandItem
                onSelect={() => { runCommand(() => { router.push('/projects/new'); }); }}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>New Project</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => { runCommand(() => { router.push('/'); }); }}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </CommandItem>
              <CommandItem
                onSelect={() => { runCommand(() => { router.push('/quotations'); }); }}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Quotations</span>
              </CommandItem>
              <CommandItem
                onSelect={() => { runCommand(() => { router.push('/projects'); }); }}
              >
                <Zap className="mr-2 h-4 w-4" />
                <span>Projects</span>
              </CommandItem>
              <CommandItem
                onSelect={() => { runCommand(() => { router.push('/inventory'); }); }}
              >
                <Package className="mr-2 h-4 w-4" />
                <span>Inventory</span>
              </CommandItem>
              <CommandItem
                onSelect={() => { runCommand(() => { router.push('/customers'); }); }}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Customers</span>
              </CommandItem>
              <CommandItem
                onSelect={() => { runCommand(() => { router.push('/warranty'); }); }}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                <span>Warranty</span>
              </CommandItem>
              <CommandItem
                onSelect={() => { runCommand(() => { router.push('/settings'); }); }}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Settings">
              <CommandItem onSelect={() => { runCommand(() => { setTheme('light'); }); }}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light Mode</span>
              </CommandItem>
              <CommandItem onSelect={() => { runCommand(() => { setTheme('dark'); }); }}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark Mode</span>
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  { runCommand(() =>
                    { setTheme(
                      window.matchMedia('(prefers-color-scheme: dark)').matches
                        ? 'dark'
                        : 'light',
                    ); },
                  ); }
                }
              >
                <Laptop className="mr-2 h-4 w-4" />
                <span>System Theme</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
