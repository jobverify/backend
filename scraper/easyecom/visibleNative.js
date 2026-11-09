import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const hiddenDeclarations = (declarations, allowNativeReveal = false) => {
  const css = String(declarations || '').replace(/\/\*[\s\S]*?\*\//g, '')
  return /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(css)
    || (!allowNativeReveal && /(?:^|;)\s*opacity\s*:\s*0(?:\.0+)?\s*(?:!important\s*)?(?:;|$)/i.test(css))
}

const selectorParts = (value, tokens = false) => {
  const parts = []
  let chunk = '', depth = 0, quote = null, escaped = false
  const flush = () => { if (chunk.trim()) parts.push(chunk.trim()); chunk = '' }
  for (const char of value) {
    if (escaped) { chunk += char; escaped = false; continue }
    if (char === '\\') { chunk += char; escaped = true; continue }
    if (quote) { chunk += char; if (char === quote) quote = null; continue }
    if (char === '"' || char === "'") { quote = char; chunk += char; continue }
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth--
    if (depth === 0 && (tokens ? /[\s>+~]/.test(char) : char === ',')) {
      flush()
      if (tokens && /[>+~]/.test(char)) parts.push(char)
    } else chunk += char
  }
  flush()
  return parts
}

// The careers page has a known .rv -> .rv.in scroll reveal. Other hiding
// styles remain conservative evidence, including styles in conditional rules.
// CSS inside templates is inert; styles in an ordinary hidden container still
// apply globally, as they do in a browser.
export const readEasyEcomVisibleDocument = html => {
  const document = readNativeDocument(html)
  const root = document.nodes(node => node.tag === 'root')[0]
  const parents = new Map(), styles = []
  const visit = node => {
    if (['template', 'noscript', 'object'].includes(node.tag)) return
    if (node.tag === 'style') { styles.push(node.raw || ''); return }
    for (const child of node.children) if (typeof child !== 'string') { parents.set(child, node); visit(child) }
  }
  visit(root)
  const css = styles.join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
  const nativeReveal = rules.some(([, selector, declarations]) => selector.trim() === '.rv.in'
    && /(?:^|;)\s*opacity\s*:\s*1(?:\.0+)?\s*(?:;|$)/i.test(declarations))
  const hiddenSelectors = rules.flatMap(([, selectors, declarations]) => selectorParts(selectors)
    .map(selector => selector.trim()).filter(selector => hiddenDeclarations(declarations,
      nativeReveal && selector === '.rv' && !/!important/i.test(declarations))))
  const compoundMatches = (node, compound) => {
    let valid = true, functional = false
    if (compound === ':root') return node.tag === 'html'
    compound = compound.replace(/:(not|is|where)\(([^()]*)\)/g, (_, kind, choices) => {
      functional = true
      const any = selectorParts(choices).some(choice => compoundMatches(node, choice.trim()))
      if (kind === 'not' ? any : !any) valid = false
      return ''
    })
    if (!valid) return false
    // An unresolved state can hide the element; do not publish its facts on
    // an assumption that the state is inactive.
    compound = compound.replace(/:[\w-]+(?:\([^()]*\))?/g, '')
    const tag = compound.match(/^(\*|[a-z][\w-]*)/i)?.[1]
    if (tag && tag !== '*' && node.tag !== tag.toLowerCase()) return false
    for (const attr of compound.matchAll(/\[([^\s\]=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/g)) {
      if (!Object.hasOwn(node.attrs, attr[1].toLowerCase())) return false
      const value = attr[2] ?? attr[3] ?? attr[4]
      if (value !== undefined && node.attrs[attr[1].toLowerCase()] !== value) return false
    }
    const simple = compound.replace(/\[[^\]]*\]/g, '')
    // Keyframe percentages and pseudo-elements are not element selectors.
    if (!/^(?:\*|[a-z][\w-]*)?(?:[.#][\w-]+)*$/i.test(simple)
      || (!simple && !functional && !/\[[^\]]*\]/.test(compound))) return false
    if (![...simple.matchAll(/#([\w-]+)/g)].every(([, id]) => node.attrs.id === id)) return false
    return [...simple.matchAll(/\.([\w-]+)/g)].every(([, name]) => document.hasClass(node, name))
  }
  const selectorMatches = (node, selector) => {
    const tokens = selectorParts(selector, true)
    const match = (current, at) => {
      if (!current || at < 0 || !compoundMatches(current, tokens[at])) return false
      if (at === 0) return true
      const combinator = tokens[at - 1]
      const parent = parents.get(current)
      if (combinator === '>') return match(parent, at - 2)
      if (combinator === '+' || combinator === '~') {
        const siblings = parent?.children.filter(child => typeof child !== 'string') || []
        const before = siblings.slice(0, siblings.indexOf(current))
        return combinator === '+' ? match(before.at(-1), at - 2) : before.some(sibling => match(sibling, at - 2))
      }
      for (let ancestor = parent; ancestor; ancestor = parents.get(ancestor)) if (match(ancestor, at - 1)) return true
      return false
    }
    return tokens.length > 0 && match(node, tokens.length - 1)
  }
  const project = (node, parentVisible = true) => {
    const visible = parentVisible && !node.inert && !hiddenDeclarations(node.attrs.style)
      && !hiddenSelectors.some(selector => selectorMatches(node, selector))
    return { ...node, inert: !visible, activeFrame: node.activeFrame === true && visible,
      children: node.children.map(child => typeof child === 'string' ? child : project(child, visible)) }
  }
  const projected = project(root)
  const find = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []),
    ...node.children.filter(child => typeof child !== 'string').flatMap(child => find(child, predicate)) ]
  return { ...document, nodes: predicate => find(projected, predicate) }
}
