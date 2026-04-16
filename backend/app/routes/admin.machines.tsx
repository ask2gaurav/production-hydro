import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState, useEffect, useRef } from "react";
import { connectDB } from "../lib/db";
import Machine from "../models/Machine";

const LIMIT = 50;

type MachineDoc = {
  _id: string;
  model_name: string;
  serial_number: string;
  machine_status: string;
  mode: string;
  production_date?: string;
  asset_type?: string;
  installation_date?: string;
  installation_location?: string;
  ssid?: string;
  password?: string;
};

export async function loader({ request }: { request: Request }) {
  await connectDB();
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const skip = (page - 1) * LIMIT;

  const [rawMachines, total] = await Promise.all([
    Machine.find({}).sort({ createdAt: -1 }).skip(skip).limit(LIMIT).lean(),
    Machine.countDocuments({}),
  ]);

  const machines = rawMachines.map((m: any) => ({
    ...m,
    _id: m._id.toString(),
    production_date: m.production_date?.toISOString() ?? null,
    installation_date: m.installation_date?.toISOString() ?? null,
  }));

  return { machines, total, page, totalPages: Math.ceil(total / LIMIT) };
}

export async function action({ request }: { request: Request }) {
  await connectDB();
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const model_name = (formData.get("model_name") as string)?.trim();
    const serial_number = (formData.get("serial_number") as string)?.trim();
    if (!model_name || !serial_number) {
      return { error: "Model name and serial number are required." };
    }
    try {
      await Machine.create({
        model_name,
        serial_number,
        machine_status: formData.get("machine_status") || "Active",
        mode: formData.get("mode") || "demo",
        production_date: formData.get("production_date") || undefined,
        asset_type: (formData.get("asset_type") as string)?.trim() || undefined,
        installation_date: formData.get("installation_date") || undefined,
        installation_location:
          (formData.get("installation_location") as string)?.trim() || undefined,
        ssid: (formData.get("ssid") as string)?.trim() || undefined,
        password: (formData.get("password") as string)?.trim() || undefined,
      });
      return { success: true };
    } catch (e: any) {
      if (e.code === 11000) return { error: "Serial number already exists." };
      return { error: "Failed to create machine." };
    }
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    const model_name = (formData.get("model_name") as string)?.trim();
    const serial_number = (formData.get("serial_number") as string)?.trim();
    if (!model_name || !serial_number) {
      return { error: "Model name and serial number are required." };
    }
    try {
      const existing = await Machine.findById(id);
      const updateData: any = {
        model_name,
        serial_number,
        machine_status: formData.get("machine_status"),
        mode: formData.get("mode"),
        production_date: formData.get("production_date") || undefined,
        asset_type: (formData.get("asset_type") as string)?.trim() || undefined,
        installation_date: formData.get("installation_date") || undefined,
        installation_location:
          (formData.get("installation_location") as string)?.trim() || undefined,
      };
      if (!existing?.ssid) updateData.ssid = (formData.get("ssid") as string)?.trim() || undefined;
      if (!existing?.password) updateData.password = (formData.get("password") as string)?.trim() || undefined;
      await Machine.findByIdAndUpdate(id, updateData);
      return { success: true };
    } catch (e: any) {
      if (e.code === 11000) return { error: "Serial number already exists." };
      return { error: "Failed to update machine." };
    }
  }

  if (intent === "delete") {
    await Machine.findByIdAndUpdate(formData.get("id"), {
      machine_status: "Inactive",
    });
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

function toInputDate(val?: string) {
  if (!val) return "";
  return new Date(val).toISOString().split("T")[0];
}

function genSsid() {
  return "Colonima" + String(Math.floor(1000 + Math.random() * 9000));
}

function genPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 9 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

export default function AdminMachines() {
  const { machines, total, page, totalPages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MachineDoc | null>(null);
  const [newSsid, setNewSsid] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const installationDateRef = useRef<HTMLInputElement>(null);
  const productionDateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (actionData?.success) {
      setModalOpen(false);
      setEditItem(null);
    }
  }, [actionData]);

  const openCreate = () => {
    setEditItem(null);
    setNewSsid(genSsid());
    setNewPassword(genPassword());
    setModalOpen(true);
  };
  const openEdit = (m: MachineDoc) => {
    setEditItem(m);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Machines</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total records</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium"
        >
          + Add Machine
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Serial No.</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Model</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Mode</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">SSID</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Password</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {machines.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400">
                  No machines found.
                </td>
              </tr>
            )}
            {machines.map((m: any) => (
              <tr key={m._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{m.serial_number}</td>
                <td className="px-4 py-3 text-gray-800">{m.model_name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[m.machine_status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {m.machine_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      MODE_COLORS[m.mode] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {m.mode}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">
                  {m.installation_location || "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{m.ssid || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{m.password || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(m as MachineDoc)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Edit
                    </button>
                    &nbsp;|&nbsp;
                    {m.machine_status !== "Inactive" && (
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm("Deactivate this machine?")) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={m._id} />
                        <button
                          type="submit"
                          className="text-red-500 hover:underline text-xs font-medium"
                        >
                          Deactivate
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
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4 text-sm">
          <a
            href={`?page=${page - 1}`}
            className={page <= 1 ? "pointer-events-none opacity-40" : ""}
          >
            <span className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50 cursor-pointer">
              ← Previous
            </span>
          </a>
          <span className="text-gray-600">
            Page {page} of {totalPages}
          </span>
          <a
            href={`?page=${page + 1}`}
            className={page >= totalPages ? "pointer-events-none opacity-40" : ""}
          >
            <span className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50 cursor-pointer">
              Next →
            </span>
          </a>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editItem ? "Edit Machine" : "Add Machine"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <Form method="post" className="p-6 flex flex-col gap-4">
              <input type="hidden" name="intent" value={editItem ? "update" : "create"} />
              {editItem && <input type="hidden" name="id" value={editItem._id} />}

              {actionData?.error && modalOpen && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {actionData.error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
                  <input name="model_name" defaultValue={editItem?.model_name} required className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                  <input name="serial_number" defaultValue={editItem?.serial_number} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="machine_status" defaultValue={editItem?.machine_status || "Active"} className={inputCls}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                  <select name="mode" defaultValue={editItem?.mode || "demo"} className={inputCls}>
                    <option value="demo">Demo</option>
                    <option value="full">Full</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
                  <input name="asset_type" defaultValue={editItem?.asset_type} className={inputCls} />
                </div>
                <div style={{position:'relative'}}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Production Date</label>
                  <input ref={productionDateRef} type="date" name="production_date" defaultValue={toInputDate(editItem?.production_date)} className={inputCls} />
                  <span style={{ position: 'absolute', right: '10px', top: '70%', transform: 'translateY(-50%)', cursor: 'pointer' }} onClick={() => { productionDateRef.current?.showPicker() }}>📅</span>
                </div>
                <div style={{position:'relative'}}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
                  <input ref={installationDateRef} type="date" name="installation_date" defaultValue={toInputDate(editItem?.installation_date)} className={inputCls} />
                  <span style={{ position: 'absolute', right: '10px', top: '70%', transform: 'translateY(-50%)', cursor: 'pointer' }} onClick={() => { installationDateRef.current?.showPicker() }}>📅</span>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Installation Location</label>
                  <input name="installation_location" defaultValue={editItem?.installation_location} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SSID</label>
                  {editItem?.ssid ? (
                    <>
                      <input value={editItem.ssid} readOnly className={inputCls + " bg-gray-100 cursor-not-allowed text-gray-500"} />
                      <p className="text-xs text-gray-400 mt-1">Cannot be changed once set.</p>
                    </>
                  ) : editItem ? (
                    <input name="ssid" className={inputCls} />
                  ) : (
                    <input name="ssid" value={newSsid} onChange={(e) => setNewSsid(e.target.value)} className={inputCls} />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  {editItem?.password ? (
                    <>
                      <input value={editItem.password} readOnly className={inputCls + " bg-gray-100 cursor-not-allowed text-gray-500"} />
                      <p className="text-xs text-gray-400 mt-1">Cannot be changed once set.</p>
                    </>
                  ) : editItem ? (
                    <input name="password" className={inputCls} />
                  ) : (
                    <input name="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editItem ? "Update Machine" : "Create Machine"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                >
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
