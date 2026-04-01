import { requireUserRole } from '../../lib/auth.server';
import Invoice from '../../models/Invoice';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  await requireUserRole(request, ['Admin', 'Supplier']);
  await connectDB();
  const invoices = await Invoice.find({}).populate('owner_id machine_id');
  return new Response(JSON.stringify(invoices), { status: 200, headers: {'Content-Type':'application/json'} });
}

export async function action({ request }: { request: Request }) {
  const user = await requireUserRole(request, ['Admin', 'Supplier']);
  await connectDB();
  
  if (request.method === 'POST') {
    const data = await request.json();
    data.created_by = user.userId;
    const invoice = await Invoice.create(data);
    return new Response(JSON.stringify(invoice), { status: 201 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
