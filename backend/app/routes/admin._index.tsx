import { useLoaderData } from "react-router";
import { connectDB } from "../lib/db";
import Machine from "../models/Machine";
import User from "../models/User";
import Invoice from "../models/Invoice";

export async function loader() {
  await connectDB();
  const machineCount = await Machine.countDocuments({});
  const activeOwners = await User.countDocuments({ user_type_id: { $exists: true } }); // Simplified for demo
  const pendingInvoices = await Invoice.countDocuments({ status: { $ne: 'Paid' } });
  
  return { machineCount, activeOwners, pendingInvoices };
}

export default function AdminDashboard() {
  const { machineCount, activeOwners, pendingInvoices } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Summary</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">TOTAL MACHINES</h2>
          <div className="text-4xl font-extrabold text-blue-600">{machineCount}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">ACTIVE OWNERS</h2>
          <div className="text-4xl font-extrabold text-green-600">{activeOwners}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">PENDING INVOICES</h2>
          <div className="text-4xl font-extrabold text-orange-500">{pendingInvoices}</div>
        </div>
      </div>
    </div>
  );
}
