/**
 * Admin Logout Endpoint
 * POST /api/auth/logout
 */

import {
  buildClearCookieHeader,
  destroySession,
  getSessionIdFromCookies
} from '@/lib/auth'
import type { APIContext } from 'astro'

export async function POST(context: APIContext): Promise<Response> {
  const sessionId = getSessionIdFromCookies(
    context.request.headers.get('cookie')
  )

  if (sessionId) {
    destroySession(sessionId)
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Logout realizado com sucesso'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildClearCookieHeader()
      }
    }
  )
}
