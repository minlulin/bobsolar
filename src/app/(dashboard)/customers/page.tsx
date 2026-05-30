import { getCustomers } from "@/actions/customer-actions";
import { CustomersPageClient } from "./components/customers-page-client";

export default async function CustomersPage(): Promise<React.JSX.Element> {
  const response = await getCustomers({ limit: 50 });
  const initialData = response.success ? response.data : { items: [], total: 0 };

  return <CustomersPageClient initialData={initialData} />;
}
