import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const entities = {amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'–',mdash:'—',rsquo:"'",lsquo:"'",ldquo:'"',rdquo:'"',middot:'·',times:'×'}
export const clean = value => String(value ?? '').replace(/&#(?:x([\da-f]+)|(\d+));/gi, (all, hex, decimal) => {
  const code = parseInt(hex || decimal, hex ? 16 : 10)
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all
}).replace(/&([a-z]+);/gi, (all, name) => entities[name.toLowerCase()] ?? all).replace(/\s+/g, ' ').trim()
export const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
export const childrenOf = node => node.children.filter(child => typeof child !== 'string')
export const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []), ...childrenOf(node).flatMap(child => descendants(child, predicate)),
]

// Source-local visibility handling supplements the shared tree reader with
// opacity and simple native CSS. It does not change any shared consumer.
export const readBrainvireDocument = (html, {reveal = false, modal = false} = {}) => {
  const root = readNativeDocument(html).nodes(node => node.tag === 'root')[0]
  const parents = new Map(), styles = []
  const index = node => {
    if (node.tag === 'style' && !parents.get(node)?.inert) styles.push(node.raw || '')
    for (const child of childrenOf(node)) { parents.set(child, node); index(child) }
  }
  index(root)
  const classes = node => new Set([
    ...(node.attrs.class || '').split(/\s+/),
    ...(reveal && hasClass(node, 'reveal') ? ['in'] : []),
    ...(modal && hasClass(node, 'cv-modal') ? ['open', 'apply'] : []),
  ])
  const compound = (node, selector) => {
    if (!node || !selector) return false
    const attributes=[...selector.matchAll(/\[\s*([\w-]+)(?:\s*([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/g)]
    selector=selector.replace(/\[[^\]]*\]/g,'')
    if (!/^(?:[a-z][\w-]*|\*)?(?:[.#][\w-]+)*$/i.test(selector) && selector !== '') return false
    if (!selector && !attributes.length) return false
    for (const attribute of attributes) {
      const [,name,operator]=attribute,expected=attribute[3] ?? attribute[4] ?? attribute[5],actual=node.attrs[name.toLowerCase()]
      if (actual == null) return false
      if (operator && !({'=':()=>actual===expected,'*=':()=>actual.includes(expected),'^=':()=>actual.startsWith(expected),'$=':()=>actual.endsWith(expected),'~=':()=>actual.split(/\s+/).includes(expected),'|=':()=>actual===expected || actual.startsWith(expected+'-')}[operator]?.())) return false
    }
    const tag = selector.match(/^[a-z][\w-]*/i)?.[0]
    if (tag && node.tag !== tag.toLowerCase()) return false
    const id = selector.match(/#([\w-]+)/)?.[1]
    if (id && node.attrs.id !== id) return false
    return [...selector.matchAll(/\.([\w-]+)/g)].every(match => classes(node).has(match[1]))
  }
  const matches = (node, selector) => {
    const parts = selector.trim().match(/(?:\[[^\]]*\]|[^\s])+/g) || []
    if (!parts.length || !compound(node, parts.pop())) return false
    let parent = parents.get(node)
    while (parts.length) {
      const part = parts.pop()
      if (part === '>') { if (!compound(parent, parts.pop())) return false; parent = parents.get(parent); continue }
      while (parent && !compound(parent, part)) parent = parents.get(parent)
      if (!parent) return false
      parent = parents.get(parent)
    }
    return true
  }
  const declarations = value => [...value.matchAll(/(?:^|;)\s*(display|visibility|content-visibility|opacity)\s*:\s*([^;]+)/gi)]
    .map(match => ({property:match[1].toLowerCase(),value:match[2].replace(/!important/gi,'').trim().toLowerCase(),important:/!important/i.test(match[2])}))
  const rules = styles.flatMap(style => [...style.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(match => match[1].split(',').map(selector => ({selector:selector.trim(),declarations:declarations(match[2])})))).filter(rule => rule.declarations.length)
  const visibleSelf = node => {
    if (node.inert || Object.hasOwn(node.attrs,'inert')) return false
    const values = new Map()
    const assign = (d, specificity) => {
      const priority = (d.important ? 1000000 : 0) + specificity
      if (!values.has(d.property) || values.get(d.property).priority <= priority) values.set(d.property,{...d,priority})
    }
    for (const rule of rules) if (matches(node,rule.selector)) {
      const specificity = (rule.selector.match(/#/g)?.length || 0) * 100 + (rule.selector.match(/\./g)?.length || 0) * 10 + rule.selector.split(/\s+/).filter(s => /^[a-z]/i.test(s)).length
      for (const d of rule.declarations) assign(d,specificity)
    }
    for (const d of declarations(node.attrs.style || '')) assign(d,1000)
    return values.get('display')?.value !== 'none'
      && !['hidden','collapse'].includes(values.get('visibility')?.value)
      && values.get('content-visibility')?.value !== 'hidden'
      && !(values.has('opacity') && Number(values.get('opacity').value) === 0)
  }
  const visibility = new Map()
  const visible = node => {
    if (!visibility.has(node)) visibility.set(node,visibleSelf(node) && (!parents.has(node) || visible(parents.get(node))))
    return visibility.get(node)
  }
  const text = node => !visible(node) || ['script','style'].includes(node.tag) ? '' : clean(node.children.map(child => typeof child === 'string' ? child : text(child)).join(' '))
  return {root,parents,visible,text,nodes:predicate => descendants(root,node => visible(node) && predicate(node))}
}
