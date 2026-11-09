import { decodeHTMLAttribute } from 'entities'

const need = (condition, message) => { if (!condition) throw Error('Biofourmis raw script proof: ' + message) }
const asciiSpace = character => character !== undefined && /^[\t\n\f\r ]$/.test(character)
const trimAsciiSpace = value => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')
const javascriptMimes = new Set(['application/ecmascript', 'application/javascript', 'application/x-ecmascript',
  'application/x-javascript', 'text/ecmascript', 'text/javascript', 'text/javascript1.0', 'text/javascript1.1',
  'text/javascript1.2', 'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', 'text/jscript',
  'text/livescript', 'text/x-ecmascript', 'text/x-javascript'])

// This reader supplies optional public proof, not a browser implementation.
// Preserve HTML's first attribute and collect executing scripts independently
// of visual hiding. Unsupported comment/namespace boundaries withhold proof.
// No source, script body or remote code is executed.
function readRawSource(input) {
  need(typeof input === 'string' && Buffer.byteLength(input) <= 2 * 1024 * 1024, 'document byte bound')
  const scripts = [], elements = [], rawElements = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'])
  let offset = 0, templates = 0, foreign = 0, tags = 0
  const readTag = start => {
    let cursor = start + 1, closing = false, selfClosing = false
    if (input[cursor] === '/') { closing = true;cursor++ }
    if (!/[A-Za-z]/.test(input[cursor] || '')) return null
    const nameStart = cursor
    while (cursor < input.length && !asciiSpace(input[cursor]) && !['/', '>'].includes(input[cursor])) cursor++
    const tag = input.slice(nameStart, cursor).toLowerCase(), attrs = Object.create(null), duplicateAttributes = []
    while (cursor < input.length) {
      while (asciiSpace(input[cursor])) cursor++
      if (input[cursor] === '>') return { tag, attrs, duplicateAttributes, closing, selfClosing, end: cursor + 1 }
      if (input[cursor] === '/') { selfClosing = input[cursor + 1] === '>';cursor++;continue }
      const attributeStart = cursor
      while (cursor < input.length && !asciiSpace(input[cursor]) && !['/', '=', '>'].includes(input[cursor])) cursor++
      need(cursor > attributeStart, 'ambiguous tag attributes')
      const name = input.slice(attributeStart, cursor).toLowerCase()
      while (asciiSpace(input[cursor])) cursor++
      let value = ''
      if (input[cursor] === '=') {
        cursor++
        while (asciiSpace(input[cursor])) cursor++
        const quote = input[cursor]
        if (quote === '"' || quote === "'") {
          const end = input.indexOf(quote, cursor + 1)
          need(end >= 0, 'unterminated attribute')
          value = input.slice(cursor + 1, end);cursor = end + 1
        } else {
          const valueStart = cursor
          while (cursor < input.length && !asciiSpace(input[cursor]) && input[cursor] !== '>') cursor++
          value = input.slice(valueStart, cursor)
        }
      }
      if (Object.hasOwn(attrs, name)) duplicateAttributes.push(name)
      else attrs[name] = decodeHTMLAttribute(value.replace(/\r\n?/g, '\n').replace(/\0/g, '\ufffd'))
      need(Object.keys(attrs).length <= 128 && duplicateAttributes.length <= 128, 'attribute count bound')
    }
    throw Error('Biofourmis raw script proof: unterminated tag')
  }
  while (offset < input.length) {
    const start = input.indexOf('<', offset)
    if (start < 0) break
    need(++tags <= 100000, 'tag count bound')
    if (input.startsWith('<!--', start)) {
      const end = input.indexOf('-->', start + 4), alternateEnd = input.indexOf('--!>', start + 4)
      need(end >= 0 && (alternateEnd < 0 || alternateEnd > end)
        && !/^<!--(?:>|->)/.test(input.slice(start, start + 7)), 'unreviewed HTML comment boundary')
      offset = end + 3;continue
    }
    if (/^<[!?]/.test(input.slice(start, start + 2))) {
      const end = input.indexOf('>', start + 2)
      need(end >= 0, 'unterminated declaration')
      offset = end + 1;continue
    }
    const node = readTag(start)
    if (!node) { offset = start + 1;continue }
    offset = node.end
    // Hidden/inert elements still participate in ID/form ownership. Only real
    // template contents and raw-text strings stay outside the source DOM here.
    if (!node.closing && templates === 0) elements.push(node)
    if (node.tag === 'template') {
      need(foreign === 0 || templates > 0, 'unreviewed foreign template context')
      if (foreign === 0) templates = node.closing ? Math.max(0, templates - 1) : templates + 1
      need(templates <= 128, 'template depth bound')
    }
    if (['svg', 'math'].includes(node.tag)) foreign = node.closing ? Math.max(0, foreign - 1) : foreign + (node.selfClosing ? 0 : 1)
    if (node.closing) continue
    // HTML raw-text rules do not apply inside SVG/MathML. Refuse the
    // unsupported context before skipping any possible nested executable tag.
    if (templates === 0 && (rawElements.has(node.tag) || node.tag === 'plaintext'))
      need(foreign === 0, 'unreviewed foreign raw-text context')
    if (node.tag === 'plaintext') break
    if (rawElements.has(node.tag)) {
      const ending = new RegExp('</' + node.tag + '(?=[\\t\\n\\f\\r />])', 'ig')
      ending.lastIndex = offset
      const end = ending.exec(input)
      need(end, 'unterminated raw-text element')
      const close = readTag(end.index)
      need(close?.closing && close.tag === node.tag, 'ambiguous raw-text closing tag')
      // Both source proof readers accept only this common finite grammar.
      // Browser-accepted attributes/slashes on an end tag are unreviewed here;
      // accepting them would let the shared DOM reader swallow later anchors.
      need(new RegExp('^</' + node.tag + '[\\t\\n\\f\\r ]*>$', 'i').test(input.slice(end.index, close.end)),
        'unreviewed raw-text closing syntax')
      const raw = input.slice(offset, end.index)
      if (node.tag === 'script' && templates === 0) {
        need(foreign === 0 && !(raw.includes('<!--') && /<script(?=[\t\n\f\r />])/i.test(raw)), 'unreviewed foreign or escaped script context')
        scripts.push({ tag: 'script', attrs: node.attrs, raw, duplicateAttributes: node.duplicateAttributes })
        need(scripts.length <= 512, 'script count bound')
      }
      offset = close.end
    }
  }
  need(templates === 0 && foreign === 0, 'unclosed template/foreign context')
  return { scripts, elements }
}

export const rawScriptNodes = html => readRawSource(html).scripts
export const rawElementNodes = html => readRawSource(html).elements

export const executionKind = node => {
  if (Object.hasOwn(node.attrs, 'nomodule')) return null
  if (Object.hasOwn(node.attrs, 'type')) {
    if (node.attrs.type === '') return 'classic'
    const type = trimAsciiSpace(node.attrs.type).toLowerCase()
    if (javascriptMimes.has(type)) return 'classic'
    return type === 'module' ? 'module' : null
  }
  if (!Object.hasOwn(node.attrs, 'language') || node.attrs.language === '') return 'classic'
  return javascriptMimes.has('text/' + node.attrs.language.toLowerCase()) ? 'classic' : null
}

export const executableScripts = html => rawScriptNodes(html).filter(node => executionKind(node))
