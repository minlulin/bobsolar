"use client";

import {
  BadgeCheck,
  Brush,
  ChevronDown,
  ClipboardList,
  Settings2,
  ShieldCheck,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

interface ServiceTemplate {
  label: string;
  description: string;
  icon: React.ElementType;
  defaultPrice: number;
}

const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    label: "Cleaning Service",
    description: "Solar panel cleaning & surface decontamination",
    icon: Brush,
    defaultPrice: 0,
  },
  {
    label: "Regular Check-Up",
    description: "Periodic system health check & performance inspection",
    icon: ClipboardList,
    defaultPrice: 0,
  },
  {
    label: "Maintenance Service",
    description: "Full preventive maintenance & component inspection",
    icon: Settings2,
    defaultPrice: 0,
  },
  {
    label: "Warranty Inspection",
    description: "On-site warranty assessment & fault diagnosis",
    icon: ShieldCheck,
    defaultPrice: 0,
  },
  {
    label: "System Audit",
    description: "Comprehensive energy production & efficiency audit",
    icon: BadgeCheck,
    defaultPrice: 0,
  },
  {
    label: "Electrical Repair",
    description: "Wiring, connection & inverter fault repair",
    icon: Zap,
    defaultPrice: 0,
  },
  {
    label: "On-Site Installation",
    description: "Labor & installation for additional components",
    icon: Wrench,
    defaultPrice: 0,
  },
  {
    label: "Transportation & Logistics",
    description: "Site delivery & equipment transport",
    icon: Truck,
    defaultPrice: 0,
  },
];

export function AddServiceMenu(): React.JSX.Element {
  const addServiceItem = useQuoteBuilderStore((state) => state.addServiceItem);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          id="add-service-btn"
          className="border-dashed border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Add Service
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px]" sideOffset={6}>
        <DropdownMenuLabel className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
          Select Service Type
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {SERVICE_TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <DropdownMenuItem
                key={template.label}
                id={`add-service-${template.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex items-start gap-3 p-3 cursor-pointer"
                onSelect={() => {
                  addServiceItem(template.label, template.description, template.defaultPrice);
                }}
              >
                <div className="bg-blue-500/15 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                  <Icon className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{template.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                    {template.description}
                  </p>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
