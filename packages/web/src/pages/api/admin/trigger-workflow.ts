/**
 * Admin Workflow Trigger Endpoint
 * POST /api/admin/trigger-workflow
 *
 * Dispatches a GitHub Actions workflow via the GitHub API.
 */

import { getSessionIdFromCookies, validateSession } from '@/lib/auth'
import type { APIContext } from 'astro'

const WORKFLOW_MAP: Record<string, string> = {
  'ingest:flora': 'update-mongodb-flora.yml',
  'ingest:fauna': 'update-mongodb-fauna.yml',
  'ingest:occurrences': 'update-mongodb-occurrences.yml',
  'enrich:ameacadas': 'enrich-ameacadas.yml',
  'enrich:invasoras': 'enrich-invasoras.yml',
  'enrich:ucs': 'enrich-ucs.yml'
}

export async function POST(context: APIContext): Promise<Response> {
  // Auth check
  const sessionId = getSessionIdFromCookies(
    context.request.headers.get('cookie')
  )
  if (!validateSession(sessionId)) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = (await context.request.json()) as { workflow?: string }
    const { workflow } = body

    if (!workflow || !(workflow in WORKFLOW_MAP)) {
      return new Response(
        JSON.stringify({ error: 'Workflow inválido ou não permitido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = process.env.GITHUB_TOKEN
    const repo = process.env.GITHUB_REPO

    if (!token || !repo) {
      return new Response(
        JSON.stringify({
          error: 'GITHUB_TOKEN ou GITHUB_REPO não configurados no servidor'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const workflowFile = WORKFLOW_MAP[workflow]
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main' })
    })

    if (response.status === 204) {
      return new Response(JSON.stringify({ success: true, workflow }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const errorBody = await response.text()
    console.error(`GitHub API error ${response.status}:`, errorBody)

    return new Response(
      JSON.stringify({
        error: `Erro ao disparar workflow: GitHub retornou ${response.status}`,
        details: errorBody
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Trigger workflow error:', error)
    return new Response(
      JSON.stringify({
        error: 'Erro interno ao disparar workflow',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
