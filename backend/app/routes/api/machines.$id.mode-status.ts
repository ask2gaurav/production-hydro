import Machine from '../../models/Machine';
import { connectDB } from '../../lib/db';

export async function loader({ request, params }: { request: Request, params: any }) {
  await connectDB();
  const { id } = params;
  
  const machine = await Machine.findOne({ serial_number: id }); // Using serial_number or ObjectId
  const actualTarget = machine || await Machine.findById(id).catch(()=>null);
  
  if (!actualTarget) {
     return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  const is_locked = actualTarget.mode === 'demo' && actualTarget.demo_sessions_used >= actualTarget.demo_session_limit;
  const sessions_remaining = actualTarget.mode === 'demo' ? Math.max(0, actualTarget.demo_session_limit - actualTarget.demo_sessions_used) : null;

  return new Response(JSON.stringify({
    mode: actualTarget.mode,
    demo_sessions_used: actualTarget.demo_sessions_used,
    demo_session_limit: actualTarget.demo_session_limit,
    sessions_remaining,
    is_locked,
    lock_screen_contact: actualTarget.lock_screen_contact
  }), { status: 200, headers: {'Content-Type':'application/json'} });
}
