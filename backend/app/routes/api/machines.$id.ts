import { requireUserRole } from '../../lib/auth.server';
import Machine from '../../models/Machine';
import { connectDB } from '../../lib/db';

export async function loader({ request, params }: { request: Request, params: any }) {
  await requireUserRole(request, ['Admin']);
  await connectDB();
  const { id } = params;
  const machine = await Machine.findById(id).lean();
  if (!machine) {
    return new Response(JSON.stringify({ error: 'Machine not found' }), { status: 404 });
  }
  return new Response(JSON.stringify(machine), { status: 200 });
}

export async function action({ request, params }: { request: Request, params: any }) {
  await requireUserRole(request, ['Admin']);
  await connectDB();
  const { id } = params;
  
  if (request.method === 'PUT') {
    const data = await request.json();
    const machine = await Machine.findByIdAndUpdate(id, data, { returnDocument: 'after' });
    return new Response(JSON.stringify(machine), { status: 200 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
