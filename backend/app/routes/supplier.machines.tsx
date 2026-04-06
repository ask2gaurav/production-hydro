import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import Machine from "../models/Machine";
import MachineSupplier from "../models/MachineSupplier";
import MachineOwner from "../models/MachineOwner";
import User from "../models/User";

type LockContact = {
  supplier_name?: string;
  supplier_email?: string;
  supplier_phone?: string;
  supplier_available_hours?: string;
  custom_message?: string;
};

type MachineDoc = {
  _id: string;
  serial_number: string;
  model_name: string;
  machine_status: string;
  mode: string;
  demo_sessions_used: number;
  demo_session_limit: number;
  installation_location?: string;
  lock_screen_contact?: LockContact;
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

  const supplierUser = await User.findById(supplierId).lean() as any;

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
        lock_screen_contact: m.lock_screen_contact ?? {},
        owner: o
          ? { _id: o._id.toString(), first_name: o.first_name, last_name: o.last_name }
          : null,
      };
    })
    .filter(Boolean);

  const supplierDefaults = {
    supplier_name: `${supplierUser?.first_name ?? ''} ${supplierUser?.last_name ?? ''}`.trim(),
    supplier_email: supplierUser?.email ?? '',
    supplier_phone: supplierUser?.phone ?? '',
  };

  return { machines, supplierId, supplierDefaults };
}

export async function action({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "add_machine") {
    const serial_number = (formData.get("serial_number") as string)?.trim();
    const model_name = (formData.get("model_name") as string)?.trim();
    const machine_status = formData.get("machine_status") as string;
    const mode = formData.get("mode") as string;
    const demo_session_limit = parseInt(formData.get("demo_session_limit") as string) || 10;
    const installation_location = (formData.get("installation_location") as string)?.trim() || undefined;
    const production_date = (formData.get("production_date") as string) || undefined;

    if (!serial_number) return { error: "Serial number is required.", intent };
    if (!model_name) return { error: "Model name is required.", intent };
    if (!["Active", "Inactive", "Maintenance"].includes(machine_status)) return { error: "Invalid status.", intent };
    if (!["demo", "full"].includes(mode)) return { error: "Invalid mode.", intent };

    const existing = await Machine.findOne({ serial_number });
    if (existing) return { error: "A machine with this serial number already exists.", intent };

    const machine = await Machine.create({
      serial_number,
      model_name,
      machine_status,
      mode,
      demo_session_limit: mode === "demo" ? demo_session_limit : 10,
      installation_location,
      production_date: production_date ? new Date(production_date) : undefined,
    });

    await MachineSupplier.create({ machine_id: machine._id, supplier_id: supplierId });

    return { success: true, intent };
  }

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

  if (intent === "update_lock_contact") {
    const supplier_name = (formData.get("supplier_name") as string)?.trim();
    const supplier_email = (formData.get("supplier_email") as string)?.trim();
    const supplier_phone = (formData.get("supplier_phone") as string)?.trim();
    const supplier_available_hours = (formData.get("supplier_available_hours") as string)?.trim();
    const custom_message = (formData.get("custom_message") as string)?.trim();

    await Machine.findByIdAndUpdate(machine_id, {
      lock_screen_contact: { supplier_name, supplier_email, supplier_phone, supplier_available_hours, custom_message },
    });
    return { success: true, intent };
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
  const { machines, supplierDefaults } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [extendModal, setExtendModal] = useState<MachineDoc | null>(null);
  const [newLimit, setNewLimit] = useState("");
  const [reason, setReason] = useState("");

  const [addModal, setAddModal] = useState(false);
  const [addMode, setAddMode] = useState("demo");

  const [contactModal, setContactModal] = useState<MachineDoc | null>(null);
  const [contactForm, setContactForm] = useState<LockContact>({});

  const openContactModal = (m: MachineDoc) => {
    const existing = m.lock_screen_contact ?? {};
    setContactForm({
      supplier_name: existing.supplier_name || supplierDefaults.supplier_name,
      supplier_email: existing.supplier_email || supplierDefaults.supplier_email,
      supplier_phone: existing.supplier_phone || supplierDefaults.supplier_phone,
      supplier_available_hours: existing.supplier_available_hours || '',
      custom_message: existing.custom_message || '',
    });
    setContactModal(m);
  };

  useEffect(() => {
    if (actionData?.success) {
      setExtendModal(null);
      setNewLimit("");
      setReason("");
      if ((actionData as any).intent === "add_machine") {
        setAddModal(false);
        setAddMode("demo");
      }
      if ((actionData as any).intent === "update_lock_contact") {
        setContactModal(null);
        setContactForm({});
      }
    }
  }, [actionData]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Machines</h1>
          <p className="text-sm text-gray-500 mt-1">{machines.length} machine{machines.length !== 1 ? "s" : ""} assigned</p>
        </div>
        <button
          onClick={() => { setAddModal(true); setAddMode("demo"); }}
          className="px-4 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 text-sm font-medium"
        >
          + Add Machine
        </button>
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
                    <a
                      href={`/supplier/machines/${m._id}`}
                      className="text-teal-600 hover:underline text-xs font-medium"
                    >
                      View
                    </a>
                    <button
                      onClick={() => openContactModal(m)}
                      className="text-gray-600 hover:underline text-xs font-medium"
                    >
                      Edit Contact
                    </button>
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
                        &nbsp;|&nbsp;&nbsp;
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

      {/* Add Machine Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Add New Machine</h2>
              <button onClick={() => setAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <Form method="post" className="p-6 flex flex-col gap-4">
              <input type="hidden" name="intent" value="add_machine" />

              {actionData?.error && (actionData as any).intent === "add_machine" && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {actionData.error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                <input
                  name="serial_number"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
                <input
                  name="model_name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    name="machine_status"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode *</label>
                  <select
                    name="mode"
                    value={addMode}
                    onChange={(e) => setAddMode(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  >
                    <option value="demo">Demo</option>
                    <option value="full">Full</option>
                  </select>
                </div>
              </div>

              {addMode === "demo" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Demo Session Limit *</label>
                  <input
                    name="demo_session_limit"
                    type="number"
                    min={1}
                    defaultValue={10}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installation Location</label>
                <input
                  name="installation_location"
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Production Date</label>
                <input
                  name="production_date"
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Adding..." : "Add Machine"}
                </button>
                <button type="button" onClick={() => setAddModal(false)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                  Cancel
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Edit Lock Screen Contact Modal */}
      {contactModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Lock Screen Contact</h2>
                <p className="text-sm text-gray-500 mt-0.5 font-mono">{contactModal.serial_number}</p>
              </div>
              <button onClick={() => setContactModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <Form method="post" className="p-6 flex flex-col gap-4">
              <input type="hidden" name="intent" value="update_lock_contact" />
              <input type="hidden" name="machine_id" value={contactModal._id} />

              {actionData?.error && (actionData as any).intent === "update_lock_contact" && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {actionData.error}
                </div>
              )}

              <p className="text-xs text-gray-500">
                Shown on the lock screen when demo sessions are exhausted. Defaults to your account info if left unchanged.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                <input
                  name="supplier_name"
                  value={contactForm.supplier_name ?? ''}
                  onChange={(e) => setContactForm((f) => ({ ...f, supplier_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  name="supplier_email"
                  type="email"
                  value={contactForm.supplier_email ?? ''}
                  onChange={(e) => setContactForm((f) => ({ ...f, supplier_email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  name="supplier_phone"
                  type="tel"
                  value={contactForm.supplier_phone ?? ''}
                  onChange={(e) => setContactForm((f) => ({ ...f, supplier_phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Available Hours</label>
                <input
                  name="supplier_available_hours"
                  placeholder="e.g. Mon–Fri, 9am–6pm"
                  value={contactForm.supplier_available_hours ?? ''}
                  onChange={(e) => setContactForm((f) => ({ ...f, supplier_available_hours: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Message</label>
                <textarea
                  name="custom_message"
                  rows={2}
                  placeholder="e.g. Contact us to activate full mode."
                  value={contactForm.custom_message ?? ''}
                  onChange={(e) => setContactForm((f) => ({ ...f, custom_message: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Contact"}
                </button>
                <button type="button" onClick={() => setContactModal(null)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                  Cancel
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

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
