import { activeHead, extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CORPORATE_CAREERS = 'https://armstrongfluidtechnology.com/en/about-armstrong/careers'
export const BAMBOO_BOARD = 'https://armstrongfluidtechnology.bamboohr.com/careers/'
export const BAMBOO_LIST = BAMBOO_BOARD+'list'
const company = 'Armstrong Fluid Technology'
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const check = (ok, message) => { if (!ok) throw new Error(`Armstrong native: ${message}`) }
const countries = new Map(), names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
  const code = String.fromCharCode(first, second), name = names.of(code)
  if (name && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(code)) { countries.set(name.toLowerCase(), name); countries.set(code.toLowerCase(), name) }
}
const countryOf = value => countries.get(clean(value).toLowerCase()) || null
const defaultRead = async (url, json, signal) => {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)])
  const response = await fetch(url, { signal: requestSignal, headers: { 'User-Agent': 'Mozilla/5.0', Accept: json ? 'application/json' : 'text/html' } })
  check(response.ok, `HTTP${response.status} at ${url}`)
  check(!response.url || response.url === url, 'native response redirected away from its requested identity')
  const result = json ? await response.json() : await response.text()
  requestSignal.throwIfAborted()
  return result
}
const verifyCorporate = html => {
  check(activeHead(html).titles.some(title => /Careers\s*\|\s*Armstrong Fluid Technology/i.test(title)), 'official careers employer identity changed')
  const document = readNativeDocument(html)
  check(document.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
    try { const url = new URL(node.attrs.href, CORPORATE_CAREERS); return url.origin === new URL(BAMBOO_BOARD).origin && /^\/careers\/\d+$/.test(url.pathname) } catch { return false }
  }), 'current official role-to-BambooHR handoff is missing')
}
const verifyBoard = html => {
  const head = activeHead(html)
  check(head.metas.some(meta => meta.property === 'og:site_name' && meta.content === company)
    && head.metas.some(meta => meta.property === 'og:title' && meta.content === 'Current Openings'), 'native employer board identity changed')
}
const readInventory = payload => {
  check(Array.isArray(payload?.result) && Number.isSafeInteger(payload?.meta?.totalCount)
    && payload.meta.totalCount === payload.result.length, 'native published total and returned inventory do not reconcile')
  check(payload.result.every(row => /^[1-9]\d*$/.test(String(row.id)) && clean(row.jobOpeningName))
    && new Set(payload.result.map(row => String(row.id))).size === payload.result.length, 'native posting identities are missing or repeated')
  return payload.result
}
const parseDetail = (payload, listing) => {
  const id = String(listing.id), detail = payload?.result?.jobOpening, url = BAMBOO_BOARD+id
  check(detail && detail.jobOpeningShareUrl === url && clean(detail.jobOpeningName) === clean(listing.jobOpeningName)
    && detail.jobOpeningStatus === 'Open', 'detail identity, title or open status does not match its native listing')
  for (const field of ['city', 'state']) if (clean(listing.location?.[field])) check(clean(listing.location[field]) === clean(detail.location?.[field]), `native ${field} changed during detail retrieval`)
  const primary = countryOf(detail.location?.addressCountry), advertised = countryOf(detail.atsLocation?.country)
  check(primary || advertised, 'native role country is missing or unqualified')
  check(!primary || !advertised || primary === advertised, 'native worksite country declarations conflict')
  const country = advertised || primary
  if (country !== 'India') return { exclusion: { id, country, reason: 'explicit native non-India worksite', sourceUrl: url } }
  const description = extractActiveDescription(detail.description)
  check(description && description.length >= 300, 'full native role criteria are unavailable')
  const posted = clean(detail.datePosted)
  check(!posted || /^\d{4}-\d{2}-\d{2}$/.test(posted) && !Number.isNaN(Date.parse(posted)), 'native posting date is invalid')
  const city = clean(detail.atsLocation?.city) || clean(detail.location?.city)
  const state = clean(detail.atsLocation?.state) || clean(detail.location?.state)
  return { job: { source: 'armstrongfluidtechnology', company, atsPlatform: 'bamboohr', jobId: id, requisitionId: null,
    title: clean(detail.jobOpeningName), department: clean(detail.departmentLabel) || null,
    city: city || null, state: state || null, country, location: [city, state, country].filter(Boolean).join(', '),
    sourceUrl: url, applyUrl: url, link: url, employmentType: clean(detail.employmentStatusLabel) || null,
    experienceRequired: null, sourceMinimumExperience: clean(detail.minimumExperience) || null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [], postingDate: posted || null, closingDate: null,
    jobDescription: description, sourceDescription: description, sourceNativeDescriptionHTML: detail.description,
    sourceDetailComplete: true, sourceRemoteStatusUnresolved: listing.isRemote !== true,
    remoteStatus: listing.isRemote === true ? 'Remote' : null,
    sourceNativeLocation: detail.location, sourceNativeAtsLocation: detail.atsLocation,
    sourceCountryEvidence: 'Current same-ID open native BambooHR detail explicitly publishes the role worksite country.' } }
}

export const runNativeArmstrong = async (options = {}) => {
  const signal = AbortSignal.any([AbortSignal.timeout(180000), ...(options.signal ? [options.signal] : [])])
  const wait = promise => new Promise((resolve, reject) => {
    const finish = (fn, value) => { signal.removeEventListener('abort', abort); fn(value) }
    const abort = () => finish(reject, signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
    if (signal.aborted) abort()
  })
  let requests = 0
  const read = async (url, json = false) => {
    signal.throwIfAborted(); requests += 1
    const override = json ? options.fetchJson : options.fetchText
    const result = await wait(override ? override(url, { signal }) : defaultRead(url, json, signal))
    signal.throwIfAborted(); return result
  }
  verifyCorporate(await read(CORPORATE_CAREERS))
  verifyBoard(await read(BAMBOO_BOARD))
  const opening = readInventory(await read(BAMBOO_LIST, true))
  const results = new Array(opening.length), failures = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, opening.length) }, async () => {
    while (cursor < opening.length) {
      const index = cursor++, row = opening[index]
      try { results[index] = parseDetail(await read(BAMBOO_BOARD+row.id+'/detail', true), row) }
      catch (error) { signal.throwIfAborted(); failures.push({ stage: 'native-detail', nativeJobId: String(row.id), message: error.message }) }
    }
  }))
  const closing = readInventory(await read(BAMBOO_LIST, true))
  verifyBoard(await read(BAMBOO_BOARD))
  verifyCorporate(await read(CORPORATE_CAREERS))
  const signature = rows => JSON.stringify([...rows].sort((a, b) => String(a.id).localeCompare(String(b.id))))
  const stable = signature(opening) === signature(closing)
  const exclusions = results.flatMap(result => result?.exclusion ? [result.exclusion] : [])
  const allJobs = results.flatMap(result => result?.job ? [result.job] : [])
  const jobs = Number.isInteger(options.maxJobs) && options.maxJobs >= 0 ? allJobs.slice(0, options.maxJobs) : allJobs
  const complete = stable && !failures.length && jobs.length === allJobs.length
  const audit = { source: 'armstrongfluidtechnology', observedListingCount: opening.length,
    observedIndiaListingCount: allJobs.length, nonIndiaListingCount: exclusions.length,
    candidateDetails: opening.length, extractedDetailJobs: jobs.length, jobs: jobs.map(job => ({ id: job.jobId })),
    exclusions, failures, listingPaginationComplete: jobs.length === allJobs.length,
    closingInventoryMatches: stable, sourceScopeComplete: complete }
  for (const job of jobs) Object.assign(job, { sourceListingComplete: complete, scrapedAt: new Date().toISOString() })
  if (jobs.length) jobs[0].nativeCollectionEvidence = audit
  return attachInventoryEvidence(jobs, { firstParty: true, surface: BAMBOO_BOARD, status: complete ? 'complete-inventory' : 'coverage-gap',
    listingComplete: complete, pagesFetched: requests, reportedTotal: opening.length,
    indiaFacetCount: failures.length ? null : allJobs.length, verifiedAt: new Date().toISOString(), reason: complete
      ? 'declared-current-official-Armstrong-to-BambooHR-board; all-native-role-countries-and-full-India-criteria-qualified; opening-and-closing-total-unique-identities-and-listing-models-reconciled'
      : `Armstrong-native-inventory-gap; closing-matched:${stable}; failed-native-details:${failures.length}; result-capped:${jobs.length !== allJobs.length}` })
}
