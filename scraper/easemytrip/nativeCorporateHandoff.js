import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

export const CORPORATE_ABOUT_URL = 'https://www.easemytrip.com/about-us.html'
const HOME = 'https://www.easemytrip.com/'
const CAREERS = HOME + 'career.html'
const requireProof = (ok, why) => { if (!ok) throw Error('Official corporate handoff: ' + why) }

// The public desktop navigation is visible at 1280px; its mobile menu moves
// off-screen below 700px. Evaluate only explicit width predicates. Unknown
// conditions remain potentially active, so they cannot dismiss a hiding rule.
const mediaApplies = query => query.split(',').some(part => {
  part = part.trim().toLowerCase().replace(/^(?:only\s+)?(?:screen|all)\s*(?:and\s*)?/, '')
  let recognized = true, applies = true
  part = part.replace(/\((min|max)-(?:device-)?width\s*:\s*(\d+(?:\.\d+)?)px\)/g, (_, bound, width) => {
    applies &&= bound === 'min' ? 1280 >= Number(width) : 1280 <= Number(width)
    return ''
  }).replace(/\band\b|\s+/g, '')
  if (part) recognized = false
  return recognized ? applies : true
})

// These layouts cannot prove a readable handoff without rendering. Mark their
// matching element conservatively hidden, alongside the shared static reader's
// display/visibility/opacity and parser-inert ancestor checks.
const uncertainLayout = declarations => /(?:^|;)\s*(?:(?:max-)?(?:height|width)|font-size)\s*:\s*[+-]?0(?:\.0*)?(?:[a-z%]+)?\s*(?:!important\s*)?(?:;|$)|(?:^|;)\s*(?:clip|clip-path|transform|animation(?:-name)?)\s*:\s*(?!none\b)[^;]+|(?:^|;)\s*position\s*:\s*(?:absolute|fixed)\b|(?:^|;)\s*(?:left|right|top|bottom)\s*:\s*-\d|(?:^|;)\s*(?:display|visibility|opacity|content-visibility)\s*:[^;]*(?:var|calc)\(/i.test(declarations)

// Parse bounded CSS blocks as data. No stylesheet or client script is run.
// Quotes and parentheses protect semicolons in the published font import URL.
const desktopCss = (input, imports, depth = 0) => {
  requireProof(depth <= 8 && input.length <= 1000000, 'stylesheet structure exceeds bound')
  const css = input.replace(/\/\*[\s\S]*?\*\//g, '')
  let cursor = 0, output = '', blocks = 0
  while (cursor < css.length) {
    while (/\s/.test(css[cursor] || '') && cursor < css.length) cursor++
    if (cursor === css.length) break
    let end = cursor, quote = '', parentheses = 0
    for (; end < css.length; end++) {
      const c = css[end]
      if (c === '\\') { end++; continue }
      if (quote) { if (c === quote) quote = ''; continue }
      if (c === '"' || c === "'") quote = c
      else if (c === '(' || c === '[') parentheses++
      else if (c === ')' || c === ']') parentheses--
      else if (!parentheses && (c === ';' || c === '{')) break
    }
    requireProof(end < css.length && !quote && parentheses === 0 && ++blocks <= 10000, 'malformed stylesheet')
    const header = css.slice(cursor, end).trim()
    if (css[end] === ';') {
      if (/^@import\b/i.test(header)) {
        const match = /^@import\s+url\(\s*(['"])([^'"]+)\1\s*\)\s*$/i.exec(header)
        requireProof(match, 'unsupported stylesheet import')
        imports.push(match[2])
      } else requireProof(/^@charset\s+(['"])utf-8\1$/i.test(header), 'unsupported stylesheet statement')
      cursor = end + 1; continue
    }
    let closing = end + 1, level = 1; quote = ''
    for (; closing < css.length && level; closing++) {
      const c = css[closing]
      if (c === '\\') { closing++; continue }
      if (quote) { if (c === quote) quote = ''; continue }
      if (c === '"' || c === "'") quote = c
      else if (c === '{') level++
      else if (c === '}') level--
    }
    requireProof(level === 0 && !quote, 'unterminated stylesheet block')
    const body = css.slice(end + 1, closing - 1)
    if (/^@media\b/i.test(header)) { if (mediaApplies(header.replace(/^@media\s*/i, ''))) output += desktopCss(body, imports, depth + 1) }
    else if (/^@(?:supports|layer)\b/i.test(header)) output += desktopCss(body, imports, depth + 1)
    else if (!/^@font-face$/i.test(header)) {
      requireProof(!header.startsWith('@') && !/[{}]/.test(body), 'unsupported stylesheet rule')
      output += header + '{' + body + (uncertainLayout(body) ? ';display:none!important;' : '') + '}\n'
    }
    cursor = closing
  }
  return output
}

const styleNodes = html => {
  const nodes = [], root = readNativeDocument(html).nodes(n => n.tag === 'root')[0]
  const visit = node => {
    if (['template', 'noscript', 'iframe', 'object', 'textarea', 'title'].includes(node.tag)) return
    nodes.push(node)
    for (const child of node.children || []) if (typeof child !== 'string') visit(child)
  }
  visit(root); return nodes
}

export const hasNormalClientHomepage = html => {
  const head = activeHead(html), doc = readNativeDocument(html)
  return head.titles.length === 1 && /^EaseMyTrip\.com - Book Flights, Hotels, Holidays, Bus & Train Tickets$/.test(head.titles[0])
    && doc.nodes(n => n.tag === 'app-root' && /^\d+\.\d+\.\d+$/.test(n.attrs['ng-version'] || '')).length === 1
}

export async function assertCurrentCorporateHandoff({ html, readStylesheet, checkDeadline }) {
  const head = activeHead(html), doc = readNativeDocument(html), nodes = styleNodes(html)
  requireProof(head.titles.length === 1 && head.titles[0] === 'About Us and Company Profile - EaseMyTrip.com', 'employer title changed')
  const canonicals = doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical')
  requireProof(canonicals.length === 1 && canonicals[0].attrs.href === CORPORATE_ABOUT_URL, 'canonical employer entry changed')
  const seen = new Set(), styles = []
  const load = async (value, base = CORPORATE_ABOUT_URL) => {
    checkDeadline()
    const url = new URL(value, base)
    requireProof(url.protocol === 'https:' && !url.username && !url.password && !url.hash
      && ['css.emtcontent.com', 'fonts.googleapis.com'].includes(url.hostname), 'stylesheet origin changed')
    if (seen.has(url.href)) return
    requireProof(seen.size < 8, 'stylesheet resource count exceeds bound'); seen.add(url.href)
    const imports = [], body = await readStylesheet(url.href)
    requireProof(!/<\/style\b/i.test(body), 'stylesheet contains HTML boundary')
    styles.push(desktopCss(body, imports))
    for (const imported of imports) await load(imported, url.href)
  }
  for (const node of nodes) {
    if (node.tag === 'link' && /(?:^|\s)stylesheet(?:\s|$)/i.test(node.attrs.rel || '')) await load(node.attrs.href)
    if (node.tag === 'style') {
      const imports = []; styles.push(desktopCss(node.raw || '', imports))
      for (const imported of imports) await load(imported)
    }
  }
  checkDeadline()
  const visible = readVisibleNativeDocument(html.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '') + '<style>' + styles.join('\n') + '</style>', { strict: true })
  const parents = new Map(), roots = visible.nodes(n => n.tag === 'root')
  const index = node => { for (const child of node.children || []) if (typeof child !== 'string') { parents.set(child, node); index(child) } }
  roots.forEach(index)
  const navigation = visible.nodes(n => n.tag === 'nav')
  const anchors = visible.nodes(n => n.tag === 'a' && n.attrs.href === CAREERS && visible.text(n) === 'Career')
  const bound = anchors.filter(anchor => {
    let hasMenu = false, hasNav = false
    for (let node = anchor; node; node = parents.get(node)) {
      if (uncertainLayout(node.attrs.style || '')) return false
      hasMenu ||= node.tag === 'ul' && node.attrs.id === 'nav-items'
      hasNav ||= navigation.includes(node)
    }
    return hasMenu && hasNav
  })
  requireProof(bound.length === 1 && visible.nodes(n => n.tag === 'a' && n.attrs.href === HOME
    && n.children.some(child => typeof child !== 'string' && child.tag === 'img' && child.attrs.src === 'https://images.emtcontent.com/career/EaseMyTrip-Logo.svg')).length === 1,
  'active branded top navigation missing or ambiguous')
  checkDeadline()
}
