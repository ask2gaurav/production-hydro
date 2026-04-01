import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import Machine from "../models/Machine";
import MachineSupplier from "../models/MachineSupplier";
import MachineOwner from "../models/MachineOwner";

type MachineDoc = {
  _id: string;
  serial_number: string;
  model_name: string;
  machine_status: string;
  mode: string;
  demo_sessions_used: number;
  demo_session_limit: number;
  installation_location?: string;
  owner?: { _id: string; first_name: string; last_name: string } | null;
};

export async function loader({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const assignments = await MachineSupplier.find({ supplier_id: supplierId })
    .populate("machine_id")
    .lean();

  const machineIds = assignments.map((a: any) => (a.machine_id as any)?._id);

  const ownerAssignments = await MachineOwner.find({ machine_id: { $in: machineIds } })
    .populate("owner_id", "first_name last_name")
    .lean();

  const machines = assignments
    .map((a: any) => {
      const m = a.machine_id as any;
      if (!m) return null;
      const ownerAssign = ownerAssignments.find(
        (oa: any) => oa.machine_id?.toString() === m._id?.toString()
      );
      const o = ownerAssign?.owner_id as any;
      return {
        _id: m._id.toString(),
        serial_number: m.serial_number,
        model_name: m.model_name,
        machine_status: m.machine_status,
        mode: m.mode,
        demo_sessions_used: m.demo_sessions_used ?? 0,
        demo_session_limit: m.demo_session_limit ?? 10,
        installation_location: m.installation_location ?? null,
        owner: o
          ? { _id: o._id.toString(), first_name: o.first_name, last_name: o.last_name }
          : null,
      };
    })
    .filter(Boolean);

  return { machines, supplierId };
}

export async function action({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const machine_id = formData.get("machine_id") as string;

  // Verify machine belongs to this supplier
  const supplierMachine = await MachineSupplier.findOne({ machine_id, supplier_id: supplierId });
  if (!supplierMachine) return { error: "Machine not found in your inventory." };

  if (intent === "extend_demo") {
    const new_limit = parseInt(formData.get("new_limit") as string);
    const reason = (formData.get("reason") as string)?.trim();

    if (!new_limit || new_limit < 1) return { error: "Please enter a valid session limit." };

    const machine = await Machine.findById(machine_id);
    if (!machine) return { error: "Machine not found." };

    if (machine.mode !== "demo") return { error: "Machine is not in demo mode." };

    machine.demo_extended_at.push({
      extended_by: supplierId,
      previous_limit: machine.demo_session_limit,
      new_limit,
      reason: reason || "",
      timestamp: new Date(),
    });
    machine.demo_session_limit = new_limit;
    await machine.save();

    return { success: true };
  }

  if (intent === "activate_full") {
    const machine = await Machine.findById(machine_id);
    if (!machine) return { error: "Machine not found." };
    if (machine.mode === "full") return { error: "Machine is already in full mode." };

    machine.mode = "full";
    machine.activated_full_mode_by = supplierId;
    machine.activated_full_mode_at = new Date();
    await machine.save();

    return { success: true };
  }

  if (intent === "set_demo") {
    await Machine.findByIdAndUpdate(machine_id, { mode: "demo" });
    return { success: true };
  }

  return { error: "Unknown intent." };
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-red-100 text-red-700",
  Maintenance: "bg-yellow-100 text-yellow-700",
};

const MODE_COLORS: Record<string, string> = {
  demo: "bg-yellow-100 text-yellow-700",
  full: "bg-blue-100 text-blue-700",
};

export default function SupplierMachines() {
  const { machines } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [extendModal, setExtendModal] = useState<MachineDoc | null>(null);
  const [newLimit, setNewLimit] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (actionData?.success) {
      setExtendModal(null);
      setNewLimit("");
      setReason("");
    }
  }, [actionData]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Machines</h1>
        <p className="text-sm text-gray-500 mt-1">{machines.length} machine{machines.length !== 1 ? "s" : ""} assigned</p>
      </div>

      {actionData?.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {actionData.error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Serial No.</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Model</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Mode</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Demo Sessions</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {machines.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">
                  No machines assigned to you yet.
                </td>
              </tr>
            )}
            {machines.map((m: any) => (
              <tr key={m._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{m.serial_number}</td>
                <td className="px-4 py-3 text-gray-800">{m.model_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.machine_status] || "bg-gray-100 text-gray-600"}`}>
                    {m.machine_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MODE_COLORS[m.mode] || "bg-gray-100 text-gray-600"}`}>
                    {m.mode}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">
                  {m.mode === "demo" ? `${m.demo_sessions_used} / ${m.demo_session_limit}` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">
                  {m.owner
                    ? <a href={`/supplier/owners/${m.owner._id}`} className="text-teal-600 hover:underline">{m.owner.first_name} {m.owner.last_name}</a>
                    : <span className="text-gray-400">Unassigned</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {m.mode === "demo" && (
                      <button
                        onClick={() => { setExtendModal(m); setNewLimit(String(m.demo_session_limit)); setReason(""); }}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Extend Demo
                      </button>
                    )}
                    {m.mode === "demo" && (
                      <Form
                        method="post"
                        onSubmit={(e) => { if (!confirm("Activate full mode? This will unlock unlimited sessions.")) e.preventDefault(); }}
                      >
                        <input type="hidden" name="intent" value="activate_full" />
                        <input type="hidden" name="machine_id" value={m._id} />
                        <button type="submit" className="text-teal-600 hover:underline text-xs font-medium" disabled={isSubmitting}>
                          Activate Full
                        </button>
                      </Form>
                    )}
                    {m.mode === "full" && (
                      <Form
                        method="post"
                        onSubmit={(e) => { if (!confirm("Switch back to demo mode?")) e.preventDefault(); }}
                      >
                        <input type="hidden" name="intent" value="set_demo" />
                        <input type="hidden" name="machine_id" value={m._id} />
                        <button type="submit" className="text-yellow-600 hover:underline text-xs font-medium" disabled={isSubmitting}>
                          Set Demo
                        </button>
                      </Form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Extend Demo Modal */}
      {extendModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Extend Demo Sessions</h2>
                <p className="text-sm text-gray-500 mt-0.5 font-mono">{extendModal.serial_number}</p>
              </div>
              <button onClick={() => setExtendModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <Form method="post" className="p-6 flex flex-col gap-4">
              <input type="hidden" name="intent" value="extend_demo" />
              <input type="hidden" name="machine_id" value={extendModal._id} />

              {actionData?.error && extendModal && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {actionData.error}
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Current limit: <strong>{extendModal.demo_session_limit}</strong> sessions
                  &nbsp;({extendModal.demo_sessions_used} used)
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Session Limit *</label>
                <input
                  name="new_limit"
                  type="number"
                  min={extendModal.demo_sessions_used + 1}
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Extend Limit"}
                </button>
                <button type="button" onClick={() => setExtendModal(null)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                  Cancel
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
