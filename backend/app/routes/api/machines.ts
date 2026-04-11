import { requireUserRole } from '../../lib/auth.server';
import Machine from '../../models/Machine';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function loader({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  const user = await requireUserRole(request, ['Admin', 'Supplier']);
  await connectDB();
  // Filter by supplier if user is Supplier
  const machines = await Machine.find({}); // TODO: Implement proper filtering for supplier
  return new Response(JSON.stringify(machines), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function action({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  await requireUserRole(request, ['Admin']);
  await connectDB();
  if (request.method === 'POST') {
    const data = await request.json();
    const machine = await Machine.create(data);
    return new Response(JSON.stringify(machine), { status: 201, headers: corsHeaders });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
