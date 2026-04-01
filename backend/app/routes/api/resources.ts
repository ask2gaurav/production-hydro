import { requireUserRole } from '../../lib/auth.server';
import Resource from '../../models/Resource';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  await connectDB();
  const resources = await Resource.find({ is_active: true });
  return new Response(JSON.stringify(resources), { status: 200, headers: {'Content-Type':'application/json'} });
}

export async function action({ request }: { request: Request }) {
  const user = await requireUserRole(request, ['Admin']);
  await connectDB();
  if (request.method === 'POST') {
    const data = await request.json();
    data.updated_by = user.userId;
    const resource = await Resource.create(data);
    return new Response(JSON.stringify(resource), { status: 201 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
