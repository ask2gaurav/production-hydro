import { requireUserRole } from '../../lib/auth.server';
import Resource from '../../models/Resource';
import { connectDB } from '../../lib/db';

export async function action({ request, params }: { request: Request, params: any }) {
  const user = await requireUserRole(request, ['Admin']);
  await connectDB();
  
  if (request.method === 'PUT') {
    const data = await request.json();
    data.updated_by = user.userId;
    data.updated_at = new Date();
    const resource = await Resource.findByIdAndUpdate(params.id, data, { new: true });
    return new Response(JSON.stringify(resource), { status: 200 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
