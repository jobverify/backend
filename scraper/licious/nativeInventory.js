import { createHash } from 'node:crypto'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription, readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { disposeResponseReader } from '../../scraper-support/shared/responseBodyDisposal.js'
import {hasReviewedCriterionRendering} from './criterionRendering.js'

export const CAREERS_URL = 'https://www.licious.in/careers'
export const CURRENT_JOBS_URL = CAREERS_URL + '/jobs'
export const NATIVE_ORIGIN = 'https://licious.mynexthire.com'
export const PUBLIC_PORTAL_URL = NATIVE_ORIGIN + '/employer/jobs/careers'
export const LISTING_API_URL = NATIVE_ORIGIN + '/employer/careers/reqlist/get'
export const TENANT_URL = NATIVE_ORIGIN + '/employer/jobboard/details_by_shortname/get/licious/'
export const PUBLICATION_DATES_URL = NATIVE_ORIGIN + '/ats/public-apis/v1/careers/job-posting-dates/list'
export const DETAIL_URL = 'https://licious.prod.in1.mynexthire.io/d17/careers/requisition/object'
const INTEGRATION_URL = NATIVE_ORIGIN + '/employer/ui/js/jobboard/careers-integration.js'
const CLIENT_URL = NATIVE_ORIGIN + '/employer/ui/js/jobboard/careers.js'
const APP_COMPONENT_URL = 'https://www.licious.in/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js'
// These complete published programs contain the same reviewed iframe, tenant,
// initializer and integration module. The document selects one whole profile.
const APP_COMPONENTS = new Map([
  [APP_COMPONENT_URL,'2ec55b865dc2493fb8174fc75bb6076d7bd298102723d1bccfbe366ec0f0feff'],
  ['https://www.licious.in/_next/static/chunks/app/content/careers/jobs/page-ee5b4b837d8d8e74.js','92a0899b761af9428e64f67f90eb8860aaf883c883f48453cf174af26d5901a0'],
])
const LISTING_INPUT = { source: 'careers', code: '', filterByBuId: -1 }
// Freshly fetched, currently advertised clients establish the connected iframe,
// unfiltered array, in1 backend and last-event publication rule. Never eval JS.
// Unsupported client revisions fail closed instead of certifying an empty board.
const CLIENT_HASHES = {
  component: '06e32b785b78eabd1fc422dc56288b0e80860e03e3b126070f4e5f106fa98d74',
  appComponent: '2ec55b865dc2493fb8174fc75bb6076d7bd298102723d1bccfbe366ec0f0feff',
  integration: '035523655249028e0fcdbc27449373d24c5e75da2a2414529309e6eff560f3fc',
  careers: '19e078b0f0328cf36adce43b62e3db3dcf624b8630349c3c3ab8668955c0bbf4',
}
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const hash = value => createHash('sha256').update(value).digest('hex')
class NativeContractError extends Error {
  constructor(message) { super('Licious native: ' + message); this.name = 'NativeContractError' }
}
const requireNative = (condition, message) => { if (!condition) throw new NativeContractError(message) }
const parseJson = (body, label) => {
  try { return JSON.parse(body) } catch { throw new NativeContractError('invalid ' + label + ' response') }
}
const defaultFetchPage = async (url, init, callerSignal) => {
  const response = await fetch(url, { ...init, redirect: 'error' })
  const reader = response.body?.getReader(), chunks = []
  let size = 0, readComplete = false
  if (reader) {
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        requireNative(size <= 4 * 1024 * 1024, 'response exceeds public native size limit')
        chunks.push(Buffer.from(part.value))
      }
      readComplete = true
    } finally {
      try { await disposeResponseReader(reader, { signal: callerSignal, bestEffort: !readComplete }) }
      finally { reader.releaseLock() }
    }
  }
  return { status: response.status, url: response.url, contentType: response.headers.get('content-type'), body: Buffer.concat(chunks).toString('utf8') }
}
const tenantIdentity = value => {
  const routes = value?.tenantPreferencesMap?.career_page_url?.url
  requireNative(value?.clientId === 1163 && value.clientName === 'Licious' && value.companyWebsite === 'https://www.licious.in/'
    && Array.isArray(routes) && routes.length === 3 && routes.every(route => route.url === CURRENT_JOBS_URL)
    && ['jd', 'application', 'list'].every(type => routes.filter(route => route.pageType === type).length === 1),
  'employer identity, corporate website or configured job/application routes changed')
  return JSON.stringify([value.clientId, value.clientName, value.companyWebsite, routes.map(route => [route.pageType, route.url]).sort()])
}
const offices = row => Array.isArray(row?.locationList) ? row.locationList.map(place => ({
  office: norm(place?.office), address: norm(place?.address), country: place?.country ?? null, countryCode: place?.countryCode ?? null,
})).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : null
const state = row => JSON.stringify([row.reqId, row.reqTitle, row.statusId, row.countryCode ?? null, row.country ?? null,
  row.location, row.locationAddress, offices(row), row.jdDisplay, row.expMin, row.expMax, row.employmentType, row.buName,
  row.companyName ?? null, row.clientName ?? null, row.hiringOrganization?.name ?? null])
const listingRows = payload => {
  const keys = payload && typeof payload === 'object' ? Object.keys(payload).sort() : []
  requireNative(JSON.stringify(keys) === JSON.stringify(['hrXmlModel', 'reqDetailsBOList', 'requesterTitle'])
    && Array.isArray(payload.reqDetailsBOList) && payload.reqDetailsBOList.length <= 2000,
    'complete unfiltered native listing contract changed, contains errors or requires pagination')
  const seen = new Set()
  for (const row of payload.reqDetailsBOList) {
    requireNative(Number.isSafeInteger(row?.reqId) && row.reqId > 0 && !seen.has(row.reqId)
      && norm(row.reqTitle) && Number.isSafeInteger(row.statusId), 'listing role identity repeats or is invalid')
    seen.add(row.reqId)
  }
  return payload.reqDetailsBOList
}
const publicationHistory = (payload, ids, checkedAt, reasons) => {
  const events = payload?.data?.careersJobPostingDatesList
  requireNative(payload?.code === 200 && payload.message === 'OK' && Array.isArray(events), 'publication history response is unavailable')
  const active = new Set(ids), histories = new Map(), invalid = new Set()
  for (const event of events) {
    // Historical events have a different grain from current vacancies.
    if (!active.has(event?.requisitionId)) continue
    const previous = histories.get(event.requisitionId) || []
    if (!Number.isSafeInteger(event.publishedOn) || event.publishedOn <= 0 || event.publishedOn > checkedAt
      || !Number.isFinite(new Date(event.publishedOn).getTime()) || (previous.length && event.publishedOn < previous.at(-1))) invalid.add(event.requisitionId)
    histories.set(event.requisitionId, [...previous, event.publishedOn])
  }
  for (const id of ids) {
    if (!histories.has(id) || invalid.has(id)) {
      reasons.add(`publication-date-unresolved:${id}`)
      histories.delete(id)
    }
  }
  return histories
}
const roleLocation = (row, detail, reasons) => {
  const assigned = offices(detail), listed = offices(row)
  if (!assigned?.length || JSON.stringify(assigned) !== JSON.stringify(listed)
    || assigned.some(place => !place.office || !place.address)
    || new Set(assigned.map(place => place.office)).size !== assigned.length) {
    reasons.add(`native-location-scope-unresolved:${row.reqId}`); return null
  }
  // These pairs are assigned to roles, not inferred from employer headquarters.
  const supported = new Map([['Bengaluru', 'BLR'], ['Chandigarh', 'Chandigarh'], ['Jaipur', 'Jaipur'], ['Hyderabad', 'Hyderabad']])
  const countries = [row.country, row.countryCode, detail.country, detail.countryCode,
    ...assigned.flatMap(place => [place.country, place.countryCode])].filter(value => value != null && value !== '')
  if (countries.some(value => !['India', 'IN', 'IND'].includes(value))) {
    reasons.add(`native-country-scope-conflicts:${row.reqId}`); return null
  }
  if (!countries.length) { reasons.add(`native-role-country-unpublished:${row.reqId}`); return null }
  const cities = []
  for (const place of assigned) {
    const city = getValidIndiaCityForJob({ city: place.office, location: place.office })
    if (supported.get(place.office) !== place.address || !city || city === 'Remote') {
      reasons.add(`native-location-scope-unresolved:${row.reqId}`); return null
    }
    cities.push(city)
  }
  if (norm(row.location) !== assigned.map(place => place.office).join(', ') || norm(row.locationAddress) !== assigned.map(place => place.address).join(', ')) {
    reasons.add(`listing-location-scope-conflicts:${row.reqId}`); return null
  }
  return { city: cities.length === 1 ? cities[0] : null, locations: cities.map(city => city + ', India'), assigned }
}
const jobUrl = (id, pageType) => {
  const context = { pageType, cvSource: 'careers', reqId: id, requester: { id: '', code: '', name: '' }, page: 'careers', bufilter: -1, customFields: {} }
  const url = new URL(CURRENT_JOBS_URL)
  url.searchParams.set('src', 'careers')
  url.searchParams.set('p', Buffer.from(JSON.stringify(context)).toString('base64'))
  return url.href
}
const hasAdditionalSurface = (doc, base, allowed) => {
  const hosts = /(?:^|\.)(?:mynexthire\.(?:com|io)|darwinbox\.(?:in|com)|zohorecruit\.(?:com|in)|freshteam\.com|workable\.com|greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|successfactors\.(?:com|eu)|taleo\.net|jobs2web\.com|teamtailor\.com|personio\.(?:com|de)|bamboohr\.com|applytojob\.com|breezy\.hr|recruitee\.com|jobvite\.com)$/i
  return doc.nodes(n => n.tag === 'a' && n.attrs.href).some(node => {
    let url
    try { url = new URL(node.attrs.href, base) } catch { return false }
    if (!['https:', 'http:'].includes(url.protocol)) return false
    url.hash = ''
    return !allowed.has(url.href.replace(/\/$/, '')) && (hosts.test(url.hostname) || /(?:career|vacanc|recruit|job)/i.test(url.pathname))
  }) || doc.frames().some(frame => {
    const src = frame.attrs.src || ''
    if (frame.attrs.id === 'mnhembedded' && ['', PUBLIC_PORTAL_URL, PUBLIC_PORTAL_URL + '#'].includes(src)) return false
    // These current social feed embeds are editorial videos, not job feeds.
    if (/^https:\/\/www\.linkedin\.com\/embed\/feed\/update\/urn:li:ugcPost:\d+$/.test(src)) return false
    return true
  })
}
const executableScript = node => node.tag === 'script' && node.attrs.src
  && !Object.hasOwn(node.attrs, 'nomodule')
  && ['', 'module', 'text/javascript', 'application/javascript'].includes(norm(node.attrs.type).toLowerCase())

export const createNativeLiciousScraper = ({ maxJobs: defaultMaxJobs = 0, now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, signal, maxJobs = defaultMaxJobs } = {}) {
    requireNative(Number.isInteger(maxJobs) && maxJobs >= 0, 'invalid job limit')
    signal?.throwIfAborted()
    const checkedAt = new Date(now()).getTime(), reasons = new Set()
    requireNative(Number.isFinite(checkedAt), 'invalid observation clock')
    let requests = 0
    const request = async (url, input) => {
      signal?.throwIfAborted()
      const scoped = signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000)
      const response = await fetchPage(url, { signal: scoped, method: input ? 'POST' : 'GET', ...(input ? { body: JSON.stringify(input) } : {}),
        headers: { Accept: 'application/json,text/html,application/javascript,*/*', ...(input ? { 'Content-Type': 'application/json' } : {}) } }, ...(fetchPage === defaultFetchPage ? [signal] : []))
      signal?.throwIfAborted(); requests++
      requireNative(response?.url === url, 'public native response redirected or changed identity')
      if (response.status !== 200) throw Error(`Licious public native HTTP ${response.status}`)
      requireNative(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 4 * 1024 * 1024, 'invalid or excessive public native response')
      return response.body
    }
    const jsonAt = async (url, input) => parseJson(await request(url, input), 'native JSON')
    const allowed = new Set([CAREERS_URL, CURRENT_JOBS_URL, PUBLIC_PORTAL_URL])
    const careers = readVisibleNativeDocument(await request(CAREERS_URL))
    requireNative(careers.nodes(n => n.tag === 'a' && n.attrs.href === '/careers/jobs').length > 0,
      'current corporate careers handoff is unavailable')
    if (hasAdditionalSurface(careers, CAREERS_URL, allowed)) reasons.add('additional-current-recruiting-surface')
    const jobsHtml = await request(CURRENT_JOBS_URL), jobsPage = readVisibleNativeDocument(jobsHtml)
    const frames = jobsPage.frames().filter(frame => frame.attrs.id === 'mnhembedded')
    requireNative(frames.length === 1 && frames[0].attrs.title === 'Licious open roles' && !Object.hasOwn(frames[0].attrs, 'srcdoc')
      && ['', PUBLIC_PORTAL_URL, PUBLIC_PORTAL_URL + '#'].includes(frames[0].attrs.src ?? ''), 'current corporate job iframe handoff is unavailable or changed')
    const data = jobsPage.nodes(n => n.tag === 'script' && n.attrs.id === '__NEXT_DATA__')
    const scripts = jobsPage.nodes(executableScript).map(n => new URL(n.attrs.src, CURRENT_JOBS_URL))
    const components = scripts.filter(url => url.origin === 'https://www.licious.in'
      && /^\/_next\/static\/chunks\/pages\/content\/careers\/jobs-[a-f0-9]+\.js$/.test(url.pathname) && !url.search && !url.hash)
    const appComponents = scripts.filter(url => url.origin === 'https://www.licious.in'
      && /^\/_next\/static\/chunks\/app\/content\/careers\/jobs\/page-[a-f0-9]+\.js$/.test(url.pathname) && !url.search && !url.hash)
    // Display visibility does not suppress script execution or data carriers.
    // Count known router carriers through hidden/inert raw-tree descendants.
    const within = (node, predicate) => [...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => within(child, predicate))]
    const rawRoot = readNativeDocument(jobsHtml).nodes(node => node.tag === 'root')[0]
    const rawScripts = within(rawRoot, node => node.tag === 'script')
    const rawPaths = rawScripts.map(node => { try { return node.attrs.src ? new URL(node.attrs.src, CURRENT_JOBS_URL).pathname : '' } catch { return '' } })
    const legacyPage = data.length === 1 && parseJson(data[0].raw, 'current Next page').page === '/content/careers/jobs' && appComponents.length === 0
    const appPage = data.length === 0 && components.length === 0 && appComponents.length === 1 && APP_COMPONENTS.has(appComponents[0].href)
    requireNative(legacyPage || appPage, 'current jobs page client handoff changed')
    requireNative(appPage || components.length === 1, 'current connected job client is unavailable')
    requireNative(rawScripts.filter(node => node.attrs.id === '__NEXT_DATA__').length === data.length
      && rawPaths.filter(value => /^\/_next\/static\/chunks\/pages\/content\/careers\/jobs(?:-[^/]+)?\.js$/.test(value)).length === components.length
      && rawPaths.filter(value => /^\/_next\/static\/chunks\/app\/content\/careers\/jobs\/page(?:-[^/]+)?\.js$/.test(value)).length === appComponents.length,
    'current router carrier census changed')
    if (appPage) {
      const sections = jobsPage.nodes(node => node.tag === 'section' && node.attrs['aria-labelledby'] === 'careers-jobs-title')
      requireNative(sections.length === 1 && within(sections[0], node => node.tag === 'h1' && node.attrs.id === 'careers-jobs-title' && jobsPage.text(node) === 'JOBS').length === 1
        && within(sections[0], node => node === frames[0]).length === 1, 'current App Router jobs section binding changed')
      // The finite current component preserves the native iframe/init callback.
      // Other App Router dependencies and company-wide hiring scope are unproved.
      reasons.add('app-router-company-scope-unqualified')
    }
    requireNative(hash(await request(appPage ? appComponents[0].href : components[0].href)) === (appPage ? APP_COMPONENTS.get(appComponents[0].href) : CLIENT_HASHES.component), 'current job client contract changed')
    requireNative(hash(await request(INTEGRATION_URL)) === CLIENT_HASHES.integration, 'current integration client contract changed')
    if (hasAdditionalSurface(jobsPage, CURRENT_JOBS_URL, allowed)) reasons.add('additional-current-recruiting-surface')
    const board = readVisibleNativeDocument(await request(PUBLIC_PORTAL_URL))
    requireNative(board.nodes(n => executableScript(n) && new URL(n.attrs.src, PUBLIC_PORTAL_URL).href === CLIENT_URL).length === 1,
      'native board client handoff changed')
    if (hasAdditionalSurface(board, PUBLIC_PORTAL_URL, allowed)) reasons.add('additional-native-recruiting-surface')
    requireNative(hash(await request(CLIENT_URL)) === CLIENT_HASHES.careers, 'current native inventory client contract changed')
    const tenant = await jsonAt(TENANT_URL), identity = tenantIdentity(tenant)
    const rows = listingRows(await jsonAt(LISTING_API_URL, LISTING_INPUT)), ids = rows.map(row => row.reqId)
    const dateInput = { srcShortName: 'careers', requisitionIdList: ids }
    const dates = publicationHistory(await jsonAt(PUBLICATION_DATES_URL, dateInput), ids, checkedAt, reasons)
    const jobs = new Map(), observations = []
    // Fetch all details before applying caller output caps.
    for (const row of rows) {
      const observation={listingRecord:row,detailRecord:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
      observations.push(observation)
      let payload
      try { payload = await jsonAt(DETAIL_URL, { source: 'careers', id: '', code: '', reqId: row.reqId }) }
      catch (error) {
        signal?.throwIfAborted()
        if (error instanceof NativeContractError) throw error
        reasons.add(`native-detail-unavailable:${row.reqId}`); continue
      }
      const detail = payload?.data?.reqDetailsBO
      observation.detailRecord=detail??null
      if (payload?.status !== 200 || !detail) { reasons.add(`native-detail-unavailable:${row.reqId}`); continue }
      requireNative(detail.reqId === row.reqId && norm(detail.reqTitle) === norm(row.reqTitle), 'full-detail role identity conflicts with listing')
      if (row.statusId !== 3 || detail.statusId !== 3 || detail.requisitionPublished !== true) { reasons.add(`native-role-not-published:${row.reqId}`); continue }
      const description = extractActiveDescription(detail.jdDisplay)
      const visibleDocument = description ? readVisibleNativeDocument(detail.jdDisplay) : null
      const visibleRoot = visibleDocument?.nodes(node => node.tag === 'root')[0]
      const visible = visibleRoot ? visibleDocument.text(visibleRoot) : ''
      const originalRoot=typeof detail.jdDisplay==='string'?readNativeDocument(detail.jdDisplay).nodes(node=>node.tag==='root')[0]:null
      const rawText=node=>typeof node==='string'?decodeNativeEntities(node):typeof node.raw==='string'?decodeNativeEntities(node.raw):node.children.map(rawText).join(' ')
      const originalText=originalRoot?norm(rawText(originalRoot)):''
      if (!description || !visible || !originalRoot || !hasReviewedCriterionRendering(originalRoot) || visible.replace(/\s/g, '') !== description.replace(/\s/g, '') || originalText.replace(/\s/g,'')!==description.replace(/\s/g,'')) {
        reasons.add(`full-native-description-unavailable:${row.reqId}`); continue
      }
      const employers = [detail.companyName, detail.clientName, detail.hiringOrganization?.name, row.companyName, row.clientName, row.hiringOrganization?.name].filter(value => value != null)
      const business = description.match(/\bBusiness:\s*(.+?)\s*(?:Experience:|About the Role|$)/i)?.[1]
      if (employers.some(name => norm(name) !== 'Licious') || (business && norm(business) !== 'Licious') || !/\bLicious\b/i.test(description)) {
        reasons.add(`role-employer-scope-unresolved:${row.reqId}`); continue
      }
      const location = roleLocation(row, detail, reasons), history = dates.get(row.reqId)
      if (!location || !history?.length) continue
      const publishedOn = history.at(-1), sourceUrl = jobUrl(row.reqId, 'jd'), applyUrl = jobUrl(row.reqId, 'application')
      const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string') ? value.map(norm).filter(Boolean) : []
      jobs.set(row.reqId, { source: 'licious', company: 'Licious', nativeEmployerBrand: tenant.clientName,
        jobId: String(row.reqId), requisitionId: String(row.reqId), title: norm(row.reqTitle), department: norm(row.buName) || null,
        city: location.city, country: 'India', location: location.locations.join('; '), locations: location.locations,
        sourceUrl, applyUrl, link: applyUrl, jobDescription: detail.jdDisplay, sourceDescription: detail.jdDisplay, jobDescriptionHtml: detail.jdDisplay,
        sourceDetailComplete: true, postingDate: new Date(publishedOn).toISOString(), closingDate: null,
        employmentType: norm(row.employmentType) || null,
        experienceRequired: Number.isFinite(detail.expMin) && Number.isFinite(detail.expMax) && detail.expMin >= 0 && detail.expMax >= detail.expMin && detail.expMax > 0
          ? `${detail.expMin} - ${detail.expMax} Years` : null,
        requiredSkills: strings(detail.mandatorySkillList), preferredSkills: strings(detail.nonMandatorySkillList),
        minimumQualification: null, preferredQualification: null, nativeEducationRequirements: strings(detail.educationList),
        sourceNativeLocations: location.assigned,
        sourceNativeCountryEvidence: { method: 'explicit-native-role-country-with-reconciled-assigned-locations', rawCountry: row.countryCode ?? row.country ?? detail.countryCode ?? detail.country ?? null, source: 'reqDetailsBO.country+locationList' },
        sourceNativeDates: { publishedOn, publicationEvents: history, firstPublishedOn: history[0], approvedOn: row.approvedOn ?? null },
        sourceNativeStatusEvidence: { statusId: detail.statusId, requisitionPublished: detail.requisitionPublished },
        sourceNativeEmployerEvidence: { clientId: tenant.clientId, clientName: tenant.clientName, companyWebsite: tenant.companyWebsite,
          configuredTenant: 'licious', configuredDetailUrl: DETAIL_URL, legalEmployer: null },
        sourceNativeExperience: { expMin: detail.expMin, expMax: detail.expMax, fresher: detail.fresher },
        companyCareerPage: CAREERS_URL, companyDomain: 'licious.in', atsPlatform: 'mynexthire', scrapedAt: new Date(now()).toISOString(),
      })
    }
    const closing = listingRows(await jsonAt(LISTING_API_URL, LISTING_INPUT))
    const closingDates = publicationHistory(await jsonAt(PUBLICATION_DATES_URL, dateInput), ids, new Date(now()).getTime(), reasons)
    requireNative(tenantIdentity(await jsonAt(TENANT_URL)) === identity, 'closing native employer identity changed')
    const closingMap = new Map(closing.map(row => [row.reqId, row]))
    if (closing.length !== rows.length || rows.some(row => !closingMap.has(row.reqId) || state(closingMap.get(row.reqId)) !== state(row))) reasons.add('closing-native-inventory-not-reconciled')
    const healthy = rows.filter(row => jobs.has(row.reqId) && closingMap.has(row.reqId) && state(closingMap.get(row.reqId)) === state(row)
      && JSON.stringify(dates.get(row.reqId)) === JSON.stringify(closingDates.get(row.reqId))).map(row => jobs.get(row.reqId))
    if (healthy.length !== jobs.size) reasons.add('closing-native-role-or-publication-changed')
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    const complete = reasons.size === 0
    if (!complete) selected.forEach(job => Object.assign(job, { sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false }))
    attachSourceObservationEvidence(selected,{source:'licious',recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false})
    Object.defineProperty(selected,'nativeCollectionEvidence',{value:{source:'licious',recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,observations,closingRecords:closing,reasons:[...reasons]},configurable:true})
    return attachInventoryEvidence(selected, { status: complete ? closing.length === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',
      lifecycleCleanupAllowed:false,
      firstParty: true, surface: CURRENT_JOBS_URL, listingComplete: complete, reportedTotal: closing.length, indiaFacetCount: complete ? healthy.length : null,
      pagesFetched: requests, verifiedAt: new Date(now()).toISOString(), reason: complete ? 'current-native-employer-full-inventory-details-and-closing-reconciled'
        : `licious-native-incomplete:${[...reasons].join(';')}` })
  },
})
