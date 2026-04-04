import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import SupplierResource from "../models/SupplierResource";

const LIMIT = 50;

type ResourceDoc = {
  _id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  is_active: boolean;
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
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const skip = (page - 1) * LIMIT;

  const [rawResources, total] = await Promise.all([
    SupplierResource.find({ supplier_id: supplierId })
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(LIMIT)
      .lean(),
    SupplierResource.countDocuments({ supplier_id: supplierId }),
  ]);

  const resources = rawResources.map((r: any) => ({
    _id: r._id.toString(),
    title: r.title,
    slug: r.slug,
    content: r.content,
    category: r.category,
    is_active: r.is_active,
  }));

  return { resources, total, page, totalPages: Math.ceil(total / LIMIT) };
}

export async function action({ request }: { request: Request }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const title = (formData.get("title") as string)?.trim();
    const content = (formData.get("content") as string)?.trim();
    const category = (formData.get("category") as string)?.trim();

    if (!title || !content || !category) {
      return { error: "Title, content, and category are required." };
    }

    const rawSlug = (formData.get("slug") as string)?.trim() || generateSlug(title);
    const slug = generateSlug(rawSlug);

    try {
      await SupplierResource.create({
        supplier_id: supplierId,
        title,
        slug,
        content,
        category,
        is_active: true,
        updated_at: new Date(),
      });
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

    if (!title || !content || !category) {
      return { error: "Title, content, and category are required." };
    }

    const rawSlug = (formData.get("slug") as string)?.trim() || generateSlug(title);
    const slug = generateSlug(rawSlug);

    // Ensure the resource belongs to this supplier
    const existing = await SupplierResource.findOne({ _id: id, supplier_id: supplierId });
    if (!existing) return { error: "Resource not found." };

    try {
      await SupplierResource.findByIdAndUpdate(id, { title, slug, content, category, updated_at: new Date() });
      return { success: true };
    } catch (e: any) {
      if (e.code === 11000) return { error: "A resource with this slug already exists." };
      return { error: "Failed to update resource." };
    }
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await SupplierResource.findOneAndUpdate({ _id: id, supplier_id: supplierId }, { is_active: false });
    return { success: true };
  }

  if (intent === "restore") {
    const id = formData.get("id") as string;
    await SupplierResource.findOneAndUpdate({ _id: id, supplier_id: supplierId }, { is_active: true });
    return { success: true };
  }

  return { error: "Unknown intent." };
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm";

export default function SupplierResources() {
  const { resources, total, page, totalPages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ResourceDoc | null>(null);
  const [titleValue, setTitleValue] = useState("");

  useEffect(() => {
    if (actionData?.success) {
      setModalOpen(false);
      setEditItem(null);
      setTitleValue("");
    }
  }, [actionData]);

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
          <h1 className="text-2xl font-bold text-gray-800">Resources</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} total records — displayed to owners on the PWA
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 text-sm font-medium"
        >
          + Add Resource
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  No resources found.
                </td>
              </tr>
            )}
            {resources.map((r: any) => (
              <tr key={r._id} className="hover:bg-gray-50">
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(r as ResourceDoc)}
                      className="text-teal-600 hover:underline text-xs font-medium"
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
                  className="flex-1 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 font-medium text-sm disabled:opacity-50"
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
    </div>
  );
}
