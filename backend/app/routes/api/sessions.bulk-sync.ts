import Session from '../../models/Session';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function action({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  await connectDB();
  if (request.method === 'POST') {
    const body = await request.json();
    const { sessions } = body;
    if (!Array.isArray(sessions)) return new Response('Invalid format', { status: 400, headers: corsHeaders });

    const created = [];
    for (const data of sessions) {
      data.synced_at = new Date();
      data.created_offline = true;
      const s = await Session.findOneAndUpdate(
        { machine_id: data.machine_id, start_time: data.start_time },
        { $setOnInsert: data },
        { upsert: true, new: true }
      );
      created.push(s);
    }
    return new Response(JSON.stringify({ count: created.length }), { status: 201, headers: corsHeaders });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
