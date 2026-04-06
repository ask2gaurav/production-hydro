import Machine from '../../models/Machine';
import MachineSupplier from '../../models/MachineSupplier';
import User from '../../models/User';
import { connectDB } from '../../lib/db';

export async function loader({ request, params }: { request: Request, params: any }) {
  await connectDB();
  const { id } = params;

  const machine = await Machine.findOne({ serial_number: id });
  const actualTarget = machine || await Machine.findById(id).catch(()=>null);

  if (!actualTarget) {
     return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  const is_locked = actualTarget.mode === 'demo' && actualTarget.demo_sessions_used >= actualTarget.demo_session_limit;
  const sessions_remaining = actualTarget.mode === 'demo' ? Math.max(0, actualTarget.demo_session_limit - actualTarget.demo_sessions_used) : null;

  // Build lock_screen_contact: use machine's stored values, fall back to supplier's user record
  const stored = actualTarget.lock_screen_contact ?? {};
  const hasContact = stored.supplier_name || stored.supplier_email || stored.supplier_phone;
  let lock_screen_contact = stored;

  if (!hasContact) {
    const assignment = await MachineSupplier.findOne({ machine_id: actualTarget._id }).populate('supplier_id').lean() as any;
    const supplier = assignment?.supplier_id;
    if (supplier) {
      lock_screen_contact = {
        supplier_name: `${supplier.first_name} ${supplier.last_name}`.trim(),
        supplier_email: supplier.email ?? '',
        supplier_phone: supplier.phone ?? '',
        supplier_available_hours: stored.supplier_available_hours ?? '',
        custom_message: stored.custom_message ?? '',
      };
    }
  }

  return new Response(JSON.stringify({
    serial_number: actualTarget.serial_number,
    mode: actualTarget.mode,
    demo_sessions_used: actualTarget.demo_sessions_used,
    demo_session_limit: actualTarget.demo_session_limit,
    sessions_remaining,
    is_locked,
    lock_screen_contact,
  }), { status: 200, headers: {'Content-Type':'application/json'} });
}
