/**
 * Admin Authentication Module
 * Simple session-based auth using environment variables
 */

// In-memory session store (sufficient for single admin use)
const sessions = new Map<string, { createdAt: number; username: string }>()
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export const SESSION_COOKIE_NAME = 'admin_session'

/**
 * Generate a cryptographically secure session ID
 */
export function generateSessionId(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  )
}

/**
 * Validate credentials against environment variables
 */
export function validateCredentials(
  username: string,
  password: string
): boolean {
  const adminUsername =
    import.meta.env.ADMIN_USERNAME || process.env.ADMIN_USERNAME
  const adminPassword =
    import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD

  if (!adminUsername || !adminPassword) {
    console.error('Admin credentials not configured in environment variables')
    return false
  }

  return username === adminUsername && password === adminPassword
}

/**
 * Create a new session for authenticated user
 */
export function createSession(username: string): string {
  cleanupExpiredSessions()

  const sessionId = generateSessionId()
  sessions.set(sessionId, {
    createdAt: Date.now(),
    username
  })

  return sessionId
}

/**
 * Validate an existing session
 */
export function validateSession(sessionId: string | undefined): boolean {
  if (!sessionId) return false

  const session = sessions.get(sessionId)
  if (!session) return false

  if (Date.now() - session.createdAt > SESSION_DURATION) {
    sessions.delete(sessionId)
    return false
  }

  return true
}

/**
 * Destroy a session (logout)
 */
export function destroySession(sessionId: string): void {
  sessions.delete(sessionId)
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_DURATION) {
      sessions.delete(id)
    }
  }
}

/**
 * Extract session ID from cookie header
 */
export function getSessionIdFromCookies(
  cookieHeader: string | null
): string | undefined {
  if (!cookieHeader) return undefined
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
  return match?.[1]
}

/**
 * Get cookie options for session
 */
export function getSessionCookieOptions(
  maxAge: number = SESSION_DURATION / 1000
) {
  return {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    path: '/',
    maxAge
  }
}

/**
 * Build Set-Cookie header string
 */
export function buildCookieHeader(sessionId: string): string {
  const opts = getSessionCookieOptions()
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    'HttpOnly',
    `SameSite=${opts.sameSite}`
  ]
  if (opts.secure) {
    parts.push('Secure')
  }
  return parts.join('; ')
}

/**
 * Build clear cookie header string
 */
export function buildClearCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly`
}
