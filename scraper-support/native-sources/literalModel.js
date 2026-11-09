// Literal data only: no eval, expressions, page scripts or recursive decoding of
// strings that happen to contain JSON. The narrow portal profile also reads
// original control characters in quoted VALUES, recording invalid JSON syntax.
export const readLiteralModel = (input, { rawControls = false } = {}) => {
  const text = String(input), controls = [], duplicateKeys = []
  let at = 0
  const fail = message => { throw Object.assign(Error(message + ' at ' + at), { code: 'NATIVE_LITERAL_INVALID', duplicateKeys }) }
  const space = () => { while (/[\x20\t\r\n]/.test(text[at] || '\uFFFF')) at++ }
  const string = key => {
    if (text[at++] !== '"') fail('Expected quoted string')
    let value = ''
    while (at < text.length) {
      const c = text[at++]
      if (c === '"') return value
      if (c === '\\') {
        const escaped = text[at++], simple = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
        if (escaped === 'u') {
          const hex = text.slice(at, at + 4)
          if (!/^[0-9a-f]{4}$/i.test(hex)) fail('Invalid Unicode escape')
          value += String.fromCharCode(parseInt(hex, 16));at += 4
        } else if (Object.hasOwn(simple, escaped)) value += simple[escaped]
        else fail('Invalid string escape')
      } else {
        if (c.charCodeAt(0) < 32) {
          if (!rawControls || key) fail('Original raw control in string')
          controls.push({ offset: at - 1, codePoint: c.charCodeAt(0) })
        }
        value += c
      }
    }
    fail('Unterminated string')
  }
  const read = (path, depth) => {
    if (depth > 128) fail('Literal nesting exceeds limit')
    space()
    const c = text[at]
    if (c === '"') return string(false)
    if (c === '{') {
      at++;space()
      const value = Object.create(null), keys = new Set()
      if (text[at] === '}') { at++;return value }
      while (at < text.length) {
        const key = string(true)
        if (keys.has(key)) { duplicateKeys.push({ path, key });fail('Duplicate decoded key') }
        keys.add(key);space()
        if (text[at++] !== ':') fail('Expected object colon')
        Object.defineProperty(value, key, { value: read(path + '.' + key, depth + 1), enumerable: true, writable: true })
        space()
        if (text[at] === '}') { at++;return value }
        if (text[at++] !== ',') fail('Expected object separator')
        space()
      }
      fail('Unterminated object')
    }
    if (c === '[') {
      at++;space()
      const value = []
      if (text[at] === ']') { at++;return value }
      while (at < text.length) {
        value.push(read(path + '[' + value.length + ']', depth + 1));space()
        if (text[at] === ']') { at++;return value }
        if (text[at++] !== ',') fail('Expected array separator')
      }
      fail('Unterminated array')
    }
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(literal, at)) { at += literal.length;return value }
    }
    const number = text.slice(at).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
    if (!number) fail('Unsupported literal value')
    at += number[0].length
    if (!Number.isFinite(Number(number[0]))) fail('Non-finite number')
    return Number(number[0])
  }
  const value = read('$', 0);space()
  if (at !== text.length) fail('Trailing literal data')
  return { value, duplicateKeys, rawControlCharacters: controls, validJSON: controls.length === 0 }
}
