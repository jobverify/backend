// Ordered, bounded literal XML. DTDs/entities and processing instructions other
// than the XML declaration are unsupported; no external resource is ever read.
export const readNativeRSS = input => {
  const source = String(input), root = { tag: '#document', attrs: {}, children: [] }, stack = [root]
  let at = source.charCodeAt(0) === 0xFEFF ? 1 : 0
  const fail = message => { throw Error('Native RSS: ' + message + ' at ' + at) }
  const entity = value => value.replace(/&([^;\s<>&]+);|&/g, (whole, name) => {
    const known = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
    if (Object.hasOwn(known, name)) return known[name]
    if (!/^#(?:\d+|x[0-9a-f]+)$/i.test(name || '')) fail('Unknown entity')
    const point = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1))
    if (!Number.isSafeInteger(point) || point > 0x10FFFF || point < 32 && ![9, 10, 13].includes(point) || point >= 0xD800 && point <= 0xDFFF) fail('Invalid character reference')
    return String.fromCodePoint(point)
  })
  const name = value => value.match(/^[A-Za-z_][A-Za-z0-9_.:-]*/)?.[0]
  while (at < source.length) {
    if (source[at] !== '<') {
      const end = source.indexOf('<', at), stop = end < 0 ? source.length : end, value = entity(source.slice(at, stop))
      if (stack.length === 1 && value.trim()) fail('Text outside root')
      stack.at(-1).children.push(value);at = stop;continue
    }
    if (source.startsWith('<!--', at)) {
      const end = source.indexOf('-->', at + 4)
      if (end < 0) fail('Unclosed comment')
      at = end + 3;continue
    }
    if (source.startsWith('<![CDATA[', at)) {
      if (stack.length < 2) fail('CDATA outside element')
      const end = source.indexOf(']]>', at + 9)
      if (end < 0) fail('Unclosed CDATA')
      stack.at(-1).children.push(source.slice(at + 9, end));at = end + 3;continue
    }
    if (source.startsWith('<?xml', at)) {
      if (root.children.some(child => typeof child !== 'string')) fail('Late XML declaration')
      const end = source.indexOf('?>', at + 5)
      if (end < 0) fail('Unclosed XML declaration')
      at = end + 2;continue
    }
    if (source.startsWith('<!', at) || source.startsWith('<?', at)) fail('Unsupported declaration')
    const start = at
    let quote = null, end = at + 1
    for (; end < source.length; end++) {
      const c = source[end]
      if (quote) { if (c === quote) quote = null }
      else if (c === '"' || c === "'") quote = c
      else if (c === '>') break
    }
    if (end >= source.length) fail('Unclosed tag')
    let body = source.slice(at + 1, end), closing = body.startsWith('/'), selfClosing = !closing && /\/\s*$/.test(body)
    at = end + 1
    if (closing) {
      body = body.slice(1).trim()
      if (stack.length < 2 || body !== stack.at(-1).tag) fail('Mismatched closing tag')
      const node = stack.pop();node.originalXML = source.slice(node.start, at);continue
    }
    if (selfClosing) body = body.replace(/\/\s*$/, '')
    const tag = name(body)
    if (!tag) fail('Invalid element name')
    let rest = body.slice(tag.length)
    const attrs = Object.create(null)
    while (rest.trim()) {
      if (!/^\s/.test(rest)) fail('Missing attribute separator')
      rest = rest.trimStart()
      const key = name(rest)
      if (!key || Object.hasOwn(attrs, key)) fail('Invalid or duplicate attribute')
      rest = rest.slice(key.length).trimStart()
      if (rest[0] !== '=') fail('Missing attribute equals')
      rest = rest.slice(1).trimStart()
      const q = rest[0], stop = rest.indexOf(q, 1)
      if (!['"', "'"].includes(q) || stop < 1 || rest.slice(1, stop).includes('<')) fail('Invalid attribute value')
      attrs[key] = entity(rest.slice(1, stop));rest = rest.slice(stop + 1)
    }
    const node = { tag, attrs, children: [], start }
    stack.at(-1).children.push(node)
    if (selfClosing) node.originalXML = source.slice(start, at)
    else { stack.push(node);if (stack.length > 64) fail('Nesting exceeds limit') }
  }
  if (stack.length !== 1) fail('Unclosed elements')
  const elements = node => node.children.filter(child => typeof child !== 'string')
  const top = elements(root)
  if (top.length !== 1 || top[0].tag !== 'rss') fail('Expected one RSS root')
  const channels = elements(top[0]).filter(node => node.tag === 'channel')
  if (channels.length !== 1) fail('Expected one channel')
  const fields = node => {
    const result = Object.create(null), duplicateFields = []
    for (const child of elements(node)) {
      if (child.tag === 'item') continue
      if (Object.hasOwn(result, child.tag)) { duplicateFields.push(child.tag);continue }
      result[child.tag] = child.children.every(value => typeof value === 'string') ? child.children.join('') : null
    }
    return { fields: result, duplicateFields, originalXML: node.originalXML }
  }
  return { channel: fields(channels[0]), items: elements(channels[0]).filter(node => node.tag === 'item').map(fields) }
}
