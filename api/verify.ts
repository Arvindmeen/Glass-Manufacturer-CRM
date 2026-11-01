import type { IncomingMessage, ServerResponse } from 'node:http'
import crypto from 'node:crypto'

/**
 * Vercel Serverless Function: /api/verify
 *
 * Security Architecture:
 * - The master secret/hash (GATE_SECRET or GATE_PASSWORD_HASH) is stored STRICTLY
 *   in server environment variables and is NEVER sent to the client browser.
 * - Constant-time comparison (crypto.timingSafeEqual) prevents timing attacks.
 * - Sets a signed HttpOnly, SameSite=Strict, Secure session cookie with a 7-hour lifespan.
 * - Brute-force rate limiter: 5 failed attempts per IP -> 30-second penalty lockout.
 * - Artificial constant-time delay (300ms) mitigates high-frequency brute-force.
 */

// 7 hours in milliseconds (25,200,000 ms)
const SESSION_DURATION_MS = 7 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_SEC = 30

// In-memory rate limiting map (IP -> { attempts, lockedUntil })
interface RateLimitEntry {
  attempts: number
  lockedUntil: number
}
const rateLimits = new Map<string, RateLimitEntry>()

function cleanRateLimits() {
  const now = Date.now()
  for (const [ip, entry] of rateLimits.entries()) {
    if (entry.lockedUntil < now && entry.attempts === 0) {
      rateLimits.delete(ip)
    }
  }
}

/** SHA-256 helper */
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Constant-time comparison between two strings to defeat timing attacks.
 * Uses SHA-256 digests to ensure equal byte lengths before timingSafeEqual.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false
  const hashA = crypto.createHash('sha256').update(a).digest()
  const hashB = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

/** HMAC-SHA256 signature for session token */
function signSession(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

/** Parse cookies from request headers */
function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!header) return cookies
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k) cookies[k] = decodeURIComponent(v.join('='))
  }
  return cookies
}

/** Get client IP for rate limiting */
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  if (Array.isArray(forwarded)) return forwarded[0].trim()
  return req.socket.remoteAddress || '127.0.0.1'
}

/** Send JSON response compatible with both Vercel and standard Node HTTP */
function sendJson(res: ServerResponse, status: number, payload: unknown, headers?: Record<string, string>) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      res.setHeader(k, v)
    }
  }
  res.end(JSON.stringify(payload))
}

/** Read JSON body from stream if not pre-parsed */
async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if ('body' in req && req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>
  }
  if ('body' in req && typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1e5) req.destroy() // 100KB guard
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  cleanRateLimits()

  const method = (req.method || 'GET').toUpperCase()
  const ip = getClientIp(req)
  const now = Date.now()

  // Secret resolution strictly from environment variables: GATE_SECRET > GATE_PASSWORD_HASH
  const serverSecret = (process.env.GATE_SECRET || '').trim()
  const serverHash = (process.env.GATE_PASSWORD_HASH || (serverSecret ? sha256(serverSecret) : '')).trim()
  const signingKey = serverSecret || serverHash || 'glasscrm-internal-signing-key'

  // 1. Session verification check (GET or POST with action: 'check')
  if (method === 'GET' || (method === 'POST' && req.url?.includes('action=check'))) {
    const cookies = parseCookies(req.headers.cookie)
    const sessionCookie = cookies['glasscrm_session']

    if (!sessionCookie) {
      return sendJson(res, 200, { ok: true, valid: false })
    }

    try {
      const [token, unlockedAtStr, expiresAtStr, sig] = sessionCookie.split('.')
      const expiresAt = Number(expiresAtStr)
      const dataToSign = `${token}.${unlockedAtStr}.${expiresAtStr}`
      const expectedSig = signSession(dataToSign, signingKey)

      if (timingSafeCompare(sig, expectedSig) && now < expiresAt) {
        return sendJson(res, 200, {
          ok: true,
          valid: true,
          expiresAt,
          unlockedAt: Number(unlockedAtStr),
        })
      }
    } catch {
      // Invalid cookie
    }

    return sendJson(res, 200, { ok: true, valid: false })
  }

  // 2. Logout action
  if (method === 'POST' && req.url?.includes('action=logout')) {
    res.setHeader(
      'Set-Cookie',
      'glasscrm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    )
    return sendJson(res, 200, { ok: true, message: 'Logged out' })
  }

  // 3. Password Verification (POST)
  if (method === 'POST') {
    // Artificial 300ms delay to deter rapid automated brute-force attacks
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Check rate limiter lockout
    const rateEntry = rateLimits.get(ip) || { attempts: 0, lockedUntil: 0 }
    if (rateEntry.lockedUntil > now) {
      const remainingSec = Math.ceil((rateEntry.lockedUntil - now) / 1000)
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many failed attempts',
        lockoutSec: remainingSec,
      })
    }

    const body = await readBody(req)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!serverSecret && !serverHash) {
      return sendJson(res, 500, {
        ok: false,
        error: 'GATE_SECRET environment variable is not configured on the server.',
      })
    }

    // Compare with server secret using constant-time comparison
    let matches = false
    if (serverSecret) {
      matches = timingSafeCompare(password, serverSecret) || timingSafeCompare(sha256(password), serverHash)
    } else {
      matches = timingSafeCompare(sha256(password), serverHash)
    }

    if (!matches) {
      rateEntry.attempts += 1
      let lockoutSec = 0
      if (rateEntry.attempts >= MAX_ATTEMPTS) {
        rateEntry.lockedUntil = now + LOCKOUT_DURATION_SEC * 1000
        rateEntry.attempts = 0
        lockoutSec = LOCKOUT_DURATION_SEC
      }
      rateLimits.set(ip, rateEntry)

      return sendJson(res, 401, {
        ok: false,
        error: 'Invalid password',
        lockoutSec,
      })
    }

    // Success: clear rate limits
    rateLimits.delete(ip)

    const unlockedAt = now
    const expiresAt = now + SESSION_DURATION_MS
    const token = crypto.randomBytes(16).toString('hex')
    const dataToSign = `${token}.${unlockedAt}.${expiresAt}`
    const sig = signSession(dataToSign, signingKey)
    const cookieValue = `${dataToSign}.${sig}`

    const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production'
    const cookieHeader = `glasscrm_session=${cookieValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_MS / 1000}${isSecure ? '; Secure' : ''}`

    res.setHeader('Set-Cookie', cookieHeader)

    return sendJson(res, 200, {
      ok: true,
      session: {
        unlockedAt,
        expiresAt,
        token,
      },
    })
  }

  return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' })
}
