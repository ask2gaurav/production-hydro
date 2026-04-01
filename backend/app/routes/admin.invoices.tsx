import { useLoaderData } from "react-router";
import { connectDB } from "../lib/db";
import Invoice from "../models/Invoice";

export async function loader() {
  await connectDB();
  const invoices = await Invoice.find({}).populate('owner_id machine_id').lean();
  return { invoices };
}

export default function AdminInvoices() {
  const { invoices } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-3xl font-bold text-gray-800">Invoices & Billing</h1>
         <button className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">Create Invoice</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
