import Patient from '../../models/Patient';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const machine_id = url.searchParams.get('machine_id');
  await connectDB();
  
  const filter = machine_id ? { machine_id, is_active: true } : { is_active: true };
  const patients = await Patient.find(filter);
  return new Response(JSON.stringify(patients), { status: 200, headers: {'Content-Type':'application/json'} });
}

export async function action({ request }: { request: Request }) {
  await connectDB();
  
  if (request.method === 'POST') {
    const data = await request.json();
    const patient = await Patient.create(data);
    return new Response(JSON.stringify(patient), { status: 201 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
