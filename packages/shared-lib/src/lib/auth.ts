import { FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from './supabase.js';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    aud: string;
    role?: string;
  };
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'AUTH_005',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'AUTH_004',
          message: 'Invalid or expired token',
        },
      });
    }

    (request as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email || '',
      aud: user.aud,
      role: user.role,
    };
  } catch {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'AUTH_005',
        message: 'Authentication failed',
      },
    });
  }
}

export function requireAuth() {
  return authenticate;
}
