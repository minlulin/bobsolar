'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createSettingsUser,
  getSettingsUsers,
  resetSettingsUserPassword,
  updateSettingsUser,
} from '@/actions/settings-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type EditableUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
};

export function UserManagementTab() {
  const usersQuery = useQuery({
    queryKey: ['settings', 'users'],
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
    name: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    password: '',
  });

  const isAdmin = usersQuery.data?.isAdmin ?? false;
  const users = usersQuery.data?.users ?? [];
  const me = usersQuery.data?.me ?? null;

  async function handleUpdate() {
    if (!editing) return;
    const res = await updateSettingsUser(editing);
    if (res.success) {
      toast.success('User updated');
      setEditing(null);
      void usersQuery.refetch();
    } else {
      toast.error(res.error);
    }
  }

  async function handleCreate() {
    const res = await createSettingsUser(newUser);
    if (res.success) {
      toast.success('User created');
      setCreating(false);
      setNewUser({ name: '', email: '', role: 'staff', password: '' });
      void usersQuery.refetch();
    } else {
      toast.error(res.error);
    }
  }

  async function handleResetPassword(userId: string) {
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

  if (!isAdmin) {
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/55 p-6">
        <h3 className="font-heading text-lg font-semibold">Your Profile</h3>
        <p className="text-sm text-white/80">Name: {me?.name ?? '-'}</p>
        <p className="text-sm text-white/80">Email: {me?.email ?? '-'}</p>
        <p className="text-sm text-white/80">Role: {me?.role ?? '-'}</p>
        <p className="text-muted-foreground text-xs">
          You can update your password in Account & Security.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold">User Management</h3>
        <Button disabled={users.length >= 3} onClick={() => setCreating(true)}>
          Add User
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Maximum 3 users allowed. Current: {users.length}/3
      </p>

      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-white/60">{user.email}</p>
              <p className="text-xs text-amber-300 uppercase">{user.role}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEditing({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role as 'admin' | 'staff',
                  })
                }
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleResetPassword(user.id)}
              >
                Reset Password
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
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
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  value={editing.email}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, email: e.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select
                  value={editing.role}
                  onValueChange={(value) =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, role: value as 'admin' | 'staff' }
                        : prev,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="staff">staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
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
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={newUser.email}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value) =>
                  setNewUser((p) => ({
                    ...p,
                    role: value as 'admin' | 'staff',
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="staff">staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Initial Password</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, password: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
