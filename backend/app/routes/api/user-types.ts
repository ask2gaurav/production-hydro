import { requireUserRole } from '../../lib/auth.server';
import UserType from '../../models/UserType';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  await requireUserRole(request, ['Admin']);
  await connectDB();
  const types = await UserType.find({});
  return new Response(JSON.stringify(types), { status: 200, headers: {'Content-Type':'application/json'} });
}

export async function action({ request }: { request: Request }) {
  await requireUserRole(request, ['Admin']);
  await connectDB();
  if (request.method === 'POST') {
    const data = await request.json();
    const type = await UserType.create(data);
    return new Response(JSON.stringify(type), { status: 201 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
