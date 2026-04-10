import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import User from "../models/User";
import AuthCredential from "../models/AuthCredential";
import bcrypt from "bcrypt";

export async function loader({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  await connectDB();
  const user = await User.findById(decoded.userId).lean() as any;
  if (!user) throw new Response("User not found", { status: 404 });
  const cred = await AuthCredential.findOne({ user_id: decoded.userId }).lean() as any;
  return {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    email: cred?.email ?? user.email ?? "",
    phone: user.phone ?? "",
  };
}

export async function action({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  await connectDB();

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update_profile") {
    const first_name = (formData.get("first_name") as string)?.trim();
    const last_name = (formData.get("last_name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();

    if (!first_name || !last_name) {
      return { intent, error: "First name and last name are required." };
    }

    await User.findByIdAndUpdate(decoded.userId, { first_name, last_name, phone, date_modified: new Date() });
    return { intent, success: true };
  }

  if (intent === "change_password") {
    const current_password = formData.get("current_password") as string;
    const new_password = formData.get("new_password") as string;
    const confirm_password = formData.get("confirm_password") as string;

    if (!current_password || !new_password || !confirm_password) {
      return { intent, error: "All password fields are required." };
    }
    if (new_password.length < 6) {
      return { intent, error: "New password must be at least 6 characters." };
    }
    if (new_password !== confirm_password) {
      return { intent, error: "New password and confirmation do not match." };
    }

    const cred = await AuthCredential.findOne({ user_id: decoded.userId });
    if (!cred) return { intent, error: "Credentials not found." };

    const valid = await bcrypt.compare(current_password, cred.password_hash);
    if (!valid) return { intent, error: "Current password is incorrect." };

    cred.password_hash = await bcrypt.hash(new_password, 10);
    await cred.save();
    return { intent, success: true };
  }

  return { intent: null, error: "Unknown action." };
}

export default function SupplierProfile() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [firstName, setFirstName] = useState(data.first_name);
  const [lastName, setLastName] = useState(data.last_name);
  const [phone, setPhone] = useState(data.phone);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  useEffect(() => {
    if (actionData?.success && actionData?.intent === "change_password") {
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  }, [actionData]);

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h1>

      {/* Profile Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Profile Information</h2>

        {actionData?.intent === "update_profile" && actionData.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{actionData.error}</div>
        )}
        {actionData?.intent === "update_profile" && actionData.success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">Profile updated successfully.</div>
        )}

        <Form method="post" className="flex flex-col gap-4">
          <input type="hidden" name="intent" value="update_profile" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name *</label>
              <input name="first_name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Last Name *</label>
              <input name="last_name" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input value={data.email} disabled className={`${inputClass} bg-gray-50 text-gray-400 cursor-not-allowed`} />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
          </div>

          <div>
            <label className={labelClass}>Phone</label>
            <input name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting && navigation.formData?.get("intent") === "update_profile" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Change Password</h2>

        {actionData?.intent === "change_password" && actionData.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{actionData.error}</div>
        )}
        {actionData?.intent === "change_password" && actionData.success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">Password changed successfully.</div>
        )}

        <Form method="post" className="flex flex-col gap-4">
          <input type="hidden" name="intent" value="change_password" />

          <div>
            <label className={labelClass}>Current Password *</label>
            <input
              name="current_password"
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>New Password *</label>
            <input
              name="new_password"
              type="password"
              required
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum 6 characters.</p>
          </div>

          <div>
            <label className={labelClass}>Confirm New Password *</label>
            <input
              name="confirm_password"
              type="password"
              required
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className={`${inputClass} ${confirmPw && newPw && confirmPw !== newPw ? "border-red-400 focus:ring-red-400" : ""}`}
            />
            {confirmPw && newPw && confirmPw !== newPw && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || (!!confirmPw && !!newPw && confirmPw !== newPw)}
              className="px-5 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting && navigation.formData?.get("intent") === "change_password" ? "Updating..." : "Update Password"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
