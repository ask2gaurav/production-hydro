import { requireUserRole } from '../../lib/auth.server';
import Therapist from '../../models/Therapist';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const machine_id = url.searchParams.get('machine_id');
  await connectDB();
  
  const filter = machine_id ? { machine_id, is_active: true } : { is_active: true };
  const therapists = await Therapist.find(filter);
  return new Response(JSON.stringify(therapists), { status: 200, headers: {'Content-Type':'application/json'} });
}

export async function action({ request }: { request: Request }) {
  const user = await requireUserRole(request, ['Admin', 'Supplier', 'Owner']);
  await connectDB();
  
  if (request.method === 'POST') {
    const data = await request.json();
    const therapist = await Therapist.create(data);
    return new Response(JSON.stringify(therapist), { status: 201 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
