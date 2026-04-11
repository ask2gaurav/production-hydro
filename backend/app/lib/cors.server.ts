const ALLOWED_ORIGIN = 'https://hct.advaitsolutions.com';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
};

export function handleOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
