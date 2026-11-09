import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const API = 'https://hire.api.auzmor.com/api/v1/'
const WEBSITE = 'https://auzmor.com/careers/'
const uuid = value => typeof value === 'string' && /^[\da-f]{32}$/.test(value)
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const count = value => Number.isSafeInteger(value) && value >= 0

// This exact passive publisher declaration is read as data, never executed.
const passiveDigest = value => createHash('sha256').update(value).digest('hex')
function hasReviewedInlineLoader(html, doc, widget, scripts) {
  const loaders = scripts.filter(node => !node.attrs.src
    && Object.keys(node.attrs).length === 1 && node.attrs.type === 'text/javascript'
    && passiveDigest(node.raw || '') === '518eadc7049fed854902042465a561f5ac425cab4f5889e3452bd52f787c5f1d')
  if (loaders.length !== 1) return false
  const parents = new Map(), rawNodes = []
  const walk = (node, parent) => {
    if (typeof node === 'string') return
    parents.set(node, parent); rawNodes.push(node)
    for (const child of node.children || []) walk(child, node)
  }
  walk(doc.root, null)
  if (rawNodes.filter(node => node.tag === 'div' && node.attrs.id === 'widget:careers').length !== 1
    || rawNodes.filter(node => node.tag === 'script' && /AUZMOR_HIRE_BASE_(?:URL|API_URL)/.test(node.raw || '')).length !== 1
    || rawNodes.filter(node => node.tag === 'link' && String(node.attrs.rel || '').toLowerCase() === 'canonical').length !== 1) return false
  const canonical = rawNodes.find(node => node.tag === 'link' && String(node.attrs.rel || '').toLowerCase() === 'canonical')
  if (!canonical || passiveDigest(doc.outer(canonical)) !== 'c206a69d36513acc2496e1cf83d858fd528a435afa692f2955738943fb86c01b') return false
  const canonicalAncestry = []
  for (let node = canonical; parents.get(node); node = parents.get(node)) {
    canonicalAncestry.unshift({ tag: node.tag, openingTagSHA256: passiveDigest(html.slice(node.start, node.openEnd)) })
  }
  if (passiveDigest(JSON.stringify(canonicalAncestry)) !== 'a46b9c9c1c5ec41456371f4df4bf0688b16e4b003743882a5e54fc25484c9db4') return false
  const widgetAncestors = new Set()
  for (let node = widget; node; node = parents.get(node)) widgetAncestors.add(node)
  let owner = loaders[0]
  while (owner && !widgetAncestors.has(owner)) owner = parents.get(owner)
  if (!owner || passiveDigest(doc.outer(owner)) !== '9e7d44ad93fbaf35a3cbf6c7cd34de6a97452e5e37e165d2551dfa50d030d161') return false
  const ancestry = []
  for (let node = owner; parents.get(node); node = parents.get(node)) {
    ancestry.unshift({ tag: node.tag, openingTagSHA256: passiveDigest(html.slice(node.start, node.openEnd)) })
  }
  return passiveDigest(JSON.stringify(ancestry)) === '80a6b8025fc45d697abfc90a8548215d20aca884c102f6fa6338f2502d98cfbe'
}

export function hasCurrentWidget(html) {
  const doc = document(html)
  const widgets = doc.nodes(node => node.tag === 'div' && node.attrs.id === 'widget:careers')
  const canonicals = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  const scripts = doc.nodes(node => node.tag === 'script')
  const config = key => scripts.flatMap(node => [...String(node.raw || '').matchAll(new RegExp(`window\\.${key}\\s*=\\s*['"]([^'"]+)['"]`, 'g'))].map(match => match[1]))
  const base = config('AUZMOR_HIRE_BASE_URL'), api = config('AUZMOR_HIRE_BASE_API_URL')
  return widgets.length === 1 && widgets[0].attrs.data_org === 'auzmor'
    && widgets[0].attrs.job_view === 'list' && canonicals.length === 1 && canonicals[0].attrs.href === WEBSITE
    && (scripts.filter(node => node.attrs.src === 'https://hire.auzmor.com/widget.js').length === 1
      || hasReviewedInlineLoader(html, doc, widgets[0], scripts))
    && base.length === 1 && base[0] === 'https://hire.auzmor.com/' && api.length === 1 && api[0] === API
}

const country = location => {
  if (/[, ]India$/i.test(location || '')) return 'India'
  if (/[, ]United States$/i.test(location || '')) return 'United States'
  return null
}
const roleIdentity = job => JSON.stringify([job.uuid, norm(job.title), job.state, job.status, job.publishType,
  job.location?.uuid, job.location?.name, job.isRemote, job.department?.uuid || null, job.employmentTypes, job.publishedDate])

function readFilters(filters) {
  if (!Array.isArray(filters?.departments) || !Array.isArray(filters.locations)) throw new Error('Auzmor native filter counts unavailable')
  const departments = new Map(), locations = new Map()
  for (const row of filters.departments) {
    if ((!uuid(row.uuid) && row.uuid !== 'Other') || !count(row.count) || departments.has(row.uuid)) throw new Error('Auzmor native department count invalid')
    departments.set(row.uuid, row.count)
  }
  for (const row of filters.locations) {
    if ((!uuid(row.uuid) && row.uuid !== 'Remote') || !count(row.count) || locations.has(row.uuid)) throw new Error('Auzmor native location count invalid')
    locations.set(row.uuid, row.count)
  }
  const total = [...departments.values()].reduce((a, b) => a + b, 0)
  if (total !== [...locations.values()].reduce((a, b) => a + b, 0)) throw new Error('Auzmor native filter inventory totals disagree')
  return { departments, locations, total }
}

async function readInventory(json, filters, { maxPages = Infinity } = {}) {
  const jobs = [], groups = new Set(), identities = new Map(), locationCounts = new Map()
  let offset = 0, totalGroups = null, pagesFetched = 0
  do {
    if (pagesFetched >= maxPages) return { jobs, identities, complete: false, pagesFetched }
    const body = await json(`${API}careers/auzmor/groupByDepartment?limit=100&offset=${offset}`)
    pagesFetched++
    const p = body?.pagination
    if (!Array.isArray(body?.data) || !count(p?.totalItems) || p.filterItems !== p.totalItems
      || p.offset !== offset || p.limit !== 100 || body.data.length > 100
      || (totalGroups !== null && p.totalItems !== totalGroups)) throw new Error('Auzmor native inventory pagination changed')
    totalGroups = p.totalItems
    if (!body.data.length && offset < totalGroups) throw new Error('Auzmor native inventory page truncated')
    for (const group of body.data) {
      const id = group.department?.uuid || 'Other'
      if (groups.has(id) || !filters.departments.has(id) || !count(group.count) || group.count !== filters.departments.get(id)
        || !Array.isArray(group.jobs) || group.jobs.length !== group.count) throw new Error('Auzmor native department inventory count truncated or changed')
      groups.add(id)
      for (const job of group.jobs) {
        if (!uuid(job?.uuid) || !norm(job.title) || identities.has(job.uuid) || job.state !== 'PUBLISHED'
          || job.status !== 'OPEN' || job.publishType !== 'External' || (job.department?.uuid || 'Other') !== id
          || !uuid(job.location?.uuid) || !norm(job.location.name) || typeof job.isRemote !== 'boolean') throw new Error('Auzmor native role identity or publication state changed')
        const locationKey = job.isRemote ? 'Remote' : job.location.uuid
        locationCounts.set(locationKey, (locationCounts.get(locationKey) || 0) + 1)
        identities.set(job.uuid, roleIdentity(job)); jobs.push(job)
      }
    }
    offset += body.data.length
    if (offset > totalGroups) throw new Error('Auzmor native group inventory count overflow')
  } while (offset < totalGroups)
  if (groups.size !== filters.departments.size || jobs.length !== filters.total || locationCounts.size !== filters.locations.size
    || [...filters.locations].some(([id, value]) => locationCounts.get(id) !== value)) throw new Error('Auzmor native full inventory filter counts disagree')
  return { jobs, identities, complete: true, pagesFetched }
}

function readDetail(listing, body) {
  const job = body?.job
  if (!job || roleIdentity(job) !== roleIdentity(listing) || job.closedDate != null
    || body.location?.uuid !== listing.location.uuid || body.location?.name !== listing.location.name) throw new Error('Auzmor native detail UUID, location or role identity changed')
  if (job.degree != null && typeof job.degree !== 'string') throw new Error('Auzmor native degree format changed')
  const doc = document(job.description || ''), description = doc.text(doc.root)
  const location = norm(job.location.name), published = job.publishedDate
  if (!published || !Number.isFinite(Date.parse(published))) throw new Error('Auzmor native publication date unavailable')
  const sourceUrl = `https://hire.auzmor.com/auzmor/careers/${job.uuid}`
  const result = { title: norm(job.title), company: 'Auzmor', source: 'auzmor', jobId: job.uuid, requisitionId: job.uuid,
    department: job.department?.name || null, location, city: location.split(',')[0], country: country(location),
    jobDescription: description || null, sourceDetailComplete: true,
    employmentType: job.employmentTypes?.length ? job.employmentTypes.join(', ') : null,
    workplaceType: job.isRemote ? 'Remote' : null, postingDate: new Date(published).toISOString().slice(0, 10), closingDate: null,
    nativePublishedDate: published, nativeJobLocation: structuredClone(job.location),
    experienceRequired: job.minExperience == null ? null : `${job.minExperience}${job.maxExperience == null ? '+' : '-' + job.maxExperience} years`,
    minimumQualification: job.educationQualificationType || null, preferredQualification: null, requiredSkills: [],
    sourceUrl, applyUrl: sourceUrl, link: sourceUrl, companyCareerPage: WEBSITE, companyDomain: 'auzmor.com', atsPlatform: 'auzmor-hire' }
  if (!hasSourceDescription(result)) throw new Error('Auzmor native full description unavailable')
  const degree = norm(job.degree)
  if (degree) result.jobDescription += '\n\nDegree: ' + degree
  return result
}

export async function readCurrentJobs({ fetchPage, signal, maxJobs = Infinity, maxPages = Infinity, now = () => new Date().toISOString() }) {
  const json = async url => {
    signal?.throwIfAborted()
    const response = await fetchPage(url, { signal })
    signal?.throwIfAborted()
    if (response?.status !== 200 || response.url !== url) throw new Error('Auzmor native first-party response changed')
    return JSON.parse(response.html)
  }
  const organization = await json(API + 'organization/domain/auzmor')
  if (!uuid(organization?.uuid) || organization.name !== 'Auzmor' || organization.domain?.toLowerCase() !== 'auzmor'
    || organization.url?.toLowerCase() !== 'auzmor.com') throw new Error('Auzmor native employer identity changed')
  const filters = readFilters(await json(API + 'careers/auzmor/filters'))
  const inventory = await readInventory(json, filters, { maxPages })
  const reasons = new Set()
  if (!inventory.complete) reasons.add('caller-page-cap')
  if (inventory.jobs.some(job => !country(job.location.name))) reasons.add('native-country-unresolved')
  const india = inventory.jobs.filter(job => country(job.location.name) === 'India'), jobs = []
  for (const listing of india) {
    if (jobs.length >= maxJobs) { reasons.add('caller-job-cap'); break }
    jobs.push({ ...readDetail(listing, await json(API + 'getJob/auzmor/' + listing.uuid)), scrapedAt: now() })
  }
  let pagesFetched = inventory.pagesFetched
  if (!reasons.size) {
    const closingFilters = readFilters(await json(API + 'careers/auzmor/filters'))
    const closing = await readInventory(json, closingFilters)
    pagesFetched += closing.pagesFetched
    if (closingFilters.total !== filters.total || closing.identities.size !== inventory.identities.size
      || [...inventory.identities].some(([id, identity]) => closing.identities.get(id) !== identity)) reasons.add('closing-native-inventory-changed')
  }
  const complete = reasons.size === 0
  return attachInventoryEvidence(jobs, { status: complete ? (filters.total ? 'complete-inventory' : 'verified-empty') : 'coverage-gap',
    surface: WEBSITE, firstParty: true, listingComplete: complete, reportedTotal: filters.total,
    indiaFacetCount: india.length, pagesFetched, verifiedAt: now(),
    reason: complete ? 'corporate-native-widget-employer-filter-counts-full-India-details-and-closing-inventory' : [...reasons].join(';') })
}
