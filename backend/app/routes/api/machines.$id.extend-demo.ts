import { requireUserRole } from '../../lib/auth.server';
import Machine from '../../models/Machine';
import AuditLog from '../../models/AuditLog';
import { connectDB } from '../../lib/db';

export async function action({ request, params }: { request: Request, params: any }) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const user = await requireUserRole(request, ['Admin', 'Supplier']);
  await connectDB();
  
  const body = await request.json();
  const { additional_sessions, reason } = body;
  
  const machine = await Machine.findById(params.id);
  if (!machine) return new Response('Not Found', { status: 404 });

  const prev = machine.demo_session_limit;
  machine.demo_session_limit += additional_sessions;
  machine.demo_extended_at.push({
    extended_by: user.userId,
    previous_limit: prev,
    new_limit: machine.demo_session_limit,
    reason,
    timestamp: new Date()
  });

  if (machine.demo_sessions_used < machine.demo_session_limit) {
    machine.operating_status = 'Active';
  }

  await machine.save();
  await AuditLog.create({ user_id: user.userId, action: 'extend_demo', resource: 'Machine', resource_id: params.id, reason });
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
