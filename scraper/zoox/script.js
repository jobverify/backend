import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName, nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zoox'
export const COMPANY = 'Zoox'
export const OFFICIAL_CAREERS_URL = 'https://zoox.com/careers'
export const BOARD_URL = 'https://jobs.lever.co/zoox'
// Current careers bundle is linked directly from the official careers HTML.
export const OFFICIAL_CLIENT_URL = 'https://zoox.com/_next/static/chunks/pages/careers-f5d415fc3e2c5db9.js'
export const API_URL = 'https://api.lever.co/v0/postings/zoox'
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const requireInventory = (condition, reason) => { if (!condition) throw new Error(`Zoox native inventory: ${reason}`) }
const text = value => typeof value === 'string' && value.trim() !== ''
const unbounded = /^(?:remote|global|worldwide|anywhere)$/i
const indiaLabel = label => text(label) && !unbounded.test(norm(label)) && isIndiaJob({ location: norm(label) })
const US_STATE_SUFFIX = /,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/
const explicitLocationCountry = label => nativeLocationCountryName(label)
  || (/,\s*(?:UK|United Kingdom)$/i.test(label) ? 'United Kingdom' : null)
  || (US_STATE_SUFFIX.test(label) ? 'United States' : null)
const proseText = node => !node || node.inactive || /^(?:h[1-6]|script|style)$/.test(node.tag) ? ''
  : node.children.map(child => typeof child === 'string' ? child : proseText(child)).join(' ')
const activeProseContent = value => {
  if (typeof value !== 'string') return null
  const doc = document(value)
  return extractActiveDescription(proseText(doc.root)) ? extractActiveDescription(value) : null
}

const scopeLocations = record => {
  const category = record.categories
  requireInventory(category && typeof category === 'object' && !Array.isArray(category)
    && text(category.location), 'missing primary location')
  requireInventory(record.country == null || typeof record.country === 'string' && /^[A-Z]{2}$/.test(record.country), 'malformed native country')
  const country = nativeCountryName(record.country)
  const primary = norm(category.location)
  const supplied = category.allLocations
  requireInventory(supplied == null || Array.isArray(supplied) && supplied.every(text), 'malformed secondary location inventory')
  requireInventory(!supplied?.length || supplied.map(norm).includes(primary), 'primary location absent from secondary inventory')
  let complete = Boolean(country && supplied?.length)
  const india = []
  for (const label of [...new Set([primary, ...(supplied || []).map(norm)])]) {
    const explicitCountry = explicitLocationCountry(label)
    const isIndia = indiaLabel(label)
    requireInventory(!(isIndia && explicitCountry && explicitCountry !== 'India'), 'contradictory native location geography')
    if (label === primary && country) {
      requireInventory(!(isIndia && country !== 'India') && !(explicitCountry && explicitCountry !== country), 'contradictory primary country/location')
    }
    if (isIndia || label === primary && country === 'India') india.push(unbounded.test(label) ? 'Remote, India' : /\bIndia\b/i.test(label) ? label : `${label}, India`)
    if (unbounded.test(label)) complete = false
    else if (label !== primary && !isIndia && !explicitCountry) complete = false
    else if (!country && !explicitCountry && !isIndia) complete = false
  }
  return { india, complete }
}

const validateRecord = (record, identities, checkedAt) => {
  requireInventory(record && UUID.test(record.id) && text(record.text) && !identities.has(record.id), 'invalid or duplicate native identity')
  identities.add(record.id)
  requireInventory(record.hostedUrl === `${BOARD_URL}/${record.id}` && record.applyUrl === `${BOARD_URL}/${record.id}/apply`, 'foreign application identity')
  for (const field of ['status', 'state', 'publicationStatus']) if (Object.hasOwn(record, field)) requireInventory(record[field] === 'published', 'unsupported publication status')
  for (const field of ['isListed', 'isPublished', 'isActive', 'active', 'published']) if (Object.hasOwn(record, field)) requireInventory(record[field] === true, 'unpublished native role')
  if (Object.hasOwn(record, 'closed')) requireInventory(record.closed === false, 'closed native role')
  for (const field of ['publishedAt', 'postedAt', 'firstPublishedAt', 'first_published']) requireInventory(record[field] == null, 'unverified native publication date contract')
  if (record.createdAt != null) requireInventory(Number.isSafeInteger(record.createdAt) && record.createdAt > 0 && record.createdAt <= checkedAt, 'malformed or future native creation date')
  const publication = nativeDate(record.datePosted)
  requireInventory(!publication.iso || Date.parse(publication.iso) <= checkedAt, 'future publication date')
  for (const field of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'opening', 'openingPlain', 'additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain']) {
    requireInventory(record[field] == null || typeof record[field] === 'string', 'malformed native description field')
  }
  requireInventory(record.lists == null || Array.isArray(record.lists) && record.lists.every(section => section && typeof section === 'object'
    && (section.text == null || typeof section.text === 'string') && (section.content == null || typeof section.content === 'string')), 'malformed native description sections')
  return { record, scope: scopeLocations(record), postingDate: publication.iso }
}

const reconcileBoard = (html, rows) => {
  const doc = document(html)
  for (const tag of ['html', 'body']) {
    const nodes = doc.nodes(node => node.tag === tag)
    requireInventory(nodes.length === 1, 'board page envelope changed'); doc.outer(nodes[0])
  }
  requireInventory(/<title>\s*Zoox\s*<\/title>/.test(html)
    && doc.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url' && node.attrs.content === BOARD_URL).length === 1,
  'bound Lever board identity changed')
  requireInventory(!doc.nodes(node => node.attrs.rel === 'next' || /pagination|load-more/.test(node.attrs['data-controller'] || '')).length, 'board pagination contract changed')
  const postings = doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'posting'))
  const ids = new Set()
  for (const node of postings) {
    doc.outer(node)
    const id = node.attrs['data-qa-posting-id'], original = rows.find(row => row.record.id === id)?.record
    requireInventory(UUID.test(id || '') && original && !ids.has(id), 'board and API inventory identities differ')
    ids.add(id)
    const names = doc.nodes(child => child.attrs['data-qa'] === 'posting-name', node)
    const locations = doc.nodes(child => doc.hasClass(child, 'location'), node)
    const links = doc.nodes(child => child.tag === 'a' && doc.hasClass(child, 'posting-title'), node)
    requireInventory(names.length === 1 && doc.text(names[0]) === norm(original.text)
      && locations.length === 1 && doc.text(locations[0]) === (original.categories.allLocations || [original.categories.location]).map(norm).join(' / ')
      && links.length === 1 && links[0].attrs.href === original.hostedUrl, 'board title, location or application identity disagrees with API')
  }
  requireInventory(postings.length === rows.length && ids.size === rows.length, 'board and terminal API inventory counts disagree')
  requireInventory(rows.length > 0, 'empty board needs a verified native empty-state contract')
}

const mapJob = ({ record, scope, postingDate }) => {
  const activeFirst = (...values) => values.map(activeProseContent).find(Boolean) || null
  const body = activeFirst(record.descriptionBodyPlain, record.descriptionBody)
  const combined = activeFirst(record.descriptionPlain, record.description)
  const sections = (record.lists || []).map(section => {
      const content = activeProseContent(section.content)
      return content ? [extractActiveDescription(section.text), content].filter(Boolean).join('\n') : null
    }).filter(Boolean)
  const hasRoleContent = Boolean(body || combined || sections.length)
  const description = hasRoleContent ? [body ? activeFirst(record.openingPlain, record.opening) : null,
    body || combined, ...sections,
    activeFirst(record.additionalPlain, record.additional), activeFirst(record.salaryDescriptionPlain, record.salaryDescription)]
    .filter(Boolean).join('\n\n') || null : null
  const cities = scope.india.map(label => label.replace(/, India$/i, '')).filter(label => !/^(?:India|Remote)$/i.test(label))
  return { title: norm(record.text), company: COMPANY, source: SOURCE, jobId: record.id, requisitionId: record.id,
    sourceUrl: record.hostedUrl, applyUrl: record.applyUrl, link: record.applyUrl,
    country: 'India', location: scope.india.join('; '), locations: scope.india, city: cities.length === 1 ? cities[0] : null,
    department: record.categories.department || record.categories.team || null, employmentType: record.categories.commitment || null,
    remoteStatus: ({ onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' })[record.workplaceType] || null,
    postingDate, nativeCreatedAt: record.createdAt ?? null, closingDate: null,
    jobDescription: description, sourceDescription: description, requiredSkills: [],
    experienceRequired: null, minimumQualification: null, preferredQualification: null,
  }
}

const defaultRead = async (url, { signal, json = false } = {}) => {
  const response = await fetch(url, { signal, headers: { Accept: json ? 'application/json' : '*/*', 'User-Agent': 'Mozilla/5.0' } })
  requireInventory(response.status === 200 && response.url === url, 'source HTTP failure or redirect identity changed')
  const body = await response.text()
  requireInventory(body.length <= 8 * 1024 * 1024, 'source response exceeds request bound')
  return json ? JSON.parse(body) : body
}

export const createZooxScraper = () => ({
  async run({ fetchText = defaultRead, fetchJson = (url, options) => defaultRead(url, { ...options, json: true }), signal, timeoutMs = 120000, maxPages = 20 } = {}) {
    requireInventory(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000 && Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 100, 'invalid source request budget')
    signal?.throwIfAborted()
    const deadline = new AbortController(), combined = composeAbortSignals(signal, deadline.signal)
    const timer = setTimeout(() => deadline.abort(new Error('Zoox source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => { onAbort = () => reject(combined.reason); combined.addEventListener('abort', onAbort, { once: true }) })
    try {
      const collect = async () => {
        const getText = async url => { combined.throwIfAborted(); const result = await fetchText(url, { signal: combined }); combined.throwIfAborted(); requireInventory(typeof result === 'string', 'source text unavailable'); return result }
        const home = await getText(OFFICIAL_CAREERS_URL)
        requireInventory(/<title[^>]*>Careers at Zoox<\/title>/i.test(home), 'official homepage identity changed')
        const homeDoc = document(home)
        for (const tag of ['html', 'body']) {
          const nodes = homeDoc.nodes(node => node.tag === tag)
          requireInventory(nodes.length === 1, 'current careers envelope changed')
          homeDoc.outer(nodes[0])
        }
        requireInventory(homeDoc.nodes(node => node.tag === 'script' && node.attrs.src
          && new URL(node.attrs.src, OFFICIAL_CAREERS_URL).href === OFFICIAL_CLIENT_URL).length === 1,
        'current careers client asset binding changed')
        const client = await getText(OFFICIAL_CLIENT_URL)
        requireInventory(client.includes('"https://api.lever.co/v0/postings/zoox?limit=999"'), 'official client Lever API binding changed')
        const rows = [], identities = new Set(), checkedAt = Date.now()
        let pagesFetched = 0, terminal = false
        for (let page = 0; page < maxPages; page++) {
          combined.throwIfAborted()
          const response = await fetchJson(`${API_URL}?mode=json&skip=${page * 100}&limit=100`, { signal: combined })
          combined.throwIfAborted()
          requireInventory(Array.isArray(response) && response.length <= 100, 'invalid Lever inventory envelope or pagination')
          pagesFetched++
          rows.push(...response.map(record => validateRecord(record, identities, checkedAt)))
          if (response.length < 100) { terminal = true; break }
        }
        requireInventory(terminal, 'pagination limit leaves incomplete inventory')
        reconcileBoard(await getText(BOARD_URL), rows)
        const jobs = rows.filter(row => row.scope.india.length).map(mapJob)
        const scopeComplete = rows.every(row => row.scope.complete), contentComplete = jobs.every(job => job.jobDescription)
        const complete = scopeComplete && contentComplete
        for (const job of jobs) job.sourceListingComplete = complete
        return attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: API_URL,
          firstParty: true, listingComplete: complete, pagesFetched, reportedTotal: rows.length,
          indiaFacetCount: scopeComplete ? jobs.length : null, verifiedAt: new Date().toISOString(),
          reason: complete ? 'official-client-binding-terminal-lever-pages-and-public-board-reconciled' : !scopeComplete ? 'native-secondary-location-scope-unresolved' : 'selected-role-description-unavailable',
        })
      }
      return await Promise.race([collect(), aborted])
    } finally { clearTimeout(timer); combined.removeEventListener('abort', onAbort) }
  },
})

export const run = async (options = {}) => createZooxScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/zoox/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
