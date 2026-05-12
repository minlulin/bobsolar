'use client';

import * as React from 'react';
import { changePassword } from '@/actions/auth-actions';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function AccountTab(): React.JSX.Element {
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    const form = e.currentTarget;
    startTransition((): void => {
      void (async (): Promise<void> => {
        const res = await changePassword(formData);
        if (res.success) {
          toast.success('Password changed successfully');
          form.reset();
        } else {
          toast.error(res.error || 'Failed to change password');
        }
      })();
    });
  };

  return (
    <div className="space-y-8">
      <div className="border-border bg-card/80 max-w-2xl space-y-6 rounded-[2rem] border p-8 backdrop-blur">
        <Label className="text-[11px] font-bold tracking-[0.3em] uppercase">
          Change Password
        </Label>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label
              htmlFor="currentPassword"
              className="text-muted-foreground text-xs"
            >
              Current Password
            </Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              className="border-border/70 bg-muted/45"
            />
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="newPassword"
              className="text-muted-foreground text-xs"
            >
              New Password
            </Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              className="border-border/70 bg-muted/45"
            />
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="confirmPassword"
              className="text-muted-foreground text-xs"
            >
              Confirm New Password
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="border-border/70 bg-muted/45"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="bg-solar hover:bg-solar/90 text-foreground mt-4 w-full sm:w-auto"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}
