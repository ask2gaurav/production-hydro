import { requireUserRole } from '../../lib/auth.server';
import Resource from '../../models/Resource';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function action({ request, params }: { request: Request, params: any }) {
  if (request.method === 'OPTIONS') return handleOptions();
  const user = await requireUserRole(request, ['Admin']);
  await connectDB();

  if (request.method === 'PUT') {
    const data = await request.json();
    data.updated_by = user.userId;
    data.updated_at = new Date();
    const resource = await Resource.findByIdAndUpdate(params.id, data, { returnDocument: 'after' });
    return new Response(JSON.stringify(resource), { status: 200, headers: corsHeaders });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
