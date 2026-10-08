import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const lumenDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(lumenDir, 'dist')
const publishDir = join(lumenDir, '..', 'netlify')
const keep = new Set(['README.md', '_redirects', 'netlify.toml'])

mkdirSync(publishDir, { recursive: true })

for (const name of readdirSync(publishDir)) {
  if (keep.has(name)) continue
  rmSync(join(publishDir, name), { recursive: true, force: true })
}

for (const name of readdirSync(distDir)) {
  cpSync(join(distDir, name), join(publishDir, name), { recursive: true })
}
