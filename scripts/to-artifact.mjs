// Turns the single-file Vite build into page content for a Claude Artifact
// (the Artifact host adds its own doctype, head and body).
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8')
const title = html.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>Service Desk Idle</title>'
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? ''
const headRest = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<title>[\s\S]*?<\/title>/, '')
writeFileSync('dist/artifact.html', `${title}\n${headRest.trim()}\n${body.trim()}\n`)
console.log('wrote dist/artifact.html')
