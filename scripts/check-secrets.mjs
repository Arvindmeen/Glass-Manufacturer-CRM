// Fails when anything that looks like an API key is in tracked files or in the build output.
// Runs before every build and (via .githooks/pre-commit) before every commit.
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PATTERNS = [
  /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/, // OpenAI
  /AIza[0-9A-Za-z_-]{35}/, // Google
  /OPENAI_API_KEY\s*[:=]\s*['"]?[^\s'"]{8,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]
const SKIP = /\.(pdf|png|jpe?g|gif|ico|woff2?)$/i

const staged = process.argv.includes('--staged')
const files = execSync(staged ? 'git diff --cached --name-only --diff-filter=ACM' : 'git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
if (!staged && existsSync('dist')) files.push(...walk('dist'))

const hits = []
for (const f of files) {
  if (SKIP.test(f) || !existsSync(f)) continue
  const text = readFileSync(f, 'utf8')
  text.split('\n').forEach((line, i) => {
    if (PATTERNS.some((re) => re.test(line))) hits.push(`${f}:${i + 1}`)
  })
}

if (hits.length) {
  console.error(`Possible secret found — remove it before committing:\n  ${hits.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-secrets: ${files.length} files clean`)
