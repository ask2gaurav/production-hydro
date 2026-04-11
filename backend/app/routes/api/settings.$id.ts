import Settings from '../../models/Settings';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function loader({ request, params }: { request: Request, params: any }) {
  if (request.method === 'OPTIONS') return handleOptions();
  await connectDB();
  const settings = await Settings.findOne({ machine_id: params.id });
  return new Response(JSON.stringify(settings || {}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function action({ request, params }: { request: Request, params: any }) {
  if (request.method === 'OPTIONS') return handleOptions();
  await connectDB();
  if (request.method === 'PUT') {
    const data = await request.json();
    const settings = await Settings.findOneAndUpdate(
      { machine_id: params.id },
      data,
      { upsert: true, returnDocument: 'after' }
    );
    return new Response(JSON.stringify(settings), { status: 200, headers: corsHeaders });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
