// Source-local inert HTML reader. Decode only original text/attribute leaves;
// decoded text never re-enters the tokenizer or another entity decode pass.
import { readFileSync } from 'node:fs'
const entities = JSON.parse(readFileSync(new URL('./htmlNamedEntities.json', import.meta.url)))
export const decodeEntities = value => String(value ?? '').replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (whole, hex, decimal, name) => {
  if (name) return entities[`${name};`] ?? whole
  const cp = Number.parseInt(hex || decimal, hex ? 16 : 10)
  return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '�'
})
export const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const hiddenStyle = value => /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?)(?:\s*!important)?\s*(?:;|$)/i.test(String(value || '').replace(/\/\*[\s\S]*?\*\//g, ''))
export const hasClass = (node, cls) => (node.attrs.class || '').split(/\s+/).includes(cls)
const visibilitySelector = selector => {
  const compounds = [], relations = []
  let pendingChild = false
  for (const part of selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/)) {
    if (part === '>') {
      if (!compounds.length || pendingChild) throw new Error('Agiloft native HTML: unsupported CSS visibility selector')
      pendingChild = true
      continue
    }
    const attrMatches = [...part.matchAll(/\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([\w-]+)))?\]/g)]
    const plain = part.replace(/\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([\w-]+)))?\]/g, '')
    if (!plain || !/^(?:[a-z][\w-]*|\*)?(?:[.#][\w-]+)*$/i.test(plain)) throw new Error(`Agiloft native HTML: unsupported CSS visibility selector:${selector}`)
    if (compounds.length) relations.push(pendingChild ? 'child' : 'descendant')
    pendingChild = false
    const tag = plain.match(/^(?:[a-z][\w-]*|\*)/i)?.[0]
    const ids = [...plain.matchAll(/#([\w-]+)/g)].map(m => m[1])
    const classes = [...plain.matchAll(/\.([\w-]+)/g)].map(m => m[1])
    compounds.push(node => (!tag || tag === '*' || tag.toLowerCase() === node.tag)
      && ids.every(id => id === node.attrs.id) && classes.every(cls => hasClass(node, cls))
      && attrMatches.every(m => Object.hasOwn(node.attrs, m[1]) && (m[2] == null && m[3] == null && m[4] == null || node.attrs[m[1]] === (m[2] ?? m[3] ?? m[4]))))
  }
  if (pendingChild || !compounds.length) throw new Error('Agiloft native HTML: unsupported CSS visibility selector')
  const matches = (node, index) => {
    if (!node || !compounds[index](node)) return false
    if (index === 0) return true
    if (relations[index - 1] === 'child') return matches(node.parent, index - 1)
    for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) if (matches(ancestor, index - 1)) return true
    return false
  }
  return node => matches(node, compounds.length - 1)
}
const cssDelimiter = (css, start, wanted) => {
  let quote = null, parens = 0, brackets = 0
  for (let i = start; i < css.length; i++) {
    const char = css[i]
    if (char === '\\') { i++; continue }
    if (quote) { if (char === quote) quote = null; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(') parens++
    if (char === ')') parens--
    if (char === '[') brackets++
    if (char === ']') brackets--
    if (!parens && !brackets && wanted.includes(char)) return i
  }
  return -1
}
const cssBlockEnd = (css, open) => {
  let quote = null, depth = 1
  for (let i = open + 1; i < css.length; i++) {
    const char = css[i]
    if (char === '\\') { i++; continue }
    if (quote) { if (char === quote) quote = null; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '{') depth++
    if (char === '}' && --depth === 0) return i
  }
  throw new Error('Agiloft native HTML: unsupported unbalanced CSS block')
}
// Retain conditional/nested scope instead of flattening its declarations. This
// is a static visibility safeguard, not viewport/support/container evaluation.
const visibilityRules = (input, conditional = false) => {
  const css = input.replace(/\/\*[\s\S]*?\*\//g, ''), rules = []
  let start = 0
  while (start < css.length) {
    const at = cssDelimiter(css, start, ['{', ';'])
    if (at < 0) break
    if (css[at] === ';') { start = at + 1; continue }
    const end = cssBlockEnd(css, at), header = css.slice(start, at).trim(), body = css.slice(at + 1, end)
    if (/^@media\s+print\b|^@(?:-[\w]+-)?keyframes\b|^@font-face\b/i.test(header)) { start = end + 1; continue }
    if (header.startsWith('@') || cssDelimiter(body, 0, ['{']) >= 0) rules.push(...visibilityRules(body, true))
    else if (hiddenStyle(body)) for (const selector of header.split(',')) {
      // Pseudo-elements are generated browser controls, not native text nodes.
      if (/::[\w-]+|:(?:before|after|first-line|first-letter)\b/.test(selector)) continue
      if (/:(?:active|hover|focus|focus-within|focus-visible|visited)\b/.test(selector)) continue
      rules.push({ matches: visibilitySelector(selector), conditional })
    }
    start = end + 1
  }
  return rules
}
const block = new Set(['root', 'div', 'section', 'p', 'li', 'ul', 'ol', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr'])
const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext', 'noscript'])
// Lever's public page protects contact text using the standard inline hex
// encoding. Resolve that native text only; it is also present in its JSON feed.
const publicContactText = node => {
  const hex = node.attrs['data-cfemail']
  if (!hex || !/^(?:[a-f0-9]{2}){2,}$/i.test(hex)) return null
  const key = Number.parseInt(hex.slice(0, 2), 16)
  return String.fromCharCode(...hex.slice(2).match(/../g).map(pair => Number.parseInt(pair, 16) ^ key))
}

export const readHtml = input => {
  const html = String(input ?? ''), root = { tag: 'root', attrs: {}, children: [], inert: false }, stack = [root]
  const tokens = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let cursor = 0, match
  while ((match = tokens.exec(html))) {
    const parent = stack.at(-1)
    if (match.index > cursor) parent.children.push(html.slice(cursor, match.index))
    cursor = tokens.lastIndex
    if (!match[1]) continue
    const tag = match[1].toLowerCase()
    if (match[0].startsWith('</')) {
      const at = stack.findLastIndex(n => n.tag === tag), boundary = stack.findLastIndex(n => n.tag === 'template')
      if (at > 0 && at >= boundary) stack.length = at
      continue
    }
    const attrs = {}
    for (const a of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = a[1].toLowerCase()
      if (!Object.hasOwn(attrs, key)) attrs[key] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '')
    }
    const node = { tag, attrs, parent, children: [], inert: parent.inert || Object.hasOwn(attrs, 'hidden') || Object.hasOwn(attrs, 'inert') || attrs['aria-hidden']?.toLowerCase() === 'true' || hiddenStyle(attrs.style) || ['template', 'object'].includes(tag) || (raw.has(tag) && !['script', 'style', 'title'].includes(tag)) }
    parent.children.push(node)
    if (raw.has(tag)) {
      const end = tag === 'plaintext' ? null : new RegExp(`</${tag}\\s*>`, 'ig')
      if (end) end.lastIndex = cursor
      const close = end?.exec(html)
      node.raw = html.slice(cursor, close?.index ?? html.length)
      cursor = close ? end.lastIndex : html.length
      tokens.lastIndex = cursor
    } else if (!voids.has(tag)) stack.push(node)
  }
  if (cursor < html.length) stack.at(-1).children.push(html.slice(cursor))
  const all = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(all)]
  const styleNodes = all(root).filter(node => {
    if (node.tag !== 'style' || (node.attrs.type && node.attrs.type.toLowerCase() !== 'text/css')) return false
    for (let parent = node.parent; parent; parent = parent.parent) if (['template', 'object'].includes(parent.tag)) return false
    return true
  })
  const rules = styleNodes.flatMap(node => visibilityRules(node.raw || '', Boolean(node.attrs.media && !/^all$/i.test(node.attrs.media.trim()))))
  const fragments = node => node.inert || ['script', 'style', 'title'].includes(node.tag) ? '' : publicContactText(node) ?? `${block.has(node.tag) ? '\n' : ''}${node.children.map(c => typeof c === 'string' ? decodeEntities(c) : fragments(c)).join('')}${block.has(node.tag) ? '\n' : ''}`
  const hide = (node, inherited = false) => {
    node.inert ||= inherited || rules.some(rule => !rule.conditional && rule.matches(node))
    node.children.filter(c => typeof c !== 'string').forEach(c => hide(c, node.inert))
  }
  hide(root)
  // Unsupported conditions must not remove a criterion and still permit a
  // complete detail claim. Empty decorative controls carry no content or URL.
  for (const node of all(root)) if (!node.inert && rules.some(rule => rule.conditional && rule.matches(node))
    && (normalize(fragments(node)) || (node.tag === 'a' && node.attrs.href))) {
    throw new Error('Agiloft native HTML: unsupported conditional visibility affects native content')
  }
  const nodes = (predicate, node = root) => node.inert ? [] : [...(predicate(node) ? [node] : []), ...node.children.filter(c => typeof c !== 'string').flatMap(c => nodes(predicate, c))]
  const text = node => fragments(node).split(/\n/).map(normalize).filter(Boolean).join('\n')
  return { root, nodes, text }
}
