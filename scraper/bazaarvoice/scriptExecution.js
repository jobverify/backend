import { decodeHTMLAttribute } from 'entities'
import { requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { MAX_HTML_BYTES } from '../../scraper-support/shared/firstPartyHtmlJobs.js'

const asciiSpace = character => character !== undefined && /^[\t\n\f\r ]$/.test(character)
const trimAsciiSpace = value => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')
const javascriptMIMEs = new Set([
  'application/ecmascript', 'application/javascript', 'application/x-ecmascript', 'application/x-javascript',
  'text/ecmascript', 'text/javascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2',
  'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', 'text/jscript', 'text/livescript',
  'text/x-ecmascript', 'text/x-javascript',
])

// Audit every raw script before classifying its mode. Known inert data forms
// and the browser's explicit nonexecution cases are distinct from opaque,
// unreviewed aliases. An unknown type can never certify absence of another
// recruiting executable merely because a small JavaScript whitelist missed it.
export function bazaarvoiceScriptMode(node) {
  const attrs = node.attrs
  let mode
  if (Object.hasOwn(attrs, 'type')) {
    const raw = attrs.type.toLowerCase(), trimmed = trimAsciiSpace(raw)
    if (raw === '' || javascriptMIMEs.has(trimmed)) mode = 'classic'
    else if (raw === 'module') mode = 'module'
    else if (trimmed === '' || trimmed === 'module' || ['application/json', 'application/ld+json', 'speculationrules'].includes(trimmed)
      || javascriptMIMEs.has(trimmed.split(';')[0])) mode = 'inert'
    else mode = 'opaque'
  } else if (!Object.hasOwn(attrs, 'language') || attrs.language === '') mode = 'classic'
  else mode = javascriptMIMEs.has(trimAsciiSpace('text/' + attrs.language.toLowerCase())) ? 'classic' : 'inert'
  return mode === 'classic' && Object.hasOwn(attrs, 'nomodule') ? 'inert' : mode
}

// Only the current reviewed classic-script forms certify the widget. Empty
// defaults apply to the actual decoded empty value, never trimmed whitespace.
export function isReviewedBazaarvoiceClassicScript(node) {
  if (Object.hasOwn(node.attrs, 'nomodule')) return false
  if (Object.hasOwn(node.attrs, 'type')) {
    const type = node.attrs.type
    return type === '' || /^(?:text|application)\/javascript$/i.test(trimAsciiSpace(type))
  }
  return !Object.hasOwn(node.attrs, 'language') || node.attrs.language === ''
}

// This source-local reader only collects script tags; it never evaluates code
// or applies CSS visibility. hidden/inert/aria-hidden do not stop scripts.
// HTML comments, template contents, and scripting-enabled noscript/raw-text
// elements cannot supply executable scripts. Ambiguous malformed markup fails
// the optional public proof rather than hiding a possible source mutation.
export function readBazaarvoiceRawScripts(input) {
  requireNative(typeof input === 'string' && Buffer.byteLength(input) <= MAX_HTML_BYTES, 'Bazaarvoice raw script document bound')
  const scripts = [], rawElements = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'])
  let offset = 0, templates = 0, foreign = 0, tags = 0
  const readTag = start => {
    let cursor = start + 1, closing = false
    if (input[cursor] === '/') { closing = true; cursor++ }
    if (!/[A-Za-z]/.test(input[cursor] || '')) return null
    const nameStart = cursor
    while (cursor < input.length && !asciiSpace(input[cursor]) && !['/', '>'].includes(input[cursor])) cursor++
    const tag = input.slice(nameStart, cursor).toLowerCase(), attrs = Object.create(null)
    while (cursor < input.length) {
      while (asciiSpace(input[cursor])) cursor++
      if (input[cursor] === '>') return { tag, attrs, closing, end: cursor + 1 }
      if (input[cursor] === '/') { cursor++; continue }
      const attributeStart = cursor
      while (cursor < input.length && !asciiSpace(input[cursor]) && !['/', '=', '>'].includes(input[cursor])) cursor++
      requireNative(cursor > attributeStart, 'Bazaarvoice ambiguous raw script tag attributes')
      const name = input.slice(attributeStart, cursor).toLowerCase()
      while (asciiSpace(input[cursor])) cursor++
      let value = ''
      if (input[cursor] === '=') {
        cursor++
        while (asciiSpace(input[cursor])) cursor++
        const quote = input[cursor]
        if (quote === '"' || quote === "'") {
          const end = input.indexOf(quote, cursor + 1)
          requireNative(end >= 0, 'Bazaarvoice unterminated raw script attribute')
          value = input.slice(cursor + 1, end)
          cursor = end + 1
        } else {
          const valueStart = cursor
          while (cursor < input.length && !asciiSpace(input[cursor]) && input[cursor] !== '>') cursor++
          value = input.slice(valueStart, cursor)
        }
      }
      // HTML keeps the first duplicate attribute. Decode in attribute context;
      // &nbsp; remains NBSP, and is never converted to ordinary ASCII space.
      if (!Object.hasOwn(attrs, name)) attrs[name] = decodeHTMLAttribute(value.replace(/\r\n?/g, '\n').replace(/\0/g, '\ufffd'))
      requireNative(Object.keys(attrs).length <= 128, 'Bazaarvoice raw script attribute bound')
    }
    throw new Error('Bazaarvoice unterminated raw script tag')
  }
  while (offset < input.length) {
    const start = input.indexOf('<', offset)
    if (start < 0) break
    requireNative(++tags <= 100000, 'Bazaarvoice raw script tag bound')
    if (input.startsWith('<!--', start)) {
      const end = input.indexOf('-->', start + 4)
      const alternateEnd = input.indexOf('--!>', start + 4)
      requireNative(end >= 0 && (alternateEnd < 0 || alternateEnd > end)
        && !/^<!--(?:>|->)/.test(input.slice(start, start + 7)), 'Bazaarvoice ambiguous HTML comment in script proof')
      offset = end + 3
      continue
    }
    if (/^<[!?]/.test(input.slice(start, start + 2))) {
      const end = input.indexOf('>', start + 2)
      requireNative(end >= 0, 'Bazaarvoice unterminated declaration in script proof')
      offset = end + 1
      continue
    }
    const node = readTag(start)
    if (!node) { offset = start + 1; continue }
    offset = node.end
    if (node.tag === 'template') {
      requireNative(foreign === 0, 'Bazaarvoice unreviewed foreign template context')
      templates = node.closing ? Math.max(0, templates - 1) : templates + 1
      requireNative(templates <= 128, 'Bazaarvoice raw script template depth bound')
    }
    if (['svg', 'math'].includes(node.tag)) foreign = node.closing ? Math.max(0, foreign - 1) : foreign + 1
    if (node.closing) continue
    if (node.tag === 'plaintext') break
    if (rawElements.has(node.tag)) {
      const ending = new RegExp('</' + node.tag + '(?=[\\t\\n\\f\\r />])', 'ig')
      ending.lastIndex = offset
      const end = ending.exec(input)
      requireNative(end, 'Bazaarvoice unterminated raw-text element in script proof')
      const close = readTag(end.index)
      requireNative(close?.closing && close.tag === node.tag, 'Bazaarvoice ambiguous raw-text closing tag')
      const raw = input.slice(offset, end.index)
      if (node.tag === 'script' && templates === 0) {
        requireNative(foreign === 0 && !(raw.includes('<!--') && /<script(?=[\t\n\f\r />])/i.test(raw)),
          'Bazaarvoice unreviewed foreign or escaped script context')
        scripts.push({ tag: 'script', attrs: node.attrs, raw })
        requireNative(scripts.length <= 512, 'Bazaarvoice raw script count bound')
      }
      offset = close.end
    }
  }
  requireNative(templates === 0, 'Bazaarvoice unclosed template in script proof')
  return scripts
}
