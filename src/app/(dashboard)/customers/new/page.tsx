'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { CustomerDialog } from '@/components/customers/customer-dialog';

export default function NewCustomerPage(): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        router.replace('/customers');
      }
    },
    [router],
  );

  return <CustomerDialog open={open} onOpenChange={handleOpenChange} />;
}
