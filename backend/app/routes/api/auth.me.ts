import { requireUserRole } from '../../lib/auth.server';
import User from '../../models/User';
import MachineOwner from '~/models/MachineOwner';
import Machine from '~/models/Machine';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function loader({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  const decoded = await requireUserRole(request, ['Owner', 'Admin', 'Supplier', 'Therapist']);
  await connectDB();

  const machine_id = await MachineOwner.find({ owner_id: decoded.userId }).findOne().lean();
  const machine = machine_id ? await Machine.findById(machine_id.machine_id).select('model_name') : null;
  const user = await User.findById(decoded.userId).select('email');
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ machine_id: machine._id.toString(), machine_name: machine.model_name, email: user.email, type: decoded.type }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
