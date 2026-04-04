import { requireUserRole } from '../../lib/auth.server';
import Resource from '../../models/Resource';
import SupplierResource from '../../models/SupplierResource';
import MachineSupplier from '../../models/MachineSupplier';
import { connectDB } from '../../lib/db';

export async function loader({ request }: { request: Request }) {
  await connectDB();
  const url = new URL(request.url);
  const machineId = url.searchParams.get('machine_id');

  if (machineId) {
    const assignment = await MachineSupplier.findOne({ machine_id: machineId }).lean();
    if (assignment) {
      const supplierId = (assignment as any).supplier_id;
      const resources = await SupplierResource.find({ supplier_id: supplierId, is_active: true }).lean();
      return new Response(JSON.stringify(resources), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // Fallback: return global resources if no machine_id or no supplier found
  const resources = await Resource.find({ is_active: true }).lean();
  return new Response(JSON.stringify(resources), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
