import { verifyToken, type AuthPayload } from '../modules/auth/service'

export function extractToken(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Check cookie
  const cookies = request.headers.get('cookie') ?? ''
  const match = cookies.match(/(?:^|;\s*)token=([^;]+)/)
  return match?.[1] ?? null
}

export function authenticate(request: Request): AuthPayload {
  const token = extractToken(request)
  if (!token) throw new Error('No token provided')
  return verifyToken(token)
}

export function optionalAuth(request: Request): AuthPayload | null {
  try {
    return authenticate(request)
  } catch {
    return null
  }
}

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  staff: 2,
  manager: 3,
  partner: 4,
  admin: 5,
}

export function requireRole(auth: AuthPayload, minRole: string): void {
  const userLevel = ROLE_HIERARCHY[auth.role] ?? 0
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0
  if (userLevel < requiredLevel) {
    throw new Error('Insufficient permissions')
  }
}
