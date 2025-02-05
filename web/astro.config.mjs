import { defineConfig } from 'astro/config'
import partytown from '@astrojs/partytown'
import tailwindcss from '@tailwindcss/vite'

import node from '@astrojs/node'

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  server: {
    port: 4321,
    host: true,
  },
  output: 'server',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [partytown(), react()],
  adapter: node({
    mode: 'standalone',
  }),
})