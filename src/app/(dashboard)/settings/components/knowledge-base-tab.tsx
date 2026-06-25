"use client";

import { FileText, Info } from "lucide-react";
import type * as React from "react";

export function KnowledgeBaseTab(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-heading text-lg font-semibold">Knowledge Base</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          The chatbot now uses markdown files from the{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">content/</code> directory. Edit
          these files directly to update the bot's knowledge.
        </p>
      </div>

      {/* Info */}
      <div className="border-border bg-card rounded-xl border p-6">
        <div className="flex items-start gap-3">
          <Info className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">File-based knowledge</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Knowledge is stored as markdown files in the{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">content/</code> folder. The bot
              reads these files on each request and injects relevant content into the system prompt.
              Organize files by brand, capacity, or category for best results.
            </p>
          </div>
        </div>
      </div>

      {/* Content Files */}
      <div className="border-border bg-card rounded-xl border p-6">
        <h4 className="text-sm font-semibold mb-3">Knowledge Files</h4>
        <div className="space-y-2">
          <FileItem
            name="growatt-fault-codes.md"
            description="Growatt inverter fault codes and troubleshooting"
          />
          <FileItem
            name="sungrow-fault-codes.md"
            description="Sungrow inverter fault codes and troubleshooting"
          />
          <FileItem name="safety-warnings.md" description="Safety guidelines for technicians" />
          <FileItem name="diagnostic-flows.md" description="Step-by-step diagnostic procedures" />
          <FileItem name="brands.md" description="Supported inverter brands and models" />
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          To add knowledge, create or edit{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">.md</code> files in the{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">content/</code> directory.
        </p>
      </div>
    </div>
  );
}

function FileItem({ name, description }: { name: string; description: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
      <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs truncate">{description}</p>
      </div>
    </div>
  );
}
