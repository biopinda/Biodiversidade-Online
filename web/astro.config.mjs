import deno from '@astrojs/deno'
import partytown from '@astrojs/partytown'
import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [tailwind(), partytown()],
  adapter: deno()
})
