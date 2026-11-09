import { activeHead, activeIframeSources, extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const COMPANY = 'Asteria Aerospace', CAREERS = 'https://asteria.co.in/careers'
const ORIGIN = 'https://asteria.keka.com', UUID = '276cea58-0e7a-4134-872d-84be59f84fe7'
const EMBED = ORIGIN+'/careers/api/embedjobs/'+UUID
const ACTIVE = ORIGIN+'/careers/api/embedjobs/default/active/'+UUID
const IDENTITY = ORIGIN+'/careers/api/organization/default/careerportalinfo'
const LEGACY = 'https://asteria.kekahire.com/api/embed/jobs/'+UUID
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const check = (ok, message) => { if (!ok) throw Error('Asteria native Keka: '+message) }
const frames = activeIframeSources
export const hasAsteriaKekaHandoff = html => frames(html).some(url => /\.keka(?:hire)?\.com\//.test(url))
const corporate = html => {
  check(activeHead(html).titles.includes('Explore Career Opportunities | Asteria'), 'official employer careers identity changed')
  const links = frames(html)
  check(links.filter(url => url === EMBED).length === 1, 'current official native iframe handoff changed')
  check(links.filter(url => /\.keka(?:hire)?\.com\//.test(url)).every(url => [EMBED, LEGACY].includes(url)), 'additional unqualified native iframe handoff')
  return links.filter(url => url === LEGACY)
}
const embed = html => {
  const scripts = readNativeDocument(html).nodes(node => node.tag === 'script').map(node => node.raw)
  for (const url of [ACTIVE, IDENTITY]) check(scripts.some(script => script.includes("$.ajax('"+url+"')")), 'native active-jobs or employer identity contract changed')
  check(scripts.some(script => /\/careers\/jobdetails\/['"]\s*\+\s*job\.id\b/.test(script)), 'native public role URL contract changed')
  check(scripts.some(script => script.includes("job.jobType == 2 ? 'Full Time' : 'Part time'")), 'native labelled employment types changed')
  check(scripts.some(script => /jobList\s*=\s*jobs\[0\]/.test(script)), 'native complete active-array contract changed')
}
const employer = value => check(value?.name === COMPANY && value?.shortName === COMPANY
  && value?.careersPortalDomain === 'asteria.keka.com' && value?.careersBackgroundPath?.includes('/'+UUID+'/'), 'native portal employer identity changed')
const inventory = value => {
  check(Array.isArray(value) && value.length <= 500 && value.every(row => Number.isSafeInteger(row?.id) && row.id > 0 && clean(row.title))
    && new Set(value.map(row => row.id)).size === value.length, 'native active inventory is invalid or repeats posting identities')
  return value
}
const regions = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const locationCountry = location => {
  check(location && Number.isSafeInteger(location.id) && location.id > 0 && /^[A-Z]{2}$/.test(location.countryCode || ''), 'native role country is missing')
  const canonical = regions.of(location.countryCode)
  check(canonical && canonical === clean(location.countryName) && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(location.countryCode), 'native role country code and name disagree')
  return canonical
}
const detail = row => {
  check(Array.isArray(row.jobLocations) && row.jobLocations.length, 'native worksite countries are missing')
  const countries = row.jobLocations.map(locationCountry), url = ORIGIN+'/careers/jobdetails/'+row.id
  if (!countries.includes('India')) return { exclusion: { id: String(row.id), sourceUrl: url, countries, reason: 'explicit native non-India worksites' } }
  const description = extractActiveDescription(row.description)
  check(description && description.length >= 500 && clean(row.jobNumber), 'full native criteria or requisition identity missing')
  check(Array.isArray(row.skillNames) && row.skillNames.every(skill => typeof skill === 'string'), 'native required skills model changed')
  check([1, 2].includes(row.jobType), 'native labelled employment type unknown')
  const india = row.jobLocations.filter(location => location.countryCode === 'IN')
  const date = clean(row.publishedOn), posted = /^\d{4}-\d{2}-\d{2}T/.test(date) && Number(date.slice(0, 4)) >= 1970 && Number.isFinite(Date.parse(date)) ? date : null
  return { job: { source: 'asteriaaerospace', company: COMPANY, atsPlatform: 'keka', jobId: String(row.id), requisitionId: clean(row.jobNumber),
    title: clean(row.title), department: clean(row.departmentName) || null,
    location: india.map(location => [clean(location.name) || clean(location.city), clean(location.state), 'India'].filter(Boolean).join(', ')).join('; '),
    city: india.length === 1 ? clean(india[0].city) || null : null, country: 'India',
    sourceUrl: url, applyUrl: url, link: url, companyCareerPage: CAREERS,
    employmentType: row.jobType === 2 ? 'Full Time' : 'Part time', experienceRequired: clean(row.experience) || null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [...row.skillNames],
    postingDate: posted, closingDate: null, sourceNativePostingDate: date || null, sourcePostingDateUnresolved: posted === null,
    jobDescription: row.description, sourceDescription: row.description, sourceNativeDescriptionHTML: row.description,
    sourceNativeRecord: structuredClone(row), sourceCountryEvidence: 'Active same-ID native Keka jobLocations countryCode and countryName both identify the India worksite.',
    sourceDetailComplete: true, sourceListingComplete: false, sourceRemoteStatusUnresolved: true, remoteStatus: null } }
}
const ownModel = row => { const { publishedSinceDays, ...model } = row; return JSON.stringify(model) }

export async function runCurrentAsteriaKeka(options = {}) {
  const signal = AbortSignal.any([AbortSignal.timeout(90000), ...(options.signal ? [options.signal] : [])])
  check(options.maxJobs == null || Number.isSafeInteger(options.maxJobs) && options.maxJobs >= 0, 'invalid result limit')
  const wait = promise => new Promise((resolve, reject) => {
    const finish = (fn, value) => { signal.removeEventListener('abort', abort); fn(value) }
    const abort = () => finish(reject, signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
    if (signal.aborted) abort()
  })
  let requests = 1
  const read = async (url, json = false) => {
    signal.throwIfAborted(); requests++
    const override = json ? options.fetchJson : options.fetchText
    if (override) { const value = await wait(override(url, { signal })); signal.throwIfAborted(); return value }
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)])
    let response = await fetch(url, { redirect: 'manual', signal: requestSignal, headers: { 'User-Agent': 'Mozilla/5.0', Accept: json ? 'application/json' : 'text/html' } })
    if (url === CAREERS && [301, 302, 307, 308].includes(response.status) && response.headers.get('location') === 'https://www.asteria.co.in/careers') {
      response = await fetch('https://www.asteria.co.in/careers', { redirect: 'manual', signal: requestSignal })
    }
    check(response.status === 200, 'HTTP'+response.status+' at '+url)
    const value = await (json ? response.json() : response.text()); requestSignal.throwIfAborted(); return value
  }
  const legacy = corporate(options.initialHtml)
  const openingEmbed = await read(EMBED); embed(openingEmbed)
  const openingIdentity = await read(IDENTITY, true); employer(openingIdentity)
  const opening = inventory(await read(ACTIVE, true)), failures = [], results = []
  for (const row of opening) {
    try { results.push(detail(row)) }
    catch (error) { failures.push({ stage: 'native-detail', nativeJobId: String(row.id), message: error.message }) }
  }
  const channelGaps = []
  for (const url of legacy) {
    try { await read(url); channelGaps.push({ url, reason: 'additional published legacy iframe requires independent current inventory reconciliation' }) }
    catch (error) { signal.throwIfAborted(); channelGaps.push({ url, reason: error?.cause?.code || error.code || error.message }) }
  }
  const closing = inventory(await read(ACTIVE, true))
  const closingIdentity = await read(IDENTITY, true); employer(closingIdentity)
  const closingEmbed = await read(EMBED); embed(closingEmbed)
  const closingLegacy = corporate(await read(CAREERS))
  const closingByID = new Map(closing.map(row => [String(row.id), ownModel(row)]))
  const stable = opening.length === closing.length && opening.every(row => closingByID.get(String(row.id)) === ownModel(row))
    && JSON.stringify(openingIdentity) === JSON.stringify(closingIdentity) && openingEmbed === closingEmbed && JSON.stringify(legacy) === JSON.stringify(closingLegacy)
  const exclusions = results.flatMap(result => result.exclusion ? [result.exclusion] : [])
  const allJobs = results.flatMap(result => result.job ? [result.job] : []).filter(job => {
    if (closingByID.get(job.jobId) === ownModel(job.sourceNativeRecord)) return true
    failures.push({ stage: 'native-detail', nativeJobId: job.jobId, message: 'native role was removed or full criteria changed at closing' }); return false
  })
  const jobs = Number.isSafeInteger(options.maxJobs) && options.maxJobs >= 0 ? allJobs.slice(0, options.maxJobs) : allJobs
  const complete = stable && !failures.length && !channelGaps.length && jobs.length === allJobs.length
  const audit = { source: 'asteriaaerospace', observedListingCount: opening.length, observedIndiaListingCount: allJobs.length,
    nonIndiaListingCount: exclusions.length, candidateDetails: opening.length, extractedDetailJobs: jobs.length,
    jobs: jobs.map(job => ({ id: job.jobId })), exclusions, failures, channelGaps,
    listingPaginationComplete: jobs.length === allJobs.length, closingInventoryMatches: stable, sourceScopeComplete: false,
    modernBoardListingComplete: complete,
    declaredModernBoardClosingMatches: stable, nativeActiveArrayCount: opening.length }
  for (const job of jobs) Object.assign(job, { scrapedAt: new Date().toISOString(), sourceListingComplete: complete,
    sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false })
  if (jobs.length) jobs[0].nativeCollectionEvidence = audit
  const reason = `Declared current official Asteria Keka complete active array observed=${opening.length}; full India roles=${jobs.length}; native failures=${failures.length}; closing full native models match=${stable}; additional declared channel gaps=${JSON.stringify(channelGaps)}; no company-wide completeness claim`
  attachInventoryEvidence(jobs, { firstParty: true, surface: EMBED, status: 'coverage-gap', listingComplete: complete,
    reportedTotal: complete ? opening.length : null, indiaFacetCount: complete ? jobs.length : null, pagesFetched: requests, verifiedAt: new Date().toISOString(), reason })
  if (options.onAudit) await wait(options.onAudit(audit))
  signal.throwIfAborted(); return jobs
}
