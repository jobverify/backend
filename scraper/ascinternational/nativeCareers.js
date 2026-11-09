import { createHash } from 'node:crypto'
import { readNativeDocument, activeIframeSources, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

const normalize = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const fail = message => { throw new Error(`ASC native careers inventory: ${message}`) }
const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]
const one = (values, name) => { if (values.length !== 1) fail(`expected one ${name}`); return values[0] }
const flatten = value => Array.isArray(value) ? value.flatMap(flatten)
  : value && typeof value === 'object' ? [value, ...flatten(value['@graph'] || [])] : []
const postings = value => flatten(value).filter(row => (Array.isArray(row['@type']) ? row['@type'] : [row['@type']]).includes('JobPosting'))
const countryNames = new Map(), display = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = display.of(code)
  if (name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    countryNames.set(code.toLowerCase(), { code, name })
    countryNames.set(name.toLowerCase(), { code, name })
  }
}
const country = value => countryNames.get(normalize(typeof value === 'object' ? value?.name : value).toLowerCase()) || null
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const unknownGeography = (value, allowed) => value && typeof value === 'object'
  && Object.entries(value).some(([key, field]) => /country|countries|location|region|geograph|address|territor|continent|latitude|longitude/i.test(key)
    && !allowed.includes(key) && field != null && (!Array.isArray(field) || field.length > 0))
const RECRUITING_HOST = /(?:^|\.)(?:greenhouse\.io|ashbyhq\.com|lever\.co|myworkdayjobs\.com|myworkdaysite\.com|smartrecruiters\.com|workable\.com|icims\.com|successfactors\.com|successfactors\.eu|taleo\.net|jobs2web\.com|teamtailor\.com|personio\.com|bamboohr\.com|freshteam\.com|applytojob\.com|breezy\.hr|recruitee\.com|jobvite\.com)$/i
const ROLE_LOCATION_STATEMENT = /\b(?:(?:additional|alternate|other|secondary|eligible|preferred)\s+)?(?:(?:work|working)\s+)?(?:locations?|worksites?|countr(?:y|ies)|regions?)\s*:/i
export const hasAscStructuredCareers = html => /["']JobPosting["']/.test(html)
export const assertAscCareersResponse = page => {
  let url
  try { url = new URL(page?.url) } catch { fail('response URL unavailable') }
  if (page.status !== 200 || url.protocol !== 'https:' || url.hostname !== 'ascinternational.com'
    || url.username || url.password || url.port || url.search || url.hash
    || url.pathname.replace(/\/+$/, '') !== '/careers' || typeof page.html !== 'string' || !page.html.trim()) {
    fail('response does not match the pinned first-party careers route')
  }
}

// Reconcile the complete visible opening section with the active native
// JobPosting records. Footer addresses never supply a vacancy's country.
export const inspectAscCareers = html => {
  const document = readNativeDocument(html), reasons = new Set()
  const canonical = one(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'canonical careers URL')
  assertAscCareersResponse({ status: 200, url: canonical.attrs.href, html })
  const sections = document.nodes(node => node.tag === 'section')
  const opening = one(sections.filter(node => descendants(node, child => child.tag === 'h2'
    && document.text(child) === 'Current Openings').length), 'current opening section')
  const cards = descendants(opening, node => node.tag === 'div' && document.hasClass(node, 'bg-dark-card')
    && document.hasClass(node, 'rounded-2xl'))
  const headingCount = descendants(opening, node => node.tag === 'h3').length
  const native = []
  for (const node of document.nodes(node => node.tag === 'script' && /^application\/ld\+json$/i.test(node.attrs.type || ''))) {
    let parsed
    try { parsed = JSON.parse(node.raw) } catch { fail('invalid active structured role JSON') }
    native.push(...postings(parsed))
  }
  if (!cards.length || cards.length !== native.length || headingCount !== native.length) fail('visible and structured role counts differ')
  const ids = new Set(), matched = new Set(), jobs = []
  for (const card of cards) {
    const header = one(descendants(card, node => node.tag === 'h3'), 'role title')
    const title = document.text(header), jobId = slug(title)
    if (!jobId || ids.has(jobId)) fail('missing or repeated role identity')
    ids.add(jobId)
    const row = one(native.filter(row => normalize(row.title) === title), 'matching structured role')
    if (matched.has(row)) fail('repeated structured role identity')
    matched.add(row)
    if (!/^ASC International(?:,? Inc\.?)?$/i.test(normalize(row.hiringOrganization?.name))) fail('foreign hiring organization')
    if (!extractActiveDescription(row.description)) fail('native role description unavailable')
    const criteria = descendants(card, node => node.tag === 'h4').map(node => document.text(node))
    if (criteria.length !== 2 || !criteria.includes('Key Responsibilities') || !criteria.includes('Required Qualifications')
      || descendants(card, node => node.tag === 'li').length < 2) fail('complete visible role criteria unavailable')
    for (const name of criteria) {
      const group = one(descendants(card, node => node.tag === 'div' && node.children.some(child => typeof child !== 'string'
        && child.tag === 'h4' && document.text(child) === name)), 'visible criteria group')
      const list = one(group.children.filter(child => typeof child !== 'string' && child.tag === 'ul' && !child.inert), 'visible criteria list')
      if (!descendants(list, node => node.tag === 'li' && document.text(node)).length) fail('visible criteria list is empty')
    }
    const jobDescription = document.text(card)
    if (ROLE_LOCATION_STATEMENT.test(jobDescription) || ROLE_LOCATION_STATEMENT.test(extractActiveDescription(row.description))) {
      reasons.add('additional-role-location-scope-unresolved')
    }
    const places = Array.isArray(row.jobLocation) ? row.jobLocation : [row.jobLocation]
    if (places.length !== 1 || !places[0]?.address || typeof places[0].address !== 'object') fail('unreviewed role worksite inventory')
    const address = places[0].address, city = normalize(address.addressLocality), region = normalize(address.addressRegion)
    const scope = country(address.addressCountry)
    const cardHeader = one(card.children.filter(node => typeof node !== 'string' && descendants(node, child => child === header).length), 'role location header')
    const headerText = document.text(cardHeader)
    if (!city || !region || !headerText.toLowerCase().includes(`${city}, ${region}`.toLowerCase())) fail('native worksite does not match the visible role')
    const locationLabels = descendants(cardHeader, node => node.tag === 'span').map(node => document.text(node))
      .filter(value => value !== 'Full-Time' && !/^~?\d+% Domestic Travel$/.test(value))
    if (locationLabels.length !== 1 || locationLabels[0].replace(/\s*\(HQ\)$/, '').toLowerCase() !== `${city}, ${region}`.toLowerCase()) {
      reasons.add('additional-role-location-scope-unresolved')
    }
    if (unknownGeography(places[0], ['address'])
      || unknownGeography(address, ['addressCountry', 'addressLocality', 'addressRegion', 'streetAddress', 'postalCode'])
      || unknownGeography(address.addressCountry, [])) reasons.add('additional-role-location-scope-unresolved')
    if (!scope) reasons.add('role-country-unresolved')
    if (row.applicantLocationRequirements != null || /global|worldwide|anywhere/i.test(headerText)) reasons.add('additional-role-location-scope-unresolved')
    for (const key of Object.keys(row)) {
      if (/location|country|countries|region|geograph|address/i.test(key)
        && !['jobLocation', 'applicantLocationRequirements'].includes(key) && row[key] != null) reasons.add('additional-role-location-scope-unresolved')
    }
    jobs.push({ title, company: 'ASC International', jobId, requisitionId: jobId,
      location: [city, region, scope?.name].filter(Boolean).join(', '), city, country: scope?.name || null,
      sourceUrl: 'https://ascinternational.com/careers/', applyUrl: 'https://ascinternational.com/careers/',
      employmentType: row.employmentType === 'FULL_TIME' ? 'Full-time' : null,
      jobDescription, postingDate: null, closingDate: null, sourceDetailComplete: true,
    })
  }
  const hiringActions = []
  for (const node of document.nodes(node => node.tag === 'a' && node.attrs.href)) {
    let url
    try { url = new URL(node.attrs.href, canonical.attrs.href) } catch { continue }
    if (!RECRUITING_HOST.test(url.hostname)
      && !/career|job|apply|resume|open.{0,2}(?:role|position)/i.test(`${document.text(node)} ${url.pathname}`)) continue
    hiringActions.push(url.href)
    if (url.protocol === 'mailto:' && /@ascinternational\.com$/i.test(url.pathname)) continue
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && url.hostname === 'ascinternational.com'
      && url.pathname.replace(/\/+$/, '') === '/careers' && !url.search) continue
    reasons.add('additional-hiring-surface-unresolved')
  }
  if (activeIframeSources(html).length || document.nodes(node => node.tag === 'form').length
    || document.nodes(node => node.tag === 'script' && /greenhouse|ashbyhq|lever\.co|workday|applytojob|smartrecruiters/.test(node.attrs.src || '')).length) {
    reasons.add('additional-hiring-surface-unresolved')
  }
  const signature = createHash('sha256').update(JSON.stringify({ native, criteria: jobs.map(job => job.jobDescription), hiringActions: hiringActions.sort() })).digest('hex')
  return { jobs, reasons: [...reasons], signature, nativeCount: native.length,
    countryUnknownCount: jobs.filter(job => !job.country).length }
}
