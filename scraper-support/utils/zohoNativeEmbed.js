import { parse } from 'acorn'

const loaderUrl = 'https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js'
const isLoad = node => node?.type === 'CallExpression' && node.callee.type === 'MemberExpression'
  && !node.callee.computed && node.callee.object.name === 'rec_embed_js' && node.callee.property.name === 'load'
const hiddenStyle = value => /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?)(?:\s*!important)?\s*(?:;|$)/i.test(value || '')
const visibleWidget = (document, id) => {
  const selectors = [...String(document.html || '').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)]
    .flatMap(([, css]) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]+)\}/g)]
      .filter(([, , declarations]) => hiddenStyle(declarations)).flatMap(([, list]) => list.split(',')))
  const matches = (node, selector) => {
    // Treat conditional hiding selectors conservatively. Match the target
    // compound, then inspect every ancestor rather than unrelated sibling rules.
    const compound = selector.trim().split(/[\s>+~]+/).at(-1)
    if (compound === '*') return true
    const tag = compound.match(/^[a-z][\w-]*/i)?.[0], ids = [...compound.matchAll(/#([\w-]+)/g)].map(m => m[1])
    const classes = [...compound.matchAll(/\.([\w-]+)/g)].map(m => m[1])
    const attributeId = compound.match(/\[id\s*=\s*["']?([^\]"']+)["']?\]/i)?.[1]
    if (!tag && !ids.length && !classes.length && !attributeId) return false
    return (!tag || node.tag === tag.toLowerCase()) && ids.every(value => node.attrs.id === value)
      && (!attributeId || node.attrs.id === attributeId)
      && classes.every(value => (node.attrs.class || '').split(/\s+/).includes(value))
  }
  let total = 0, visible = 0
  const visit = (node, active = true) => {
    if (typeof node === 'string') return
    active &&= !node.inert && !hiddenStyle((node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, ''))
      && !selectors.some(selector => matches(node, selector))
    if (node.attrs.id === id) { total++; if (active && ['div', 'section'].includes(node.tag)) visible++ }
    node.children.forEach(child => visit(child, active))
  }
  document.nodes(n => n.tag === 'root').forEach(root => visit(root))
  return total === 1 && visible === 1
}

// A current immediate literal loader plus its active widget establishes the
// native handoff. Downloaded JavaScript is inspected and never executed.
export const inspectZohoNativeEmbed = (document, expectedBoard) => {
  const scripts = document.nodes(n => n.tag === 'script' && !Object.hasOwn(n.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/javascript)$/i.test(n.attrs.type || ''))
  if (!scripts.some(n => n.attrs.src === loaderUrl)) return { bound: false, additionalSites: [] }
  const calls = []; let unknownScope = false, shadowed = false
  for (const script of scripts.filter(n => !n.attrs.src && /rec_embed_js/.test(n.raw || ''))) {
    let ast
    try { ast = parse(script.raw, { ecmaVersion: 'latest' }) } catch { continue }
    const checkShadow = node => {
      if (!node?.type) return
      const target = node.type === 'VariableDeclarator' ? node.id : node.type === 'AssignmentExpression' ? node.left
        : ['FunctionDeclaration', 'ClassDeclaration'].includes(node.type) ? node.id : null
      const touchesLoader = value => value?.name === 'rec_embed_js' || (value?.type === 'MemberExpression'
        && ((value.property?.name || value.property?.value) === 'rec_embed_js' || touchesLoader(value.object)))
      if (touchesLoader(target)) shadowed = true
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(checkShadow)
        else if (value?.type) checkShadow(value)
      }
    }
    checkShadow(ast)
    if (ast.body.some(s => s.type !== 'EmptyStatement' && !(s.type === 'ExpressionStatement'
      && (isLoad(s.expression) || s.directive)))) continue
    for (const statement of ast.body) {
      const call = statement.type === 'ExpressionStatement' && statement.expression
      if (!isLoad(call)) continue
      if (call.arguments.length !== 1 || call.arguments[0].type !== 'ObjectExpression') { unknownScope = true; continue }
      const values = new Map(); let valid = true
      for (const prop of call.arguments[0].properties) {
        const key = prop.key?.name || prop.key?.value
        if (prop.type !== 'Property' || prop.computed || prop.kind !== 'init' || values.has(key)
          || prop.value.type !== 'Literal' || typeof prop.value.value !== 'string') { valid = false; break }
        values.set(key, prop.value.value)
      }
      if (!valid || !values.get('page_name') || values.get('source') !== 'CareerSite') { unknownScope = true; continue }
      if (!visibleWidget(document, values.get('widget_id'))) continue
      let site
      try { site = new URL(values.get('site')) } catch { continue }
      if (site.protocol !== 'https:' || site.username || site.password || site.port || site.search || site.hash
        || site.pathname !== '/') continue
      calls.push(site.origin + '/jobs/' + encodeURIComponent(values.get('page_name')))
    }
  }
  return { bound: !shadowed && calls.includes(expectedBoard), additionalSites: [...new Set(calls.filter(site => site !== expectedBoard))], unknownScope }
}
