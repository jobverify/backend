// Decoded member names must be unique. Quoted description values stay data.
export function readUniqueLiteralJSON(raw) {
  if (typeof raw !== 'string') throw new SyntaxError('Expected literal JSON')
  let at = 0
  const duplicateKeys = [], space = () => { while (/[\t\n\r ]/.test(raw[at] || '!')) at++ }
  const bad = () => { throw new SyntaxError('Malformed literal JSON at ' + at) }
  const pointer = value => value.replaceAll('~', '~0').replaceAll('/', '~1')
  const string = () => {
    if (raw[at] !== '"') bad()
    const start = at++
    while (at < raw.length) {
      const character = raw[at++]
      if (character === '\\') { if (at >= raw.length) bad();at++ }
      else if (character === '"') return JSON.parse(raw.slice(start, at))
    }
    bad()
  }
  const value = (path = '', depth = 0) => {
    if (depth >= 128) throw new SyntaxError('Native JSON nesting exceeds limit')
    space()
    if (raw[at] === '{') {
      at++;space();const keys = new Set()
      if (raw[at] === '}') { at++;return }
      while (at < raw.length) {
        space();const offset = at, key = string();space()
        if (raw[at++] !== ':') bad()
        if (keys.has(key)) duplicateKeys.push({ key, objectPath: path, path: path + '/' + pointer(key), offset })
        keys.add(key);value(path + '/' + pointer(key), depth + 1);space()
        const delimiter = raw[at++];if (delimiter === '}') return;if (delimiter !== ',') bad()
      }
      bad()
    }
    if (raw[at] === '[') {
      at++;space();if (raw[at] === ']') { at++;return }
      let index = 0
      while (at < raw.length) { value(path + '/' + index++, depth + 1);space();const delimiter = raw[at++];if (delimiter === ']') return;if (delimiter !== ',') bad() }
      bad()
    }
    if (raw[at] === '"') { string();return }
    const start = at
    while (at < raw.length && !/[\t\n\r ,\]}]/.test(raw[at])) at++
    if (!/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(raw.slice(start, at))) bad()
  }
  value();space();if (at !== raw.length) bad()
  return duplicateKeys.length ? { duplicateKeys } : { value: JSON.parse(raw), duplicateKeys }
}
