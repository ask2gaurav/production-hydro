import Session from '../../models/Session';
import { connectDB } from '../../lib/db';

export async function action({ request }: { request: Request }) {
  await connectDB();
  if (request.method === 'POST') {
    const body = await request.json();
    const { sessions } = body; 
    if (!Array.isArray(sessions)) return new Response('Invalid format', { status: 400 });
    
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
    return new Response(JSON.stringify({ count: created.length }), { status: 201 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
