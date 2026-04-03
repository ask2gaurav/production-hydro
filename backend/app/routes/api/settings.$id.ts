import Settings from '../../models/Settings';
import { connectDB } from '../../lib/db';

export async function loader({ request, params }: { request: Request, params: any }) {
  await connectDB();
  const settings = await Settings.findOne({ machine_id: params.id });
  return new Response(JSON.stringify(settings || {}), { status: 200, headers: {'Content-Type':'application/json'} });
}

export async function action({ request, params }: { request: Request, params: any }) {
  await connectDB();
  if (request.method === 'PUT') {
    const data = await request.json();
    const settings = await Settings.findOneAndUpdate(
      { machine_id: params.id }, 
      data, 
      { upsert: true, returnDocument: 'after' }
    );
    return new Response(JSON.stringify(settings), { status: 200 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
