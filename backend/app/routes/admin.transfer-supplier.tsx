import { useLoaderData, useActionData, Form, useNavigation, useSubmit } from "react-router";
import { useEffect, useState } from "react";
import { connectDB } from "../lib/db";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import User from "../models/User";
import UserType from "../models/UserType";
import MachineSupplier from "../models/MachineSupplier";
import MachineOwner from "../models/MachineOwner";
import Session from "../models/Session";
import Patient from "../models/Patient";
import Therapist from "../models/Therapist";
import Invoice from "../models/Invoice";

type SupplierOption = { _id: string; first_name: string; last_name: string; email: string };
type OwnerPreview = { _id: string; first_name: string; last_name: string; email: string };
type MachinePreview = { _id: string; serial_number: string; model_name: string };

export async function loader({ request }: { request: Request }) {
  await connectDB();
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  const supplierType = await UserType.findOne({ name: "Supplier" }).lean();
  const ownerType = await UserType.findOne({ name: "Owner" }).lean();

  const suppliers = supplierType
    ? await User.find({ user_type_id: (supplierType as any)._id, is_active: true })
        .select("first_name last_name email")
        .sort({ first_name: 1 })
        .lean()
    : [];

  const supplierOptions: SupplierOption[] = suppliers.map((s: any) => ({
    _id: s._id.toString(),
    first_name: s.first_name,
    last_name: s.last_name,
    email: s.email,
  }));

  let owners: OwnerPreview[] = [];
  let machines: MachinePreview[] = [];
  let counts = { sessions: 0, patients: 0, therapists: 0, invoices: 0 };

  if (from && to && from !== to && ownerType) {
    const [rawOwners, rawMachineLinks] = await Promise.all([
      User.find({ supplier_id: from, user_type_id: (ownerType as any)._id })
        .select("first_name last_name email")
        .lean(),
      MachineSupplier.find({ supplier_id: from })
        .populate("machine_id", "serial_number model_name")
        .lean(),
    ]);

    owners = rawOwners.map((o: any) => ({
      _id: o._id.toString(),
      first_name: o.first_name,
      last_name: o.last_name,
      email: o.email,
    }));

    machines = rawMachineLinks
      .map((l: any) => l.machine_id)
      .filter(Boolean)
      .map((m: any) => ({
        _id: m._id.toString(),
        serial_number: m.serial_number,
        model_name: m.model_name,
      }));

    const machineIds = machines.map((m) => m._id);
    if (machineIds.length > 0) {
      const [sessions, patients, therapists, invoices] = await Promise.all([
        Session.countDocuments({ machine_id: { $in: machineIds } }),
        Patient.countDocuments({ machine_id: { $in: machineIds } }),
        Therapist.countDocuments({ machine_id: { $in: machineIds } }),
        Invoice.countDocuments({ machine_id: { $in: machineIds } }),
      ]);
      counts = { sessions, patients, therapists, invoices };
    }
  }

  return { supplierOptions, from, to, owners, machines, counts };
}

export async function action({ request }: { request: Request }) {
  await connectDB();
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "move") {
    const fromId = formData.get("id") as string;
    const toId = formData.get("to_supplier_id") as string;

    if (!fromId || !toId) return { error: "Select both a From and a To supplier." };
    if (fromId === toId) return { error: "From and To suppliers must be different." };

    const toSupplier = await User.findById(toId);
    if (!toSupplier || !toSupplier.is_active) return { error: "Target supplier not found or inactive." };

    await User.updateMany({ supplier_id: fromId }, { supplier_id: toId });
    await MachineSupplier.updateMany({ supplier_id: fromId }, { supplier_id: toId });
    await MachineOwner.updateMany({ supplier_id: fromId }, { supplier_id: toId });

    return { success: true };
  }

  return { error: "Unknown intent." };
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

export default function AdminTransferSupplier() {
  const { supplierOptions, from, to, owners, machines, counts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (actionData?.success) {
      setConfirmOpen(false);
    }
  }, [actionData]);

  const handleChange = (e: React.FormEvent<HTMLFormElement>) => {
    submit(e.currentTarget);
  };

  const fromSupplier = supplierOptions.find((s: SupplierOption) => s._id === from);
  const toSupplier = supplierOptions.find((s: SupplierOption) => s._id === to);
  const hasPreview = !!from && !!to && from !== to;
  const total = owners.length + machines.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Transfer Supplier Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Move all of one supplier's owners and machines (with their sessions, patients, and therapists) to another supplier.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <Form method="get" onChange={handleChange} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Supplier</label>
            <select name="from" defaultValue={from} className={inputCls}>
              <option value="">Select supplier...</option>
              {supplierOptions.map((s: SupplierOption) => (
                <option key={s._id} value={s._id}>
                  {s.first_name} {s.last_name} ({s.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Supplier</label>
            <select name="to" defaultValue={to} className={inputCls}>
              <option value="">Select supplier...</option>
              {supplierOptions.map((s: SupplierOption) => (
                <option key={s._id} value={s._id}>
                  {s.first_name} {s.last_name} ({s.email})
                </option>
              ))}
            </select>
          </div>
        </Form>

        {from && to && from === to && (
          <p className="text-sm text-red-600 mt-4">From and To suppliers must be different.</p>
        )}

        {actionData?.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {actionData.error}
          </div>
        )}

        {actionData?.success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
            Transfer complete. Owners and machines now belong to {toSupplier ? `${toSupplier.first_name} ${toSupplier.last_name}` : "the new supplier"}.
          </div>
        )}
      </div>

      {hasPreview && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            Preview: {fromSupplier?.first_name} {fromSupplier?.last_name} → {toSupplier?.first_name} {toSupplier?.last_name}
          </h2>

          {total === 0 ? (
            <p className="text-sm text-gray-400 mt-4">This supplier has no owners or machines to move.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6 mt-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Owners to move ({owners.length})</h3>
                  {owners.length === 0 ? (
                    <p className="text-sm text-gray-400">None</p>
                  ) : (
                    <ul className="text-sm text-gray-700 flex flex-col gap-1">
                      {owners.map((o: OwnerPreview) => (
                        <li key={o._id} className="px-3 py-2 bg-gray-50 rounded border border-gray-200">
                          {o.first_name} {o.last_name} <span className="text-gray-400">({o.email})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Machines to move ({machines.length})</h3>
                  {machines.length === 0 ? (
                    <p className="text-sm text-gray-400">None</p>
                  ) : (
                    <ul className="text-sm text-gray-700 flex flex-col gap-1">
                      {machines.map((m: MachinePreview) => (
                        <li key={m._id} className="px-3 py-2 bg-gray-50 rounded border border-gray-200 font-mono text-xs">
                          {m.serial_number} — {m.model_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-5 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm">
                {counts.sessions} session(s), {counts.patients} patient(s), {counts.therapists} therapist(s), and {counts.invoices} invoice(s)
                tied to these machines will automatically remain accessible under the new supplier — no separate action needed for them.
              </div>

              <div className="mt-5">
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm font-medium"
                >
                  Move Data
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <DeleteConfirmModal
        isOpen={confirmOpen}
        title="Confirm Supplier Transfer"
        warningText={
          <>
            This will move {owners.length} owner(s) and {machines.length} machine(s) from{" "}
            {fromSupplier?.first_name} {fromSupplier?.last_name} to {toSupplier?.first_name} {toSupplier?.last_name}.
            This cannot be undone.
          </>
        }
        id={from}
        intent="move"
        extraFields={{ to_supplier_id: to }}
        isSubmitting={isSubmitting}
        error={confirmOpen ? actionData?.error : null}
        confirmWord="MOVE"
        confirmButtonLabel="Move Data"
        submittingLabel="Moving..."
        confirmButtonClassName="bg-amber-600 hover:bg-amber-700"
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
