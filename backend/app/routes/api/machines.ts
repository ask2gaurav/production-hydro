import { requireUserRole } from '../../lib/auth.server';
import Machine from '../../models/Machine';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  const user = await requireUserRole(request, ['Admin', 'Supplier']);
  await connectDB();
  // Filter by supplier if user is Supplier
  const machines = await Machine.find({}); // TODO: Implement proper filtering for supplier
  return new Response(JSON.stringify(machines), { status: 200, headers: {'Content-Type':'application/json'} });
}

export async function action({ request }: { request: Request }) {
  await requireUserRole(request, ['Admin']);
  await connectDB();
  if (request.method === 'POST') {
    const data = await request.json();
    const machine = await Machine.create(data);
    return new Response(JSON.stringify(machine), { status: 201 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
