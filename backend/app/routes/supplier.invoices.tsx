import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import Invoice from "../models/Invoice";
import User from "../models/User";
import UserType from "../models/UserType";
import Machine from "../models/Machine";
import MachineOwner from "../models/MachineOwner";

const LIMIT = 50;

type InvoiceDoc = {
  _id: string;
  owner_id: string;
  ownerName: string;
  machine_id: string;
  machineSerial: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  date_created: string;
};

export async function loader({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const skip = (page - 1) * LIMIT;

  const ownerType = await UserType.findOne({ name: "Owner" }).lean();

  // My owners
  const myOwners = ownerType
    ? await User.find({ supplier_id: supplierId, user_type_id: (ownerType as any)._id, is_active: true })
        .select("first_name last_name email")
        .lean()
    : [];

  const myOwnerIds = myOwners.map((o: any) => o._id);

  // Owners' machine assignments
  const ownerMachineAssignments = await MachineOwner.find({ owner_id: { $in: myOwnerIds } })
    .populate("machine_id", "serial_number model_name")
    .lean();

  const [rawInvoices, total] = await Promise.all([
    Invoice.find({ created_by: supplierId })
      .populate("owner_id", "first_name last_name")
      .populate("machine_id", "serial_number")
      .sort({ date_created: -1 })
      .skip(skip)
      .limit(LIMIT)
      .lean(),
    Invoice.countDocuments({ created_by: supplierId }),
  ]);

  const invoices = rawInvoices.map((inv: any) => {
    const o = inv.owner_id as any;
    const m = inv.machine_id as any;
    return {
      _id: inv._id.toString(),
      owner_id: o?._id?.toString() ?? "",
      ownerName: o ? `${o.first_name} ${o.last_name}` : "Unknown",
      machine_id: m?._id?.toString() ?? "",
      machineSerial: m?.serial_number ?? "—",
      total_amount: inv.total_amount,
      paid_amount: inv.paid_amount,
      balance: inv.balance,
      status: inv.status,
      date_created: inv.date_created?.toISOString() ?? null,
    };
  });

  // Owner options with their assigned machine
  const ownerOptions = myOwners.map((o: any) => {
    const assignment = ownerMachineAssignments.find(
      (a: any) => a.owner_id?.toString() === o._id.toString()
    );
    const m = assignment?.machine_id as any;
    return {
      _id: o._id.toString(),
      name: `${o.first_name} ${o.last_name}`,
      email: o.email,
      machine: m
        ? { _id: m._id.toString(), serial_number: m.serial_number, model_name: m.model_name }
        : null,
    };
  });

  return {
    invoices,
    total,
    page,
    totalPages: Math.ceil(total / LIMIT),
    ownerOptions,
    supplierId,
  };
}

export async function action({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const owner_id = formData.get("owner_id") as string;
    const machine_id = formData.get("machine_id") as string;
    const total_amount = parseFloat(formData.get("total_amount") as string);
    const note = (formData.get("note") as string)?.trim();

    if (!owner_id || !machine_id) return { error: "Owner and machine are required." };
    if (!total_amount || total_amount <= 0) return { error: "Total amount must be greater than 0." };

    // Verify owner belongs to this supplier
    const owner = await User.findOne({ _id: owner_id, supplier_id: supplierId });
    if (!owner) return { error: "Owner not found." };

    // Verify machine belongs to this owner via MachineOwner
    const ownerMachine = await MachineOwner.findOne({ owner_id, machine_id });
    if (!ownerMachine) return { error: "This machine is not assigned to this owner." };

    await Invoice.create({
      owner_id,
      machine_id,
      total_amount,
      paid_amount: 0,
      balance: total_amount,
      status: "Pending",
      created_by: supplierId,
      date_created: new Date(),
      notes: note || undefined,
    });

    return { success: true };
  }

  if (intent === "record_payment") {
    const invoice_id = formData.get("invoice_id") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const note = (formData.get("note") as string)?.trim();

    if (!amount || amount <= 0) return { error: "Payment amount must be greater than 0." };

    const invoice = await Invoice.findOne({ _id: invoice_id, created_by: supplierId });
    if (!invoice) return { error: "Invoice not found." };

    const newPaid = invoice.paid_amount + amount;
    if (newPaid > invoice.total_amount) return { error: "Payment exceeds invoice total." };

    const newBalance = invoice.total_amount - newPaid;
    const newStatus = newBalance <= 0 ? "Paid" : newPaid > 0 ? "Partial" : "Pending";

    invoice.payments.push({
      amount,
      date: new Date(),
      received_by: supplierId,
      note: note || "",
    });
    invoice.paid_amount = newPaid;
    invoice.balance = newBalance;
    invoice.status = newStatus;
    await invoice.save();

    return { success: true };
  }

  return { error: "Unknown intent." };
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  Partial: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
};

export default function SupplierInvoices() {
  const { invoices, total, page, totalPages, ownerOptions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [createModal, setCreateModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState<InvoiceDoc | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  useEffect(() => {
    if (actionData?.success) {
      setCreateModal(false);
      setPaymentModal(null);
      setSelectedOwnerId("");
    }
  }, [actionData]);

  const selectedOwner = (ownerOptions as any[]).find((o) => o._id === selectedOwnerId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total records</p>
        </div>
        <button
          onClick={() => { setCreateModal(true); setSelectedOwnerId(""); }}
          className="px-4 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 text-sm font-medium"
        >
          + New Invoice
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Machine</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Paid</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Balance</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400">
                  No invoices found.
                </td>
              </tr>
            )}
            {invoices.map((inv: any) => (
              <tr key={inv._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800 font-medium">{inv.ownerName}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.machineSerial}</td>
                <td className="px-4 py-3 text-gray-800">{inv.total_amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-600">{inv.paid_amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-800 font-medium">{inv.balance.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-600"}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {inv.date_created ? new Date(inv.date_created).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  {inv.status !== "Paid" && (
                    <button
                      onClick={() => setPaymentModal(inv)}
                      className="text-teal-600 hover:underline text-xs font-medium"
                    >
                      Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4 text-sm">
          <a href={`?page=${page - 1}`} className={page <= 1 ? "pointer-events-none opacity-40" : ""}>
            <span className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50 cursor-pointer">← Previous</span>
          </a>
          <span className="text-gray-600">Page {page} of {totalPages}</span>
          <a href={`?page=${page + 1}`} className={page >= totalPages ? "pointer-events-none opacity-40" : ""}>
            <span className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50 cursor-pointer">Next →</span>
          </a>
        </div>
      )}

      {/* Create Invoice Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">New Invoice</h2>
              <button onClick={() => setCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <Form method="post" className="p-6 flex flex-col gap-4">
              <input type="hidden" name="intent" value="create" />
              {selectedOwner?.machine && (
                <input type="hidden" name="machine_id" value={selectedOwner.machine._id} />
              )}

              {actionData?.error && createModal && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {actionData.error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
                <select
                  name="owner_id"
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">Select owner...</option>
                  {(ownerOptions as any[]).map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.name} — {o.email}
                    </option>
                  ))}
                </select>
              </div>

              {selectedOwner && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Machine</label>
                  {selectedOwner.machine ? (
                    <p className="text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 font-mono">
                      {selectedOwner.machine.serial_number} — {selectedOwner.machine.model_name}
                    </p>
                  ) : (
                    <p className="text-sm text-red-500">No machine assigned to this owner.</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount *</label>
                <input
                  name="total_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input name="note" placeholder="Optional note..." className={inputCls} />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || (!!selectedOwner && !selectedOwner.machine)}
                  className="flex-1 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Invoice"}
                </button>
                <button type="button" onClick={() => setCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                  Cancel
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Record Payment</h2>
                <p className="text-sm text-gray-500 mt-0.5">{paymentModal.ownerName} — {paymentModal.machineSerial}</p>
              </div>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <Form method="post" className="p-6 flex flex-col gap-4">
              <input type="hidden" name="intent" value="record_payment" />
              <input type="hidden" name="invoice_id" value={paymentModal._id} />

              {actionData?.error && paymentModal && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {actionData.error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-center text-sm bg-gray-50 rounded border border-gray-200 p-3">
                <div>
                  <div className="font-semibold text-gray-800">{paymentModal.total_amount.toLocaleString()}</div>
                  <div className="text-gray-500 text-xs">Total</div>
                </div>
                <div>
                  <div className="font-semibold text-green-700">{paymentModal.paid_amount.toLocaleString()}</div>
                  <div className="text-gray-500 text-xs">Paid</div>
                </div>
                <div>
                  <div className="font-semibold text-red-700">{paymentModal.balance.toLocaleString()}</div>
                  <div className="text-gray-500 text-xs">Balance</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount *</label>
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max={paymentModal.balance}
                  step="0.01"
                  required
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input name="note" placeholder="Payment note..." className={inputCls} />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Record Payment"}
                </button>
                <button type="button" onClick={() => setPaymentModal(null)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
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
