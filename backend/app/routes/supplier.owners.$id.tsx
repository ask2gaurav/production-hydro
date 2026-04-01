import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import User from "../models/User";
import Machine from "../models/Machine";
import MachineOwner from "../models/MachineOwner";
import MachineSupplier from "../models/MachineSupplier";
import Session from "../models/Session";
import Therapist from "../models/Therapist";
import Patient from "../models/Patient";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const owner = await User.findOne({ _id: params.id, supplier_id: supplierId }).lean();
  if (!owner) throw new Response("Owner not found", { status: 404 });

  // Get supplier's machines for assignment dropdown (not already owned by someone)
  const supplierMachineAssignments = await MachineSupplier.find({ supplier_id: supplierId }).lean();
  const supplierMachineIds = supplierMachineAssignments.map((a: any) => a.machine_id);

  // Machines already assigned to an owner
  const ownedMachineIds = await MachineOwner.distinct("machine_id");

  // This owner's current assignment
  const ownerAssignment = await MachineOwner.findOne({ owner_id: params.id })
    .populate("machine_id", "serial_number model_name machine_status mode demo_sessions_used demo_session_limit")
    .lean();

  const assignedMachine = ownerAssignment?.machine_id as any;

  // Available machines: in supplier's pool AND not owned by anyone (excluding current owner's machine)
  const alreadyOwnedExcludingCurrent = ownedMachineIds
    .map((id: any) => id.toString())
    .filter((id: string) => id !== assignedMachine?._id?.toString());

  const availableMachines = await Machine.find({
    _id: {
      $in: supplierMachineIds,
      $nin: alreadyOwnedExcludingCurrent,
    },
    machine_status: { $ne: "Inactive" },
  })
    .select("serial_number model_name")
    .lean();

  // Sessions, therapists, patients for the assigned machine
  let sessions: any[] = [];
  let therapists: any[] = [];
  let patients: any[] = [];

  if (assignedMachine) {
    const machineId = assignedMachine._id;
    [sessions, therapists, patients] = await Promise.all([
      Session.find({ machine_id: machineId }).sort({ start_time: -1 }).limit(50).lean(),
      Therapist.find({ machine_id: machineId, is_active: true }).lean(),
      Patient.find({ machine_id: machineId, is_active: true }).lean(),
    ]);
  }

  const serialize = (obj: any) => JSON.parse(JSON.stringify(obj));

  return {
    owner: { ...serialize(owner), _id: owner._id.toString() },
    assignedMachine: assignedMachine
      ? {
          _id: assignedMachine._id.toString(),
          serial_number: assignedMachine.serial_number,
          model_name: assignedMachine.model_name,
          machine_status: assignedMachine.machine_status,
          mode: assignedMachine.mode,
          demo_sessions_used: assignedMachine.demo_sessions_used,
          demo_session_limit: assignedMachine.demo_session_limit,
        }
      : null,
    availableMachines: availableMachines.map((m: any) => ({
      _id: m._id.toString(),
      serial_number: m.serial_number,
      model_name: m.model_name,
    })),
    sessions: sessions.map((s: any) => ({
      _id: s._id.toString(),
      start_time: s.start_time?.toISOString() ?? null,
      end_time: s.end_time?.toISOString() ?? null,
      duration_minutes: s.duration_minutes,
      status: s.status,
    })),
    therapists: therapists.map((t: any) => ({
      _id: t._id.toString(),
      first_name: t.first_name,
      last_name: t.last_name,
      phone: t.phone,
    })),
    patients: patients.map((p: any) => ({
      _id: p._id.toString(),
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone,
    })),
  };
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  // Verify owner belongs to this supplier
  const owner = await User.findOne({ _id: params.id, supplier_id: supplierId });
  if (!owner) return { error: "Owner not found." };

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "assign_machine") {
    const machine_id = formData.get("machine_id") as string;
    if (!machine_id) return { error: "Please select a machine." };

    // Verify machine belongs to this supplier
    const supplierMachine = await MachineSupplier.findOne({ machine_id, supplier_id: supplierId });
    if (!supplierMachine) return { error: "Machine not found in your inventory." };

    // Verify machine is not already assigned to another owner
    const existing = await MachineOwner.findOne({ machine_id });
    if (existing && existing.owner_id.toString() !== params.id) {
      return { error: "This machine is already assigned to another owner." };
    }

    if (existing) {
      await MachineOwner.findByIdAndUpdate(existing._id, { machine_id, supplier_id: supplierId });
    } else {
      await MachineOwner.create({
        machine_id,
        owner_id: params.id,
        supplier_id: supplierId,
        sale_date: new Date(),
      });
    }
    return { success: true };
  }

  if (intent === "unassign_machine") {
    await MachineOwner.findOneAndDelete({ owner_id: params.id, supplier_id: supplierId });
    return { success: true };
  }

  return { error: "Unknown intent." };
}

function statusColor(status: string) {
  if (status === "Completed") return "bg-green-100 text-green-700";
  if (status === "Abandoned") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
}

export default function SupplierOwnerDetail() {
  const { owner, assignedMachine, availableMachines, sessions, therapists, patients } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <a href="/supplier/owners" className="text-sm text-teal-600 hover:underline mb-4 inline-block">
        ← Back to Owners
      </a>

      {/* Owner Info */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {owner.first_name} {owner.last_name}
            </h1>
            <p className="text-gray-500 text-sm mt-1">{owner.email}</p>
            {owner.phone && <p className="text-gray-500 text-sm">{owner.phone}</p>}
            {owner.address && <p className="text-gray-500 text-sm">{owner.address}</p>}
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              owner.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {owner.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {actionData?.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {actionData.error}
        </div>
      )}

      {/* Machine Assignment */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Assigned Machine</h2>

        {assignedMachine ? (
          <div className="flex items-center justify-between bg-gray-50 rounded border border-gray-200 px-4 py-3">
            <div>
              <p className="font-mono text-sm font-semibold text-gray-800">{assignedMachine.serial_number}</p>
              <p className="text-sm text-gray-500">{assignedMachine.model_name}</p>
              <div className="flex gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  assignedMachine.machine_status === "Active" ? "bg-green-100 text-green-700" :
                  assignedMachine.machine_status === "Maintenance" ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>{assignedMachine.machine_status}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  assignedMachine.mode === "full" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                }`}>{assignedMachine.mode}</span>
                {assignedMachine.mode === "demo" && (
                  <span className="text-xs text-gray-500">
                    {assignedMachine.demo_sessions_used}/{assignedMachine.demo_session_limit} sessions
                  </span>
                )}
              </div>
            </div>
            <Form method="post" onSubmit={(e) => { if (!confirm("Unassign this machine from the owner?")) e.preventDefault(); }}>
              <input type="hidden" name="intent" value="unassign_machine" />
              <button type="submit" className="text-red-500 hover:underline text-sm font-medium">
                Unassign
              </button>
            </Form>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-3">No machine assigned.</p>
            {availableMachines.length > 0 ? (
              <Form method="post" className="flex gap-2">
                <input type="hidden" name="intent" value="assign_machine" />
                <select name="machine_id" className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm">
                  <option value="">Select a machine...</option>
                  {availableMachines.map((m: any) => (
                    <option key={m._id} value={m._id}>
                      {m.serial_number} — {m.model_name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 text-sm font-medium disabled:opacity-50"
                >
                  Assign
                </button>
              </Form>
            ) : (
              <p className="text-sm text-gray-400">No available machines in your inventory.</p>
            )}
          </div>
        )}
      </div>

      {/* Therapists */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Therapists ({therapists.length})</h2>
        {therapists.length === 0 ? (
          <p className="text-sm text-gray-400">No therapists registered.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Name</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {therapists.map((t: any) => (
                <tr key={t._id}>
                  <td className="px-3 py-2 text-gray-800">{t.first_name} {t.last_name}</td>
                  <td className="px-3 py-2 text-gray-600">{t.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Patients */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Patients ({patients.length})</h2>
        {patients.length === 0 ? (
          <p className="text-sm text-gray-400">No patients registered.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Name</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patients.map((p: any) => (
                <tr key={p._id}>
                  <td className="px-3 py-2 text-gray-800">{p.first_name} {p.last_name}</td>
                  <td className="px-3 py-2 text-gray-600">{p.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sessions */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Sessions ({sessions.length})</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400">No sessions recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Start</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Duration</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((s: any) => (
                <tr key={s._id}>
                  <td className="px-3 py-2 text-gray-800">
                    {s.start_time ? new Date(s.start_time).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{s.duration_minutes} min</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
