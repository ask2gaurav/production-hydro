import Patient from '../../models/Patient';
import Machine from '../../models/Machine';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function loader({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  const url = new URL(request.url);
  const machine_id = url.searchParams.get('machine_id');
  await connectDB();
  await Machine.findOneAndUpdate({ _id: machine_id }, { last_seen_date: new Date() });
  const filter = machine_id ? { machine_id, is_active: true } : { is_active: true };
  const patients = await Patient.find(filter);
  return new Response(JSON.stringify(patients), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function action({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  await connectDB();

  if (request.method === 'POST') {
    const data = await request.json();
    const patient = await Patient.findOneAndUpdate(
      { machine_id: data.machine_id, email: data.email },
      { $set: data },
      { upsert: true, new: true }
    );
    await Machine.findOneAndUpdate({ _id: data.machine_id }, { last_seen_date: new Date() });
    return new Response(JSON.stringify(patient), { status: 201, headers: corsHeaders });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
