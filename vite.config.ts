import react from '@vitejs/plugin-react'
import { defineConfig, type ViteDevServer } from 'vite'
import vercel from './vercel.json' with { type: 'json' }

// Same security headers locally (`npm run preview`) as in production (vercel.json).
// Not applied to the dev server, whose hot reload needs inline scripts.
const securityHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]))

// Local development middleware plugin to execute /api/verify identically to Vercel Serverless
const devApiPlugin = () => ({
  name: 'dev-api-middleware',
  configureServer(server: ViteDevServer) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url && (req.url === '/api/verify' || req.url.startsWith('/api/verify?'))) {
        try {
          const handler = (await import('./api/verify.ts')).default
          await handler(req, res)
          return
        } catch (err) {
          console.error('[dev-api] Error in /api/verify handler:', err)
        }
      }
      next()
    })
  },
})

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  preview: { headers: securityHeaders },
  build: { sourcemap: false },
})
