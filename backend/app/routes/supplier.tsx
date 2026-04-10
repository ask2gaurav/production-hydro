import { redirect, Outlet, Link, Form, useLoaderData } from "react-router";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import User from "../models/User";

export async function loader({ request }: { request: Request }) {
  let decoded: any;
  try {
    decoded = await requireSupplier(request);
  } catch {
    throw redirect("/supplier/login");
  }
  await connectDB();
  const user = await User.findById(decoded.userId).select("first_name last_name").lean() as any;
  return { name: user ? `${user.first_name} ${user.last_name}` : "Supplier" };
}

export default function SupplierLayout() {
  const { name } = useLoaderData<typeof loader>();

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
          {/* <Link to="/supplier/invoices" className="p-2 hover:bg-gray-200 rounded">Invoices</Link> */}
          <Link to="/supplier/resources" className="p-2 hover:bg-gray-200 rounded">Resources</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white shadow flex items-center justify-between px-6">
          <div className="text-gray-600 font-semibold">Supplier Panel</div>
          <div className="flex items-center gap-4">
            <Link to="/supplier/profile" className="flex items-center gap-2 text-sm text-gray-700 hover:text-teal-700">
              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold text-xs">
                {name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <span>{name}</span>
            </Link>
            <Form method="post" action="/supplier/logout">
              <button type="submit" className="text-red-500 hover:text-red-700 text-sm">Logout</button>
            </Form>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
