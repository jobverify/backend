import entities from './htmlNamedEntities.json' with { type: 'json' }

// Decode after recognizing markup, exactly once. Encoded tags remain text.
export const decode = value => String(value ?? '').replace(/&(?:#(x[\da-f]+|\d+);?|([A-Za-z][A-Za-z\d]+);)/gi, (whole, number, name) => {
  if (!number) return Object.hasOwn(entities, name + ';') ? entities[name + ';'] : whole
  const code = /^x/i.test(number) ? parseInt(number.slice(1), 16) : Number(number)
  return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd'
})
export const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '))
const rawTags = new Set('script style textarea title xmp iframe noembed noframes plaintext noscript'.split(' '))
const blocks = new Set('p div br li ul ol table tr td th h1 h2 h3 h4 h5 h6 section article header footer hr'.split(' '))

// Offsets always refer to the original UTF-8-decoded document. In particular,
// nested Word spans cannot terminate the outer description's source slice.
export const document = input => {
  const html = String(input), root = { tag: 'root', attrs: Object.create(null), children: [], openEnd: 0, closeStart: html.length, closed: true }
  const stack = [root], tags = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let cursor = 0, match
  while ((match = tags.exec(html))) {
    const parent = stack.at(-1)
    if (match.index > cursor) parent.children.push(html.slice(cursor, match.index))
    cursor = tags.lastIndex
    if (!match[1]) continue
    const tag = match[1].toLowerCase()
    if (match[0].startsWith('</')) {
      const at = stack.findLastIndex(node => node.tag === tag)
      const boundary = stack.findLastIndex(node => node.tag === 'template')
      if (at > 0 && at >= boundary) {
        const node = stack[at];node.closeStart = match.index;node.end = cursor;node.closed = true
        for (const unclosed of stack.slice(at + 1)) { unclosed.closeStart = match.index;unclosed.end = match.index }
        stack.length = at
      }
      continue
    }
    const attrs = Object.create(null), duplicateAttributes = []
    for (const a of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = a[1].toLowerCase(), value = decode(a[2] ?? a[3] ?? a[4] ?? '')
      if (Object.hasOwn(attrs, key)) duplicateAttributes.push({ key, original: attrs[key], duplicate: value })
      else attrs[key] = value
    }
    const style = (attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '')
    const hidden = Object.hasOwn(attrs, 'hidden') || Object.hasOwn(attrs, 'inert') || attrs['aria-hidden']?.toLowerCase() === 'true'
      || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style)
    const node = { tag, attrs, duplicateAttributes, children: [], parent, openStart: match.index, openEnd: cursor,
      closeStart: voids.has(tag) ? cursor : html.length, end: voids.has(tag) ? cursor : html.length, closed: voids.has(tag), inert: Boolean(parent.inert || hidden || ['template', 'object'].includes(tag)
        || rawTags.has(tag) && !['script', 'title'].includes(tag)) }
    parent.children.push(node)
    if (rawTags.has(tag)) {
      const end = tag === 'plaintext' ? null : new RegExp('</' + tag + '\\s*>', 'ig')
      if (end) end.lastIndex = cursor
      const closing = end?.exec(html)
      node.raw = html.slice(cursor, closing?.index ?? html.length)
      node.closeStart = closing?.index ?? html.length;node.end = closing ? end.lastIndex : html.length;node.closed = Boolean(closing)
      cursor = node.end;tags.lastIndex = cursor
    } else if (!voids.has(tag)) stack.push(node)
  }
  if (cursor < html.length) stack.at(-1).children.push(html.slice(cursor))
  const nodes = predicate => {
    const found = []
    const visit = node => {
      if (node.inert) return
      if (predicate(node)) found.push(node)
      for (const child of node.children) if (typeof child !== 'string') visit(child)
    }
    visit(root);return found
  }
  const render = node => {
    if (node.inert || ['script', 'style'].includes(node.tag)) return ''
    if (node.tag === 'title') return decode(node.raw || '')
    const value = node.children.map(child => typeof child === 'string' ? decode(child) : render(child)).join('')
    return blocks.has(node.tag) ? '\n' + value + '\n' : value
  }
  return { nodes, text: node => compact(render(node)), inner: node => html.slice(node.openEnd, node.closeStart),
    original: node => html.slice(node.openStart, node.end), hasClass: (node, token) => (node.attrs.class || '').split(/\s+/).includes(token) }
}
