import type { APIContext } from 'astro'
import { z } from 'zod'

const input = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']),
  apiKey: z.string().min(10)
})

export async function POST({ request }: APIContext) {
  const parsed = input.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      { success: false, error: 'Dados inválidos' },
      { status: 400 }
    )
  }

  const { provider, apiKey } = parsed.data

  try {
    let models: Array<{ id: string; displayName: string }> = []

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: {} }))
        return Response.json(
          {
            success: false,
            error: body?.error?.message || `Erro ${res.status}`
          },
          { status: res.status }
        )
      }
      const body = await res.json()
      const chatPrefixes = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'o4', 'chatgpt']
      models = body.data
        .filter(
          (m: any) =>
            chatPrefixes.some((p) => m.id.startsWith(p)) &&
            !m.id.includes('audio') &&
            !m.id.includes('realtime') &&
            !m.id.includes('embedding')
        )
        .map((m: any) => ({ id: m.id, displayName: m.id }))
        .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName))
    } else if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: {} }))
        return Response.json(
          {
            success: false,
            error: body?.error?.message || `Erro ${res.status}`
          },
          { status: res.status }
        )
      }
      const body = await res.json()
      models = (body.data || [])
        .map((m: any) => ({
          id: m.id,
          displayName: m.display_name || m.id
        }))
        .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName))
    } else if (provider === 'google') {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        { headers: { 'x-goog-api-key': apiKey } }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: {} }))
        return Response.json(
          {
            success: false,
            error: body?.error?.message || `Erro ${res.status}`
          },
          { status: res.status }
        )
      }
      const body = await res.json()
      models = (body.models || [])
        .filter((m: any) =>
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m: any) => ({
          id: m.name.replace('models/', ''),
          displayName: m.displayName || m.name.replace('models/', '')
        }))
        .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName))
    }

    return Response.json({ success: true, models })
  } catch {
    return Response.json(
      { success: false, error: 'Erro de conexão ao carregar modelos' },
      { status: 500 }
    )
  }
}
