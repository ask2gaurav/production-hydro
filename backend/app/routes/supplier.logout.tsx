import { redirect } from "react-router";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const cookieHeader = `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`;
  return redirect("/supplier/login", { headers: { "Set-Cookie": cookieHeader } });
}
