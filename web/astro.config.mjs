import deno from '@astrojs/deno'
import partytown from '@astrojs/partytown'
import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'

import preact from '@astrojs/preact'

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [tailwind(), partytown(), preact()],
  adapter: deno()
})
