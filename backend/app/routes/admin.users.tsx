import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import bcrypt from "bcrypt";
import { connectDB } from "../lib/db";
import User from "../models/User";
import UserType from "../models/UserType";
import AuthCredential from "../models/AuthCredential";

const LIMIT = 50;

type UserDoc = {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  billing_address?: string;
  is_active: boolean;
  user_type_id: { _id: string; name: string } | string;
};

type UserTypeDoc = { _id: string; name: string };

export async function loader({ request }: { request: Request }) {
  await connectDB();
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const skip = (page - 1) * LIMIT;

  const [rawUsers, total, rawUserTypes] = await Promise.all([
    User.find({})
      .sort({ date_created: -1 })
      .skip(skip)
      .limit(LIMIT)
      .populate("user_type_id", "name")
      .lean(),
    User.countDocuments({}),
    UserType.find({}).sort({ name: 1 }).lean(),
  ]);

  // Serialize ObjectIds to strings so they survive JSON serialization over the wire
  const users = rawUsers.map((u: any) => ({
    ...u,
    _id: u._id.toString(),
    user_type_id: u.user_type_id
      ? { _id: u.user_type_id._id.toString(), name: u.user_type_id.name }
      : null,
  }));

  const userTypes = rawUserTypes.map((t: any) => ({
    _id: t._id.toString(),
    name: t.name,
  }));

  return { users, total, page, totalPages: Math.ceil(total / LIMIT), userTypes };
}

export async function action({ request }: { request: Request }) {
  await connectDB();
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const first_name = (formData.get("first_name") as string)?.trim();
    const last_name = (formData.get("last_name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const phone = (formData.get("phone") as string)?.trim();
    const password = formData.get("password") as string;
    const user_type_id = formData.get("user_type_id") as string;

    if (!first_name || !last_name || !phone || !email || !password || !user_type_id) {
      return { error: "First name, last name, phone, email, password, and role are required." };
    }
    if (password.length < 6) {
      return { error: "Password must be at least 6 characters." };
    }

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
        user_type_id,
        is_active: true,
        date_created: new Date(),
        date_modified: new Date(),
      });
    } catch {
      return { error: "Failed to create user." };
    }

    try {
      const password_hash = await bcrypt.hash(password, 10);
      await AuthCredential.create({
        user_id: user._id,
        email,
        password_hash,
        is_active: true,
      });
    } catch {
      await User.findByIdAndDelete(user._id);
      return { error: "Failed to set up credentials. User was not created." };
    }

    return { success: true };
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    const first_name = (formData.get("first_name") as string)?.trim();
    const last_name = (formData.get("last_name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const user_type_id = formData.get("user_type_id") as string;

    if (!first_name || !last_name || !phone || !email || !user_type_id) {
      return { error: "First name, last name, phone, email, and role are required." };
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
      user_type_id,
      date_modified: new Date(),
    });

    // Update email in AuthCredential if changed
    await AuthCredential.findOneAndUpdate({ user_id: id }, { email });

    // Optional password reset
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
  if (intent === "restore") {
    const id = formData.get("id") as string;
    await User.findByIdAndUpdate(id, { is_active: true, date_modified: new Date() });
    await AuthCredential.findOneAndUpdate({ user_id: id }, { is_active: true });
    return { success: true };
  }

  return { error: "Unknown intent." };
}

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-purple-100 text-purple-700",
  Supplier: "bg-blue-100 text-blue-700",
  Owner: "bg-green-100 text-green-700",
  Therapist: "bg-teal-100 text-teal-700",
  Patient: "bg-orange-100 text-orange-700",
};

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

export default function AdminUsers() {
  const { users, total, page, totalPages, userTypes } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<UserDoc | null>(null);

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
  const openEdit = (u: UserDoc) => {
    setEditItem(u);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total records</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium"
        >
          + Add User
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">

            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u: any) => {
              const roleName =
                typeof u.user_type_id === "object"
                  ? u.user_type_id?.name
                  : "—";
              
              const strUserId = u._id.toString();
              return (
                
                <tr key={strUserId} id={strUserId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        ROLE_COLORS[roleName] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {roleName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEdit(u as UserDoc)}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Edit
                      </button>&nbsp;|&nbsp;
                      
                        <Form
                          method="post"
                          onSubmit={(e) => {
                            if (!confirm("Deactivate this user?")) e.preventDefault();
                          }}
                        >
                        <input type="hidden" name="intent" value={u.is_active ? "delete" : "restore"} />
                          <input type="hidden" name="id" value={strUserId} />
                          <button
                            type="submit"
                          className={u.is_active ? "text-red-500 hover:underline text-xs font-medium" : "text-green-500 hover:underline text-xs font-medium"}
                          >
                            {u.is_active ? "Deactivate" : "Restore"}
                          </button>
                        </Form>
                    </div>
                  </td>
                </tr>
              
              );
            })}
          </tbody>
        </table>
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
                {editItem ? "Edit User" : "Add User"}
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
                  <input name="phone" defaultValue={editItem?.phone} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    name="user_type_id"
                    defaultValue={
                      typeof editItem?.user_type_id === "object"
                        ? editItem.user_type_id._id
                        : editItem?.user_type_id || ""
                    }
                    required
                    className={inputCls}
                  >
                    <option value="">Select role...</option>
                    {(userTypes as UserTypeDoc[]).map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
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
                  {isSubmitting ? "Saving..." : editItem ? "Update User" : "Create User"}
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
