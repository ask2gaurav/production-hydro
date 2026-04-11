import { requireUserRole } from '../../lib/auth.server';
import Machine from '../../models/Machine';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function loader({ request, params }: { request: Request, params: any }) {
  if (request.method === 'OPTIONS') return handleOptions();
  await requireUserRole(request, ['Admin']);
  await connectDB();
  const { id } = params;
  const machine = await Machine.findById(id).lean();
  if (!machine) {
    return new Response(JSON.stringify({ error: 'Machine not found' }), { status: 404, headers: corsHeaders });
  }
  return new Response(JSON.stringify(machine), { status: 200, headers: corsHeaders });
}

export async function action({ request, params }: { request: Request, params: any }) {
  if (request.method === 'OPTIONS') return handleOptions();
  await requireUserRole(request, ['Admin']);
  await connectDB();
  const { id } = params;

  if (request.method === 'PUT') {
    const data = await request.json();
    const machine = await Machine.findByIdAndUpdate(id, data, { returnDocument: 'after' });
    return new Response(JSON.stringify(machine), { status: 200, headers: corsHeaders });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
