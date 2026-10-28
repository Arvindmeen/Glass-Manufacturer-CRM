import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import vercel from './vercel.json' with { type: 'json' }

// Same security headers locally (`npm run preview`) as in production (vercel.json).
// Not applied to the dev server, whose hot reload needs inline scripts.
const securityHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]))

export default defineConfig({
  plugins: [react()],
  preview: { headers: securityHeaders },
  build: { sourcemap: false },
})
