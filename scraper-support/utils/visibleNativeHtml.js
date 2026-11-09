import { readNativeDocument, decodeNativeEntities, readNativeAttributeTokens } from './activeNativeHtml.js'

const hiddenStyle = value => /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden|opacity\s*:\s*[+-]?(?:0(?:\.0*)?|\.0+)(?:e[+-]?\d+)?%?)(?:\s*!important)?\s*(?:;|$)/i.test(value || '')

// CSS Syntax3: one escaped code point, including1-6 hex digits and at most
// one following CSS whitespace unit. Keep malformed escapes conservative.
const cssEscape = (value, start) => {
  let end = start + 1
  if (end >= value.length || /[\n\r\f]/.test(value[end])) return { valid: false, end }
  if (/[0-9a-f]/i.test(value[end])) {
    const first = end
    while (end < value.length && end - first < 6 && /[0-9a-f]/i.test(value[end])) end++
    const code = Number.parseInt(value.slice(first, end), 16)
    if (/[\t\n\r\f ]/.test(value[end] || '') && end < value.length) {
      if (value[end] === '\r' && value[end + 1] === '\n') end++
      end++
    }
    return { valid: true, end, value: String.fromCodePoint(!code || code > 0x10ffff || code >= 0xd800 && code <= 0xdfff ? 0xfffd : code) }
  }
  const code = value.codePointAt(end), char = String.fromCodePoint(code)
  const decoded = !code || code >= 0xd800 && code <= 0xdfff ? '\uFFFD' : char
  return { valid: true, end: end + char.length, value: decoded }
}
const cssTrim = value => {
  let start = 0, end = 0
  while (/[\t\n\r\f ]/.test(value[start] || '') && start < value.length) start++
  for (let index = start; index < value.length; index++) {
    if (value[index] === '\\') { const escape = cssEscape(value, index); index = Math.max(index, escape.end - 1); end = index + 1 }
    else if (!/[\t\n\r\f ]/.test(value[index])) end = index + 1
  }
  return value.slice(start, end)
}
const cssIdentifier = (value, start) => {
  const nameStart = char => !!char && (/[a-z_]/i.test(char) || char.codePointAt(0) >= 0x80)
  const starts = index => nameStart(value[index]) || value[index] === '\\' || value[index] === '-' && (nameStart(value[index + 1]) || ['-', '\\'].includes(value[index + 1]))
  if (!starts(start)) return null
  let end = start, name = ''
  while (end < value.length) {
    const char = String.fromCodePoint(value.codePointAt(end))
    if (char === '\\') {
      const escape = cssEscape(value, end)
      if (!escape.valid) return { invalid: true }
      name += escape.value; end = escape.end
    } else if (/[a-z0-9_-]/i.test(char) || char.codePointAt(0) >= 0x80) { name += char; end += char.length }
    else break
  }
  return { name, end }
}
const escapedCompound = (compound, strict) => {
  const result = { tag: '', ids: [], classes: [], attributes: [], unknown: false, invalid: false }
  let index = 0
  if (compound[index] === '*') index++
  else if (!['.', '#', '[', ':'].includes(compound[index])) {
    const identifier = cssIdentifier(compound, index)
    if (!identifier || identifier.invalid) return { ...result, invalid: true }
    // Retain the existing finite escaped type-selector vocabulary. A decoded
    // type outside it cannot prove a hiding rule absent.
    if (!/^[a-z](?:[a-z0-9:_-]*[a-z0-9_])?$/i.test(identifier.name)) return { ...result, invalid: true }
    result.tag = identifier.name; index = identifier.end
  }
  while (index < compound.length) {
    const char = compound[index]
    if (char === '.' || char === '#') {
      const identifier = cssIdentifier(compound, index + 1)
      if (!identifier || identifier.invalid) return { ...result, invalid: true }
      result[char === '.' ? 'classes' : 'ids'].push(identifier.name); index = identifier.end
    } else if (char === '[') {
      const attribute = compound.slice(index).match(/^\[\s*([\w-]+)\s*(?:(=|~=|\|=|\^=|\$=|\*=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*)?(?:[iIsS]\s*)?\]/)
      if (!attribute || attribute[0].includes('\\')) return { ...result, unknown: true }
      if (strict || attribute[1].toLowerCase() === 'id' && attribute[2] === '=') result.attributes.push(attribute)
      index += attribute[0].length
    } else if (char === ':') return { ...result, unknown: true }
    else return { ...result, invalid: true }
  }
  return result
}
// The native tree's attribute decoder is intentionally small. A field that
// contains character references, input replacements or unsupported token
// boundaries cannot provide exact absence evidence for an escaped selector.
// Keep the uncertainty by field/value; equal parsed values share the caution.
const ambiguousAttributes = (html, { statusStyleQuotes = false } = {}) => {
  const values = new Map()
  for (const [, source] of html.matchAll(/<[a-z][a-z0-9:_-]*\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)) {
    const legacy = [...source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)].map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ''])
    const ascii = [...source.matchAll(/([^\t\n\f\r =/>]+)(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"([^"]*)"|'([^']*)'|([^\t\n\f\r "'=<>`]+)))?/g)].map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ''])
    let current, unsupported = false
    try { current = readNativeAttributeTokens(source) } catch { current = legacy; unsupported = true }
    const different = (left, right) => left.length !== right.length || left.some(([name, value], index) => name !== right[index][0] || value !== right[index][1])
    const uncertainTokens = unsupported || different(legacy, ascii) || different(current, ascii)
    // Retain old conservative raw-value caution as well as the exact new
    // lexical values. Inert/raw strings cannot grant an absence proof.
    for (const [name, value] of [...legacy, ...current]) {
      if (!uncertainTokens && !/[&\u0000\r\uD800-\uDFFF]/u.test(value)) continue
      // This exact reference spelling is already decoded once by the native
      // attribute reader. The opt-in flow check may trust its quote token;
      // every other reference/replacement/token ambiguity remains uncertain.
      if (!uncertainTokens && statusStyleQuotes && name === 'style' && value.includes('&quot;')
        && !/[&\u0000\r\uD800-\uDFFF]/u.test(value.replaceAll('&quot;', '"'))) continue
      let decoded
      try { decoded = decodeNativeEntities(value) } catch { continue } // Inert raw markup may contain references the active tree never reads.
      if (!values.has(name)) values.set(name, new Set())
      values.get(name).add(decoded)
    }
  }
  return (node, name) => values.get(name)?.has(node.attrs[name]) === true
}
const simpleMatches = (node, { tag, ids, classes, attributes }, ambiguous) => (!tag || node.tag === tag.toLowerCase())
  && ids.every(id => node.attrs.id === id || ambiguous(node, 'id'))
  && attributes.every(([, name, operator, doubleQuoted, singleQuoted, unquoted]) => {
    const key = name.toLowerCase(), expected = doubleQuoted ?? singleQuoted ?? unquoted
    if (!Object.hasOwn(node.attrs, key)) return false
    if (!operator || ambiguous(node, key)) return true
    const actual = node.attrs[key].toLowerCase(), value = expected.toLowerCase()
    if (operator === '=') return actual === value
    if (operator === '~=') return value !== '' && actual.split(/[\t\n\f\r ]+/).includes(value)
    if (operator === '|=') return actual === value || actual.startsWith(value + '-')
    if (!value) return false
    if (operator === '^=') return actual.startsWith(value)
    if (operator === '$=') return actual.endsWith(value)
    return actual.includes(value)
  }) && classes.every(name => (node.attrs.class || '').split(/[\t\n\f\r ]+/).includes(name) || ambiguous(node, 'class'))

// Only delimiters are consumed here, not cascade, media applicability or
// pseudo-class evaluation. Escaped/quoted braces cannot begin a CSS block.
const hidingRules = (css, statusContext = false) => {
  const legacy = () => [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].map(([, selector, declarations]) => [selector, declarations])
  if (!statusContext && !css.includes('\\') && !/@(?:-[a-z]+-)?keyframes\b/i.test(css)) return legacy()
  const rules = [], stack = []
  let start = 0, quote = '', depth = 0, bracket = 0, malformed = false
  for (let index = 0; index < css.length; index++) {
    const char = css[index]
    if (char === '\\') { const escape = cssEscape(css, index); index = Math.max(index, escape.end - 1); continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === '[') bracket++
    else if (char === ']') bracket--
    else if (!depth && !bracket && char === '{') {
      if (stack.length) stack.at(-1).nested = true
      const selector = cssTrim(css.slice(start, index))
      const atRule = selector.startsWith('@') ? cssIdentifier(selector, 1) : null
      // Keyframe selectors describe animation offsets, never DOM elements.
      // Preserve their block boundary, including escaped/vendor rule names,
      // without letting a nested offset become a global hiding selector.
      const keyframes = stack.at(-1)?.keyframes || !!(atRule && !atRule.invalid && /^(?:-[a-z]+-)?keyframes$/i.test(atRule.name))
      stack.push({ selector, body: index + 1, nested: false, keyframes }); start = index + 1
    } else if (!depth && !bracket && char === '}') {
      const block = stack.pop()
      if (!block) malformed = true
      else if (block.keyframes) { /* Animation declarations do not select elements. */ }
      else if (!block.nested) rules.push(statusContext
        ? [block.selector, css.slice(block.body, index), { qualified: !stack.length && !block.selector.startsWith('@') }]
        : [block.selector, css.slice(block.body, index)])
      else if (statusContext && !block.selector.startsWith('@')) rules.push([block.selector, '', { qualified: false, forceUnknown: true }])
      start = index + 1
    } else if (!stack.length && char === ';') start = index + 1
  }
  return malformed || quote || depth || bracket || stack.length
    ? statusContext ? [['*', '', { qualified: false, forceUnknown: true }]] : legacy()
    : rules
}

const selectorList = (value, statusContext = false) => {
  const selectors = []
  let start = 0, depth = 0, quote = ''
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (char === '\\') { const escape = cssEscape(value, i); i = Math.max(i, escape.end - 1); continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (char === '"' || char === "'") quote = char
    else if (char === '[' || char === '(') depth++
    else if (char === ']' || char === ')') depth--
    else if (char === ',' && !depth) { selectors.push(cssTrim(value.slice(start, i))); start = i + 1 }
  }
  selectors.push(cssTrim(value.slice(start)))
  return statusContext ? selectors : selectors.filter(selector => selector && !/^\d+(?:\.\d+)?%$/.test(selector))
}

const targetsPseudoElement = value => {
  let depth = 0, quote = ''
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (char === '\\') { const escape = cssEscape(value, i); i = Math.max(i, escape.end - 1); continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (char === '"' || char === "'") quote = char
    else if (char === '[' || char === '(') depth++
    else if (char === ']' || char === ')') depth--
    else if (!depth && char === ':' && /^(?:::|:(?:before|after|first-line|first-letter)(?![\w-]))/i.test(value.slice(i))) return true
  }
  return false
}
// Split only at top-level combinators: spaces inside attributes and pseudo
// functions are part of a compound. Conditional pseudo classes can hide a
// matching element, so they remain conservative rather than proving visibility.
const selectorParts = (selector, statusContext = false) => {
  const parts = [], combinators = []
  const whitespace = selector.includes('\\') ? /[\t\n\f\r ]/ : /\s/
  let start = 0, depth = 0, quote = '', pending = ' ', invalidEscape = false, invalidRelation = false
  const flush = end => { const part = cssTrim(selector.slice(start, end)); if (part) { if (parts.length) combinators.push(pending); parts.push(part); pending = ' ' } }
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i]
    if (char === '\\') { const escape = cssEscape(selector, i); if (!escape.valid) invalidEscape = true; i = Math.max(i, escape.end - 1); continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '[' || char === '(') depth++
    else if (char === ']' || char === ')') depth--
    else if (!depth && (whitespace.test(char) || /[>+~]/.test(char))) {
      const part = cssTrim(selector.slice(start, i))
      flush(i)
      if (!whitespace.test(char)) {
        if (statusContext && (!parts.length || !part && pending !== ' ')) invalidRelation = true
        pending = char
      }
      start = i + 1
    }
  }
  flush(selector.length)
  return { parts, combinators, invalidEscape,
    statusQualified: !statusContext || !(invalidEscape || invalidRelation || depth || quote || pending !== ' ' || !parts.length) }
}
const compoundMatches = (node, compound, ancestor = false, strict = false, ambiguous) => {
  if (strict && targetsPseudoElement(compound)) return false
  if (compound.includes('\\')) {
    const parsed = escapedCompound(compound, strict)
    if (parsed.invalid) return true
    if (parsed.unknown && !parsed.tag && !parsed.ids.length && !parsed.classes.length && !parsed.attributes.length) return true
    return simpleMatches(node, parsed, ambiguous)
  }
  // An unsupported constraint cannot prove that a hiding rule is
  // inapplicable. Keep its known prefix (e.g. .header in .header:hover) and
  // conservatively allow the remaining condition, as for conditional styles.
  const attributeSelector = /\[\s*([\w-]+)\s*(?:(=|~=|\|=|\^=|\$=|\*=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*)?(?:[iIsS]\s*)?\]/g
  const attributes = [...compound.matchAll(attributeSelector)].filter(([, name, operator]) => strict || name.toLowerCase() === 'id' && operator === '=')
  const withoutAttributes = strict ? compound.replace(attributeSelector, '')
    : compound.replace(/\[id\s*=\s*(?:"[^"]*"|'[^']*'|[^\]]+)\]/gi, '')
  const knownCompound = !compound.includes('\\') && /^(?:[a-z][\w-]*|\*)?(?:[.#][\w-]+)*$/i.test(withoutAttributes)
  if ((ancestor || strict) && !knownCompound) {
    // An unresolved pseudo-class does not remove attributes required before it.
    // Stop at that pseudo-class: attributes inside :not/:is are conditional and
    // cannot be treated as positive constraints on the element itself.
    const constraints = escapedCompound(compound, strict)
    if (!constraints.invalid && constraints.attributes.length && !simpleMatches(node,
      { tag: '', ids: [], classes: [], attributes: constraints.attributes }, ambiguous || (() => false))) return false
    // Namespaces and unhandled non-ASCII identifiers cannot be truncated into
    // literal class/tag names: the resulting prefix would mean another token.
    if (/[\\|]|[^\x00-\x7f]/.test(compound)) return true
    const prefix = compound.match(/^(?:[a-z][\w-]*|\*)?(?:[.#][\w-]+)*/i)?.[0]
    return prefix ? compoundMatches(node, prefix, false, strict) : true
  }
  // Keep the reader's existing tag/id/class vocabulary. This repairs scope;
  // it does not expand static CSS evaluation into runtime hydration rules.
  const vocabulary = strict ? withoutAttributes : compound
  const tag = vocabulary.match(/^[a-z][\w-]*/i)?.[0], ids = [...vocabulary.matchAll(/#([\w-]+)/g)].map(m => m[1])
  const classes = [...vocabulary.matchAll(/\.([\w-]+)/g)].map(m => m[1])
  if (compound === '*') return true
  if (!tag && !ids.length && !classes.length && !attributes.length) return false
  return (!tag || node.tag === tag.toLowerCase()) && ids.every(id => node.attrs.id === id)
    && attributes.every(([, name, operator, doubleQuoted, singleQuoted, unquoted]) => {
      const key = name.toLowerCase(), expected = doubleQuoted ?? singleQuoted ?? unquoted
      // Case-insensitive comparison is conservative for a hiding rule even on
      // HTML attributes whose actual matching may be case-sensitive.
      if (!Object.hasOwn(node.attrs, key)) return false
      if (!operator) return true
      const actual = node.attrs[key].toLowerCase(), value = expected.toLowerCase()
      if (operator === '=') return actual === value
      if (operator === '~=') return value !== '' && actual.split(/\s+/).includes(value)
      if (operator === '|=') return actual === value || actual.startsWith(value + '-')
      if (!value) return false
      if (operator === '^=') return actual.startsWith(value)
      if (operator === '$=') return actual.endsWith(value)
      return actual.includes(value)
    })
    && classes.every(name => (node.attrs.class || '').split(/\s+/).includes(name))
}
const matches = (node, { parts, combinators, invalidEscape }, parents, strict, ambiguous, testCompound = compoundMatches) => {
  if (invalidEscape) return true
  const test = (current, index) => {
    if (!current || !testCompound(current, parts[index], index < parts.length - 1, strict, ambiguous)) return false
    if (!index) return true
    const parent = parents.get(current), combinator = combinators[index - 1]
    if (combinator === '>') return test(parent, index - 1)
    if (combinator === '+' || combinator === '~') {
      const siblings = parent?.children.filter(child => typeof child !== 'string') || [], before = siblings.slice(0, siblings.indexOf(current))
      return combinator === '+' ? test(before.at(-1), index - 1) : before.some(sibling => test(sibling, index - 1))
    }
    for (let ancestor = parent; ancestor; ancestor = parents.get(ancestor)) if (test(ancestor, index - 1)) return true
    return false
  }
  return parts.length > 0 && test(node, parts.length - 1)
}

// Status text needs a qualified flow boundary in addition to visibility. This
// opt-in map leaves the projected tree and the default reader unchanged. It is
// deliberately not a cascade: conflicting or unmodelled applicable layout is
// uncertain, even where a browser could resolve it with more information.
const statusLayouts = new WeakMap()
export const readNativeStatusLayout = node => statusLayouts.get(node) || null
const statusBlocks = new Set(['html', 'body', 'address', 'article', 'aside', 'blockquote', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'ul'])
// The standard button outer flow joins adjacent inline text (including a word
// split), as measured independently; this does not qualify author atomic/flex
// display values or resolve conflicting overrides.
const statusInline = new Set(['root', 'a', 'abbr', 'b', 'bdi', 'bdo', 'button', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'ins', 'kbd', 'label', 'mark', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr'])
const unmodelledFlow = /^(?:all|float|position|white-space|white-space-collapse|text-wrap|writing-mode|text-orientation|direction|unicode-bidi|order|content|columns|column-count|column-width|flex(?:-.+)?|grid(?:-.+)?|(?:-[a-z]+-)?animation(?:-name)?)$/
const statusDeclarations = source => {
  const declarations = [], displays = [], hiding = { visibility: [], content: [], opacity: [] }
  let start = 0, quote = '', depth = 0, uncertain = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (char === '\\') { const escape = cssEscape(source, index); if (!escape.valid) uncertain = true; index = Math.max(index, escape.end - 1); continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') { if (--depth < 0) uncertain = true }
    else if (char === '{' || char === '}') uncertain = true
    else if (char === ';' && !depth) { declarations.push(source.slice(start, index)); start = index + 1 }
  }
  declarations.push(source.slice(start))
  if (quote || depth) uncertain = true
  for (const declaration of declarations) {
    const text = cssTrim(declaration)
    if (!text) continue
    const property = cssIdentifier(text, 0)
    if (!property || property.invalid) { uncertain = true; continue }
    const name = property.name.toLowerCase(), after = cssTrim(text.slice(property.end))
    if (!after.startsWith(':')) { uncertain = true; continue }
    if (unmodelledFlow.test(name)) { uncertain = true; continue }
    if (!['display', 'visibility', 'content-visibility', 'opacity'].includes(name)) continue
    const raw = cssTrim(after.slice(1))
    if (name === 'opacity') {
      const number = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?)(?:\s*!\s*important)?$/i.exec(raw)
      const numeric = number ? Number(number[1].replace(/%$/, '')) : NaN
      if (!Number.isFinite(numeric) || numeric < 0) uncertain = true
      else hiding.opacity.push(numeric === 0 ? 'hidden' : 'visible')
      continue
    }
    const value = cssIdentifier(raw, 0)
    if (!value || value.invalid) { uncertain = true; continue }
    const remainder = cssTrim(raw.slice(value.end))
    if (remainder) {
      const important = remainder.startsWith('!') && cssIdentifier(cssTrim(remainder.slice(1)), 0)
      if (!important || important.invalid || important.name.toLowerCase() !== 'important'
        || cssTrim(cssTrim(remainder.slice(1)).slice(important.end))) { uncertain = true; continue }
    }
    const token = value.name.toLowerCase()
    if (name === 'display') {
      if (['none', 'inline', 'block'].includes(token)) displays.push(token)
      else uncertain = true
    } else if (name === 'visibility' && ['hidden', 'collapse', 'visible'].includes(token)) hiding.visibility.push(token === 'visible' ? 'visible' : 'hidden')
    else if (name === 'content-visibility' && ['hidden', 'visible'].includes(token)) hiding.content.push(token)
    else uncertain = true
  }
  return { displays, hiding, uncertain }
}
const statusLayoutQualifier = (html, document, parents) => {
  const ambiguous = ambiguousAttributes(html, { statusStyleQuotes: true }), rules = []
  const collect = (node, inertStyle = false) => {
    if (typeof node === 'string') return
    inertStyle ||= ['template', 'object'].includes(node.tag)
    if (node.tag === 'style' && !inertStyle) {
      const css = (node.raw || '').replace(/\/\*[\s\S]*?\*\//g, '')
      // Imports or unsupported nested syntax cannot establish a local layout.
      if (/@import\b/i.test(css)) rules.push({ selector: selectorParts('*'), qualified: false, declarations: { displays: [], uncertain: true } })
      for (const [list, body, context] of hidingRules(css, true)) {
        // @font-face contains font descriptors, not element declarations. Its
        // raw CSS text (including literal HTML-looking references) stays raw.
        if (/^@font-face\s*$/i.test(list)) continue
        const declarations = statusDeclarations(body)
        if (!declarations.displays.length && !Object.values(declarations.hiding).some(values => values.length)
          && !declarations.uncertain && !context.forceUnknown) continue
        const listParts = selectorList(list, true), invalidList = listParts.some(selector => !selector)
        for (const selector of invalidList ? ['*'] : listParts) rules.push({ selector: selectorParts(selector, true),
          qualified: !invalidList && context.qualified && (!node.attrs.media || node.attrs.media.toLowerCase() === 'all') && !ambiguous(node, 'media'),
          declarations: { ...declarations, uncertain: declarations.uncertain || context.forceUnknown === true } })
      }
    }
    for (const child of node.children) collect(child, inertStyle)
  }
  document.nodes(node => node.tag === 'root').forEach(root => collect(root))
  return node => {
    const own = statusDeclarations((node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, ''))
    let uncertain = own.uncertain || ambiguous(node, 'style')
    // A hidden attribute proves absence only while no possibly applicable
    // declaration can restore its display. Conditional none alone cannot.
    let hiddenDisplayMayChange = uncertain || own.displays.some(value => value !== 'none')
    const displays = [...own.displays]
    const hiding = Object.fromEntries(Object.entries(own.hiding).map(([key, values]) => [key, [...values]]))
    for (const rule of rules) {
      let exact = rule.qualified && rule.selector.statusQualified !== false
      const test = (current, compound) => {
        // Reuse the same finite compound grammar and relation matcher. Known
        // prefixes can show possible applicability, never exact absence for an
        // unsupported/ambiguous selector constraint.
        const parsed = escapedCompound(compound, true)
        if (parsed.invalid) { exact = false; return true }
        if (parsed.unknown || parsed.attributes.length) exact = false
        if (parsed.ids.length && ambiguous(current, 'id') || parsed.classes.length && ambiguous(current, 'class')) exact = false
        return simpleMatches(current, parsed, ambiguous)
      }
      if (!matches(node, rule.selector, parents, true, ambiguous, test)) continue
      uncertain ||= !exact || rule.declarations.uncertain
      hiddenDisplayMayChange ||= rule.declarations.uncertain || rule.declarations.displays.some(value => value !== 'none')
      displays.push(...rule.declarations.displays)
      for (const key of Object.keys(hiding)) hiding[key].push(...(rule.declarations.hiding?.[key] || []))
    }
    const values = [...new Set(displays)]
    uncertain ||= values.length > 1
    const hiddenValues = Object.fromEntries(Object.entries(hiding).map(([key, states]) => [key, [...new Set(states)]]))
    uncertain ||= Object.values(hiddenValues).some(states => states.length > 1)
    const stronglyExcluded = !uncertain && (values[0] === 'none' || hiddenValues.opacity[0] === 'hidden' || hiddenValues.content[0] === 'hidden')
    const weakVisibility = hiddenValues.visibility[0] || null
    const boundary = values[0] && values[0] !== 'none' ? values[0]
      : node.tag === 'br' ? 'break' : statusBlocks.has(node.tag) ? 'block' : statusInline.has(node.tag) ? 'inline' : null
    return { qualified: !uncertain && (stronglyExcluded || weakVisibility === 'hidden' || !!boundary), boundary, stronglyExcluded, weakVisibility, hiddenDisplayMayChange,
      ...(uncertain ? { reason: 'unsupported-conditional-ambiguous-or-conflicting-flow-or-hiding' } : {}) }
  }
}

// Extend the static native tree with conservative stylesheet/opacity visibility.
// Conditional hiding rules count as hidden evidence; scripts are never executed.
export const readVisibleNativeDocument = (html, { strict = false, statusLayout = false } = {}) => {
  const document = readNativeDocument(html)
  const selectors = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].flatMap(([, css]) =>
    hidingRules(css.replace(/\/\*[\s\S]*?\*\//g, ''))
      .filter(([, declarations]) => hiddenStyle(declarations)).flatMap(([list]) => strict || list.includes('\\') ? selectorList(list) : list.split(','))).map(selector => selectorParts(selector))
  const ambiguous = selectors.some(({ parts }) => parts.some(part => part.includes('\\'))) ? ambiguousAttributes(html) : () => false
  const parents = new Map()
  const indexParents = node => { for (const child of node.children || []) if (typeof child !== 'string') { parents.set(child, node); indexParents(child) } }
  document.nodes(node => node.tag === 'root').forEach(indexParents)
  const qualifyLayout = statusLayout ? statusLayoutQualifier(html, document, parents) : null
  const project = (node, active = true, parentLayout = null) => {
    if (typeof node === 'string') return node
    const visible = active && !hiddenStyle((node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, ''))
      && !selectors.some(selector => matches(node, selector, parents, strict, ambiguous))
    const activeFrame = node.activeFrame === true && visible
    active = visible && !node.inert
    let layout = null
    if (qualifyLayout) {
      const own = qualifyLayout(node)
      // Raw/template exclusions remain definite. Accessibility and interaction
      // attributes do not prove visual absence, and CSS may restore hidden.
      // Keep the default inert projection; only opt-in status confidence differs.
      const rawExclusion = ['template', 'object', 'script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext', 'noscript'].includes(node.tag)
      const hiddenExclusion = Object.hasOwn(node.attrs, 'hidden') && !own.hiddenDisplayMayChange
      const attributeUncertainty = (Object.hasOwn(node.attrs, 'hidden') || Object.hasOwn(node.attrs, 'inert')
        || node.attrs['aria-hidden']?.toLowerCase() === 'true')
        && !(own.qualified && (own.stronglyExcluded || own.weakVisibility === 'hidden'))
      if (rawExclusion || hiddenExclusion || parentLayout?.stronglyExcluded) layout = { ...own, qualified: true, visibility: 'excluded', stronglyExcluded: true }
      else {
        const restoredVisibility = parentLayout?.weakVisibility === 'hidden' && own.weakVisibility === 'visible'
        const uncertain = attributeUncertainty || own.qualified === false || parentLayout?.qualified === false
          || parentLayout?.visibility === 'uncertain' || restoredVisibility
        const weakVisibility = own.weakVisibility || parentLayout?.weakVisibility || null
        const stronglyExcluded = !uncertain && own.stronglyExcluded
        layout = { ...own, qualified: !uncertain, visibility: uncertain ? 'uncertain'
          : stronglyExcluded || weakVisibility === 'hidden' ? 'excluded' : 'visible', stronglyExcluded, weakVisibility }
      }
    }
    // An unsupported native tag is an unqualified scope, not visual absence.
    // Keep it in opt-in status traversal even if a style could hide its text.
    if (layout && node.nativeTagUnqualified) layout = { ...layout, qualified: false, visibility: 'uncertain', stronglyExcluded: false, reason: 'unsupported-native-tag-scope' }
    // A legacy conservative hiding match may exceed the opt-in finite rule
    // grammar. Unexplained inert content is uncertain, never proof of absence.
    if (layout?.visibility === 'visible' && !active) layout = { ...layout, qualified: false, visibility: 'uncertain' }
    const projected = { ...node, activeFrame, inert: !active, children: node.children.map(child => project(child, active, layout)) }
    // visibility:hidden can be countered by a descendant visibility:visible.
    // The default projection remains conservative; withhold status proof for
    // this uncertainty instead of pretending to resolve inherited rendering.
    if (layout?.visibility === 'excluded' && !layout.stronglyExcluded
      && projected.children.some(child => typeof child !== 'string' && statusLayouts.get(child)?.visibility === 'uncertain')) {
      layout = { ...layout, qualified: false, visibility: 'uncertain' }
    }
    if (layout) statusLayouts.set(projected, layout)
    return projected
  }
  const roots = document.nodes(node => node.tag === 'root').map(root => project(root))
  const find = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []),
    ...node.children.filter(child => typeof child !== 'string').flatMap(child => find(child, predicate)) ]
  // Visible frames may initially have no src; their fallback remains inert.
  const frames = node => node.activeFrame ? [node] : node.inert ? []
    : node.children.filter(child => typeof child !== 'string').flatMap(frames)
  // Status scope selection must retain uncertain hidden candidates so a
  // healthy sibling/model cannot turn their omission into positive evidence.
  // Definite semantic/style exclusions remain outside these opt-in scopes.
  const findStatus = (node, predicate) => statusLayouts.get(node)?.visibility === 'excluded' ? []
    : [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => findStatus(child, predicate)) ]
  return { ...document, nodes: predicate => roots.flatMap(root => find(root, predicate)), frames: () => roots.flatMap(frames),
    ...(statusLayout ? { statusNodes: predicate => roots.flatMap(root => findStatus(root, predicate)) } : {}) }
}
