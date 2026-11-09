import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

// Decode only original text leaves. Recursively decoding parent strings changes
// literal encoded examples and can turn text into markup on another pass.
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', darr: '↓', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' }
export const decodeLeaf = value => String(value ?? '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, name) => {
  if (!name.startsWith('#')) return entities[name.toLowerCase()] ?? original
  const cp = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
  return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '�'
})
export const normalizeText = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const textBlocks = new Set(['p','div','li','ul','ol','h1','h2','h3','h4','h5','h6','br','hr','table','tr','td','th','dl','dt','dd','section','article'])
const textLeaves = node => {
  if(typeof node==='string')return decodeLeaf(node)
  if(node.inert||node.tag==='script')return ''
  const body=node.children.map(textLeaves).join('')
  return textBlocks.has(node.tag)?' '+body+' ':body
}
const cleanCss = value => String(value ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
const hidden = value => cleanCss(value).split(';').some(part => {
  const [key, ...rest] = part.split(':'), property = key.trim().toLowerCase(), value = rest.join(':').replace(/\s*!important\s*$/i, '').trim().toLowerCase()
  return property === 'display' && value === 'none' || ['visibility', 'content-visibility'].includes(property) && ['hidden', 'collapse'].includes(value)
    || property === 'opacity' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(value) && Number(value.replace(/%$/, '')) === 0
})
const uncertain = value => /&(?:[a-z]+|#\w+);?|\\|(?:opacity|display|visibility|content-visibility)\s*:\s*(?:var|calc)\(|(?:^|;)\s*(?:filter|clip|clip-path|transform|animation)\s*:/i.test(value)
  || /(?:^|;)\s*font-size\s*:\s*[+-]?0(?:[a-z%]*)\s*(?:!important\s*)?(?:;|$)/i.test(value)
  || /(?:^|;)\s*color\s*:\s*(?:transparent|rgba?\([^)]*[,/]\s*0(?:\.0+)?\s*\))\s*(?:!important\s*)?(?:;|$)/i.test(value)
const simple = value => /^(?:\*|[a-z][\w-]*)?(?:[.#][\w-]+)*$/i.test(value) && Boolean(value)
const matchSimple = (node, selector) => {
  const tag = selector.match(/^[a-z][\w-]*/i)?.[0]
  return (!tag || node.tag === tag.toLowerCase()) && [...selector.matchAll(/([.#])([\w-]+)/g)].every(([, kind, name]) => kind === '#' ? node.attrs.id === name : (node.attrs.class || '').split(/\s+/).includes(name))
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
  const html = String(input), document = readNativeDocument(html), root = document.nodes(n => n.tag === 'root')[0]
  const parents = new WeakMap(), nodes = [], relevant = new Set(), hiddenNodes = new Set()
  const walk = (node, parent) => { if (typeof node === 'string') return; if (parent) parents.set(node, parent); nodes.push(node); node.children.forEach(child => walk(child, node)) }
  walk(root)
  const descend = node => { if (typeof node === 'string') return; relevant.add(node); node.children.forEach(descend) }
  for (const node of nodes.filter(scope)) { descend(node); for (let p = parents.get(node); p; p = parents.get(p)) relevant.add(p) }
  const issues = new Set()
  let unresolved = false
  for (const node of relevant) if (uncertain(cleanCss(node.attrs.style || ''))) { unresolved = true; issues.add('inline-style:' + node.tag + '.' + (node.attrs.class || '')) }
  for (const [, style] of html.replace(/<!--[\s\S]*?(?:-->|$)/g, '').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    const css = cleanCss(style)
    if (/@import|\\/.test(css)) { unresolved = true; issues.add('unresolved-stylesheet-import-or-escape') }
    for (const [, list, declaration] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // CSS nesting may put the parent's declarations in this prelude. A
      // decorative nested pseudo-element never controls criteria visibility;
      // inspect it before commas inside color-mix can look like selectors.
      if (/&::?(?:before|after)\b/.test(list)) continue
      if (!hidden(declaration) && !uncertain(declaration)) continue
      for (let selector of list.split(',').map(s => s.trim())) {
        if (/::?(?:before|after)\b/.test(selector)) continue
        const dynamic = /:/.test(selector)
        selector = selector.replace(/::?[a-z-]+(?:\([^)]*\))?/gi, '')
        for (const node of nodes) {
          const matches = selectorMatch(node, selector, parents)
          if (matches === null) { if (relevant.has(node)) { unresolved = true; issues.add('unsupported-hiding-selector:' + selector) } continue }
          if (!matches) continue
          if (relevant.has(node) && (dynamic || uncertain(declaration))) { unresolved = true; issues.add('uncertain-hiding-rule:' + selector) }
          if (!dynamic && hidden(declaration)) hiddenNodes.add(node)
        }
      }
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
