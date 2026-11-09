import { activeHead, extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const ORIGIN = 'https://www.appinessworld.com'
const LEGAL = 'Appiness Interactive Pvt. Ltd.'
const requireNative = (value, message) => { if (!value) throw new Error(`Appiness native ${message}`) }
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const elements = node => node.children.filter(child => typeof child !== 'string')
const active = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []), ...elements(node).flatMap(child => active(child, predicate)) ]
const one = (nodes, label) => { requireNative(nodes.length === 1, `${label} is missing or ambiguous`); return nodes[0] }
const exactUrl = (value, expected) => {
  try { const url = new URL(value); return url.href === expected && url.protocol === 'https:' && !url.username && !url.password && !url.port } catch { return false }
}
const detailUrl = value => {
  let url
  try { url = new URL(value) } catch { requireNative(false, 'detail URL is malformed') }
  requireNative(url.origin === ORIGIN && !url.username && !url.password && !url.port && !url.search && !url.hash
    && /^\/careers\/job-details\/[a-z0-9-]+\/$/i.test(url.pathname), 'detail URL leaves the configured employer path')
  return url.href
}
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const extractNativeListings = html => {
  const document = readNativeDocument(html)
  requireNative(activeHead(html).titles.filter(title => title === 'Jobs at Appiness Interactive').length === 1
    && document.nodes(node => node.tag === 'p' && document.text(node) === 'Current Openings').length === 1
    && document.nodes(node => node.tag === 'p' && document.hasClass(node, 'location-text')
      && norm(node.children.find(child => typeof child === 'string')) === LEGAL).length === 1,
  'official listing employer identity changed')
  const container = one(document.nodes(node => node.attrs.id === 'jobs-list-appy'), 'listing container')
  const cards = active(container, node => node.tag === 'div' && document.hasClass(node, 'job-container'))
  requireNative(cards.length > 0 && cards.length <= 100, 'listing role inventory is missing or exceeds the bounded100-role limit')
  const identities = new Set(), links = new Set(), publicIds = new Set()
  return cards.map(card => {
    const nativeId = card.attrs['data-job-id']
    requireNative(/^[1-9]\d*$/.test(nativeId || '') && Number.isSafeInteger(Number(nativeId)), 'listing native role ID is missing')
    const fields = active(card, node => node.tag === 'p' && elements(node).some(child => child.tag === 'span' && document.hasClass(child, 'job-list')))
    const field = label => {
      const paragraph = one(fields.filter(node => elements(node).some(child => child.tag === 'span' && document.text(child) === label)), label)
      const value = norm(document.text(paragraph).slice(label.length))
      requireNative(value, `listing ${label} is missing`)
      return value
    }
    const title = field('Role'), experienceRequired = field('Experience'), city = field('Location')
    const anchor = one(active(card, node => node.tag === 'a' && document.hasClass(node, 'job-detail-anchor') && document.text(node) === 'Job Details'), 'role detail anchor')
    const url = detailUrl(anchor.attrs.href), jobId = slug(title)
    requireNative(jobId && !identities.has(nativeId) && !links.has(url) && !publicIds.has(jobId), 'listing role identity repeats')
    identities.add(nativeId); links.add(url); publicIds.add(jobId)
    return { title, company: 'Appiness Interactive', department: null, location: city, city,
      jobId, requisitionId: jobId, sourceNativeJobId: nativeId, sourceNativeLocation: city,
      sourceUrl: url, applyUrl: url, employmentType: null, experienceRequired,
      minimumQualification: null, preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null,
    }
  })
}

// The native publisher emits literal CR/LF in ten quoted description fields.
// Escape only control characters inside JSON strings, then require strict JSON.
const parseSchema = value => {
  let output = '', quoted = false, escaped = false
  for (const character of value) {
    if (quoted && character.charCodeAt(0) < 32) {
      requireNative(!escaped, 'JobPosting contains an unsupported escaped control character')
      output += JSON.stringify(character).slice(1, -1); continue
    }
    output += character
    if (escaped) { escaped = false; continue }
    if (quoted && character === '\\') { escaped = true; continue }
    if (character === '"') quoted = !quoted
  }
  try { return JSON.parse(output) } catch { requireNative(false, 'JobPosting JSON is malformed') }
}
const calendar = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  requireNative(match, 'publication date is missing or malformed')
  const [, year, month, day] = match.map(Number), date = new Date(Date.UTC(year, month - 1, day))
  requireNative(date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day, 'publication calendar date is invalid')
  return value
}
const schemaTitles = new Map([
  ['4', ['SEO Expert', 'SEO Expert | SEO Jobs']], ['5', ['Python Developer', 'Python Developer Job']],
  ['6', ['Digital Sales Manager', 'Digital Sales Manager | Digital Sales Manager Job']],
  ['10', ['MERN Stack Developer', 'MERN Stack Developer Jobs | MERN Stack Jobs']],
  ['11', ['Account Manager', 'Account Manager Jobs | Key Account Manager Jobs']],
  ['12', ['React Developer', 'React Developer Jobs in Bangalore']],
  ['19', ['Project Manager | Scrum Master', 'Project Manager Jobs | Scrum Master Job']],
  ['21', ['Talent Acquisition Executive', 'Talent Acquisition Job | Appiness']],
])
const attr = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')
const voids = new Set(['br', 'hr', 'img', 'input', 'source', 'wbr'])
const render = node => {
  if (typeof node === 'string') return node
  if (node.inert || node.tag === 'script' || node.attrs.id === 'myBtnjobs') return ''
  return `<${node.tag}${Object.entries(node.attrs).map(([key, value]) => ` ${key}="${attr(value)}"`).join('')}>${node.children.map(render).join('')}${voids.has(node.tag) ? '' : `</${node.tag}>`}`
}

// This is intentional hidden form metadata, not hidden description content.
// Only the one role Apply control can activate the observed modal. Descendants
// inherit display:none; their own hidden/inert/template wrappers remain invalid.
const modalMetadata = (main, document) => {
  const modals = node => node.attrs.id === 'myModaljobs' ? [node] : node.inert ? [] : elements(node).flatMap(modals)
  const modal = one(modals(main), 'role application modal')
  requireNative(document.hasClass(modal, 'modal') && /^display\s*:\s*none\s*;?$/i.test(norm(modal.attrs.style))
    && !Object.hasOwn(modal.attrs, 'hidden') && !Object.hasOwn(modal.attrs, 'inert')
    && norm(modal.attrs['aria-hidden']).toLowerCase() !== 'true', 'application modal contract changed')
  const metadata = (node, predicate, root = false) => {
    if (!root && (['template', 'script', 'object', 'iframe', 'xmp', 'noscript'].includes(node.tag)
      || Object.hasOwn(node.attrs, 'hidden') || Object.hasOwn(node.attrs, 'inert')
      || node.attrs['aria-hidden']?.toLowerCase() === 'true'
      || /display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden/i.test((node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '')))) return []
    return [...(predicate(node) ? [node] : []), ...elements(node).flatMap(child => metadata(child, predicate))]
  }
  const form = one(metadata(modal, node => node.tag === 'form' && node.attrs.id === 'jobApplicationForm', true), 'native role application form')
  return one(metadata(form, node => node.tag === 'input' && node.attrs.id === 'job-id' && node.attrs.type === 'hidden'), 'native role form ID').attrs.value
}

export const extractNativeDetail = (html, listing, { url = listing.sourceUrl } = {}) => {
  requireNative(exactUrl(url, listing.sourceUrl), 'detail response URL conflicts with listing')
  const document = readNativeDocument(html)
  const canonical = one(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'canonical role URL')
  requireNative(exactUrl(canonical.attrs.href, listing.sourceUrl), 'canonical role URL conflicts with listing')
  const main = one(document.nodes(node => node.tag === 'main' && document.hasClass(node, 'careers-inner-main')), 'active role main')
  requireNative(document.text(one(active(main, node => node.tag === 'h1'), 'role title')) === listing.title, 'detail title conflicts with listing')
  const labels = active(main, node => node.tag === 'p' && document.hasClass(node, 'loc-display'))
  const label = prefix => document.text(one(elements(one(labels.filter(node => document.text(node).startsWith(prefix)), prefix)).filter(node => node.tag === 'span'), prefix + ' value'))
  requireNative(label('Location:') === listing.sourceNativeLocation && label('Required Experience:') === listing.experienceRequired, 'detail role location or experience conflicts with listing')
  const apply = one(active(main, node => node.attrs.id === 'myBtnjobs'), 'role Apply control')
  requireNative(apply.attrs.onclick === 'openJobModal()' && document.text(apply) === 'Apply'
    && document.nodes(node => node.tag === 'script' && exactUrl(node.attrs.src, `${ORIGIN}/assets/js/job-detalis-inner.min.js`)).length === 1
    && modalMetadata(main, document) === listing.sourceNativeJobId, 'native form role identity conflicts with listing')
  const schemas = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json').map(node => parseSchema(node.raw))
  const posting = one(schemas.filter(value => value?.['@type'] === 'JobPosting'), 'native JobPosting')
  requireNative(posting.hiringOrganization?.['@type'] === 'Organization' && posting.hiringOrganization.name === 'Appiness World'
    && ['https://appinessworld.com/', `${ORIGIN}/`].includes(posting.hiringOrganization.sameAs), 'JobPosting employer identity conflicts with official legal branding')
  const titleAlias = schemaTitles.get(listing.sourceNativeJobId)
  requireNative(typeof posting.title === 'string' && posting.title
    && (posting.title === listing.title || (titleAlias?.[0] === listing.title && titleAlias[1] === posting.title)), 'JobPosting role title conflicts with listing')
  requireNative(posting.jobLocation?.address?.addressCountry === 'India', 'JobPosting explicit India country is missing or conflicting')
  const postingDate = calendar(posting.datePosted)
  const content = one(active(main, node => node.tag === 'div' && document.hasClass(node, 'job-inner-content')), 'active job content')
  const introduction = one(active(content, node => node.tag === 'div' && document.hasClass(node, 'job-title')), 'description introduction')
  requireNative(extractActiveDescription(introduction.children.filter(node => typeof node === 'string' || node.tag !== 'h2').map(render).join('')), 'published role description is missing')
  const jobDescriptionHtml = content.children.map(render).join(''), description = extractActiveDescription(jobDescriptionHtml)
  requireNative(description, 'published role content is missing')
  const remote = /^remote$/i.test(listing.sourceNativeLocation)
  return { ...listing, location: `${listing.sourceNativeLocation}, India`, city: remote ? null : listing.city,
    country: 'India', remoteStatus: remote ? 'Remote' : 'On-site', postingDate,
    sourceNativePostingDate: postingDate, sourceNativeSchemaTitle: posting.title,
    jobDescription: description, sourceDescription: description, jobDescriptionHtml, sourceDetailComplete: true,
  }
}
