import { authenticateUser } from '../../lib/auth.server';
import User from '../../models/User';
import { connectDB } from '../../lib/db';
export async function loader({ request }: { request: Request }) {
 
  await connectDB();
  const users = await User.find();
  return new Response(JSON.stringify(users), { status: 200, headers: {'Content-Type': 'application/json'}});
}
export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.email || !body.password) {
    return new Response(JSON.stringify({ error: 'Missing email or password' }), { status: 400 });
  }

  const token = await authenticateUser(body.email, body.password);
  
  if (!token) {
    return new Response(JSON.stringify({ error: 'Invalid credentials or inactive account' }), { status: 401 });
  }

  // Set HTTP-Only Cookie
  const isProd = process.env.NODE_ENV === 'production';
  const cookieHeader = `token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict${isProd ? '; Secure' : ''}`;

  return new Response(JSON.stringify({ success: true, token }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }
  });
}
