import type { Metadata } from "next";
import { getExpensesData } from "./actions";
import { ExpensesClient } from "./client";

export const metadata: Metadata = {
  title: "General Expenses",
  description: "Record and manage company operating expenses.",
};

export default async function ExpensesPage() {
  const result = await getExpensesData();

  if (!result.success) {
    return (
      <div className="w-full h-full p-4 md:p-8 flex items-center justify-center">
        <p className="text-destructive">Failed to load expenses data</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto">
      <ExpensesClient data={result.data} />
    </div>
  );
}
