import { readFileSync } from 'node:fs'
const entities = JSON.parse(readFileSync(new URL('./htmlNamedEntities.json', import.meta.url)))
export const text = value => String(value ?? '').replace(/\s+/gu, ' ').trim()
export const decode = value => String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (raw, key) => {
  if (key[0] !== '#') return entities[`${key};`] ?? raw
  const cp = key[1].toLowerCase() === 'x' ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10)
  return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '\ufffd'
})
// Recognize markup before decoding each text leaf once.
export const visibleText = html => {
  const parts = []; const stack = []
  for (const token of String(html ?? '').match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+|</gi) || []) {
    if (token.startsWith('<!--') || token.startsWith('<!')) continue
    const closing = token.match(/^<\/([a-z][\w:-]*)/i)
    if (closing) { const tag = closing[1].toLowerCase(); const index = stack.findLastIndex(x => x.tag === tag); if (index >= 0) stack.splice(index); if (/^(p|div|li|ul|ol|h[1-6]|section|table|tr|td|th)$/.test(tag)) parts.push(' '); continue }
    const opening = token.match(/^<([a-z][\w:-]*)/i)
    if (opening) {
      const tag = opening[1].toLowerCase()
      const hidden = /^(script|style|template|noscript)$/i.test(tag) || /\s(?:hidden|inert)(?:\s|=|>|\/)|aria-hidden\s*=\s*["']?true|display\s*:\s*none|visibility\s*:\s*hidden/i.test(token)
      if (!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !/\/\s*>$/.test(token)) stack.push({ tag, hidden })
      if (/^(p|div|br|li|ul|ol|h[1-6]|section|table|tr|td|th)$/.test(tag)) parts.push(' ')
      continue
    }
    if (!stack.some(x => x.hidden)) parts.push(decode(token))
  }
  return text(parts.join(''))
}
export const readAppData = html => {
  const raw = String(html ?? ''); const start = /window\.__appData\s*=\s*/g.exec(raw)
  if (!start) throw new Error('Missing native Ashby app data')
  const offset = start.index + start[0].length
  let depth = 0; let quote = false; let escape = false
  for (let i = offset; i < raw.length; i++) {
    const ch = raw[i]
    if (quote) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === '"') quote = false; continue }
    if (ch === '"') { quote = true; continue }
    if (ch === '{' || ch === '[') depth++
    if (ch === '}' || ch === ']') { if (--depth === 0) return JSON.parse(raw.slice(offset, i + 1)) }
  }
  throw new Error('Truncated native Ashby app data')
}
export const readSchemas = html => [...String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap(m => { const value = JSON.parse(m[1]); return Array.isArray(value) ? value : value['@graph'] || [value] }).filter(value => value?.['@type'] === 'JobPosting')
export const qualificationSections = html => {
  const result = { minimumQualification: null, preferredQualification: null, requiredSkills: [] }
  const headings = [...String(html).matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  for (let i = 0; i < headings.length; i++) {
    const heading = visibleText(headings[i][2]); const content = visibleText(String(html).slice(headings[i].index + headings[i][0].length, headings[i + 1]?.index))
    if (/^(?:requirements|required qualifications|minimum qualifications|qualifications)\s*:?$/i.test(heading)) result.minimumQualification = content || null
    if (/^(?:preferred qualifications|preferred requirements|nice to have)\s*:?$/i.test(heading)) result.preferredQualification = content || null
    if (/^(?:required skills|technical skills)\s*:?$/i.test(heading)) result.requiredSkills.push(content)
  }
  return result
}
