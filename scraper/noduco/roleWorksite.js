import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { parseExpressionAt } from 'acorn'

const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const fail = message => Object.assign(new Error('Noduco native ' + message), { abortRetries: true, incompleteScope: true })
const children = node => node.children.filter(child => typeof child !== 'string')
const descendants = (node, predicate) => [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => descendants(child, predicate))]
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const recognizedCountry = value => typeof value === 'string' && /^[a-z]{2}$/i.test(value)
  && !['ZZ', 'EU', 'EZ', 'UN', 'XA', 'XB', 'QO'].includes(value.toUpperCase()) && regions.of(value.toUpperCase()) !== value.toUpperCase()
const jobUrl = value => {
  try {
    const url = new URL(value)
    return url.origin === 'https://noduco.com' && !url.username && !url.password && !url.search && !url.hash
      && /^\/careers\/\d+\/$/.test(url.pathname) ? url.href : null
  } catch { return null }
}
const unknown = { location: null, city: null, country: null }

// JSON.parse alone keeps the last duplicate key. Validate the inert JSON syntax
// tree first so a supplied contradictory title/company/country cannot disappear.
// JSON.parse still enforces the strict JSON grammar; no native script executes.
const parseSchema = source => {
  const value = JSON.parse(source)
  const uniqueKeys = node => {
    if (node.type === 'ObjectExpression') {
      const keys = new Set()
      for (const property of node.properties) {
        const key = property.key.value
        if (keys.has(key)) throw fail('JobPosting schema duplicate field')
        keys.add(key); uniqueKeys(property.value)
      }
    } else if (node.type === 'ArrayExpression') node.elements.forEach(uniqueKeys)
  }
  uniqueKeys(parseExpressionAt(source, 0, { ecmaVersion: 'latest' }))
  return value
}

export const visibleNoducoRoleIds = html => {
  const document = readVisibleNativeDocument(html, { strict: true })
  return new Set(document.nodes(node => hasClass(node, 'job-card')).flatMap(card =>
    descendants(card, node => node.tag === 'a').map(node => node.attrs.href?.match(/^\/careers\/(\d+)\/$/)?.[1]).filter(Boolean)))
}

export const readNoducoRoleWorksite = (html, listing, summary) => {
  const document = readVisibleNativeDocument(html, { strict: true })
  const expected = jobUrl(listing.sourceUrl)
  const headings = document.nodes(node => node.tag === 'h1' && hasClass(node, 'job-title-display'))
  if (!expected || headings.length !== 1 || norm(document.text(headings[0])) !== norm(listing.title)) throw fail('role title/URL identity mismatch')
  const canonical = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical').map(node => node.attrs.href)
  const publicUrls = document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url').map(node => node.attrs.content)
  if ([...canonical, ...publicUrls].some(value => jobUrl(value) !== expected)) throw fail('canonical role URL identity mismatch')
  const scripts = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
  const postings = []
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (value['@type'] === 'JobPosting') postings.push(value)
    if (Array.isArray(value['@graph'])) value['@graph'].forEach(visit)
  }
  for (const script of scripts) {
    try { visit(parseSchema(script.raw)) } catch { throw fail('JobPosting schema malformed or duplicate field') }
  }
  if (postings.length > 1) throw fail('JobPosting schema ambiguous')
  const visibleCriteria = document.nodes(node => node.tag === 'ul' && hasClass(node, 'job-section-list'))
    .some(node => Boolean(extractActiveDescription(document.text(node))))
  const parents = new Map(), index = node => { for (const child of children(node)) { parents.set(child, node); index(child) } }
  document.nodes(node => node.tag === 'root').forEach(index)
  const visibleContent = { summary: document.nodes(node => node.tag === 'p' && hasClass(node, 'job-section-text'))
    .map(node => document.text(node)).find(Boolean) || null,
    sections: document.nodes(node => node.tag === 'ul' && hasClass(node, 'job-section-list')).flatMap(node => {
      const siblings = children(parents.get(node)), heading = siblings[siblings.indexOf(node) - 1]
      if (!heading || heading.tag !== 'h3' || !hasClass(heading, 'job-section-title') || !document.text(heading)) return []
      const items = children(node).filter(child => child.tag === 'li').map(child => document.text(child)).filter(Boolean)
      return items.length ? [{ title: document.text(heading), items }] : []
    }) }
  if (!postings.length) return { ...unknown, visibleCriteria, visibleContent }
  const [schema] = postings, organization = schema.hiringOrganization
  if (schema.title != null && norm(schema.title) !== norm(listing.title)) throw fail('schema role title identity mismatch')
  if (organization?.name != null && norm(organization.name) !== 'Noduco') throw fail('schema company identity mismatch')
  if (organization?.sameAs != null) {
    let url
    try { url = new URL(organization.sameAs) } catch { throw fail('schema company domain identity unavailable') }
    if (url.href !== 'https://noduco.com/') throw fail('schema company domain identity mismatch')
  }
  for (const field of ['url', '@id']) if (schema[field] != null && jobUrl(schema[field]) !== expected) throw fail('schema role URL identity mismatch')
  if (schema.identifier != null) {
    const identifier = typeof schema.identifier === 'object' ? schema.identifier.value : schema.identifier
    if (String(identifier) !== String(listing.requisitionId)
      || schema.identifier?.name != null && schema.identifier.name !== 'Noduco') throw fail('schema native requisition identity mismatch')
  }
  if (schema.description != null && norm(schema.description) !== norm(summary)) throw fail('schema description identity mismatch')
  if (canonical.length !== 1 || publicUrls.length !== 1 || !schema.title || organization?.name !== 'Noduco'
    || organization?.sameAs !== 'https://noduco.com') return { ...unknown, visibleCriteria, visibleContent }
  const place = schema.jobLocation, address = place?.address
  if (place?.['@type'] !== 'Place' || address?.['@type'] !== 'PostalAddress') return { ...unknown, visibleCriteria, visibleContent }
  const city = norm(address.addressLocality) || null, state = norm(address.addressRegion) || null
  // Eligibility countries and company/other-role offices never fill this field.
  const country = recognizedCountry(address.addressCountry) ? address.addressCountry : null
  return { city, country, location: [city, state, norm(address.addressCountry)].filter(Boolean).join(', ') || null, visibleCriteria, visibleContent }
}
