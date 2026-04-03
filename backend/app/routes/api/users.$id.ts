import { requireUserRole } from '../../lib/auth.server';
import User from '../../models/User';
import { connectDB } from '../../lib/db';

export async function action({ request, params }: { request: Request, params: any }) {
  await requireUserRole(request, ['Admin']);
  await connectDB();
  const { id } = params;
  
  if (request.method === 'PUT') {
    const data = await request.json().catch(()=>({}));
    const user = await User.findByIdAndUpdate(id, data, { returnDocument: 'after' });
    return new Response(JSON.stringify(user), { status: 200 });
  }
  
  if (request.method === 'DELETE') {
    // Soft delete
    await User.findByIdAndUpdate(id, { is_active: false });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
  
  return new Response('Method Not Allowed', { status: 405 });
}
