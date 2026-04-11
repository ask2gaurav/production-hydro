import Session from '../../models/Session';
import Machine from '../../models/Machine';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function loader({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  const url = new URL(request.url);
  const machine_id = url.searchParams.get('machine_id');
  await connectDB();
  const filter = machine_id ? { machine_id } : {};
  const sessions = await Session.find(filter).populate('therapist_id patient_id').sort({ start_time: -1 });
  return new Response(JSON.stringify(sessions), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function action({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  await connectDB();
  if (request.method === 'POST') {
    const data = await request.json();

    // Demo Mode Logic — increment on session start regardless of status
    const machine = await Machine.findById(data.machine_id).catch(() => Machine.findOne({ serial_number: data.machine_id }));
    if (!machine) return new Response('Machine Not Found', { status: 404, headers: corsHeaders });

    // Dedup check — if a session for this machine at this start_time already exists,
    // return it as-is without re-incrementing the demo counter.
    const existing = await Session.findOne({ machine_id: data.machine_id, start_time: data.start_time });
    if (existing) {
      return new Response(JSON.stringify({ session: existing, demo_locked: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let is_locked_now = false;
    const session = await Session.create(data);
    //Update last_seen_date of machine on every session start
    await Machine.findOneAndUpdate({ _id: machine._id }, { last_seen_date: new Date() });
    if (machine.mode === 'demo') {
        const updatedMachine = await Machine.findOneAndUpdate(
          { _id: machine._id, demo_sessions_used: { $lt: machine.demo_session_limit } },
          { $inc: { demo_sessions_used: 1 } },
          { returnDocument: 'after' }
        );

        if (!updatedMachine) {
           machine.operating_status = 'demo_locked';
           await machine.save();
           return new Response(JSON.stringify({ demo_locked: true, error: "Demo limit reached" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else if (updatedMachine.demo_sessions_used >= updatedMachine.demo_session_limit) {
           updatedMachine.operating_status = 'demo_locked';
           await updatedMachine.save();
           is_locked_now = true;
        }
    }

    return new Response(JSON.stringify({ session, demo_locked: is_locked_now }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
