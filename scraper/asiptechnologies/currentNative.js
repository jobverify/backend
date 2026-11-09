import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE = 'asiptechnologies', COMPANY = 'ASIP Technologies'
const ORIGIN = 'https://asip-tech.com', CAREERS = ORIGIN + '/careers/'
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const fail = message => { throw Error('ASIP current native inventory: ' + message) }
const single = (nodes, label) => { if (nodes.length !== 1) fail('missing or ambiguous ' + label); return nodes[0] }
const canonical = doc => single(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'canonical URL').attrs.href
const field = (doc, root, name) => {
  const wrappers = doc.nodes(node => doc.hasClass(node, 'awsm-job-specification-' + name), root)
  if (wrappers.length !== 1) fail('missing or ambiguous native ' + name)
  return doc.text(single(doc.nodes(node => doc.hasClass(node, 'awsm-job-specification-term'), wrappers[0]), name + ' value'))
}

export function readCurrentAsipListings(html, { allowMissing = false } = {}) {
  const doc = document(html)
  const groups = doc.nodes(node => doc.hasClass(node, 'awsm-job-listings'))
  if (!groups.length && allowMissing) return null
  const group = single(groups, 'native listing container')
  if (canonical(doc) !== CAREERS) fail('first-party careers canonical changed')
  const body = single(doc.nodes(node => node.tag === 'body'), 'careers body')
  if (!doc.hasClass(body, 'listing-page-awsm_job_openings')) fail('native careers page type changed')
  const cards = doc.nodes(node => doc.hasClass(node, 'awsm-job-listing-item'), group)
  if (cards.length > 100) fail('native listing exceeds observation budget')
  const ids = new Set(), urls = new Set()
  return cards.map(card => {
    const jobId = /^awsm-grid-item-([1-9]\d*)$/.exec(card.attrs.id || '')?.[1]
    const link = single(doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'awsm-job-item'), card), 'native role link')
    const url = new URL(link.attrs.href, CAREERS)
    if (!jobId || ids.has(jobId) || urls.has(url.href) || url.origin !== ORIGIN || url.username || url.password
      || url.search || url.hash || !/^\/career\/[^/]+\/$/.test(url.pathname)) fail('native listing identity changed')
    const title = doc.text(single(doc.nodes(node => doc.hasClass(node, 'awsm-job-post-title'), link), 'native role title'))
    const location = field(doc, link, 'job-location')
    if (!title || !location) fail('native role title or location is blank')
    ids.add(jobId); urls.add(url.href)
    return { source: SOURCE, title, company: COMPANY, jobId, requisitionId: null,
      location, city: location.split(',')[0].trim(), country: null,
      department: field(doc, link, 'job-category'), employmentType: field(doc, link, 'job-type'),
      sourceUrl: url.href, applyUrl: url.href, link: url.href, companyCareerPage: CAREERS, companyDomain: 'asip-tech.com',
      postingDate: null, closingDate: null, jobDescription: null, experienceRequired: null,
      minimumQualification: null, preferredQualification: null, requiredSkills: [],
      sourceNativeListingHTML: doc.outer(card), sourceCountryScopeUnresolved: true,
      sourceDetailComplete: false, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
  })
}

function jobPostings(doc) {
  const result = []
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if ([value['@type']].flat().includes('JobPosting')) result.push(value)
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child === 'object') visit(child)
    }
  }
  for (const node of doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) {
    try { visit(JSON.parse(node.raw)) } catch { fail('invalid native JobPosting JSON') }
  }
  return result
}

function workplace(posting, visible) {
  const place = posting.jobLocation
  const address = !Array.isArray(place) && place?.['@type'] === 'Place' ? place.address : null
  const country = address && typeof address === 'object' && !Array.isArray(address) ? address.addressCountry : null
  const rawCountry = typeof country === 'string' ? clean(country) : null
  const city = address && typeof address === 'object' ? clean(address.addressLocality) : null
  // A footer address and a city name alone cannot establish this job's country.
  const normalized = rawCountry && /^(?:IN|India)$/i.test(rawCountry) ? 'India' : null
  const sameCity = city && clean(visible).split(',')[0].toLowerCase() === city.toLowerCase()
  return { country: normalized && sameCity ? normalized : null, city: sameCity ? city : visible.split(',')[0].trim(),
    sourceCountryScopeUnresolved: !normalized || !sameCity, sourceNativeJobLocation: structuredClone(place ?? null) }
}

export function readCurrentAsipDetail(html, listing) {
  const doc = document(html)
  if (canonical(doc) !== listing.sourceUrl) fail('native detail canonical identity changed')
  const body = single(doc.nodes(node => node.tag === 'body'), 'native detail body')
  const ids = (body.attrs.class || '').split(/\s+/).filter(value => value.startsWith('postid-'))
  if (ids.length !== 1 || ids[0] !== 'postid-' + listing.jobId) fail('native detail post identity changed')
  const inputs = doc.nodes(node => node.tag === 'input' && node.attrs.name === 'awsm_job_id')
  if (!inputs.length || inputs.some(node => node.attrs.value !== listing.jobId)) fail('native public role identity disagrees')
  const title = doc.text(single(doc.nodes(node => node.tag === 'h1' && doc.hasClass(node, 'awsm-jobs-single-title')), 'native detail title'))
  const content = single(doc.nodes(node => doc.hasClass(node, 'awsm-job-entry-content')), 'native role criteria')
  const posting = single(jobPostings(doc), 'native JobPosting')
  if (title !== listing.title || clean(posting.title) !== title || posting.hiringOrganization?.name !== COMPANY
    || ![ORIGIN, ORIGIN + '/'].includes(posting.hiringOrganization?.sameAs)) fail('native employer or title identity changed')
  const raw = doc.inner(content), visible = extractActiveDescription(raw), schema = extractActiveDescription(posting.description)
  if (!visible || !schema || visible.replace(/\s/g, '') !== schema.replace(/\s/g, '')) fail('full native criteria disagree')
  const location = field(doc, body, 'job-location')
  const department = field(doc, body, 'job-category'), employmentType = field(doc, body, 'job-type')
  if (location !== listing.location || department !== listing.department || employmentType !== listing.employmentType
    || posting.employmentType !== 'FULL_TIME' || employmentType !== 'Full Time') fail('native labelled fields disagree')
  const postingDate = typeof posting.datePosted === 'string' && Number.isFinite(Date.parse(posting.datePosted)) ? posting.datePosted : null
  if (!postingDate) fail('native posting date unavailable')
  return { ...listing, ...workplace(posting, location), jobDescription: raw, postingDate,
    sourcePostingDate: postingDate, sourceNativePostingDate: postingDate,
    sourceNativeJobPosting: structuredClone(posting), sourceNativeDescriptionHTML: raw,
    sourceDetailComplete: true, sourceNativeDetailQualified: true }
}

const signature = row => JSON.stringify([row.jobId, row.title, row.sourceUrl, row.location, row.department, row.employmentType])
const defaultFetchPage = async (url, { signal }) => {
  const response = await fetch(url, { redirect: 'manual', signal,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,application/xhtml+xml' } })
  return { status: response.status, url: response.url, html: await response.text() }
}

export function createCurrentAsipScraper(defaults = {}) {
  return { async run(provided = {}) {
    const options = { ...defaults, ...provided }
    const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(90000)])
    signal.throwIfAborted()
    const now = new Date((options.now || (() => new Date()))())
    if (!Number.isFinite(now.getTime())) fail('invalid observation time')
    if (options.maxJobs != null && (!Number.isSafeInteger(options.maxJobs) || options.maxJobs < 0)) fail('invalid result limit')
    const wait = promise => new Promise((resolve, reject) => {
      const finish = (fn, value) => { signal.removeEventListener('abort', abort); fn(value) }
      const abort = () => finish(reject, signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
      if (signal.aborted) abort()
    })
    let pagesFetched = 0
    const read = async url => {
      signal.throwIfAborted()
      const page = options.fetchPage ? await wait(options.fetchPage(url, { signal }))
        : options.fetchText ? { status: 200, url, html: await wait(options.fetchText(url, { signal })) }
          : await wait(defaultFetchPage(url, { signal }))
      signal.throwIfAborted(); pagesFetched++
      if (page?.status !== 200 || page.url !== url || typeof page.html !== 'string' || page.html.length > 3000000) fail('public page unavailable or redirected')
      return page.html
    }
    const opening = readCurrentAsipListings(await read(CAREERS)), observations = [], detailFailures = []
    for (const listing of opening) {
      try { observations.push(readCurrentAsipDetail(await read(listing.sourceUrl), listing)) }
      catch (error) {
        signal.throwIfAborted()
        observations.push({ ...listing, sourceDetailFailureKind: 'native-role-detail-unavailable-or-inconsistent' })
        detailFailures.push({ jobId: listing.jobId, reason: String(error.message) })
      }
    }
    const closing = readCurrentAsipListings(await read(CAREERS))
    const closingModels = new Set(closing.map(signature))
    const listingStable = opening.length === closing.length && opening.every(row => closingModels.has(signature(row)))
    for (const row of observations) { row.sourceCurrentPostingStable = closingModels.has(signature(row)); row.scrapedAt = now.toISOString() }
    const candidates = observations.filter(row => row.country === 'India' && row.sourceDetailComplete && row.sourceCurrentPostingStable)
    const jobs = options.maxJobs == null ? candidates : candidates.slice(0, options.maxJobs)
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows',
      observedRecordCount: opening.length, observedVacancyCount: opening.length, sourceScopeComplete: false })
    const evidence = { status: 'coverage-gap', surface: CAREERS, firstParty: true, listingComplete: false,
      reportedTotal: null, indiaFacetCount: null, pagesFetched, verifiedAt: now.toISOString(),
      reason: `Current ASIP native roles observed; authoritative total unavailable; unresolved job countries=${observations.filter(row => row.sourceCountryScopeUnresolved).length}; detail failures=${detailFailures.length}; closing listing stable=${listingStable}; no company-wide completeness claim` }
    attachInventoryEvidence(jobs, evidence)
    if (options.onRecords) await wait(options.onRecords(structuredClone(observations)))
    if (options.onAudit) await wait(options.onAudit({ source: SOURCE, observations: structuredClone(observations),
      detailFailures, listingStable, inventoryEvidence: evidence, productionWrites: false }))
    signal.throwIfAborted()
    return jobs
  } }
}
