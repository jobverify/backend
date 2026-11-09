import { readNativeDocument } from './activeNativeHtml.js'

const space = value => value != null && /[\t\n\f\r ]/.test(value)
const rawElements = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext', 'noscript'])

// Quotes start an attribute value only after '='. A quote in an attribute name
// or an unquoted value is a parse error, but stays part of that token.
// https://html.spec.whatwg.org/multipage/parsing.html#attribute-name-state
const attributesAt = (html, start) => {
  const attributes = []
  let i = start
  while (i < html.length) {
    while (space(html[i])) i++
    if (html[i] === '>') return { end: i + 1, attributes }
    if (html[i] === '/') { i++; continue }
    if (i >= html.length) break
    const nameStart = i++
    while (i < html.length && !space(html[i]) && !['/', '>', '='].includes(html[i])) i++
    const name = html.slice(nameStart, i).toLowerCase()
    while (space(html[i])) i++
    let value = ''
    if (html[i] === '=') {
      i++
      while (space(html[i])) i++
      if (html[i] === '"' || html[i] === "'") {
        const end = html.indexOf(html[i], i + 1)
        if (end < 0) return null
        value = html.slice(i + 1, end)
        i = end + 1
      } else {
        const valueStart = i
        while (i < html.length && !space(html[i]) && html[i] !== '>') i++
        value = html.slice(valueStart, i)
      }
    }
    attributes.push([name, value])
  }
  // An unfinished tag at EOF is not emitted, including text inside its value.
  return null
}

// Project only attribute boundaries for the existing conservative tree reader.
// Raw text, comments, duplicate identity metadata and visibility retain their
// existing handling. Original HTTP bytes are kept separately as evidence.
export const normalizeNativeAttributeBoundaries = input => {
  const html = String(input), output = []
  const tags = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\?[^>]*(?:>|$)|<\/?([a-z][^\t\n\f\r />]*)/gi
  let cursor = 0, match
  while ((match = tags.exec(html))) {
    output.push(html.slice(cursor, match.index))
    if (!match[1]) {
      // HTML processing instructions are bogus comments, never active markup.
      if (!match[0].startsWith('<?')) output.push(match[0])
      cursor = tags.lastIndex
      continue
    }
    const tag = match[1].replace(/[A-Z]/g, character => character.toLowerCase())
    // Retain the complete tag spelling. The native tree qualifies supported
    // names and keeps other subtrees inert; a malformed footer must not reject
    // valid content elsewhere or be shortened into an ordinary identity tag.
    // https://html.spec.whatwg.org/multipage/parsing.html#tag-name-state
    const parsed = attributesAt(html, tags.lastIndex)
    if (!parsed) { cursor = html.length; break }
    const closing = match[0].startsWith('</')
    const attributes = parsed.attributes.filter(([name]) => /^[^\s"'<>/=]+$/.test(name))
      .map(([name, value]) => ' ' + name + '="' + value.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"').join('')
    output.push(closing ? '</' + tag + '>' : '<' + tag + attributes + '>')
    cursor = parsed.end
    tags.lastIndex = cursor
    if (!closing && rawElements.has(tag)) {
      const end = tag === 'plaintext' ? null : new RegExp('</' + tag + '\\s*>', 'ig')
      if (end) end.lastIndex = cursor
      const close = end?.exec(html)
      const boundary = close ? end.lastIndex : html.length
      output.push(html.slice(cursor, boundary))
      cursor = boundary
      tags.lastIndex = cursor
    }
  }
  output.push(html.slice(cursor))
  return output.join('')
}

export const readNativeAttributeDocument = (html, options) => readNativeDocument(normalizeNativeAttributeBoundaries(html), options)
