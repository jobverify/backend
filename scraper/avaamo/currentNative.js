import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { readNativeDocument, readNativeAttributeTokens, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { findExplicitNativeClosure } from '../../scraper-support/utils/sourceAvailability.js'
import { nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

export const AVAAMO_CAREERS_URL = 'https://avaamo.ai/career'
export const AVAAMO_COLLECTION_EVIDENCE = Symbol.for('jobverify.avaamo.current-collection')
const marker = 'data-jobverify-avaamo-offset'
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const need = (ok, message) => { if (!ok) throw Object.assign(Error('Avaamo current native contract: ' + message), { abortRetries: true }) }
const one = (values, label) => { need(values.length === 1, 'missing or ambiguous ' + label); return values[0] }
const children = node => node.children.filter(child => typeof child !== 'string' && !child.inert)
const within = (root, predicate) => root.inert ? [] : [...(predicate(root) ? [root] : []), ...children(root).flatMap(node => within(node, predicate))]
const hash = value => createHash('sha256').update(value).digest('hex')
const classNames = node => (node.attrs.class || '').split(/\s+/).filter(Boolean)
const mediaRules = /@media\s*(\([^{}]+\)(?:\s*and\s*\([^{}]+\))*)\s*\{((?:\s*\.hidden-[a-z0-9]+\s*\{\s*display\s*:\s*none\s*!important\s*;?\s*\})+\s*)\}/g
const hidingRule = /\.((?:hidden-)[a-z0-9]+)\s*\{\s*display\s*:\s*none\s*!important\s*;?\s*\}/g
const breakpointMask = condition => ({
  '(max-width:809.98px)': 1,
  '(min-width:810px)and(max-width:1199.98px)': 2,
  '(min-width:1200px)': 4,
})[condition.replace(/\s+/g, '').toLowerCase()] ?? null

function qualifiedBreakpointEdits(html, styles) {
  if (!styles.length) return []
  const native = readNativeDocument(html), nodes = native.nodes(() => true), parents = new Map(), masks = new Map()
  need(nodes.length <= 25000, 'native node budget exceeded')
  for (const node of nodes) for (const child of children(node)) parents.set(child, node)
  for (const style of styles) {
    for (const block of style.css.matchAll(mediaRules)) {
      const mask = breakpointMask(block[1])
      if (mask === null) continue
      for (const rule of block[2].matchAll(hidingRule)) masks.set(rule[1], (masks.get(rule[1]) || 0) | mask)
    }
  }
  const variantMask = node => classNames(node).reduce((mask, name) => mask | (masks.get(name) || 0), 0)
  const qualifiedGroup = parent => {
    const variants = children(parent).filter(node => classNames(node).includes('ssr-variant'))
    // Every rendition must be visible in at least one of the actual Framer
    // viewport bands, and exactly one sibling supplies each band. A variant
    // hidden at every width must never become positive native evidence.
    return variants.length >= 2 && variants.every(node => variantMask(node) !== 7)
      && [1, 2, 4].every(band => variants.filter(node => !(variantMask(node) & band)).length === 1)
  }
  const allowed = new Set()
  for (const name of masks.keys()) {
    const users = nodes.filter(node => classNames(node).includes(name))
    if (users.length && users.every(node => classNames(node).includes('ssr-variant') && parents.has(node) && qualifiedGroup(parents.get(node)))) allowed.add(name)
  }
  return styles.map(style => ({ start: style.start, end: style.end,
    text: style.css.replace(mediaRules, (whole, condition, rules) => {
      if (breakpointMask(condition) === null) return whole
      const retained = rules.replace(hidingRule, (rule, name) => allowed.has(name) ? '' : rule)
      return retained.trim() ? '@media' + condition + '{' + retained + '}' : ''
    }),
  }))
}

// Add source offsets only to a derived parse document. Raw scripts, comments,
// template visibility and quoted '>' boundaries retain their HTML semantics.
// Framer's exact breakpoint-only rules describe alternative SSR renditions;
// compare those renditions instead of treating all of them as absent.
function markedDocument(html) {
  const edits = [], offsets = new Map(), divs = [], breakpointStyles = []
  let cursor = 0
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor)
    if (start < 0) break
    if (html.startsWith('<!--', start)) { const end = html.indexOf('-->', start + 4); cursor = end < 0 ? html.length : end + 3; continue }
    const match = /^<(\/?)([a-zA-Z][^\t\n\f\r />]*)/.exec(html.slice(start))
    if (!match) { cursor = start + 1; continue }
    let end = start + match[0].length, quote = null
    for (; end < html.length; end++) {
      const char = html[end]
      if (quote) { if (char === quote) quote = null }
      else if (char === '"' || char === "'") quote = char
      else if (char === '>') break
    }
    need(end < html.length, 'unterminated native element')
    const tag = match[2].toLowerCase(), closing = Boolean(match[1])
    const rawAttributes = html.slice(start + match[0].length, end).replace(/\/$/, '')
    const attrs = Object.fromEntries(readNativeAttributeTokens(rawAttributes).map(([name, value]) => [name, decodeHTML(value)]))
    need(!Object.hasOwn(attrs, marker), 'reserved source marker in publisher document')
    if (tag === 'div') {
      if (closing) { const opened = divs.pop(); if (opened?.content) offsets.set(opened.start, { start: opened.start, innerStart: opened.end, innerEnd: start, end: end + 1 }) }
      else {
        const content = attrs['data-framer-name'] === 'Content' && attrs['data-framer-component-type'] === 'RichTextContainer'
        divs.push({ start, end: end + 1, content })
        if (content) edits.push({ start: end, end, text: ' ' + marker + '="' + start + '"' })
      }
    }
    cursor = end + 1
    if (!closing && ['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext'].includes(tag)) {
      const pattern = new RegExp('</' + tag + '[\\t\\n\\f\\r ]*>', 'ig')
      pattern.lastIndex = cursor
      const close = tag === 'plaintext' ? null : pattern.exec(html)
      const rawEnd = close?.index ?? html.length
      if (tag === 'style' && Object.hasOwn(attrs, 'data-framer-breakpoint-css')) {
        const css = html.slice(cursor, rawEnd)
        breakpointStyles.push({ start: cursor, end: rawEnd, css })
      }
      cursor = close ? pattern.lastIndex : html.length
    }
  }
  edits.push(...qualifiedBreakpointEdits(html, breakpointStyles))
  let marked = html
  for (const edit of edits.sort((a, b) => b.start - a.start)) marked = marked.slice(0, edit.start) + edit.text + marked.slice(edit.end)
  return { marked, offsets }
}

function document(html, canonical, check = () => {}, expectedTitle) {
  check()
  need(typeof html === 'string' && Buffer.byteLength(html) <= 2000000, 'missing or oversized native HTML')
  const annotated = markedDocument(html)
  check()
  const doc = readVisibleNativeDocument(annotated.marked, { strict: true })
  check()
  const nodes = doc.nodes(() => true)
  need(nodes.length <= 25000, 'native node budget exceeded')
  const pageTitle = one(doc.nodes(node => node.tag === 'title'), 'native page title')
  need(norm(decodeHTML(pageTitle.raw)) === expectedTitle, 'native page title differs')
  const parents = new Map()
  for (const node of nodes) for (const child of children(node)) parents.set(child, node)
  const links = doc.nodes(node => node.tag === 'link' && node.attrs.rel?.toLowerCase() === 'canonical')
  need(one(links, 'canonical URL').attrs.href === canonical, 'canonical role URL differs')
  need(!doc.nodes(node => node.tag === 'base').length, 'unreviewed document base URL')
  const og = doc.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url')
  need(og.length === 0 || one(og, 'Open Graph URL').attrs.content === canonical, 'Open Graph URL differs')
  const organizations = []
  const visit = value => {
    need(value && typeof value === 'object', 'malformed Organization JSON data')
    if (Array.isArray(value)) { need(value.length <= 50, 'structured data count budget exceeded'); value.forEach(visit); return }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    if (types.includes('Organization')) organizations.push(value)
    if (value['@graph']) visit(value['@graph'])
  }
  for (const script of doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) visit(JSON.parse(script.raw))
  const organization = one(organizations, 'published Organization')
  need(organization.name === 'Avaamo' && organization.legalName === 'Avaamo, Inc.' && organization.url === 'https://avaamo.ai/', 'employer identity differs')
  check()
  return { doc, parents, organization, offsets: annotated.offsets }
}

export function parseAvaamoListing(html, finalUrl = AVAAMO_CAREERS_URL, { check = () => {} } = {}) {
  need(finalUrl === AVAAMO_CAREERS_URL, 'listing final URL is not the current canonical URL')
  const { doc, parents, organization } = document(html, finalUrl, check, 'Careers at Avaamo')
  const titles = doc.nodes(node => node.tag === 'h1').map(node => norm(doc.text(node)))
  need(titles.length > 0 && titles.every(title => title === 'Work with us'), 'current careers heading differs')
  need(doc.nodes(node => node.tag === 'h2' && /^Active positions$/i.test(doc.text(node))).length === 1, 'missing active positions heading')
  const wrapper = one(doc.nodes(node => node.attrs['data-framer-name'] === 'Career Card Wrapper'), 'native card wrapper')
  const allCards = within(wrapper, node => node.attrs.name === 'Career Card')
  const cards = allCards.filter(node => ['Default', 'Phone'].includes(node.attrs['data-framer-name']))
  need(cards.length > 0 && cards.length <= 1000, 'missing or oversized current native card set')
  need(allCards.every(node => cards.includes(node) || within(node, child => cards.includes(child)).length === 1), 'unsupported native card rendition')
  const records = new Map()
  for (const card of cards) {
    check()
    const title = norm(doc.text(one(within(card, node => node.tag === 'h3'), 'native card title')))
    need(title.length > 0, 'empty native title')
    const link = one(within(card, node => node.tag === 'a' && /^Learn more$/i.test(doc.text(node))), 'native role link')
    const url = new URL(link.attrs.href, finalUrl)
    need(url.origin === 'https://avaamo.ai' && !url.username && !url.password && !url.port && !url.search && !url.hash
      && /^\/career\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname), 'role URL outside public careers scope')
    const field = label => {
      const labelNode = one(within(card, node => node.attrs['data-framer-component-type'] === 'RichTextContainer' && doc.text(node) === label), 'card ' + label + ' label')
      const pair = children(parents.get(labelNode)).filter(node => node.attrs['data-framer-component-type'] === 'RichTextContainer')
      need(pair.length === 2 && pair[0] === labelNode, 'card ' + label + ' value scope differs')
      const value = norm(doc.text(pair[1]))
      need(value.length > 0, 'missing card ' + label + ' value')
      return value
    }
    const record = { title, detailUrl: url.href, location: field('Location'), employmentType: field('Type'), department: field('Team') }
    const prior = records.get(record.detailUrl)
    need(!prior || JSON.stringify(prior) === JSON.stringify(record), 'responsive native card renditions disagree')
    records.set(record.detailUrl, record)
  }
  const links = within(wrapper, node => node.tag === 'a')
  need(links.length === cards.length && links.every(node => /^Learn more$/i.test(doc.text(node))), 'unparsed native listing or pagination link')
  check()
  return { roles: [...records.values()], organization, responsiveCardCount: cards.length, documentSHA256: hash(html), canonicalUrl: finalUrl }
}

const escapedAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const serialize = node => {
  if (typeof node === 'string') return node
  if (node.inert || ['script', 'style', 'template'].includes(node.tag)) return ''
  const attrs = Object.entries(node.attrs).filter(([key]) => key !== marker).map(([key, value]) => ' ' + key + '="' + escapedAttribute(value) + '"').join('')
  return '<' + node.tag + attrs + '>' + node.children.map(serialize).join('') + (['br', 'img', 'hr', 'wbr'].includes(node.tag) ? '' : '</' + node.tag + '>')
}

export function parseAvaamoDetail(html, listing, { check = () => {} } = {}) {
  const { doc, organization, offsets } = document(html, listing.detailUrl, check, listing.title + ' | Careers at Avaamo')
  const header = one(doc.nodes(node => node.attrs['data-framer-name'] === 'Header' && within(node, child => child.tag === 'h1').length > 0), 'native role header')
  const titles = within(header, node => node.tag === 'h1').map(node => norm(doc.text(node)))
  need(titles.length > 0 && titles.every(title => title === listing.title), 'listing/detail title or responsive headings disagree')
  const meta = one(within(header, node => node.attrs['data-framer-name'] === 'Meta'), 'native detail metadata')
  const field = name => norm(doc.text(one(within(meta, node => node.attrs['data-framer-component-type'] === 'RichTextContainer' && node.attrs['data-framer-name'] === name), 'detail ' + name)))
  const metadata = { department: field('Team'), location: field('Location'), employmentType: field('Type') }
  need(Object.entries(metadata).every(([key, value]) => value === listing[key]), 'listing/detail native metadata differs')
  const content = one(doc.nodes(node => node.attrs['data-framer-name'] === 'Content' && node.attrs['data-framer-component-type'] === 'RichTextContainer'), 'active authored role Content')
  const offset = offsets.get(Number(content.attrs[marker]))
  need(offset, 'authored Content source boundary is unqualified')
  const sourceDescriptionHtml = content.children.map(serialize).join('')
  const sections = []
  let section = { heading: null, nodes: [] }
  for (const node of children(content)) {
    if (/^h[2-6]$/.test(node.tag)) {
      if (section.heading || section.nodes.length) sections.push(section)
      section = { heading: norm(doc.text(node)), nodes: [] }
    } else section.nodes.push(node)
  }
  if (section.heading || section.nodes.length) sections.push(section)
  const sourceSections = sections.map(section => ({ heading: section.heading, html: section.nodes.map(serialize).join(''), text: section.nodes.map(node => doc.text(node)).join('\n\n') }))
  const sourceDescription = sourceSections.map(section => [section.heading, section.text].filter(Boolean).join('\n\n')).join('\n\n')
  const requirements = sourceSections.filter(section => /^(?:(?:minimum|preferred|basic|essential|desired)\s+)?(?:qualifications|requirements|skills)|^(?:non-technical|technical) skills/i.test(section.heading || ''))
  const criteria = sourceSections.filter(section => !/^About Avaamo$/i.test(section.heading || ''))
    .map(section => section.text.replace(/^Location:[^\n]*(?:\n|$)/i, '')).join('\n')
  const hasCriteria = criteria.length >= 160 && requirements.some(section => section.text.length >= 40 && extractActiveDescription(section.html))
  const applies = doc.nodes(node => node.tag === 'a' && node.attrs['data-framer-name'] === 'Apply now' && /^Apply now\b/i.test(doc.text(node))).map(node => node.attrs.href)
  need(applies.length > 0 && new Set(applies).size === 1 && /^mailto:[^\s<>]+@(?:avaamo\.ai|avaamo\.com)(?:\?[^\s<>]*)?$/i.test(applies[0]), 'native public apply handoff missing or ambiguous')
  const blocks = children(content).map(node => doc.text(node))
  const closedNotice = findExplicitNativeClosure(blocks)
  check()
  return { ...metadata, title: listing.title, organization, sourceDescription, sourceDescriptionHtml, sourceSections,
    rawContentHtml: html.slice(offset.innerStart, offset.innerEnd), contentSourceOffsets: offset, documentSHA256: hash(html),
    sourceDetailComplete: Boolean(hasCriteria && !closedNotice), sourceDetailFailureKind: closedNotice ? 'native-role-closed' : hasCriteria ? null : 'missing-role-criteria',
    sourceApplicationHandoff: applies[0], closedNotice,
  }
}

// Country fields come only from explicit native country text, never from cities,
// travel destinations, company addresses or the request's server country header.
export function explicitAvaamoCountry(location) {
  const value = norm(location).replace(/\s*\((?:remote|hybrid|on-site)\)\s*$/i, '')
  if (/^IND$/i.test(value)) return 'India'
  if (/^(?:United States(?: of America)?|USA|U\.S\.)$/i.test(value) || /,\s*United States(?: of America)?$/i.test(value)) return 'United States'
  return nativeLocationCountryName(value)
}
