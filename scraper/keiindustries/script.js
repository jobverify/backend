import { createHash } from 'node:crypto'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { visibleDocument, visibleText, decodeLeaf, normalizeText } from './nativeVisibility.js'
import KEI_INDUSTRIES_CATALOG from './catalog.js'

export const PROVIDER_METADATA = KEI_INDUSTRIES_CATALOG
export const SOURCE = 'keiindustries'
export const COMPANY = 'KEI Industries'
export const HOMEPAGE_URL = 'https://www.kei-ind.com/'
export const CAREER_PAGE_URL = 'https://www.kei-ind.com/career-at-kei/life-at-kei/'
export const JOBS_ARCHIVE_URL = 'https://www.kei-ind.com/jobs/' // Legacy general-content archive; never enumerate it as hiring inventory.
export const PUBLIC_PORTAL_URL = 'https://keihrms.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab'
const LABEL_BODY = { CompanyID: 'KEIIND', FormModuleCode: ['CAND_JOSK_00_28,CAND_GENR_00_00','CAND_VACY_00_24'] }
const clean = value => normalizeText(value) || null
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const absolute = (value, base = HOMEPAGE_URL) => { try { return new URL(value, base).href } catch { return null } }
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
export class KeiNativeError extends Error { constructor(message) { super('KEI Industries native: ' + message); this.abortRetries = true } }
const valid = (condition, message) => { if (!condition) throw new KeiNativeError(message) }
const parseJson = value => { try { return JSON.parse(value) } catch { throw new KeiNativeError('invalid native JSON') } }
const date = value => {
  if (typeof value !== 'string') return null
  let iso = value.trim()
  const calendar = iso.slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendar) || !Number.isFinite(Date.parse(calendar)) || !new Date(calendar).toISOString().startsWith(calendar)) return null
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(iso)) iso = iso.slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(iso) || !Number.isFinite(Date.parse(iso))) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !new Date(iso).toISOString().startsWith(iso) ? null : iso
}
const countryName = value => {
  const name = clean(value)?.toLowerCase()
  return ({ in: 'India', ind: 'India', india: 'India', us: 'United States', usa: 'United States', 'united states': 'United States', 'united states of america': 'United States', uk: 'United Kingdom', gb: 'United Kingdom', 'united kingdom': 'United Kingdom', austria: 'Austria', germany: 'Germany', de: 'Germany', japan: 'Japan', jp: 'Japan', singapore: 'Singapore', sg: 'Singapore' })[name] || null
}
const locationCountry = value => {
  // ISO aliases belong to typed country fields. IN/DE in an untyped location
  // can be Indiana/Delaware and cannot establish the work country.
  const writtenCountry = /^(?:India|United States(?: of America)?|United Kingdom|Austria|Germany|Japan|Singapore)$/i
  const matches = [...new Set((value || '').split(/[,;|]/).map(clean).filter(part => part && writtenCountry.test(part)).map(countryName).filter(Boolean))]
  return matches
}
const dynamicSections = (record, labels) => Object.entries(record).filter(([key]) => key.endsWith('~D')).sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => {
  const nativeKey = key.slice(0,-2), label = typeof labels[nativeKey] === 'string' ? labels[nativeKey].split('~')[0] : nativeKey
  return { nativeKey: key, label, value: ['string','number','boolean'].includes(typeof value) ? clean(value) : value == null ? null : undefined }
})
export const extractNativeJob = (record, { portalUrl = PUBLIC_PORTAL_URL, labels = {}, now = new Date().toISOString() } = {}) => {
  if (!object(record)) return null
  const id = ['string','number'].includes(typeof record.JOB_REQUEST_CODE) ? clean(record.JOB_REQUEST_CODE) : null
  const title = typeof record.FUNCTION_NAME === 'string' ? clean(record.FUNCTION_NAME) : null
  const sections = dynamicSections(record, labels), get = pattern => sections.filter(s => pattern.test(s.label)).map(s => s.value).filter(Boolean).join('; ') || null
  const description = visibleText(record.FUNCTION_DESC || ''), responsibilities = visibleText(record.FUNCTION_RESPONSIBILITY || '')
  const countryValues = [record.COUNTRY_NAME, record.COUNTRY, record.COUNTRY_CODE, ...sections.filter(s => /^country(?: code)?$/i.test(s.label)).map(s => s.value)].filter(v => v != null && v !== '')
  const rawLocation = clean(record.LOCATION_NAME), locationExplicit = locationCountry(rawLocation)
  const countries = countryValues.map(countryName); countries.push(...locationExplicit)
  const known = countries.length > 0 && countries.every(Boolean) && new Set(countries).size === 1, country = known ? countries[0] : null
  const full = Boolean(id && title && description.text && responsibilities.text && !description.unresolved && !responsibilities.unresolved && sections.every(s => s.value !== undefined))
  const publication = date(record.POSTED_ON), closing = date(record.APPLY_END_DATE), nativeReq = get(/^requisition (?:id|number)$/i)
  const text = [labels.CAND_VACY_lblJbDes?.split('~')[0] || 'Job description', description.text, labels.CAND_VACY_lblRolRes?.split('~')[0] || 'Roles & responsibilities', responsibilities.text, ...sections.filter(s => s.value).map(s => s.label + ': ' + s.value)].filter(Boolean).join('\n')
  const expiry = closing ? Date.parse(closing.length === 10 ? closing + 'T23:59:59.999Z' : closing) : null
  return { source: SOURCE, company: COMPANY, title, jobId: id, id, sourceJobId: id, requisitionId: nativeReq,
    country, city: clean(record.CITY || record.CITY_NAME) || (rawLocation && !/[,;|]/.test(rawLocation) ? rawLocation : null), state: clean(record.STATE_NAME || record.STATE), location: rawLocation,
    department: get(/^department$/i), employmentType: get(/^(?:employment type|job type)$/i), remoteStatus: get(/^(?:work arrangement|work mode|remote status)$/i),
    experienceRequired: clean(record.EXPERIENCE) || get(/^experience$/i), minimumQualification: get(/^(?:qualification|education)(?:s| required)?$/i), preferredQualification: get(/^preferred qualification/i), requiredSkills: sections.filter(s => /^(?:skills|competencies)(?: required)?$/i.test(s.label) && s.value).map(s => s.value), compensation: get(/^(?:salary|compensation)$/i),
    postingDate: publication, postedAt: publication, nativePublicationDate: publication, nativePublicationOriginal: record.POSTED_ON ?? null, nativePublicationSource: publication ? 'anonymous native vacancy POSTED_ON' : null, sourcePublicationDateUnavailable: !publication,
    closingDate: closing, validThrough: closing, sourceClosingDateIsExact: Boolean(closing && closing.length > 10), nativeInactive: Boolean(record.OFFER_FILLED === '1' || record.OFFER_FILLED === 1 || expiry && expiry < Date.parse(now)),
    sourceUrl: portalUrl, applyUrl: portalUrl, link: portalUrl, applicationUrlIsGeneric: true, applicationUrlScope: 'employer-native-vacancy-portal',
    applicationPostingContext: { nativePostingId: id, nativeTitle: title, publicCompanyId: 'KEIIND', formalRequisitionId: nativeReq }, applicationPublicContextValidated: Boolean(id && title), applicationRequiresLogin: true, applicationSubmitted: false, candidateActionsTaken: false,
    jobDescription: full ? text : null, sourceDescription: full ? text : null, sourceDetailComplete: full, sourceIdentityComplete: Boolean(id && title), sourceDetailFailureKind: full ? null : 'full-native-vacancy-criteria-unresolved',
    sourceNativeCriteria: { description: description.text, responsibilities: responsibilities.text, dynamicFields: sections, visibilityUnresolved: description.unresolved || responsibilities.unresolved },
    sourceNativeCountryEvidence: { explicitCountryValues: countryValues, roleLocation: rawLocation, explicitLocationCountry: locationExplicit, resolved: known }, sourceNativeDates: { publication: record.POSTED_ON ?? null, expiry: record.APPLY_END_DATE ?? null },
    sourceNativeEmployerEvidence: { officialHomepage: HOMEPAGE_URL, publicCompanyId: 'KEIIND', portalUrl, nativePostingId: id } }
}
export const defaultFetchPage = async (url, { fetchImpl = fetch, timeoutMs = 30000, signal, ...init } = {}) => {
  const response = await fetchImpl(url, { ...init, redirect: 'follow', signal: signal || AbortSignal.timeout(timeoutMs) })
  const body = await response.text()
  return { status: response.status, url: response.url, contentType: response.headers?.get?.('content-type'), body, html: body }
}
const publicChannels = html => {
  const doc = visibleDocument(html, n => n.tag === 'a'), urls = []
  valid(doc.nodes(n => n.tag === 'title' && /\bKEI\b/i.test(decodeLeaf(n.raw))).length === 1, 'official employer title changed')
  for (const n of doc.nodes(n => n.tag === 'a')) {
    const href = absolute(n.attrs.href)
    if (!href || !/career|\bjobs?\b|vacanc|open positions?|apply now|join (?:our|the) team/i.test(doc.text(n))) continue
    const u = new URL(href)
    if (u.pathname === '/CandidateMAX/') urls.push(href)
    else if (!href.startsWith('https://www.kei-ind.com/career-at-kei/') && !/^mailto:/i.test(href)) urls.push(href)
  }
  return { urls: [...new Set(urls)].sort(), visibilityUnresolved: doc.unresolved }
}
const publicProtocol = script => script.includes('CPVacancyDetails/GetVacancyInformationWithoutToken') && /\{CompanyID:this\.appConfig\.CompanyID,Flag:\w+\}/.test(script)
  && script.includes('CPLandigPage/GetLandingPage') && script.includes('CPCommon/GetLabelWithoutToken') && script.includes('refreshPagedData()')
  && script.includes('selectedJobDetail.FUNCTION_DESC') && script.includes('selectedJobDetail.FUNCTION_RESPONSIBILITY') && /\.includes\("~D"\)/.test(script)
  && script.includes('assets/company/') && script.includes('/config.json')
const employerLanding = payload => payload?.IsValid === true && payload.Data?.some(d => Array.isArray(d.CompanyDetails) && d.CompanyDetails.some(c => /^KEI INDUSTRIES (?:LTD\.?|LIMITED)$/i.test(c.LINK_NAME || '') && absolute(c.LINK_ADDRESS) === HOMEPAGE_URL))
const readVacancies = payload => {
  if (payload?.IsValid !== true || !Array.isArray(payload.Data) || payload.Data.length !== 1 || !Array.isArray(payload.Data[0]?.VacancyInformation)) return null
  const hasPagination = Object.entries(payload).concat(Object.entries(payload.Data[0])).some(([k,v]) => /^(?:hasmore|next|nextpage|nextcursor|continuationtoken|offset|pagenumber|pagesize)$/i.test(k.replaceAll('_','')) && v != null && v !== false && v !== '')
  return hasPagination ? null : payload.Data[0].VacancyInformation
}
export const createKeiIndustriesScraper = () => ({ async run(options = {}) {
  const load = options.fetchPage || defaultFetchPage, now = new Date((options.now || (() => new Date().toISOString()))()).toISOString(), maxJobs = options.maxJobs ?? 0
  valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid output budget')
  valid(!options.fetchJson && !options.fetchText || options.fetchPage, 'use native fetchPage transport')
  let requests = 0, pagesFetched = 0
  const request = async (url, body) => {
    options.signal?.throwIfAborted()
    const r = await load(url, { method: body ? 'POST' : 'GET', headers: { Accept: body || url.endsWith('.json') ? 'application/json' : url.endsWith('.js') ? 'application/javascript' : 'text/html', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: options.signal }); requests++
    const text = r?.body ?? r?.html
    if ([401,403,429].includes(Number(r?.status)) || /<(?:title|h1)\b[^>]*>\s*(?:access denied|just a moment|verify you are human|request rejected|captcha|attention required|pardon our interruption|robot check)|\bid=["'](?:challenge-form|cf-chl-)/i.test(text || '')) throw new KeiNativeError('public access denied HTTP ' + r?.status)
    valid(r?.status === 200 && r.url === url && typeof text === 'string' && Buffer.byteLength(text) <= 8*1024*1024, 'public response or employer binding changed')
    return text
  }
  let handoffVisibilityUnresolved = false
  const surfaces = async () => { const homepage = await request(HOMEPAGE_URL), hub = await request(CAREER_PAGE_URL), parsed = [publicChannels(homepage),publicChannels(hub)], channels = [...new Set(parsed.flatMap(p => p.urls))].sort(); if (parsed.some(p => p.visibilityUnresolved)) handoffVisibilityUnresolved = true; valid(channels.includes(PUBLIC_PORTAL_URL), 'official current openings handoff changed'); return channels }
  const openingChannels = await surfaces(), scopes = [], nativeJobs = [], reasons = []
  for (const portalUrl of openingChannels) {
    const u = new URL(portalUrl), scope = { portalUrl, complete: false, observedCount: null, nativeReportedTotal: null, reason: null }
    scopes.push(scope)
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !['keihrms.myadrenalin.com','maxhr.myadrenalin.com'].includes(u.hostname) || u.pathname !== '/CandidateMAX/' || !/[?&]CompanyID=KEIIND(?:[&#]|$)/.test(u.hash)) { scope.reason = 'unresolved-advertised-recruitment-channel'; reasons.push(scope.reason); continue }
    const base = u.origin + '/CandidateMAX/', shell = await request(base), doc = visibleDocument(shell, n => n.tag === 'script')
    const scripts = doc.nodes(n => n.tag === 'script' && /^main\.[\w.-]+\.js$/.test(n.attrs.src || '')).map(n => absolute(n.attrs.src,base))
    if (scripts.length !== 1) { scope.reason = 'public-native-frontend-unresolved'; reasons.push(scope.reason); continue }
    const script = await request(scripts[0]); scope.frontendSHA256 = hash(script)
    if (!publicProtocol(script)) { scope.reason = 'anonymous-native-protocol-changed'; reasons.push(scope.reason); continue }
    const config = parseJson(await request(base + 'assets/company/KEIIND/config.json'))
    if (config.apiURL !== u.origin || config.apiPath !== '/CandidateMAX/') { scope.reason = 'native-api-employer-binding-changed'; reasons.push(scope.reason); continue }
    const landing = parseJson(await request(base + 'CPLandigPage/GetLandingPage', { CompanyID: 'KEIIND' }))
    if (!employerLanding(landing)) { scope.reason = 'advertised-portal-employer-unresolved'; reasons.push(scope.reason); continue }
    const labelPayload = parseJson(await request(base + 'CPCommon/GetLabelWithoutToken', LABEL_BODY))
    if (labelPayload.IsValid !== true || !object(labelPayload.Data?.[0])) { scope.reason = 'native-labels-unresolved'; reasons.push(scope.reason); continue }
    const labels = labelPayload.Data[0], feedUrl = base + 'CPVacancyDetails/GetVacancyInformationWithoutToken', body = { CompanyID: 'KEIIND', Flag: 'OP' }
    const opening = readVacancies(parseJson(await request(feedUrl,body))); pagesFetched++
    if (!opening) { scope.reason = 'native-full-list-or-pagination-unresolved'; reasons.push(scope.reason); continue }
    const rows = opening.map(r => extractNativeJob(r,{portalUrl,labels,now})), ids = rows.map(r => r?.jobId), duplicates = ids.filter((id,i) => id && ids.indexOf(id) !== i)
    for (const r of rows) if (r && duplicates.includes(r.jobId)) { r.sourceIdentityComplete = false; r.sourceDetailComplete = false; r.sourceDescription = null; r.jobDescription = null; r.sourceDetailFailureKind = 'duplicate-native-posting-id' }
    nativeJobs.push(...rows.filter(Boolean)); scope.observedCount = opening.length
    const closing = readVacancies(parseJson(await request(feedUrl,body))); pagesFetched++
    const closingLanding = parseJson(await request(base + 'CPLandigPage/GetLandingPage',{CompanyID:'KEIIND'})), closingLabels = parseJson(await request(base + 'CPCommon/GetLabelWithoutToken', LABEL_BODY))
    scope.closingReconciled = Boolean(closing && hash(opening) === hash(closing) && employerLanding(closingLanding) && hash(labels) === hash(closingLabels.Data?.[0]))
    scope.complete = scope.closingReconciled && rows.every(r => r?.sourceIdentityComplete) && !duplicates.length
    if (!scope.complete) { scope.reason = 'native-closing-inventory-or-identity-unresolved'; reasons.push(scope.reason) }
  }
  const closingChannels = await surfaces(), handoffsStable = JSON.stringify(openingChannels) === JSON.stringify(closingChannels)
  if (!handoffsStable) reasons.push('closing-official-recruitment-handoffs-changed')
  if (handoffVisibilityUnresolved) reasons.push('official-career-handoff-visibility-unresolved')
  const nativeChannelRecordCount = nativeJobs.length, uniqueJobs = new Map(), unidentified = []
  const comparable = r => ({ title: r.title, country: r.country, location: r.location, criteria: r.sourceNativeCriteria, dates: r.sourceNativeDates, requisitionId: r.requisitionId, inactive: r.nativeInactive })
  for (const job of nativeJobs) {
    if (!job.jobId) { unidentified.push(job); continue }
    const existing = uniqueJobs.get(job.jobId)
    if (!existing) { uniqueJobs.set(job.jobId, job); continue }
    if (hash(comparable(existing)) !== hash(comparable(job))) {
      reasons.push('conflicting-native-posting-across-channels')
      existing.sourceIdentityComplete = false; existing.sourceDetailComplete = false; existing.sourceDescription = null; existing.jobDescription = null; existing.sourceDetailFailureKind = 'conflicting-native-posting-across-channels'
    }
    existing.sourceNativeEmployerEvidence.advertisedPortals = [...new Set([...(existing.sourceNativeEmployerEvidence.advertisedPortals || [existing.applyUrl]),job.applyUrl])]
  }
  nativeJobs.splice(0,nativeJobs.length,...uniqueJobs.values(),...unidentified)
  if (nativeJobs.some(r => !r.country)) reasons.push('role-owned-country-unresolved')
  if (nativeJobs.some(r => !r.sourceDetailComplete)) reasons.push('full-native-criteria-unresolved')
  const scopeComplete = handoffsStable && scopes.length > 0 && scopes.every(s => s.complete) && !reasons.length
  const india = nativeJobs.filter(r => r.country === 'India' && r.jobId && r.title && !r.nativeInactive), outputCapped = maxJobs > 0 && india.length > maxJobs, listingComplete = scopeComplete && !outputCapped
  const jobs = (outputCapped ? india.slice(0,maxJobs) : india).map(r => ({ ...r, scrapedAt: now, sourceListingComplete: listingComplete, sourceCleanupEligible: listingComplete, sourcePrimaryScopeComplete: scopes.find(s => s.portalUrl === PUBLIC_PORTAL_URL)?.complete === true }))
  const metrics = analyzePublishableJobs(jobs,{now:new Date(now)})
  const audit = { source: SOURCE, nativeJobs, scopes, requests, pagesFetched, observedGlobalCount: nativeJobs.length, nativeChannelRecordCount, nativeGlobalReportedTotal: null, primaryScopeComplete: scopes.find(s => s.portalUrl === PUBLIC_PORTAL_URL)?.complete === true, scopeComplete, closingReconciled: handoffsStable && scopes.every(s => s.closingReconciled === true), indiaJobCount: scopeComplete ? india.length : null, cleanupEligible: listingComplete, fullHealthyIndia: india.filter(r => r.sourceDetailComplete && r.applicationPublicContextValidated && !r.nativeInactive).length, eligibleCount: metrics.eligibleJobs.length, outputCapped, reasons: [...new Set(reasons)] }
  options.onAudit?.(audit)
  return attachInventoryEvidence(jobs,{status:listingComplete ? (nativeJobs.length ? 'complete-inventory':'verified-empty'):'coverage-gap',surface:PUBLIC_PORTAL_URL,firstParty:true,listingComplete,pagesFetched,reportedTotal:null,indiaFacetCount:scopeComplete ? india.length:null,verifiedAt:now,reason:[...new Set(reasons)].concat(outputCapped?['output-capped-after-full-reconciliation']:[]).join(';') || 'all-advertised-native-public-feeds-and-closing-reconciliation'})
} })
export const run = async options => createKeiIndustriesScraper().run(options)
