import { authenticateUser, verifyToken } from '../../lib/auth.server';
import User from '../../models/User';
import MachineOwner from '~/models/MachineOwner';
import Machine from '~/models/Machine';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function loader({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  return new Response(JSON.stringify({error:' permission denied'}), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function action({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.email || !body.password) {
    return new Response(JSON.stringify({ error: 'Missing email or password' }), { status: 400, headers: corsHeaders });
  }

  const token = await authenticateUser(body.email, body.password);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Invalid credentials or inactive account' }), { status: 401, headers: corsHeaders });
  }

  //add check if owner is assigned a machine and if machine is active or not, if not return error message to contact support
  const decodedToken = await verifyToken(token);
  let machine = null;
  console.log('Decoded Token:', decodedToken);
  if (decodedToken && decodedToken.userId) {
    await connectDB();
    const machine_owners = await MachineOwner.find({ owner_id: decodedToken.userId }).lean();

    if(machine_owners.length>0){
      for(let i=0;i<machine_owners.length;i++){
        if (machine_owners[i] && machine_owners[i].machine_id.toString()) {
          machine = await Machine.findById(machine_owners[i].machine_id?.toString()).lean();
          console.log('Assigned Machine Record:', machine);
          if (machine && 'Active' == machine.machine_status) {
            // Machine is active, exit loop
            // Set HTTP-Only Cookie
            const isProd = process.env.NODE_ENV === 'production';
            const cookieHeader = `token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict${isProd ? '; Secure' : ''}`;

            return new Response(JSON.stringify({ success: true, token }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Set-Cookie': cookieHeader
              }
            });
          }
        }
      }
      return new Response(JSON.stringify({ error: 'Your assigned machine is currently inactive. Please contact support.' }), { status: 403, headers: corsHeaders });
    } else {
      return new Response(JSON.stringify({ error: 'No machine assigned to your account. Please contact support.' }), { status: 403, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ error: 'No machine assigned to your account. Please contact support.' }), { status: 403, headers: corsHeaders });
  }
  console.log('Assigned Machine Record2:', machine);
  if (!machine) {
    return new Response(JSON.stringify({ error: 'No machine assigned to your account. Please contact support.' }), { status: 403, headers: corsHeaders });
  }
}
