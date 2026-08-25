import { useLoaderData, useActionData, Form, useNavigation, useNavigate, useSubmit } from "react-router";
import { Fragment, useState, useEffect, useRef } from "react";
import { connectDB } from "../lib/db";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import Resource from "../models/Resource";
import SupplierResource from "../models/SupplierResource";
import User from "../models/User";
import UserType from "../models/UserType";

const LIMIT = 50;

// Mirrors frontend/src/pages/Resources.tsx's legacyCategoryLabel — used to backfill
// category_label on resources saved before that field existed.
const LEGACY_CATEGORY_LABEL: Record<string, string> = {
  FAQ: "Frequently Asked Questions",
  Guide: "Guidelines & Best Practices",
  Help: "Need More Help?",
  Troubleshooting: "Troubleshooting",
  KeyboardTroubleshooting: "Keyboard Troubleshooting",
};

type ResourceDoc = {
  _id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  category_label: string;
  type: string;
  is_active: boolean;
  sort_order: number;
};

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function loader({ request }: { request: Request }) {
  await connectDB();
  const url = new URL(request.url);
  const reorderMode = url.searchParams.get("mode") === "reorder";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const skip = (page - 1) * LIMIT;

  const query = Resource.find({}).sort({ sort_order: 1, updated_at: -1 });
  if (!reorderMode) query.skip(skip).limit(LIMIT);

  const [rawResources, total] = await Promise.all([
    query.lean(),
    Resource.countDocuments({}),
  ]);

  const resources = rawResources.map((r: any) => ({
    ...r,
    _id: r._id.toString(),
    updated_by: r.updated_by?.toString() ?? null,
  }));

  return { resources, total, page, totalPages: Math.ceil(total / LIMIT), reorderMode };
}

export async function action({ request }: { request: Request }) {
  await connectDB();
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const title = (formData.get("title") as string)?.trim();
    const content = (formData.get("content") as string)?.trim();
    const category = (formData.get("category") as string)?.trim();
    const category_label = (formData.get("category_label") as string)?.trim() || "";
    const rawType = (formData.get("type") as string)?.trim();
    const type = rawType === "FAQ" ? "FAQ" : "Description";

    if (!title || !content || !category) {
      return { error: "Title, content, and category are required." };
    }

    const rawSlug = (formData.get("slug") as string)?.trim() || generateSlug(title);
    const slug = generateSlug(rawSlug);

    try {
      await Resource.create({ title, slug, content, category, category_label, type, is_active: true, updated_at: new Date() });
      return { success: true };
    } catch (e: any) {
      if (e.code === 11000) return { error: "A resource with this slug already exists. Change the title or customize the slug." };
      return { error: "Failed to create resource." };
    }
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    const title = (formData.get("title") as string)?.trim();
    const content = (formData.get("content") as string)?.trim();
    const category = (formData.get("category") as string)?.trim();
    const category_label = (formData.get("category_label") as string)?.trim() || "";
    const rawType = (formData.get("type") as string)?.trim();
    const type = rawType === "FAQ" ? "FAQ" : "Description";

    if (!title || !content || !category) {
      return { error: "Title, content, and category are required." };
    }

    const rawSlug = (formData.get("slug") as string)?.trim() || generateSlug(title);
    const slug = generateSlug(rawSlug);

    try {
      await Resource.findByIdAndUpdate(id, { title, slug, content, category, category_label, type, updated_at: new Date() });
      return { success: true };
    } catch (e: any) {
      if (e.code === 11000) return { error: "A resource with this slug already exists." };
      return { error: "Failed to update resource." };
    }
  }

  if (intent === "delete") {
    await Resource.findByIdAndUpdate(formData.get("id"), { is_active: false });
    return { success: true };
  }

  if (intent === "restore") {
    await Resource.findByIdAndUpdate(formData.get("id"), { is_active: true });
    return { success: true };
  }

  if (intent === "hard_delete") {
    await Resource.findByIdAndDelete(formData.get("id"));
    return { success: true };
  }

  if (intent === "reorder") {
    const ids: string[] = JSON.parse((formData.get("order") as string) || "[]");
    if (ids.length > 0) {
      await Resource.bulkWrite(
        ids.map((id, index) => ({
          updateOne: { filter: { _id: id }, update: { sort_order: index } },
        }))
      );
    }
    return { success: true };
  }

  if (intent === "sync") {
    const supplierType = await UserType.findOne({ name: "Supplier" }).lean();
    if (!supplierType) return { error: "No supplier user type found." };

    const [suppliers, resources] = await Promise.all([
      User.find({ user_type_id: (supplierType as any)._id }).select("_id").lean(),
      Resource.find({}).lean(),
    ]);

    if (suppliers.length === 0 || resources.length === 0) {
      return { syncSuccess: true, added: 0, skipped: 0 };
    }

    const existing = await SupplierResource.find({
      supplier_id: { $in: suppliers.map((s: any) => s._id) },
    })
      .select("supplier_id slug")
      .lean();
    const existingKeys = new Set(
      existing.map((e: any) => `${e.supplier_id.toString()}:${e.slug}`)
    );

    const toInsert: any[] = [];
    for (const supplier of suppliers) {
      for (const resource of resources as any[]) {
        const key = `${(supplier as any)._id.toString()}:${resource.slug}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        toInsert.push({
          supplier_id: (supplier as any)._id,
          title: resource.title,
          slug: resource.slug,
          content: resource.content,
          category: resource.category,
          category_label: resource.category_label,
          type: resource.type,
          is_active: resource.is_active,
          sort_order: -1,
          updated_at: new Date(),
        });
      }
    }

    let added = 0;
    if (toInsert.length > 0) {
      try {
        const inserted = await SupplierResource.insertMany(toInsert, { ordered: false });
        added = inserted.length;
      } catch (e: any) {
        // insertMany with ordered:false still inserts non-conflicting docs even if some fail
        added = e?.result?.insertedCount ?? e?.insertedDocs?.length ?? 0;
      }
    }

    return { syncSuccess: true, added, skipped: toInsert.length - added };
  }

  if (intent === "sync_fields") {
    await SupplierResource.updateMany(
      { sort_order: { $exists: false } },
      { $set: { sort_order: -1 } }
    );

    const [adminResources, supplierResources] = await Promise.all([
      Resource.find({}).select("slug sort_order category_label type").lean(),
      SupplierResource.find({}).select("slug sort_order category_label type").lean(),
    ]);

    const slugToAdmin = new Map(
      (adminResources as any[]).map((r) => [r.slug, r])
    );

    const ops: any[] = [];
    for (const s of supplierResources as any[]) {
      const admin = slugToAdmin.get(s.slug);
      if (!admin) continue;

      const update: Record<string, any> = {};
      if (s.sort_order === -1 || s.sort_order === undefined) {
        update.sort_order = admin.sort_order ?? 0;
      }
      if (!s.category_label && admin.category_label) {
        update.category_label = admin.category_label;
      }
      if (!s.type && admin.type) {
        update.type = admin.type;
      }

      if (Object.keys(update).length > 0) {
        ops.push({ updateOne: { filter: { _id: s._id }, update } });
      }
    }

    let updated = 0;
    if (ops.length > 0) {
      const result = await SupplierResource.bulkWrite(ops);
      updated = result.modifiedCount ?? ops.length;
    }

    return { fieldsSyncSuccess: true, updated };
  }

  if (intent === "fix_data") {
    const resources = await Resource.find({
      $or: [
        { category_label: { $in: [null, ""] } },
        { type: { $in: [null, ""] } },
      ],
    })
      .select("category category_label type")
      .lean();

    const ops = (resources as any[]).map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: {
          type: r.category === "FAQ" ? "FAQ" : "Description",
          category_label: r.category_label || LEGACY_CATEGORY_LABEL[r.category] || r.category,
        },
      },
    }));

    let fixed = 0;
    if (ops.length > 0) {
      const result = await Resource.bulkWrite(ops);
      fixed = result.modifiedCount ?? ops.length;
    }

    return { fixDataSuccess: true, fixed };
  }

  return { error: "Unknown intent." };
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

export default function AdminResources() {
  const { resources, total, page, totalPages, reorderMode } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ResourceDoc | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ResourceDoc | null>(null);

  const [orderedRows, setOrderedRows] = useState<ResourceDoc[]>(resources as ResourceDoc[]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    setOrderedRows(resources as ResourceDoc[]);
    console.log(
      "[reorder] initial order:",
      (resources as ResourceDoc[]).map((r, i) => `${i}: ${r.title} (${r._id})`)
    );
  }, [resources]);

  useEffect(() => {
    if (actionData?.success) {
      setModalOpen(false);
      setEditItem(null);
      setTitleValue("");
      setDeleteTarget(null);
      if (reorderMode) navigate("/admin/resources");
    }
  }, [actionData]);

  const isSyncing =
    isSubmitting && navigation.formData?.get("intent") === "sync";
  const isSyncingFields =
    isSubmitting && navigation.formData?.get("intent") === "sync_fields";
  const isSavingOrder =
    isSubmitting && navigation.formData?.get("intent") === "reorder";
  const isFixingData =
    isSubmitting && navigation.formData?.get("intent") === "fix_data";

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    //e.target.style.display = 'none';
    dragIndex.current = index;

    const row = e.currentTarget as HTMLTableRowElement;
    const rect = row.getBoundingClientRect();
    const wrapperTable = document.createElement("table");
    wrapperTable.style.position = "fixed";
    wrapperTable.style.top = "-9999px";
    wrapperTable.style.left = "-9999px";
    wrapperTable.style.width = `${rect.width}px`;
    wrapperTable.style.opacity = "1";
    wrapperTable.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
    wrapperTable.style.background = "white";
    const tbody = document.createElement("tbody");
    tbody.appendChild(row.cloneNode(true));
    wrapperTable.appendChild(tbody);
    document.body.appendChild(wrapperTable);
    e.dataTransfer.setDragImage(wrapperTable, e.clientX - rect.left, e.clientY - rect.top);
    setTimeout(() => document.body.removeChild(wrapperTable), 0);

    console.log(
      "[reorder] drag start:",
      `index=${index}`,
      `id=${orderedRows[index]?._id}`,
      `title=${orderedRows[index]?.title}`
    );
  };
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const from = dragIndex.current;
    if (from === null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    const slot = isAfter ? index + 1 : index;
    if (slot === from || slot === from + 1) return;
    setDragOverIndex(slot);
  };
  const handlePlaceholderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex.current;
    const to = dragOverIndex;
    console.log("[reorder] drop:", `from=${from}`, `to=${to}`);
    if (from !== null && to !== null) {
      setOrderedRows((rows) => {
        const moved = rows[from];
        const rest = rows.filter((_, i) => i !== from);
        const insertAt = to > from ? to - 1 : to;
        const next = [...rest];
        next.splice(insertAt, 0, moved);
        console.log(
          "[reorder] new order:",
          next.map((r, i) => `${i}: ${r.title} (${r._id})`)
        );
        return next;
      });
    }
    dragIndex.current = null;
    setDragOverIndex(null);
  };
  const handleSaveOrder = () => {
    const formData = new FormData();
    formData.set("intent", "reorder");
    formData.set("order", JSON.stringify(orderedRows.map((r) => r._id)));
    submit(formData, { method: "post" });
  };
  const handleCancelReorder = () => {
    navigate("/admin/resources");
  };

  const openCreate = () => {
    setEditItem(null);
    setTitleValue("");
    setModalOpen(true);
  };
  const openEdit = (r: ResourceDoc) => {
    setEditItem(r);
    setTitleValue(r.title);
    setModalOpen(true);
  };

  const autoSlug = generateSlug(titleValue);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">CMS Resources</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} total records — synced to PWA clients for offline display
          </p>
        </div>
        <div className="flex items-center gap-3">
          {reorderMode ? (
            <>
              <button
                type="button"
                onClick={handleCancelReorder}
                disabled={isSavingOrder}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium disabled:opacity-50"
              >
                {isSavingOrder ? "Saving..." : "Save Order"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/admin/resources?mode=reorder")}
                className="px-4 py-2 bg-white border border-blue-700 text-blue-700 rounded hover:bg-blue-50 text-sm font-medium"
              >
                Rearrange Order
              </button>
              <Form
                method="post"
                onSubmit={(e) => {
                  if (!confirm("Sync all resources to every supplier? Suppliers who already have a matching resource will be left unchanged.")) e.preventDefault();
                }}
              >
                <input type="hidden" name="intent" value="sync" />
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-4 py-2 bg-white border border-blue-700 text-blue-700 rounded hover:bg-blue-50 text-sm font-medium disabled:opacity-50"
                >
                  {isSyncing ? "Syncing..." : "Sync to Suppliers"}
                </button>
              </Form>
              <Form
                method="post"
                onSubmit={(e) => {
                  if (!confirm("Push the admin resource order to every supplier resource whose order hasn't been customized yet (still at its default), and fill in any missing Category Label / Type fields on slug-matching supplier resources from the admin copy. Suppliers who already rearranged their own resources keep their order unchanged.")) e.preventDefault();
                }}
              >
                <input type="hidden" name="intent" value="sync_fields" />
                <button
                  type="submit"
                  disabled={isSyncingFields}
                  className="px-4 py-2 bg-white border border-blue-700 text-blue-700 rounded hover:bg-blue-50 text-sm font-medium disabled:opacity-50"
                >
                  {isSyncingFields ? "Syncing Fields..." : "Sync Fields to Supplier"}
                </button>
              </Form>
              <Form
                method="post"
                onSubmit={(e) => {
                  if (!confirm("Scan all resources and fill in missing Type/Category Label fields (Type: FAQ for the FAQ category, Description for all others; Category Label: from the app's legacy category names)? Resources that already have both fields set are left unchanged.")) e.preventDefault();
                }}
              >
                <input type="hidden" name="intent" value="fix_data" />
                <button
                  type="submit"
                  disabled={isFixingData}
                  className="px-4 py-2 bg-white border border-blue-700 text-blue-700 rounded hover:bg-blue-50 text-sm font-medium disabled:opacity-50"
                >
                  {isFixingData ? "Fixing..." : "Fix Data"}
                </button>
              </Form>
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium"
              >
                + Add Resource
              </button>
            </>
          )}
        </div>
      </div>

      {actionData?.syncSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
          Sync complete — {actionData.added} resource{actionData.added === 1 ? "" : "s"} added to suppliers
          {actionData.skipped > 0 ? `, ${actionData.skipped} already existed and were left unchanged` : ""}.
        </div>
      )}

      {actionData?.fieldsSyncSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
          Fields sync complete — {actionData.updated} supplier resource{actionData.updated === 1 ? "" : "s"} updated.
        </div>
      )}

      {actionData?.fixDataSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
          Fix complete — {actionData.fixed} resource{actionData.fixed === 1 ? "" : "s"} updated with a Type and/or Category Label.
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {reorderMode && <th className="w-10 px-4 py-3" />}
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(reorderMode ? orderedRows : resources).length === 0 && (
              <tr>
                <td colSpan={reorderMode ? 6 : 5} className="text-center py-10 text-gray-400">
                  No resources found.
                </td>
              </tr>
            )}
            {(reorderMode ? orderedRows : resources).map((r: any, index: number) => (
              <Fragment key={r._id}>
                {reorderMode && dragOverIndex === index && (
                  <tr
                    onDragOver={handlePlaceholderDragOver}
                    onDrop={handleDrop}
                  >
                    <td colSpan={6} className="p-0">
                      <div className="h-10 mx-4 my-1 border-2 border-dashed border-blue-400 bg-blue-50 rounded" />
                    </td>
                  </tr>
                )}
              <tr
                  className={`hover:bg-gray-50 ${reorderMode ? "cursor-move select-none" : ""} `}
                draggable={reorderMode}
                onDragStart={reorderMode ? handleDragStart(index) : undefined}
                onDragOver={reorderMode ? handleDragOver(index) : undefined}
                onDrop={reorderMode ? handleDrop : undefined}
                onDragEnd={reorderMode ? handleDragEnd : undefined}
                style={((reorderMode && dragIndex.current === index) ? {display: 'none'} : {})}
              >
                {reorderMode && (
                  <td className="px-4 py-3 text-gray-400 text-center select-none">⠿</td>
                )}
                <td className="px-4 py-3 text-gray-800 font-medium">{r.title}</td>
                <td className="px-4 py-3 text-gray-600">{r.category}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                  <td className="px-4 py-3">
                  {reorderMode ? (
                      <span  className="text-gray-400 text-xs italic">Drag to reorder</span>
                  ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(r as ResourceDoc)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Edit
                    </button>
                    {r.is_active ? (
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm("Deactivate this resource?")) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={r._id} />
                        <button
                          type="submit"
                          className="text-red-500 hover:underline text-xs font-medium"
                        >
                          Deactivate
                        </button>
                      </Form>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="intent" value="restore" />
                        <input type="hidden" name="id" value={r._id} />
                        <button
                          type="submit"
                          className="text-green-600 hover:underline text-xs font-medium"
                        >
                          Restore
                        </button>
                      </Form>
                    )}
                    &nbsp;|&nbsp;
                    <button
                      onClick={() => setDeleteTarget(r as ResourceDoc)}
                      className="text-red-700 hover:underline text-xs font-bold"
                    >
                      Delete
                    </button>
                  </div>
                  )}
                </td>
              </tr>
              </Fragment>
            ))}
            {reorderMode && dragOverIndex === orderedRows.length && (
              <tr onDragOver={handlePlaceholderDragOver} onDrop={handleDrop}>
                <td colSpan={6} className="p-0">
                  <div className="h-10 mx-4 my-1 border-2 border-dashed border-blue-400 bg-blue-50 rounded" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {!reorderMode && totalPages > 1 && (
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editItem ? "Edit Resource" : "Add Resource"}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  name="title"
                  defaultValue={editItem?.title}
                  required
                  className={inputCls}
                  onChange={(e) => setTitleValue(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug{" "}
                  <span className="text-gray-400 font-normal text-xs">
                    (auto-generated — edit to customize)
                  </span>
                </label>
                <input
                  name="slug"
                  defaultValue={editItem?.slug}
                  placeholder={autoSlug || "auto-generated-from-title"}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <input
                  name="category"
                  defaultValue={editItem?.category}
                  required
                  placeholder="e.g. FAQ, Help, Guide"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Label{" "}
                  <span className="text-gray-400 font-normal text-xs">
                    (heading shown on the app, e.g. "Frequently Asked Questions")
                  </span>
                </label>
                <input
                  name="category_label"
                  defaultValue={editItem?.category_label}
                  placeholder="e.g. Frequently Asked Questions"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  name="type"
                  defaultValue={editItem?.type || "Description"}
                  required
                  className={inputCls}
                >
                  <option value="FAQ">FAQ</option>
                  <option value="Description">Description</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                <textarea
                  name="content"
                  defaultValue={editItem?.content}
                  required
                  rows={8}
                  className={`${inputCls} resize-y`}
                  placeholder="Resource content..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editItem ? "Update Resource" : "Create Resource"}
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

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title={`Delete Resource "${deleteTarget?.title ?? ""}"`}
        warningText={<>This resource has no linked records. This cannot be undone.</>}
        id={deleteTarget?._id ?? ""}
        isSubmitting={isSubmitting}
        error={deleteTarget ? actionData?.error : null}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
