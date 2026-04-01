import { requireUserRole } from '../../lib/auth.server';
import Invoice from '../../models/Invoice';
import { connectDB } from '../../lib/db';

export async function action({ request, params }: { request: Request, params: any }) {
  const user = await requireUserRole(request, ['Admin', 'Supplier']);
  await connectDB();
  
  if (request.method === 'POST') {
    const { amount, note } = await request.json();
    const invoice = await Invoice.findById(params.id);
    if (!invoice) return new Response('Not found', { status: 404 });
    
    invoice.payments.push({
      amount,
      note,
      received_by: user.userId,
      date: new Date()
    });
    
    invoice.paid_amount += amount;
    invoice.balance = invoice.total_amount - invoice.paid_amount;
    if (invoice.balance <= 0) {
      invoice.status = 'Paid';
    } else if (invoice.paid_amount > 0) {
      invoice.status = 'Partial';
    }
    
    await invoice.save();
    return new Response(JSON.stringify(invoice), { status: 200 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
