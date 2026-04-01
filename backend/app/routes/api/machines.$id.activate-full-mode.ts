import { requireUserRole } from '../../lib/auth.server';
import Machine from '../../models/Machine';
import AuditLog from '../../models/AuditLog';
import { connectDB } from '../../lib/db';

export async function action({ request, params }: { request: Request, params: any }) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const user = await requireUserRole(request, ['Admin', 'Supplier']);
  await connectDB();
  const { id } = params;
  
  const machine = await Machine.findById(id);
  if (!machine) return new Response('Not Found', { status: 404 });

  machine.mode = 'full';
  machine.activated_full_mode_by = user.userId;
  machine.activated_full_mode_at = new Date();
  
  if (machine.operating_status === 'demo_locked') {
    machine.operating_status = 'Active';
  }

  await machine.save();
  await AuditLog.create({ user_id: user.userId, action: 'activate_full_mode', resource: 'Machine', resource_id: id });
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
