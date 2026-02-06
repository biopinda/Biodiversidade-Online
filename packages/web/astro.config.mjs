import partytown from '@astrojs/partytown'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import node from '@astrojs/node'

import react from '@astrojs/react'

// https://astro.build/config
export default defineConfig({
  server: {
    port: 4321,
    host: true
  },
  output: 'server',
  image: {
    service: { entrypoint: 'astro/assets/services/noop' }
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      host: true,
      allowedHosts: ['biodiversidade.online', 'localhost'],
      hmr: {
        host: 'localhost'
      }
    }
  },
  integrations: [partytown(), react()],
  adapter: node({
    mode: 'standalone'
  })
})
