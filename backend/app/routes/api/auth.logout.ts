import { corsHeaders, handleOptions } from '../../lib/cors.server';

export async function action({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') return handleOptions();
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const cookieHeader = `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`;

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }
  });
}
