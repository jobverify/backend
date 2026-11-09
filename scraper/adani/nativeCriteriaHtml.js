import { decode, document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { projectHTML } from '../arcelormittal/oracleNative.js'

const declarations = style => {
  const parts = []
  let start = 0, quote = null, escaped = false, depth = 0
  for (let index = 0; index < style.length; index++) {
    const char = style[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (quote) { if (char === quote) quote = null; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(') depth++
    else if (char === ')') { if (--depth < 0) return null }
    else if (char === ';' && depth === 0) { parts.push(style.slice(start, index)); start = index + 1 }
  }
  if (quote || depth || escaped) return null
  parts.push(style.slice(start))
  return parts
}

// These properties affect font choice or borders, without hiding role text.
// Parse quoted values before removing them so a real display/opacity declaration
// can never disappear into a semicolon embedded in a font-family value.
export function normalizeNativeCriteriaStyles(input) {
  if (typeof input !== 'string') return { html: input, complete: true }
  let valid = true
  const edits = []
  const visit = node => {
    if (node.tag !== 'root') {
      const opening = input.slice(node.start, node.openEnd), name = opening.match(/^<[a-z][a-z0-9:_-]*\b/i)?.[0]
      if (name) {
        const attributes = opening.slice(name.length)
        const tokens = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
        let seenStyle = false
        for (const match of attributes.matchAll(tokens)) {
          if (match[1].toLowerCase() !== 'style' || seenStyle) continue
          seenStyle = true
          const parts = declarations(decode(match[2] ?? match[3] ?? match[4] ?? ''))
          if (!parts) { valid = false; continue }
          const remaining = parts.filter(part => {
            const property = part.match(/^\s*([\w-]+)\s*:/)?.[1]?.toLowerCase()
            return property !== 'font-family' && !/^border-(?:top|right|bottom|left)-style$/.test(property || '')
          }).join(';')
          const encoded = remaining.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const quote = match[2] != null ? '"' : match[3] != null ? "'" : '"'
          const start = node.start + name.length + match.index
          edits.push({ start, end: start + match[0].length, text: 'style=' + quote + encoded + quote })
        }
      }
    }
    for (const child of node.children || []) if (typeof child !== 'string') visit(child)
  }
  visit(document(input).root)
  let html = input
  for (const edit of edits.sort((a, b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.text + html.slice(edit.end)
  return { html, complete: valid }
}

export function projectNativeCriteria(input) {
  const normalized = normalizeNativeCriteriaStyles(input), projection = projectHTML(normalized.html)
  return { text: projection.text, complete: normalized.complete && projection.complete }
}
