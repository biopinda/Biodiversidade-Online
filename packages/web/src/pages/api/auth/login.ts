/**
 * Admin Login Endpoint
 * POST /api/auth/login
 */

import { buildCookieHeader, createSession, validatePin } from '@/lib/auth'
import type { APIContext } from 'astro'

interface LoginRequest {
  pin: string
}

export async function POST(context: APIContext): Promise<Response> {
  try {
    const body = (await context.request.json()) as LoginRequest

    if (!body.pin) {
      return new Response(
        JSON.stringify({
          error: 'PIN é obrigatório',
          code: 'INVALID_REQUEST'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (!validatePin(body.pin)) {
      // Add delay to prevent brute force timing attacks
      await new Promise((resolve) => setTimeout(resolve, 500))

      return new Response(
        JSON.stringify({
          error: 'PIN inválido',
          code: 'INVALID_CREDENTIALS'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const sessionId = createSession('admin')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login realizado com sucesso'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': buildCookieHeader(sessionId)
        }
      }
    )
  } catch (error) {
    console.error('Login error:', error)

    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        code: 'SERVER_ERROR'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
