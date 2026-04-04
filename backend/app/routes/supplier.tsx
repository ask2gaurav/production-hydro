import { redirect, Outlet, Link, Form } from "react-router";
import { requireSupplier } from "../lib/auth.server";

export async function loader({ request }: { request: Request }) {
  try {
    await requireSupplier(request);
  } catch {
    throw redirect("/supplier/login");
  }
  return null;
}

export default function SupplierLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md">
        <div className="p-4 bg-teal-700 text-white text-xl font-bold">
          HydroSys Supplier
        </div>
        <nav className="mt-4 flex flex-col gap-2 p-2">
          <Link to="/supplier" className="p-2 hover:bg-gray-200 rounded">Dashboard</Link>
          <Link to="/supplier/machines" className="p-2 hover:bg-gray-200 rounded">My Machines</Link>
          <Link to="/supplier/owners" className="p-2 hover:bg-gray-200 rounded">My Owners</Link>
          <Link to="/supplier/invoices" className="p-2 hover:bg-gray-200 rounded">Invoices</Link>
          <Link to="/supplier/resources" className="p-2 hover:bg-gray-200 rounded">Resources</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white shadow flex items-center justify-between px-6">
          <div className="text-gray-600 font-semibold">Supplier Panel</div>
          <Form method="post" action="/supplier/logout">
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
