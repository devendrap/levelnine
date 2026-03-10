import { verifyToken, type AuthPayload } from '../modules/auth/service'
import { verifyAppToken, type AppAuthPayload } from '../modules/app-auth/service'

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

export function extractAppToken(request: Request): string | null {
  const cookies = request.headers.get('cookie') ?? ''
  const match = cookies.match(/(?:^|;\s*)app_token=([^;]+)/)
  return match?.[1] ?? null
}

/** Authenticate platform admin users */
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

/**
 * Authenticate app-level users.
 * Also accepts platform admin tokens (they get full access to any app).
 */
export function authenticateAppUser(request: Request, slug: string): AppAuthPayload {
  // First check app_token cookie
  const appToken = extractAppToken(request)
  if (appToken) {
    const payload = verifyAppToken(appToken)
    return payload
  }

  // Fall back to platform admin token — they can access any app
  const platformToken = extractToken(request)
  if (platformToken) {
    const platform = verifyToken(platformToken)
    return {
      userId: platform.userId,
      email: platform.email,
      role: 'admin',
      containerId: '', // filled by caller
      type: 'app',
    }
  }

  throw new Error('No token provided')
}

export function optionalAppAuth(request: Request, slug: string): AppAuthPayload | null {
  try {
    return authenticateAppUser(request, slug)
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

const APP_ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
}

export function requireAppRole(auth: AppAuthPayload, minRole: string): void {
  const userLevel = APP_ROLE_HIERARCHY[auth.role] ?? 0
  const requiredLevel = APP_ROLE_HIERARCHY[minRole] ?? 0
  if (userLevel < requiredLevel) {
    throw new Error('Insufficient permissions')
  }
}
