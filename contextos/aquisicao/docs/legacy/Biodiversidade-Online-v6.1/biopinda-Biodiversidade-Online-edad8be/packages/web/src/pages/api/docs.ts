/**
 * Swagger UI Endpoint
 * GET /api/docs
 * Serves Swagger UI HTML with OpenAPI spec
 */

import { swaggerOptions } from '@/lib/swagger-config'
import type { APIContext } from 'astro'

export async function GET(context: APIContext): Promise<Response> {
  // Validate that this is an HTML request
  const accept = context.request.headers.get('accept') || ''

  // Return HTML with embedded Swagger UI
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Biodiversidade.Online API - Swagger UI</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
        <style>
          body {
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.js"></script>
        <script>
          const spec = ${JSON.stringify(swaggerOptions.definition)};
          const ui = SwaggerUIBundle({
            spec: spec,
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "BaseLayout",
            tryItOutEnabled: true
          });
        </script>
      </body>
    </html>
  `

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
