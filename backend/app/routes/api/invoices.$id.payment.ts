import { requireUserRole } from '../../lib/auth.server';
import Invoice from '../../models/Invoice';
import { connectDB } from '../../lib/db';
import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function action({ request, params }: { request: Request, params: any }) {
  if (request.method === 'OPTIONS') return handleOptions();
  const user = await requireUserRole(request, ['Admin', 'Supplier']);
  await connectDB();

  if (request.method === 'POST') {
    const { amount, note } = await request.json();
    const invoice = await Invoice.findById(params.id);
    if (!invoice) return new Response('Not found', { status: 404, headers: corsHeaders });

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
    return new Response(JSON.stringify(invoice), { status: 200, headers: corsHeaders });
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
