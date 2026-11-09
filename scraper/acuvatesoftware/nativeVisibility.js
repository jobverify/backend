import namedEntities from './htmlNamedEntities.json' with { type: 'json' }
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

// Decode only original text leaves. Recursively decoding parent strings changes
// literal encoded examples and can turn text into markup on another pass.
const numericReplacements = {128:8364,130:8218,131:402,132:8222,133:8230,134:8224,135:8225,136:710,137:8240,138:352,139:8249,140:338,142:381,145:8216,146:8217,147:8220,148:8221,149:8226,150:8211,151:8212,152:732,153:8482,154:353,155:8250,156:339,158:382,159:376}
export const decodeLeaf = value => String(value ?? '').replace(/&#(?:x[0-9a-f]+|\d+);?|&[a-z][a-z0-9]*;?/gi, original => {
  const name = original.slice(1)
  if (name.startsWith('#')) {
    const numeric = name.replace(/;$/, ''), parsed = numeric[1].toLowerCase() === 'x' ? parseInt(numeric.slice(2),16) : Number(numeric.slice(1)), cp = numericReplacements[parsed] ?? parsed
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '\ufffd'
  }
  for (let length = name.length; length > 0; length--) if (Object.hasOwn(namedEntities,name.slice(0,length))) return namedEntities[name.slice(0,length)] + name.slice(length)
  return original
})
export const normalizeText = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const textLeaves = node => typeof node === 'string' ? decodeLeaf(node) : node.inert || node.tag === 'script' ? '' : node.children.map(textLeaves).join(' ')
const cleanCss = value => String(value ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
const hidden = value => cleanCss(value).split(';').some(part => {
  const [key, ...rest] = part.split(':'), property = key.trim().toLowerCase(), value = rest.join(':').replace(/\s*!important\s*$/i, '').trim().toLowerCase()
  return property === 'display' && value === 'none' || ['visibility', 'content-visibility'].includes(property) && ['hidden', 'collapse'].includes(value)
    || property === 'opacity' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/.test(value) && Number(value.replace(/%$/, '')) <= 0
})
const visibilityValue = css => cleanCss(css).split(';').map(declaration => {
  const [property,...rest] = declaration.split(':')
  return property.trim().toLowerCase() === 'visibility' ? rest.join(':').replace(/\s*!important\s*$/i,'').trim().toLowerCase() : null
}).filter(Boolean).at(-1)
// A color's third RGB/HSL component is not alpha. Only a slash alpha or a
// fourth legacy comma component can make these color functions transparent.
// Withhold uncertain color alpha rather than discard children that may set
// their own visible color.
const uncertainColor = css => cleanCss(css).split(';').some(declaration => {
  const colon = declaration.indexOf(':')
  if (colon < 0 || !['color','-webkit-text-fill-color'].includes(declaration.slice(0,colon).trim().toLowerCase())) return false
  const value = declaration.slice(colon + 1).replace(/\s*!important\s*$/i,'').trim().toLowerCase()
  if (value === 'transparent' || /^#[\da-f]{3}0$|^#[\da-f]{6}00$/i.test(value)) return true
  const functional = /^([a-z-]+)\(([\s\S]*)\)$/.exec(value)
  if (!functional) return false
  const [,name,body] = functional
  if (name === 'var' || /^\s*from\b/.test(body)) return true
  let depth = 0, slash = -1, commas = [], last = 0
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (depth === 0 && char === '/') { if (slash >= 0) return true; slash = i }
    else if (depth === 0 && char === ',') { commas.push(body.slice(last,i).trim()); last = i + 1 }
  }
  commas.push(body.slice(last).trim())
  const legacy = /^(?:rgb|rgba|hsl|hsla)$/.test(name)
  const alpha = slash >= 0 ? body.slice(slash + 1).trim() : legacy && commas.length === 4 ? commas[3] : null
  if (alpha == null) return !/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|device-cmyk)$/.test(name)
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(alpha)) return true
  return Number(alpha.replace(/%$/,'')) <= 0
})
const uncertain = value => /&(?:[a-z]+|#\w+);?|\\|(?:opacity|display|visibility|content-visibility)\s*:\s*(?:var|calc)\(|(?:^|;)\s*(?:filter|clip|clip-path|transform|animation)\s*:\s*(?!none\b|initial\b|unset\b)[^;]+/i.test(value)
  || /(?:^|;)\s*font-size\s*:\s*[+-]?0(?:[a-z%]*)\s*(?:!important\s*)?(?:;|$)/i.test(value)
  || uncertainColor(value)
const simple = value => /^(?:\*|[a-z][\w-]*)?(?:[.#][\w-]+|\[[\w-]+(?:\s*=\s*(?:[\w-]+|"[^"]*"|'[^']*'))?\])*$/i.test(value) && Boolean(value)
const matchSimple = (node, selector) => {
  const tag = selector.match(/^[a-z][\w-]*/i)?.[0]
  const withoutAttributes = selector.replace(/\[[^\]]*\]/g,'')
  return (!tag || node.tag === tag.toLowerCase()) && [...withoutAttributes.matchAll(/([.#])([\w-]+)/g)].every(([, kind, name]) => kind === '#' ? node.attrs.id === name : (node.attrs.class || '').split(/\s+/).includes(name))
    && [...selector.matchAll(/\[([\w-]+)(?:\s*=\s*(?:([\w-]+)|"([^"]*)"|'([^']*)'))?\]/g)].every(([,key,...values]) => Object.hasOwn(node.attrs,key) && (values.every(v=>v===undefined) || node.attrs[key] === values.find(v=>v!==undefined)))
}

// Match the source's class/tag/id descendant and child rules. A hiding rule with
// an unsupported selector remains unresolved if it could affect the criteria.
const selectorMatch = (node, selector, parents) => {
  const tokens = selector.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/)
  if (!tokens.length || tokens.some(t => t !== '>' && !simple(t))) return null
  let current = node, index = tokens.length - 1
  if (!matchSimple(current, tokens[index--])) return false
  while (index >= 0) {
    if (tokens[index] === '>') {
      current = parents.get(current); index--
      if (!current || index < 0 || !matchSimple(current, tokens[index--])) return false
    } else {
      const wanted = tokens[index--]
      current = parents.get(current)
      while (current && !matchSimple(current, wanted)) current = parents.get(current)
      if (!current) return false
    }
  }
  return true
}

export const visibleDocument = (input, scope = () => true) => {
  // Nitropack's noscript CSS is inactive in the normal JavaScript-enabled client.
  const html = String(input).replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi,''), document = readNativeDocument(html), root = document.nodes(n => n.tag === 'root')[0]
  const definitions = new Map()
  for (const [,name,value] of html.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)(?:;|})/g)) { if(!definitions.has(name))definitions.set(name,new Set());definitions.get(name).add(value.trim()) }
  const resolveCss = value => String(value).replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,(original,name,fallback)=>definitions.get(name)?.size===1?[...definitions.get(name)][0]:!definitions.has(name)&&fallback!==undefined?fallback:original)
  const parents = new WeakMap(), nodes = [], relevant = new Set(), hiddenNodes = new Set()
  const walk = (node, parent) => { if (typeof node === 'string') return; if (parent) parents.set(node, parent); nodes.push(node); node.children.forEach(child => walk(child, node)) }
  walk(root)
  const visibilityHiddenNodes = new Set(nodes.filter(n => ['hidden','collapse'].includes(visibilityValue(n.attrs.style || ''))))
  const visibilityVisibleNodes = new Set(nodes.filter(n => visibilityValue(n.attrs.style || '') === 'visible'))
  const descend = node => { if (typeof node === 'string') return; relevant.add(node); node.children.forEach(descend) }
  for (const node of nodes.filter(scope)) { descend(node); for (let p = parents.get(node); p; p = parents.get(p)) relevant.add(p) }
  const issues = new Set()
  let unresolved = false
  for (const node of relevant) if (uncertain(resolveCss(cleanCss(node.attrs.style || '')))) { unresolved = true; issues.add('inline-style:' + node.tag + '.' + (node.attrs.class || '')) }
  for (const [, style] of html.replace(/<!--[\s\S]*?(?:-->|$)/g, '').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    const css = resolveCss(cleanCss(style))
    if (/@import|\\/.test(css)) { unresolved = true; issues.add('unresolved-stylesheet-import-or-escape') }
    for (const [, list, declaration] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // CSS nesting may put the parent's declarations in this prelude. A
      // decorative nested pseudo-element never controls criteria visibility;
      // inspect it before commas inside color-mix can look like selectors.
      if (/&::?(?:before|after)\b/.test(list)) continue
      const ruleVisibility = visibilityValue(declaration), visibleRule = ruleVisibility === 'visible' && !hidden(declaration) && !uncertain(declaration)
      if (!hidden(declaration) && !uncertain(declaration) && !visibleRule) continue
      for (let selector of list.split(',').map(s => s.trim())) {
        if (/::?(?:before|after)\b/.test(selector)) continue
        const requiresEmpty = /:empty\b/.test(selector)
        selector = selector.replace(/:empty\b/g,'')
        const dynamic = /:/.test(selector)
        selector = selector.replace(/::?[a-z-]+(?:\([^)]*\))?/gi, '')
        for (const node of nodes) {
          if(requiresEmpty && node.children.some(c=>typeof c==='string'?c.length>0:!c.inert))continue
          const matches = selectorMatch(node, selector, parents)
          if (matches === null) {
            const candidate = selector.split(/\s+|>/).filter(Boolean).at(-1)?.replace(/\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?/g,'')
            if (!visibleRule && relevant.has(node) && (!candidate || !simple(candidate) || matchSimple(node,candidate))) { unresolved = true; issues.add('unsupported-hiding-selector:' + selector) } continue
          }
          if (!matches) continue
          if (visibleRule) { visibilityVisibleNodes.add(node); continue }
          if (relevant.has(node) && (dynamic || uncertain(declaration))) { unresolved = true; issues.add('uncertain-hiding-rule:' + selector) }
          if (!dynamic && hidden(declaration)) {
            hiddenNodes.add(node)
            if (['hidden','collapse'].includes(ruleVisibility)) visibilityHiddenNodes.add(node)
          }
        }
      }
    }
  }
  // Visibility is inherited and a descendant can explicitly become visible.
  // The underlying reader's inherited inert flag cannot resolve that cascade;
  // preserve uncertainty only where such an override affects the criteria.
  for (const node of visibilityVisibleNodes) if (relevant.has(node)) {
    for (let parent = parents.get(node); parent; parent = parents.get(parent)) if (visibilityHiddenNodes.has(parent)) {
      unresolved = true; issues.add('inherited-visibility-override'); break
    }
  }
  const project = (node, parentVisible = true) => {
    if (typeof node === 'string') return node
    const visible = parentVisible && !node.inert && !hidden(cleanCss(node.attrs.style || '')) && !hiddenNodes.has(node)
    return { ...node, inert: !visible, children: node.children.map(child => project(child, visible)) }
  }
  const projected = project(root)
  const find = (node, predicate) => node.inert ? [] : [...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => find(child, predicate))]
  return { ...document, unresolved, visibilityIssues: [...issues], nodes: predicate => find(projected, predicate), text: node => normalizeText(textLeaves(node)) }
}

export const visibleText = html => { const doc = visibleDocument(html); return { text: doc.unresolved ? null : doc.text(doc.nodes(n => n.tag === 'root')[0]) || null, unresolved: doc.unresolved } }
