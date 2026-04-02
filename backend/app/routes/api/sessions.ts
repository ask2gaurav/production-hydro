import Session from '../../models/Session';
import Machine from '../../models/Machine';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const machine_id = url.searchParams.get('machine_id');
  await connectDB();
  const filter = machine_id ? { machine_id } : {};
  const sessions = await Session.find(filter).populate('therapist_id patient_id').sort({ start_time: -1 });
  return new Response(JSON.stringify(sessions), { status: 200, headers: {'Content-Type':'application/json'} });
}

export async function action({ request }: { request: Request }) {
  await connectDB();
  if (request.method === 'POST') {
    const data = await request.json();
    
    // Demo Mode Logic — increment on session start regardless of status
    const machine = await Machine.findById(data.machine_id).catch(() => Machine.findOne({ serial_number: data.machine_id }));
    if (!machine) return new Response('Machine Not Found', { status: 404 });

    let is_locked_now = false;
    const session = await Session.create(data);
    if (machine.mode === 'demo') {
        const updatedMachine = await Machine.findOneAndUpdate(
          { _id: machine._id, demo_sessions_used: { $lt: machine.demo_session_limit } },
          { $inc: { demo_sessions_used: 1 } },
          { new: true }
        );

        if (!updatedMachine) {
           machine.operating_status = 'demo_locked';
           await machine.save();
           return new Response(JSON.stringify({ demo_locked: true, error: "Demo limit reached" }), { status: 403, headers: {'Content-Type':'application/json'} });
        } else if (updatedMachine.demo_sessions_used >= updatedMachine.demo_session_limit) {
           updatedMachine.operating_status = 'demo_locked';
           await updatedMachine.save();
           is_locked_now = true;
        }
    }
    
    
    return new Response(JSON.stringify({ session, demo_locked: is_locked_now }), { status: 201, headers: {'Content-Type':'application/json'} });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
