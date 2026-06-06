"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, Pencil, Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  archiveOwner,
  createOwner,
  listOwnersForSettings,
  updateOwner,
} from "@/actions/owner-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SafeOwner } from "@/hooks/use-owners";
import { PARTNER_SLOTS } from "@/lib/domain/partners";
import { settingsKeys } from "@/lib/query-keys";

type PartnerFormState = {
  name: string;
  email: string;
  password: string;
  ownershipPercent: string;
};

const EMPTY_FORM: PartnerFormState = {
  name: "",
  email: "",
  password: "",
  ownershipPercent: "",
};

export function PartnersTab(): React.JSX.Element {
  const partnersQuery = useQuery({
    queryKey: settingsKeys.partners(),
    queryFn: async () => {
      const res = await listOwnersForSettings();
      if (!res.success) throw new Error(res.error);
      return res.data.owners;
    },
    staleTime: 60 * 1000,
  });

  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<SafeOwner | null>(null);
  const [archiving, setArchiving] = React.useState<SafeOwner | null>(null);
  const [createForm, setCreateForm] = React.useState<PartnerFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = React.useState<PartnerFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);

  const partners = partnersQuery.data ?? [];
  const atCap = partners.length >= PARTNER_SLOTS.length;
  const totalOwnership = partners.reduce((sum, p) => sum + Number(p.ownershipPercentage), 0);

  React.useEffect(() => {
    if (editing) {
      setEditForm({
        name: editing.name,
        email: editing.email,
        password: "",
        ownershipPercent: editing.ownershipPercentage,
      });
    }
  }, [editing]);

  async function handleCreate(): Promise<void> {
    const percent = Number(createForm.ownershipPercent);
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      toast.error("Ownership must be between 0 and 100");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createOwner({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        ownershipPercent: percent,
      });
      if (res.success) {
        toast.success(`Partner added (slot ${res.data.slot})`);
        setCreating(false);
        setCreateForm(EMPTY_FORM);
        await partnersQuery.refetch();
      } else {
        toast.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(): Promise<void> {
    if (!editing) return;
    const percent = Number(editForm.ownershipPercent);
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      toast.error("Ownership must be between 0 and 100");
      return;
    }
    setSubmitting(true);
    try {
      const payload: {
        ownerId: string;
        name: string;
        ownershipPercent: number;
        email?: string;
        password?: string;
      } = {
        ownerId: editing.ownerId,
        name: editForm.name.trim(),
        ownershipPercent: percent,
      };
      if (editForm.email.trim() && editForm.email.trim() !== editing.email) {
        payload.email = editForm.email.trim();
      }
      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }
      const res = await updateOwner(payload);
      if (res.success) {
        toast.success("Partner updated");
        setEditing(null);
        await partnersQuery.refetch();
      } else {
        toast.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(): Promise<void> {
    if (!archiving) return;
    setSubmitting(true);
    try {
      const res = await archiveOwner({ ownerId: archiving.ownerId });
      if (res.success) {
        toast.success(`Partner archived (slot ${res.data.freedSlot} freed)`);
        setArchiving(null);
        await partnersQuery.refetch();
      } else {
        toast.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (partnersQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading partners...</p>;
  }

  return (
    <div className="border-border bg-card space-y-5 rounded-xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Partners</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {partners.length}/{PARTNER_SLOTS.length} partners • {totalOwnership.toFixed(2)}% total
            ownership
          </p>
        </div>
        <Button
          disabled={atCap}
          className="rounded-lg"
          onClick={() => {
            setCreateForm(EMPTY_FORM);
            setCreating(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Partner
        </Button>
      </div>

      {!atCap ? (
        <p className="text-muted-foreground text-xs">
          Add a partner with their name, email, initial password, and ownership share. They will be
          assigned the next available slot (A, B, or C).
        </p>
      ) : (
        <p className="text-xs text-amber-600">
          All {PARTNER_SLOTS.length} partner slots are in use. Archive an existing partner to free a
          slot.
        </p>
      )}

      <div className="space-y-3">
        {partners.map((partner) => (
          <div
            key={partner.ownerId}
            className="border-border/70 bg-muted/35 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                <span className="text-primary text-sm font-semibold">{partner.slot}</span>
              </div>
              <div>
                <p className="font-medium">{partner.name}</p>
                <p className="text-foreground/60 text-xs">{partner.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums">
                {Number(partner.ownershipPercentage).toFixed(2)}%
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    setEditing(partner);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-amber-600 hover:text-amber-700"
                  onClick={() => {
                    setArchiving(partner);
                  }}
                >
                  <Archive className="mr-1 h-3.5 w-3.5" />
                  Archive
                </Button>
              </div>
            </div>
          </div>
        ))}
        {partners.length === 0 ? (
          <div className="border-border/70 bg-muted/20 rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">
              No partners yet. Add the first partner to get started.
            </p>
          </div>
        ) : null}
      </div>

      <Dialog
        open={creating}
        onOpenChange={(o) => {
          if (!o) setCreating(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Partner</DialogTitle>
            <DialogDescription>
              Create a new partner account. The next available slot (A, B, or C) will be assigned
              automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={createForm.name}
                onChange={(e) => {
                  setCreateForm((p) => ({ ...p, name: e.target.value }));
                }}
                placeholder="Partner name"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => {
                  setCreateForm((p) => ({ ...p, email: e.target.value }));
                }}
                placeholder="partner@bobsolar.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Initial Password</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => {
                  setCreateForm((p) => ({ ...p, password: e.target.value }));
                }}
                placeholder="At least 12 chars, with upper/lower/number/symbol"
              />
            </div>
            <div className="space-y-1">
              <Label>Ownership %</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={createForm.ownershipPercent}
                onChange={(e) => {
                  setCreateForm((p) => ({ ...p, ownershipPercent: e.target.value }));
                }}
                placeholder="33.33"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={submitting}>
              {submitting ? "Creating..." : "Add Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>
              Slot {editing?.slot} — changes are saved immediately. Leave password empty to keep the
              current one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => {
                  setEditForm((p) => ({ ...p, name: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => {
                  setEditForm((p) => ({ ...p, email: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>New Password (optional)</Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) => {
                  setEditForm((p) => ({ ...p, password: e.target.value }));
                }}
                placeholder="Leave empty to keep current"
              />
            </div>
            <div className="space-y-1">
              <Label>Ownership %</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={editForm.ownershipPercent}
                onChange={(e) => {
                  setEditForm((p) => ({ ...p, ownershipPercent: e.target.value }));
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleUpdate()} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!archiving}
        onOpenChange={(o) => {
          if (!o) setArchiving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Partner</DialogTitle>
            <DialogDescription>
              Archiving {archiving?.name} will mark them as inactive and revoke their login session.
              Their slot ({archiving?.slot}) will be freed for the next partner. All historical
              transactions are preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setArchiving(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleArchive()}
              disabled={submitting}
            >
              {submitting ? "Archiving..." : "Archive Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
