"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import {
  createSettingsUser,
  getSettingsUsers,
  resetSettingsUserPassword,
  updateSettingsUser,
} from "@/actions/settings-actions";
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
import { USER_CAP } from "@/lib/domain/policies";
import { settingsKeys } from "@/lib/query-keys";

type EditableUser = {
  id: string;
  name: string;
  email: string;
};

export function UserManagementTab(): React.JSX.Element {
  const usersQuery = useQuery({
    queryKey: settingsKeys.users(),
    queryFn: async () => {
      const res = await getSettingsUsers();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const [editing, setEditing] = React.useState<EditableUser | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [newUser, setNewUser] = React.useState({
    name: "",
    email: "",
    password: "",
  });

  const users = usersQuery.data?.users ?? [];
  const isAdmin = usersQuery.data?.isAdmin ?? false;

  async function handleUpdate(): Promise<void> {
    if (!editing) return;
    const res = await updateSettingsUser(editing);
    if (res.success) {
      toast.success("User updated");
      setEditing(null);
      void usersQuery.refetch();
    } else {
      toast.error(res.error);
    }
  }

  async function handleCreate(): Promise<void> {
    const res = await createSettingsUser(newUser);
    if (res.success) {
      toast.success("User created");
      setCreating(false);
      setNewUser({ name: "", email: "", password: "" });
      void usersQuery.refetch();
    } else {
      toast.error(res.error);
    }
  }

  async function handleResetPassword(userId: string): Promise<void> {
    const res = await resetSettingsUserPassword(userId);
    if (res.success) {
      toast.success(`Temp password: ${res.data.temporaryPassword}`);
    } else {
      toast.error(res.error);
    }
  }

  if (usersQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading users...</p>;
  }

  return (
    <div className="border-border bg-card space-y-5 rounded-xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-lg font-semibold">User Management</h3>
        {isAdmin ? (
          <Button
            disabled={users.length >= USER_CAP}
            className="rounded-lg"
            onClick={() => {
              setCreating(true);
            }}
          >
            Add User
          </Button>
        ) : null}
      </div>
      {isAdmin ? (
        <p className="text-muted-foreground text-xs">
          Maximum {USER_CAP} users allowed. Current: {users.length}/{USER_CAP}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Only admins can manage users. Showing your account only.
        </p>
      )}

      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="border-border/70 bg-muted/35 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-foreground/60 text-xs">{user.email}</p>
            </div>
            {isAdmin ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    setEditing({
                      id: user.id,
                      name: user.name,
                      email: user.email,
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => void handleResetPassword(user.id)}
                >
                  Reset Password
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update name, email and role.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => {
                    setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  value={editing.email}
                  onChange={(e) => {
                    setEditing((prev) => (prev ? { ...prev, email: e.target.value } : prev));
                  }}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleUpdate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={newUser.name}
                onChange={(e) => {
                  setNewUser((p) => ({ ...p, name: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={newUser.email}
                onChange={(e) => {
                  setNewUser((p) => ({ ...p, email: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Initial Password</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => {
                  setNewUser((p) => ({ ...p, password: e.target.value }));
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
