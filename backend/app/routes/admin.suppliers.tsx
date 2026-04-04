import { useLoaderData, useActionData, Form, useNavigation, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import bcrypt from "bcrypt";
import { connectDB } from "../lib/db";
import User from "../models/User";
import UserType from "../models/UserType";
import AuthCredential from "../models/AuthCredential";
import Machine from "../models/Machine";
import MachineSupplier from "../models/MachineSupplier";
import Resource from "../models/Resource";
import SupplierResource from "../models/SupplierResource";

const LIMIT = 50;

type SupplierDoc = {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  assignedMachines: { _id: string; serial_number: string; model_name: string }[];
};

type MachineOption = { _id: string; serial_number: string; model_name: string };

export async function loader({ request }: { request: Request }) {
  await connectDB();
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const search = (url.searchParams.get("search") || "").trim();
  const skip = (page - 1) * LIMIT;

  const supplierType = await UserType.findOne({ name: "Supplier" }).lean();
  if (!supplierType) {
    return { suppliers: [], total: 0, page, totalPages: 0, search, availableMachines: [], supplierTypeId: null };
  }

  const filter: Record<string, any> = { user_type_id: (supplierType as any)._id };
  if (search) {
    const re = new RegExp(search, "i");
    filter.$or = [
      { first_name: re },
      { last_name: re },
      { email: re },
      { phone: re },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ date_created: -1 }).skip(skip).limit(LIMIT).lean(),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u: any) => u._id);
  const assignments = await MachineSupplier.find({ supplier_id: { $in: userIds } })
    .populate("machine_id", "serial_number model_name")
    .lean();

  // Machines already assigned to ANY supplier
  const allAssignedMachineIds = await MachineSupplier.distinct("machine_id");

  const availableMachines = await Machine.find({
    _id: { $nin: allAssignedMachineIds },
    machine_status: { $ne: "Inactive" },
  })
    .select("serial_number model_name")
    .lean();

  const suppliers = users.map((u: any) => ({
    ...u,
    _id: u._id.toString(),
    assignedMachines: assignments
      .filter((a: any) => a.supplier_id?.toString() === u._id?.toString())
      .map((a: any) => a.machine_id)
      .filter(Boolean)
      .map((m: any) => ({
        _id: m._id.toString(),
        serial_number: m.serial_number,
        model_name: m.model_name,
      })),
  }));

  return {
    suppliers,
    total,
    page,
    totalPages: Math.ceil(total / LIMIT),
    search,
    availableMachines: availableMachines.map((m: any) => ({
      _id: m._id.toString(),
      serial_number: m.serial_number,
      model_name: m.model_name,
    })),
    supplierTypeId: (supplierType as any)._id?.toString(),
  };
}

export async function action({ request }: { request: Request }) {
  await connectDB();
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const first_name = (formData.get("first_name") as string)?.trim();
    const last_name = (formData.get("last_name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const password = formData.get("password") as string;
    const supplierTypeId = formData.get("supplier_type_id") as string;

    if (!first_name || !last_name || !email || !password || !supplierTypeId) {
      return { error: "First name, last name, email, and password are required." };
    }
    if (password.length < 6) return { error: "Password must be at least 6 characters." };

    const existing = await User.findOne({ email });
    if (existing) return { error: "A user with this email already exists." };

    let user;
    try {
      user = await User.create({
        first_name,
        last_name,
        email,
        phone: (formData.get("phone") as string)?.trim() || undefined,
        address: (formData.get("address") as string)?.trim() || undefined,
        user_type_id: supplierTypeId,
        is_active: true,
        date_created: new Date(),
        date_modified: new Date(),
      });
    } catch {
      return { error: "Failed to create supplier." };
    }

    try {
      const password_hash = await bcrypt.hash(password, 10);
      await AuthCredential.create({ user_id: user._id, email, password_hash, is_active: true });
    } catch {
      await User.findByIdAndDelete(user._id);
      return { error: "Failed to set up credentials. Supplier was not created." };
    }

    // Seed all active global resources into supplier's resource library
    try {
      const globalResources = await Resource.find({ is_active: true }).lean();
      if (globalResources.length > 0) {
        await SupplierResource.insertMany(
          globalResources.map((r: any) => ({
            supplier_id: user._id,
            title: r.title,
            slug: r.slug,
            content: r.content,
            category: r.category,
            is_active: true,
            updated_at: new Date(),
          })),
          { ordered: false }
        );
      }
    } catch {
      // Non-fatal — supplier and credentials already created successfully
    }

    return { success: true };
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    const first_name = (formData.get("first_name") as string)?.trim();
    const last_name = (formData.get("last_name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();

    if (!first_name || !last_name || !email) {
      return { error: "First name, last name, and email are required." };
    }

    const conflict = await User.findOne({ email, _id: { $ne: id } });
    if (conflict) return { error: "Another user with this email already exists." };

    await User.findByIdAndUpdate(id, {
      first_name,
      last_name,
      email,
      phone: (formData.get("phone") as string)?.trim() || undefined,
      address: (formData.get("address") as string)?.trim() || undefined,
      date_modified: new Date(),
    });

    await AuthCredential.findOneAndUpdate({ user_id: id }, { email });

    const newPassword = (formData.get("password") as string)?.trim();
    if (newPassword) {
      if (newPassword.length < 6) return { error: "Password must be at least 6 characters." };
      const password_hash = await bcrypt.hash(newPassword, 10);
      await AuthCredential.findOneAndUpdate({ user_id: id }, { password_hash });
    }

    return { success: true };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await User.findByIdAndUpdate(id, { is_active: false, date_modified: new Date() });
    await AuthCredential.findOneAndUpdate({ user_id: id }, { is_active: false });
    return { success: true };
  }

  if (intent === "assign_machine") {
    const supplier_id = formData.get("supplier_id") as string;
    const machine_id = formData.get("machine_id") as string;
    if (!supplier_id || !machine_id) return { error: "Supplier and machine are required." };

    const alreadyAssigned = await MachineSupplier.findOne({ machine_id });
    if (alreadyAssigned) return { error: "This machine is already assigned to a supplier." };

    await MachineSupplier.create({ machine_id, supplier_id, assigned_date: new Date() });
    return { success: true };
  }

  if (intent === "unassign_machine") {
    const supplier_id = formData.get("supplier_id") as string;
    const machine_id = formData.get("machine_id") as string;
    await MachineSupplier.findOneAndDelete({ machine_id, supplier_id });
    return { success: true };
  }

  return { error: "Unknown intent." };
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

export default function AdminSuppliers() {
  const { suppliers, total, page, totalPages, search, availableMachines, supplierTypeId } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<SupplierDoc | null>(null);
  const [machineModalSupplier, setMachineModalSupplier] = useState<SupplierDoc | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState("");

  useEffect(() => {
    if (actionData?.success) {
      setModalOpen(false);
      setEditItem(null);
      setMachineModalSupplier(null);
      setSelectedMachineId("");
    }
  }, [actionData]);

  const openCreate = () => {
    setEditItem(null);
    setModalOpen(true);
  };
  const openEdit = (s: SupplierDoc) => {
    setEditItem(s);
    setModalOpen(true);
  };
  const openMachineModal = (s: SupplierDoc) => {
    setMachineModalSupplier(s);
    setSelectedMachineId("");
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(e.currentTarget);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total records</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium"
        >
          + Add Supplier
        </button>
      </div>

      <Form method="get" onSubmit={handleSearch} className="flex gap-3 mb-5">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by name, email or phone..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button type="submit" className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm font-medium">
          Search
        </button>
        {search && (
          <a href="?" className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm text-gray-600">
            Clear
          </a>
        )}
      </Form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Assigned Machines</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  {search ? "No suppliers match your search." : "No suppliers found."}
                </td>
              </tr>
            )}
            {suppliers.map((s: any) => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800 font-medium">
                  {s.first_name} {s.last_name}
                </td>
                <td className="px-4 py-3 text-gray-600">{s.email}</td>
                <td className="px-4 py-3 text-gray-600">{s.phone || "—"}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {s.assignedMachines?.length > 0
                    ? s.assignedMachines.map((m: any) => `${m.serial_number} (${m.model_name})`).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(s as SupplierDoc)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Edit
                    </button>
                    &nbsp;|&nbsp;
                    <button
                      onClick={() => openMachineModal(s as SupplierDoc)}
                      className="text-indigo-600 hover:underline text-xs font-medium"
                    >
                      Machines
                    </button>
                    
                    {s.is_active && (
                      
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm("Deactivate this supplier?")) e.preventDefault();
                        }}
                      >
                        &nbsp;|&nbsp;
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={s._id} />
                        <button type="submit" className="text-red-500 hover:underline text-xs font-medium">
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

      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4 text-sm">
          <a
            href={`?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
            className={page <= 1 ? "pointer-events-none opacity-40" : ""}
          >
            <span className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50 cursor-pointer">← Previous</span>
          </a>
          <span className="text-gray-600">Page {page} of {totalPages}</span>
          <a
            href={`?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
            className={page >= totalPages ? "pointer-events-none opacity-40" : ""}
          >
            <span className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50 cursor-pointer">Next →</span>
          </a>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editItem ? "Edit Supplier" : "Add Supplier"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <Form method="post" className="p-6 flex flex-col gap-4">
              <input type="hidden" name="intent" value={editItem ? "update" : "create"} />
              {editItem && <input type="hidden" name="id" value={editItem._id} />}
              {!editItem && <input type="hidden" name="supplier_type_id" value={supplierTypeId || ""} />}

              {actionData?.error && modalOpen && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {actionData.error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input name="first_name" defaultValue={editItem?.first_name} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input name="last_name" defaultValue={editItem?.last_name} required className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input name="email" type="email" defaultValue={editItem?.email} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input name="phone" defaultValue={editItem?.phone} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input name="address" defaultValue={editItem?.address} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editItem ? "New Password (leave blank to keep current)" : "Password *"}
                  </label>
                  <input
                    name="password"
                    type="password"
                    required={!editItem}
                    minLength={6}
                    placeholder={editItem ? "••••••••" : "Min. 6 characters"}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editItem ? "Update Supplier" : "Create Supplier"}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                  Cancel
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Machine Assignment Modal */}
      {machineModalSupplier && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Manage Machines</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {machineModalSupplier.first_name} {machineModalSupplier.last_name}
                </p>
              </div>
              <button onClick={() => setMachineModalSupplier(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {actionData?.error && machineModalSupplier && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {actionData.error}
                </div>
              )}

              {/* Currently assigned */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Assigned Machines</h3>
                {machineModalSupplier.assignedMachines.length === 0 ? (
                  <p className="text-sm text-gray-400">No machines assigned.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {machineModalSupplier.assignedMachines.map((m) => (
                      <div key={m._id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 border border-gray-200">
                        <span className="text-sm text-gray-700 font-mono">{m.serial_number} — {m.model_name}</span>
                        <Form method="post" onSubmit={(e) => { if (!confirm("Unassign this machine?")) e.preventDefault(); }}>
                          <input type="hidden" name="intent" value="unassign_machine" />
                          <input type="hidden" name="supplier_id" value={machineModalSupplier._id} />
                          <input type="hidden" name="machine_id" value={m._id} />
                          <button type="submit" className="text-red-500 hover:underline text-xs font-medium ml-3">
                            Unassign
                          </button>
                        </Form>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign new machine */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Assign Machine</h3>
                {(availableMachines as MachineOption[]).length === 0 ? (
                  <p className="text-sm text-gray-400">No available machines to assign.</p>
                ) : (
                  <Form method="post" className="flex gap-2">
                    <input type="hidden" name="intent" value="assign_machine" />
                    <input type="hidden" name="supplier_id" value={machineModalSupplier._id} />
                    <select
                      name="machine_id"
                      value={selectedMachineId}
                      onChange={(e) => setSelectedMachineId(e.target.value)}
                      className={`flex-1 ${inputCls}`}
                    >
                      <option value="">Select a machine...</option>
                      {(availableMachines as MachineOption[]).map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.serial_number} — {m.model_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!selectedMachineId || isSubmitting}
                      className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </Form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
