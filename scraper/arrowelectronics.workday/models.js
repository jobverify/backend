const incompleteSnapshot=message=>Object.assign(new Error('PHENOM_INCOMPLETE_SNAPSHOT: '+message),{code:'PHENOM_INCOMPLETE_SNAPSHOT'});
// Native element reader with an Arrow-specific static model construction guard.
const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x2F;/gi, '/')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')


const extractJsonObjectAfterMarker = (value, marker) => {
  const source = String(value)
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null

  const start = source.indexOf('{', markerIndex + marker.length)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escapeNext) {
        escapeNext = false
      } else if (char === '\\') {
        escapeNext = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  return null
}

// Read only active native elements. Scripts inside templates, comments and raw
// text elements cannot establish listing identity or supply a job description.
const nativeElements = value => {
  const html = String(value), scripts = [], links = []
  const tags = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noscript', 'noembed', 'noframes', 'iframe', 'plaintext'])
  let templateDepth = 0, match
  while ((match = tags.exec(html))) {
    if (!match[1]) continue
    const name = match[1].toLowerCase(), closing = match[0].startsWith('</')
    if (name === 'template') { templateDepth = Math.max(0, templateDepth + (closing ? -1 : 1)); continue }
    if (closing) continue
    const attributes = new Map()
    for (const attr of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = attr[1].toLowerCase()
      // Duplicate native identity attributes are ambiguous, even if a browser
      // might select the first one.
      attributes.set(key, attributes.has(key) ? null : decodeHtmlEntities(attr[2] ?? attr[3] ?? attr[4] ?? ''))
    }
    if (raw.has(name)) {
      if (name === 'plaintext') break
      const close = new RegExp('</' + name + '\\s*>', 'gi')
      close.lastIndex = tags.lastIndex
      const end = close.exec(html)
      if (!end) break
      if (name === 'script' && templateDepth === 0 && !attributes.has('src') && !attributes.has('nomodule')) {
        const type = (attributes.get('type') ?? (attributes.has('type') ? 'invalid' : '')).trim().toLowerCase()
        scripts.push({ type, body: html.slice(tags.lastIndex, end.index) })
      }
      tags.lastIndex = close.lastIndex
      continue
    }
    if (name === 'link' && templateDepth === 0) links.push(attributes)
  }
  return { scripts, links }
}

// This is a static reader, not a JavaScript interpreter. Accept the captured
// top-level JSON construction grammar and reject writes or escapes that would
// make the retained app/ddo cease to describe the active native client.
// Bare slash syntax is supported only for division between decimal numeric
// literals (with an optional signed right operand). Regex literals, compound
// division and variable/grouped operands are unsupported and fail closed before
// quote masking. Comments and slash characters inside quoted values stay inert.
const decimalNativeOperand = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
const numericNativeDivisionRight = text => {
  const operand = /^\s*(?:[+-]\s*)?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(text)
  if (!operand) return false
  const remainder = text.slice(operand[0].length).trimStart()
  return !remainder || /^[;,+\-*%<>=!&|?:()[\]{}\/]/.test(remainder)
}
const nativeTokens = body => {
  const tokens = []
  const pattern = /\s+|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n\u2028\u2029]*|<!--[^\r\n\u2028\u2029]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|(?:[$\w]|\\u(?:\{[0-9a-fA-F]+\}|[0-9a-fA-F]{4}))+|===|!==|>>>=|\*\*=|&&=|\|\|=|\?\?=|=>|==|!=|<=|>=|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=|&&|\|\||\?\?|\?\.|./g
  for (const match of body.matchAll(pattern)) {
    const raw = match[0]
    if (/^\s|^\/\*|^\/\/|^<!--/.test(raw)) continue
    if (raw === '/' || raw === '/=') {
      const previous = tokens.at(-1)
      if (raw !== '/' || !previous || previous.quoted || !decimalNativeOperand.test(previous.value) ||
          !numericNativeDivisionRight(body.slice(match.index + 1))) throw incompleteSnapshot('unsupported native slash or regular-expression syntax')
    }
    const quoted = /^['"`]/.test(raw)
    // An interpolated template is executable code. Its effects cannot be
    // inferred from a JSON snapshot, so fail closed on interpolation.
    if (raw[0] === '`' && raw.includes('${')) throw incompleteSnapshot('dynamic native template')
    const value = quoted ? raw : raw.replace(/\\u(?:\{([0-9a-fA-F]+)\}|([0-9a-fA-F]{4}))/g,
      (_, point, unit) => String.fromCodePoint(parseInt(point || unit, 16)))
    tokens.push({ value, raw, quoted, start: match.index, end: match.index + raw.length })
  }
  return tokens
}

// Strip only balanced grouping around a complete member reference. Call and
// control-statement parentheses stay intact. Repeating the reduction handles
// arbitrary grouping depth without a fixed lookbehind or evaluating code.
const ungroupNativeReferences = input => {
  const identifier = token => token && !token.quoted && /^[$\w]+$/.test(token.value)
  const reference = tokens => {
    if (!identifier(tokens[0])) return false
    for (let i = 1; i < tokens.length;) {
      if (['.', '?.'].includes(tokens[i].value) && identifier(tokens[i + 1])) i += 2
      else if (tokens[i].value === '[' && tokens[i + 1] && (tokens[i + 1].quoted || identifier(tokens[i + 1])) && tokens[i + 2]?.value === ']') i += 3
      else return false
    }
    return true
  }
  const grouping = previous => !previous ||
    ['delete', 'typeof', 'void', 'return', 'throw', 'yield', 'await', 'new'].includes(previous.value) ||
    !identifier(previous) && !previous.quoted && ![')', ']', '}'].includes(previous.value)
  let tokens = input, changed = true
  while (changed) {
    const stack = [], removed = new Set()
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].quoted) continue
      if (tokens[i].value === '(') stack.push(i)
      else if (tokens[i].value === ')') {
        const start = stack.pop()
        if (start === undefined) throw incompleteSnapshot('unbalanced native reference grouping')
        if (grouping(tokens[start - 1]) && reference(tokens.slice(start + 1, i))) {
          removed.add(start); removed.add(i)
        }
      }
    }
    if (stack.length) throw incompleteSnapshot('unbalanced native reference grouping')
    changed = removed.size > 0
    if (changed) tokens = tokens.filter((_, index) => !removed.has(index))
  }
  return tokens
}

// These captured UI settings are separate literal constructions. In particular,
// pageId is a display setting; it is not one of the public client binding fields.
const nativeUIFields = new Set(['experimentData', 'inlinePreview', 'eagerLoadDDOs', 'eagerLoadParams', 'sessionParams', 'urlMap', 'ddoRealPath', 'pageId', 'systemIconUrl', 'pxSegmentState', 'pxPageState'])
const nativeGlobals = new Set(['window', 'globalThis', 'self', 'this'])
const writeOperator = /^(?:=(?!=)|\+\+|--|(?:\*\*|&&|\|\||\?\?|>>>|>>|<<|[+\-*/%&|^])=)$/
const extractNativeModels = html => {
  const found = { app: [], ddo: [] }
  for (const { type, body } of nativeElements(html).scripts) {
    if (!['', 'text/javascript', 'application/javascript', 'module'].includes(type)) continue
    const tokens = ungroupNativeReferences(nativeTokens(body))
    let depth = 0
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i], value = token.value
      const at = offset => tokens[i + offset]?.value
      if (!token.quoted && ['eval', 'Function'].includes(value)) throw incompleteSnapshot('dynamic native code execution')
      const statement = depth === 0 && (i === 0 || at(-1) === ';')
      let kind = null, start = null, supplemental = false
      if (statement && value === 'var' && at(1) === 'phApp' && at(2) === '=' && at(3) === 'phApp' && at(4) === '||' && at(5) === '{') {
        kind = 'app'; start = i + 5
      } else if (statement && value === 'phApp' && at(1) === '.' && at(3) === '=') {
        if (at(2) === 'ddo' && at(4) === '{') { kind = 'ddo'; start = i + 4 }
        else if (nativeUIFields.has(at(2))) { supplemental = true; start = i + 4 }
      }
      if (start !== null) {
        let end = start, text
        if (supplemental) {
          while (end < tokens.length && tokens[end].value !== ';') end++
          text = body.slice(tokens[start].start, tokens[end]?.start ?? body.length).trim()
        } else {
          text = extractJsonObjectAfterMarker(body.slice(tokens[start].start), '')
          const boundary = tokens[start].start + (text?.length ?? 0)
          while (end < tokens.length && tokens[end].start < boundary) end++
        }
        const parsed = supplemental && /^'[^'\\\r\n]*'$/.test(text) ? text.slice(1, -1) : parseJson(text)
        // A suffix (call, comma, property access, operator...) changes the
        // meaning of a literal. Only the complete JSON statement is accepted.
        if (!text || parsed === null && text !== 'null' || end < tokens.length && tokens[end].value !== ';') throw incompleteSnapshot('invalid active native construction')
        if (kind) {
          if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw incompleteSnapshot('invalid active native model')
          found[kind].push(parsed)
        }
        i = end - 1
        continue
      }
      // A computed phApp receiver can also be a simple alias of a global.
      // Reject that critical reference regardless of the receiver's spelling.
      const receiver = tokens[i - 2]
      if (token.quoted && at(-1) === '[' && at(1) === ']' && receiver &&
          (!receiver.quoted && /^[$\w]+$/.test(receiver.value) || [')', ']'].includes(receiver.value)) &&
          (value.slice(1, -1) === 'phApp' || value.includes('\\'))) {
        throw incompleteSnapshot('computed native global access or alias')
      }
      // A simple global alias would hide later dynamic keys from this reader.
      // Keep ordinary member reads and the captured GTM global argument intact.
      if (!token.quoted && nativeGlobals.has(value) && !['.', '?.', '['].includes(at(1)) && writeOperator.test(at(-1) ?? '')) {
        throw incompleteSnapshot('unsupported native global alias escape')
      }
      // Unknown global keys might name phApp at runtime; static unrelated
      // global properties cannot change the retained native binding.
      if (!token.quoted && nativeGlobals.has(value) && at(1) === '[' &&
          (!tokens[i + 2]?.quoted || !/^['"]/.test(at(2)) || at(2).includes('\\') || at(3) !== ']')) {
        throw incompleteSnapshot('dynamic native global access')
      }
      if (!token.quoted && value === 'phApp') {
        const path = []
        let end = i + 1
        while (tokens[end]?.value === '.' || tokens[end]?.value === '?.' || tokens[end]?.value === '[') {
          if (tokens[end].value === '[') throw incompleteSnapshot('computed native app access')
          const property = tokens[end + 1]
          if (!property || property.quoted || !/^[$\w]+$/.test(property.value)) throw incompleteSnapshot('dynamic native app access')
          path.push(property.value); end += 2
        }
        let suffix = end
        while ([')', ']', '}'].includes(tokens[suffix]?.value)) suffix++
        let referenceStart = i
        while (['.', '?.'].includes(tokens[referenceStart - 1]?.value) &&
               tokens[referenceStart - 2] && !tokens[referenceStart - 2].quoted && /^[$\w]+$/.test(tokens[referenceStart - 2].value)) referenceStart -= 2
        const prefix = tokens[referenceStart - 1]?.value
        if (!path.length || path[0] === 'ddo' || path.some(key => ['__proto__', 'constructor', 'prototype'].includes(key)) ||
            ['delete', '++', '--'].includes(prefix) || writeOperator.test(tokens[suffix]?.value ?? '') ||
            ['(', '`'].includes(tokens[end]?.value?.[0])) {
          throw incompleteSnapshot('unsupported active native app mutation or escape')
        }
        i = end - 1
        continue
      }
      if (!token.quoted && ['(', '[', '{'].includes(value)) depth++
      if (!token.quoted && [')', ']', '}'].includes(value)) depth--
    }
  }
  const result = {}
  for (const kind of ['app', 'ddo']) {
    const unique = new Map(found[kind].map(model => [JSON.stringify(model), model]))
    if (unique.size > 1) throw incompleteSnapshot('conflicting active native models')
    result[kind] = unique.values().next().value || null
  }
  return result
}

const extractCanonical = html => {
  const urls = nativeElements(html).links.filter(attrs => attrs.get('rel')?.toLowerCase().split(/\s+/).includes('canonical'))
    .map(attrs => attrs.get('href'))
  if (urls.some(url => typeof url !== 'string') || new Set(urls).size > 1) throw incompleteSnapshot('conflicting native canonical links')
  return urls[0] || null
}

const parseJson = (value) => {
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}


export function models(html){ const {app,ddo}=extractNativeModels(html);const ld=nativeElements(html).scripts.filter(s=>s.type==='application/ld+json'&&s.body.trim()).map(s=>JSON.parse(s.body)).filter(p=>p['@type']==='JobPosting');if(!app||!ddo||ld.length>1)throw Error('Missing or ambiguous models');return{app,ddo,posting:ld[0]??null,canonical:extractCanonical(html)};}
