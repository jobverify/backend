import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

// Attribute entities were already decoded once by readNativeDocument. A remaining
// ampersand may be literal CSS; uncertain() keeps it unresolved instead of
// decoding a second time and accidentally hiding a visible native requirement.
// Style-element contents are CSS raw text and likewise need no HTML decoding.
const cleanCss = value => String(value ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
const uncertain = style => /&(?:[a-z]+|#\w+);?|\\|(?:opacity|display|visibility|content-visibility)\s*:\s*(?:var|calc)\(|(?:^|;)\s*(?:filter|clip|clip-path|transform|animation)\s*:/i.test(style)
  || /(?:^|;)\s*font-size\s*:\s*[+-]?0(?:[a-z%]*)\s*(?:!important\s*)?(?:;|$)/i.test(style)
  || /(?:^|;)\s*color\s*:\s*(?:transparent|rgba?\([^)]*[,/]\s*0(?:\.0+)?\s*\))\s*(?:!important\s*)?(?:;|$)/i.test(style)
const hidden = value => cleanCss(value).split(';').some(part => {
  const [name, ...rest] = part.split(':'), property = name.trim().toLowerCase(), value = rest.join(':').replace(/\s*!important\s*$/i, '').trim().toLowerCase()
  return property === 'display' && value === 'none' || ['visibility','content-visibility'].includes(property) && ['hidden','collapse'].includes(value)
    || property === 'opacity' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(value) && Number(value.replace(/%$/, '')) === 0
})
const simple = value => /^(?:\*|[a-z][\w-]*)?(?:[.#][\w-]+)*$/i.test(value) && Boolean(value)
const matches = (node, selector) => {
  const tag = selector.match(/^[a-z][\w-]*/i)?.[0]
  return (!tag || node.tag === tag.toLowerCase()) && [...selector.matchAll(/([.#])([\w-]+)/g)].every(([, kind, name]) =>
    kind === '#' ? node.attrs.id === name : (node.attrs.class || '').split(/\s+/).includes(name))
}

// This source needs only simple selectors. A new hiding mechanism or unsupported
// selector makes full content unresolved; it never falls back to publishing raw HTML.
export const visibleDocument = input => {
  const html = String(input), source = html.replace(/<!--[\s\S]*?(?:-->|$)/g, ''), document = readNativeDocument(source), selectors = []
  let unresolved = false
  for (const [, css] of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    const clean = cleanCss(css)
    if (/\\|@import|@keyframes/i.test(clean)) unresolved = true
    for (const [, list, declarations] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (hidden(declarations)) {
      for (const selector of list.split(',').map(value => value.trim())) {
        if (/::?(?:before|after)$/.test(selector) && simple(selector.replace(/::?(?:before|after)$/, ''))) continue
        if (!simple(selector)) unresolved = true
        else selectors.push(selector)
      }
    }
  }
  const project = (node, parent = true) => {
    if (typeof node === 'string') return node
    const style = cleanCss(node.attrs.style || '')
    if (uncertain(style)) unresolved = true
    const visible = parent && !node.inert && !hidden(style) && !selectors.some(selector => matches(node, selector))
    return { ...node, activeFrame: node.activeFrame===true&&parent&&!hidden(style)&&!selectors.some(selector=>matches(node,selector)), inert: !visible, children: node.children.map(child => project(child, visible)) }
  }
  const roots = document.nodes(node => node.tag === 'root').map(root => project(root))
  const find = (node, predicate) => node.inert ? [] : [...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => find(child,predicate))]
  const frames=node=>node.activeFrame?[node]:node.inert?[]:node.children.filter(child=>typeof child!=='string').flatMap(frames)
  return { ...document, unresolved, nodes: predicate => roots.flatMap(root => find(root,predicate)), frames:()=>roots.flatMap(frames) }
}
export const visibleText = html => { const doc = visibleDocument(html); return { text: doc.unresolved?null:doc.text(doc.nodes(n => n.tag === 'root')[0]), unresolved: doc.unresolved } }
