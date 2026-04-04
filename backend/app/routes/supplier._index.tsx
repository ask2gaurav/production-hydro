import { useLoaderData } from "react-router";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import MachineSupplier from "../models/MachineSupplier";
import User from "../models/User";
import UserType from "../models/UserType";
import Session from "../models/Session";

export async function loader({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const ownerType = await UserType.findOne({ name: "Owner" }).lean();

  const [machineAssignments, ownerCount] = await Promise.all([
    MachineSupplier.find({ supplier_id: supplierId }).lean(),
    ownerType
      ? User.countDocuments({ supplier_id: supplierId, user_type_id: (ownerType as any)._id, is_active: true })
      : Promise.resolve(0),
  ]);

  const machineIds = machineAssignments.map((a: any) => a.machine_id);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sessionCount = await Session.countDocuments({
    machine_id: { $in: machineIds },
    start_time: { $gte: monthStart },
  });

  return {
    machineCount: machineIds.length,
    ownerCount,
    sessionCount,
    monthLabel: now.toLocaleString("default", { month: "long", year: "numeric" }),
  };
}

export default function SupplierDashboard() {
  const { machineCount, ownerCount, sessionCount, monthLabel } = useLoaderData<typeof loader>();

  const stats = [
    { label: "Machines Assigned", value: machineCount, color: "bg-teal-50 border-teal-200 text-teal-700" },
    { label: "Active Owners", value: ownerCount, color: "bg-blue-50 border-blue-200 text-blue-700" },
    { label: `Sessions (${monthLabel})`, value: sessionCount, color: "bg-purple-50 border-purple-200 text-purple-700" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-lg border p-6 ${s.color}`}>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm mt-1 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <a href="/supplier/machines" className="block bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="font-semibold text-gray-800 mb-1">My Machines</h2>
          <p className="text-sm text-gray-500">View assigned machines, extend demo sessions, and change mode.</p>
        </a>
        <a href="/supplier/owners" className="block bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="font-semibold text-gray-800 mb-1">My Owners</h2>
          <p className="text-sm text-gray-500">Manage owners, assign machines, and view session activity.</p>
        </a>
        <a href="/supplier/invoices" className="block bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="font-semibold text-gray-800 mb-1">Invoicesss</h2>
          <p className="text-sm text-gray-500">Create invoices, record payments, and track balances.</p>
        </a>
        <a href="/supplier/resources" className="block bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="font-semibold text-gray-800 mb-1">Resources</h2>
          <p className="text-sm text-gray-500">Manage help articles and guides displayed to owners on the PWA.</p>
        </a>
      </div>
    </div>
  );
}
