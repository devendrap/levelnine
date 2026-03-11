const attempts = new Map<string, number[]>()

/**
 * Sliding-window rate limiter. Returns true if request should be blocked.
 */
export function isRateLimited(
  key: string,
  limit = 5,
  windowMs = 60_000,
): boolean {
  const now = Date.now()
  const timestamps = attempts.get(key) ?? []

  // Remove expired timestamps
  const valid = timestamps.filter(t => now - t < windowMs)

  if (valid.length >= limit) {
    attempts.set(key, valid)
    return true
  }

  valid.push(now)
  attempts.set(key, valid)
  return false
}

/** Extract IP from request for rate limiting */
export function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
}
