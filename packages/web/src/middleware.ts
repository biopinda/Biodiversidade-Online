/**
 * Astro Middleware for CORS, API Headers, and Admin Authentication
 */

import { getSessionIdFromCookies, validateSession } from '@/lib/auth'
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url)

  // Protect /admin routes (except /admin/login)
  if (
    url.pathname.startsWith('/admin') &&
    !url.pathname.startsWith('/admin/login')
  ) {
    const sessionId = getSessionIdFromCookies(
      context.request.headers.get('cookie')
    )

    if (!validateSession(sessionId)) {
      return context.redirect('/admin/login')
    }
  }

  const response = await next()

  // Add CORS headers for API endpoints
  if (context.request.url.includes('/api/')) {
    // Get the origin from request headers
    const origin = context.request.headers.get('origin')

    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:4321',
      'http://127.0.0.1:4321',
      'https://biodiversidade.online',
      'https://www.biodiversidade.online'
    ]

    // Check if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      )
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      )
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Max-Age', '86400')
    }

    // Handle preflight requests
    if (context.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400'
        }
      })
    }
  }

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Content Security Policy para proteger contra XSS e injeção de scripts maliciosos
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.partytown.io https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests'
  ]
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))

  return response
})
