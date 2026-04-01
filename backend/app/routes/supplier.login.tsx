import { redirect, useActionData, Form } from "react-router";
import { authenticateUser, verifyToken } from "../lib/auth.server";

export async function loader({ request }: { request: Request }) {
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/token=([a-zA-Z0-9.\-_]+)/);
    if (match) {
      const decoded: any = verifyToken(match[1]);
      if (decoded?.type === "Supplier") {
        throw redirect("/supplier");
      }
    }
  }
  return null;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const token = await authenticateUser(email, password);
  if (!token) {
    return { error: "Invalid credentials or inactive account." };
  }

  const decoded: any = verifyToken(token);
  if (!decoded || decoded.type !== "Supplier") {
    return { error: "Access denied. Supplier credentials required." };
  }

  const isProd = process.env.NODE_ENV === "production";
  const cookieHeader = `token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict${isProd ? "; Secure" : ""}`;

  return redirect("/supplier", {
    headers: { "Set-Cookie": cookieHeader },
  });
}

export default function SupplierLogin() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-teal-700">HydroSys Supplier</h1>
          <p className="text-gray-500 mt-1">Sign in to your supplier account</p>
        </div>

        {actionData?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="supplier@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-teal-700 text-white font-semibold rounded hover:bg-teal-800 transition-colors mt-2"
          >
            Sign In
          </button>
        </Form>
      </div>
    </div>
  );
}
