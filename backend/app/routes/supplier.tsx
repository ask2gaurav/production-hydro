import { redirect, Outlet, Link, Form, useLoaderData } from "react-router";
import { useState } from "react";
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
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { to: "/supplier", label: "Dashboard", abbr: "Da" },
    { to: "/supplier/machines", label: "My Machines", abbr: "Ma" },
    { to: "/supplier/owners", label: "My Owners", abbr: "Ow" },
    { to: "/supplier/resources", label: "Resources", abbr: "Re" },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-14' : 'w-64'} bg-white shadow-md flex flex-col transition-all duration-200 overflow-hidden`}>
        <div className={`bg-teal-700 text-white font-bold flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between p-4'}`}>
          {!collapsed && <span className="text-xl">HydroSys Supplier</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white hover:text-teal-200 focus:outline-none text-lg leading-none"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>
        <nav className="mt-4 flex flex-col gap-1 p-2 flex-1">
          {navItems.map(({ to, label, abbr }) => (
            <Link
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={`p-2 hover:bg-gray-200 rounded flex items-center gap-2 text-sm font-medium ${collapsed ? 'justify-center' : ''}`}
            >
              <span className="w-6 h-6 rounded bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">
                {abbr}
              </span>
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
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
