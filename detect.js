import { lookup } from './frecency.js'

const DOMAIN_RE = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+([\/\?#].*)?$/
const FILE_EXTS = new Set(['js','ts','jsx','tsx','mjs','cjs','md','mdx','json','yaml','yml','toml','ini','cfg','conf','env','txt','csv','sh','bash','zsh','py','rb','php','go','rs','java','kt','swift','c','cpp','h','hpp','vue','html','htm','css','scss','sass','less','lock','log','sql','graphql','gql','xml','svg','png','jpg','jpeg','gif','webp','pdf','docx','xlsx','pptx','epub','odt'])

function isFileExtension(arg) {
  const dot = arg.lastIndexOf('.')
  if (dot === -1) return false
  return FILE_EXTS.has(arg.slice(dot + 1).toLowerCase())
}

/**
 * detect(arg) → { type: 'url'|'exact-path'|'fuzzy'|'content', value: string }
 */
export function detect(arg) {
  // 1. URL: explicit scheme or bare domain (but not a filename like README.md)
  if (arg.includes('://') || (DOMAIN_RE.test(arg) && !arg.includes(' ') && !arg.startsWith('/') && !isFileExtension(arg))) {
    return { type: 'url', value: arg }
  }

  // 2. Exact path: starts with /, ./, ../, or contains /
  if (arg.startsWith('/') || arg.startsWith('./') || arg.startsWith('../') || arg.includes('/')) {
    return { type: 'exact-path', value: arg }
  }

  // 3. Fuzzy file lookup via frecency
  const resolved = lookup(arg)
  if (resolved) {
    return { type: 'fuzzy', value: resolved }
  }

  // 4. Fallback: content search
  return { type: 'content', value: arg }
}
