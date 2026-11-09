const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error('Bazaarvoice ' + message), { code: 'native_contract', abortRetries: true })
}
const maximumBytes = 2 * 1024 * 1024
const printStart = /@media[\t\n\f\r ]+(?:only[\t\n\f\r ]+)?print[\t\n\f\r ]*\{/iy

// Only discover a media rule while outside CSS comments, strings and escapes.
// Preserve every real screen/unknown media rule. Incomplete lexical contexts
// cannot prove screen visibility and fail the optional detail/scope proof.
export function stripBazaarvoicePrintCSS(css) {
  need(typeof css === 'string' && Buffer.byteLength(css) <= maximumBytes, 'stylesheet-byte-bound')
  let index = 0, cursor = 0, result = '', depth = 0, boundary = true
  const skipToken = () => {
    if (css[index] === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2)
      need(end >= 0, 'unterminated-stylesheet-comment')
      index = end + 2
      return true
    }
    if (css[index] === '"' || css[index] === "'") {
      const quote = css[index++]
      while (index < css.length && css[index] !== quote) {
        if (css[index] === '\\') { index += css[index + 1] === '\r' && css[index + 2] === '\n' ? 3 : 2; continue }
        need(!/[\n\r\f]/.test(css[index]), 'ambiguous-stylesheet-string')
        index++
      }
      need(index < css.length, 'unterminated-stylesheet-string')
      index++
      return true
    }
    if (css[index] === '\\') {
      index++
      need(index < css.length, 'unterminated-stylesheet-escape')
      if (/[0-9a-f]/i.test(css[index])) {
        const start = index
        while (index < css.length && index - start < 6 && /[0-9a-f]/i.test(css[index])) index++
        if (/[\t\n\f\r ]/.test(css[index] || '')) index += css[index] === '\r' && css[index + 1] === '\n' ? 2 : 1
      } else index++
      return true
    }
    return false
  }
  while (index < css.length) {
    const wasComment = css[index] === '/' && css[index + 1] === '*'
    if (skipToken()) { if (!wasComment) boundary = false; continue }
    printStart.lastIndex = index
    const match = boundary && css[index] === '@' ? printStart.exec(css) : null
    if (match) {
      result += css.slice(cursor, index)
      index = printStart.lastIndex
      let printDepth = 1
      while (index < css.length && printDepth) {
        if (skipToken()) continue
        if (css[index] === '{') need(++printDepth <= 128, 'stylesheet-depth-bound')
        if (css[index] === '}') printDepth--
        index++
      }
      need(printDepth === 0, 'unterminated-print-stylesheet')
      cursor = index
      boundary = true
      continue
    }
    const char = css[index++]
    if (char === '{') { need(++depth <= 128, 'stylesheet-depth-bound'); boundary = true }
    else if (char === '}') { need(--depth >= 0, 'unbalanced-stylesheet-block'); boundary = true }
    else if (char === ';') boundary = true
    else if (!/[\t\n\f\r ]/.test(char)) boundary = false
  }
  need(depth === 0, 'unbalanced-stylesheet-block')
  return result + css.slice(cursor)
}

export function projectBazaarvoiceScreenStyles(html) {
  need(typeof html === 'string' && Buffer.byteLength(html) <= maximumBytes, 'screen-document-byte-bound')
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi,
    (whole, attributes, css) => '<style' + attributes + '>' + stripBazaarvoicePrintCSS(css) + '</style>')
}
