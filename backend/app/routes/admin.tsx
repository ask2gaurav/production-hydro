import { redirect, Outlet, Link, Form } from "react-router";
import { requireAdmin } from "../lib/auth.server";

export async function loader({ request }: { request: Request }) {
  try {
    await requireAdmin(request);
  } catch {
    throw redirect('/admin/login');
  }
  return null;
}

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md">
        <div className="p-4 bg-blue-700 text-white text-xl font-bold">
          HydroSys Admin
        </div>
        <nav className="mt-4 flex flex-col gap-2 p-2">
          <Link to="/admin" className="p-2 hover:bg-gray-200 rounded">Dashboard</Link>
          <Link to="/admin/machines" className="p-2 hover:bg-gray-200 rounded">Machines</Link>
          <Link to="/admin/users" className="p-2 hover:bg-gray-200 rounded">Users</Link>
          <Link to="/admin/owners" className="p-2 hover:bg-gray-200 rounded">Owners</Link>
          <Link to="/admin/suppliers" className="p-2 hover:bg-gray-200 rounded">Suppliers</Link>
          <Link to="/admin/invoices" className="p-2 hover:bg-gray-200 rounded">Invoices</Link>
          <Link to="/admin/resources" className="p-2 hover:bg-gray-200 rounded">CMS Resources</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white shadow flex items-center justify-between px-6">
          <div className="text-gray-600 font-semibold">Admin Panel</div>
          <Form method="post" action="/admin/logout">
            <button type="submit" className="text-red-500 hover:text-red-700">Logout</button>
          </Form>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
