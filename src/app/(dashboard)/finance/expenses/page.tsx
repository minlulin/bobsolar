import type { Metadata } from "next";
import { getExpensesData } from "./actions";
import { ExpensesClient } from "./client";

export const metadata: Metadata = {
  title: "General Expenses",
  description: "Record and manage company operating expenses.",
};

export default async function ExpensesPage() {
  const data = await getExpensesData();

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto">
      <ExpensesClient data={data} />
    </div>
  );
}
