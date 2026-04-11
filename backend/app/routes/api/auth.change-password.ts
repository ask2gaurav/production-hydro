import { requireUserRole } from '../../lib/auth.server';
import AuthCredential from '../../models/AuthCredential';
import bcrypt from 'bcrypt';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function action({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const user = await requireUserRole(request, ['Admin', 'Supplier', 'Owner', 'Therapist']);

    const body = await request.json().catch(() => null);
    if (!body || !body.oldPassword || !body.newPassword) {
      return new Response(JSON.stringify({ error: 'Missing old or new password' }), { status: 400, headers: corsHeaders });
    }

    await connectDB();
    const cred = await AuthCredential.findOne({ user_id: user.userId });
    if (!cred) {
      return new Response(JSON.stringify({ error: 'User credentials not found' }), { status: 404, headers: corsHeaders });
    }

    const valid = await bcrypt.compare(body.oldPassword, cred.password_hash);
    if (!valid) {
       return new Response(JSON.stringify({ error: 'Incorrect old password' }), { status: 401, headers: corsHeaders });
    }

    cred.password_hash = await bcrypt.hash(body.newPassword, 10);
    await cred.save();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
}
