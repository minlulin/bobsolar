"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ProjectOperationalNotes({
  disabled,
  initialNotes,
  onPersist,
}: {
  disabled: boolean;
  initialNotes: string | null | undefined;
  onPersist: (draft: string) => void;
}): React.JSX.Element {
  const [draft, setDraft] = React.useState(() => initialNotes ?? "");

  return (
    <div className="bg-card border-border space-y-5 rounded-[2rem] border p-6">
      <h3 className="text-muted-foreground text-[10px] font-bold uppercase">Operational notes</h3>
      <Textarea
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        className="min-h-[170px]"
      />
      <Button
        disabled={disabled}
        variant="outline"
        className="rounded-full"
        onClick={() => {
          onPersist(draft);
        }}
        type="button"
      >
        Save briefing
      </Button>
    </div>
  );
}
