import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import AuthCredential from '../models/AuthCredential';
import User from '../models/User';
import UserType from '../models/UserType';
import { connectDB } from './db';
import { corsHeaders } from './cors.server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-256-bit-secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY as any });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

export async function authenticateUser(email: string, password_raw: string) {
  await connectDB();
  const credential = await AuthCredential.findOne({ email, is_active: true });
  if (!credential) return null;

  const valid = await bcrypt.compare(password_raw, credential.password_hash);
  if (!valid) return null;

  const user = await User.findById(credential.user_id).populate('user_type_id');
  if (!user || !user.is_active) return null;

  // Update last login
  credential.last_login = new Date();
  await credential.save();

  return signToken({
    userId: user._id,
    type: (user.user_type_id as any).name,
    email: user.email,
  });
}

// Admin-specific middleware helper
export async function requireAdmin(request: Request) {
  return requireUserRole(request, ['Admin']);
}

// Supplier-specific middleware helper
export async function requireSupplier(request: Request) {
  return requireUserRole(request, ['Supplier']);
}

// Middleware helper
export async function requireUserRole(request: Request, allowedRoles: string[]) {
  let token = null;

  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    // Try to extract from cookie
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/token=([a-zA-Z0-9.\-_]+)/);
      if (match) {
        token = match[1];
      }
    }
  }

  if (!token) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const decoded: any = verifyToken(token);

  if (!decoded || !allowedRoles.includes(decoded.type)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }

  return decoded;
}
