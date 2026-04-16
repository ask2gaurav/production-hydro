import { useLoaderData, useActionData, Form, useNavigation, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import bcrypt from "bcrypt";
import { connectDB } from "../lib/db";
import User from "../models/User";
import UserType from "../models/UserType";
import AuthCredential from "../models/AuthCredential";
import MachineOwner from "../models/MachineOwner";
import Machine from "../models/Machine";

const LIMIT = 50;

type OwnerDoc = {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  billing_address?: string;
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

  const ownerType = await UserType.findOne({ name: "Owner" }).lean();
  if (!ownerType) {
    return { owners: [], total: 0, page, totalPages: 0, search, machines: [], ownerTypeId: null };
  }

  const filter: Record<string, any> = { user_type_id: (ownerType as any)._id };
  if (search) {
    const re = new RegExp(search, "i");
    filter.$or = [
      { first_name: re },
      { last_name: re },
      { email: re },
      { phone: re },
    ];
  }

  const [users, total, machines] = await Promise.all([
    User.find(filter).sort({ date_created: -1 }).skip(skip).limit(LIMIT).lean(),
    User.countDocuments(filter),
    Machine.find({ machine_status: { $ne: "Inactive" } })
      .select("serial_number model_name")
      .lean(),
  ]);

  const userIds = users.map((u: any) => u._id);
  const assignments = await MachineOwner.find({ owner_id: { $in: userIds } })
    .populate("machine_id", "serial_number model_name")
    .lean();

  const owners = users.map((u: any) => ({
    ...u,
    _id: u._id.toString(),
    is_active: u.is_active,
    assignedMachines: assignments
      .filter((a: any) => a.owner_id?.toString() === u._id?.toString())
      .map((a: any) => a.machine_id)
      .filter(Boolean)
      .map((m: any) => ({
        _id: m._id.toString(),
        serial_number: m.serial_number,
        model_name: m.model_name,
      })),
  }));

  const machineOptions = (machines as any[]).map((m) => ({
    _id: m._id.toString(),
    serial_number: m.serial_number,
    model_name: m.model_name,
  }));

  return {
    owners,
    total,
    page,
    totalPages: Math.ceil(total / LIMIT),
    search,
    machines: machineOptions,
    ownerTypeId: (ownerType as any)._id?.toString(),
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
    const ownerTypeId = formData.get("owner_type_id") as string;

    if (!first_name || !last_name || !email || !password || !ownerTypeId) {
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
        billing_address: (formData.get("billing_address") as string)?.trim() || undefined,
        user_type_id: ownerTypeId,
        is_active: true,
        date_created: new Date(),
        date_modified: new Date(),
      });
    } catch {
      return { error: "Failed to create owner." };
    }

    try {
      const password_hash = await bcrypt.hash(password, 10);
      await AuthCredential.create({ user_id: user._id, email, password_hash, is_active: true });
    } catch {
      await User.findByIdAndDelete(user._id);
      return { error: "Failed to set up credentials. Owner was not created." };
    }

    // Assign machine if provided
    const machine_id = (formData.get("machine_id") as string)?.trim();
    if (machine_id) {
      await MachineOwner.create({
        machine_id,
        owner_id: user._id,
        sale_date: new Date(),
      });
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
      billing_address: (formData.get("billing_address") as string)?.trim() || undefined,
      date_modified: new Date(),
    });

    await AuthCredential.findOneAndUpdate({ user_id: id }, { email });

    const newPassword = (formData.get("password") as string)?.trim();
    if (newPassword) {
      if (newPassword.length < 6) return { error: "Password must be at least 6 characters." };
      const password_hash = await bcrypt.hash(newPassword, 10);
      await AuthCredential.findOneAndUpdate({ user_id: id }, { password_hash });
    }

    // Update machine assignment: replace existing if a new one is provided
    const machine_id = (formData.get("machine_id") as string)?.trim();
    if (machine_id) {
      const existing = await MachineOwner.findOne({ owner_id: id });
      if (existing) {
        await MachineOwner.findByIdAndUpdate(existing._id, { machine_id });
      } else {
        await MachineOwner.create({ machine_id, owner_id: id, sale_date: new Date() });
      }
    }

    return { success: true };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await User.findByIdAndUpdate(id, { is_active: false, date_modified: new Date() });
    await AuthCredential.findOneAndUpdate({ user_id: id }, { is_active: false });
    return { success: true };
  }

  return { error: "Unknown intent." };
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

export default function AdminOwners() {
  const { owners, total, page, totalPages, search, machines, ownerTypeId } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<OwnerDoc | null>(null);

  useEffect(() => {
    if (actionData?.success) {
      setModalOpen(false);
      setEditItem(null);
    }
  }, [actionData]);

  const openCreate = () => {
    setEditItem(null);
    setModalOpen(true);
  };
  const openEdit = (o: OwnerDoc) => {
    setEditItem(o);
    setModalOpen(true);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form);
  };

  const firstAssignedMachineId = (o: OwnerDoc) =>
    o.assignedMachines?.[0]?._id.toString() || "";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Owners</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total records</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium"
        >
          + Add Owner
        </button>
      </div>

      {/* Filter bar */}
      <Form method="get" onSubmit={handleSearch} className="flex gap-3 mb-5">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by name, email or phone..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm font-medium"
        >
          Search
        </button>
        {search && (
          <a
            href="?"
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm text-gray-600"
          >
            Clear
          </a>
        )}
      </Form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Assigned Machine(s)</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {owners.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  {search ? "No owners match your search." : "No owners found."}
                </td>
              </tr>
            )}
            {owners.map((o: any) => (
              <tr key={o._id.toString()}  className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800 font-medium">
                  {o.first_name} {o.last_name}
                </td>
                <td className="px-4 py-3 text-gray-600">{o.email}</td>
                <td className="px-4 py-3 text-gray-600">{o.phone || "—"}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {o.assignedMachines?.length > 0
                    ? o.assignedMachines
                        .map((m: any) => `${m.serial_number} (${m.model_name})`)
                        .join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {o.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(o as OwnerDoc)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Edit
                    </button>
                    {o.is_active && (
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm("Deactivate this owner?")) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={o._id.toString()} />
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
            href={`?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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
            href={`?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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
                {editItem ? "Edit Owner" : "Add Owner"}
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
              {editItem && <input type="hidden" name="id" value={editItem._id.toString()} />}
              {!editItem && <input type="hidden" name="owner_type_id" value={ownerTypeId || ""} />}

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Machine</label>
                  <select
                    name="machine_id"
                    defaultValue={editItem ? firstAssignedMachineId(editItem) : ""}
                    className={inputCls}
                  >
                    <option value="">None</option>
                    {(machines as MachineOption[]).map((m) => (
                      <option key={m._id?.toString()} value={m._id?.toString()}>
                        {m.serial_number} — {m.model_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input name="address" defaultValue={editItem?.address} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
                  <input name="billing_address" defaultValue={editItem?.billing_address} className={inputCls} />
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
                  {isSubmitting ? "Saving..." : editItem ? "Update Owner" : "Create Owner"}
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
