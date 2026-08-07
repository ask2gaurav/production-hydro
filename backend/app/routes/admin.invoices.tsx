import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import { connectDB } from "../lib/db";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import Invoice from "../models/Invoice";

type InvoiceDoc = {
  _id: string;
  invoice_number: string;
  invoice_type: string;
  total_amount: number;
  balance: number;
  status: string;
};

export async function loader() {
  await connectDB();
  const invoices = await Invoice.find({}).populate('owner_id machine_id').lean();
  return { invoices };
}

export async function action({ request }: { request: Request }) {
  await connectDB();
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "hard_delete") {
    const id = formData.get("id") as string;
    await Invoice.findByIdAndDelete(id);
    return { success: true };
  }

  return { error: "Unknown intent." };
}

export default function AdminInvoices() {
  const { invoices } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [deleteTarget, setDeleteTarget] = useState<InvoiceDoc | null>(null);

  useEffect(() => {
    if (actionData?.success) {
      setDeleteTarget(null);
    }
  }, [actionData]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-3xl font-bold text-gray-800">Invoices & Billing</h1>
         <button className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">Create Invoice</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inv Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.map((inv: any) => (
              <tr key={inv._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inv.invoice_type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${inv.total_amount} (Balance: ${inv.balance})</td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                     {inv.status}
                   </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <span className="text-indigo-600 hover:text-indigo-900 cursor-pointer">View</span>
                  &nbsp;|&nbsp;
                  <span
                    onClick={() => setDeleteTarget(inv as InvoiceDoc)}
                    className="text-red-700 hover:underline cursor-pointer font-bold"
                  >
                    Delete
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title={`Delete Invoice ${deleteTarget?.invoice_number ?? ""}`}
        warningText={<>This invoice has no linked records. This cannot be undone.</>}
        id={deleteTarget?._id ?? ""}
        isSubmitting={isSubmitting}
        error={deleteTarget ? actionData?.error : null}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
