import { requireUserRole } from '../../lib/auth.server';
import User from '../../models/User';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  await requireUserRole(request, ['Admin']);
  await connectDB();
  const users = await User.find({ is_active: true }).populate('user_type_id');
  return new Response(JSON.stringify(users), { status: 200, headers: {'Content-Type': 'application/json'}});
}

export async function action({ request }: { request: Request }) {
  await requireUserRole(request, ['Admin']);
  await connectDB();
  
  if (request.method === 'POST') {
    const data = await request.json();
    const user = await User.create(data);
    return new Response(JSON.stringify(user), { status: 201 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
