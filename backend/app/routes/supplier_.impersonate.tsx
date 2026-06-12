import { redirect } from "react-router";
import { verifyToken } from "../lib/auth.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) throw redirect("/supplier/login");

  const decoded: any = verifyToken(token);
  if (!decoded || decoded.type !== "Supplier") throw redirect("/supplier/login");

  const isProd = process.env.NODE_ENV === "production";
  const cookieHeader = `token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict${isProd ? "; Secure" : ""}`;

  throw redirect("/supplier", { headers: { "Set-Cookie": cookieHeader } });
}

export default function SupplierImpersonate() {
  return null;
}
