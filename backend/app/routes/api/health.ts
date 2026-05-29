import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function loader({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
