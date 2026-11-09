import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { decodeLeaf, normalizeText, visibleDocument, visibleText } from './nativeVisibility.js'

export const SOURCE = 'datadesign'
export const COMPANY = 'Data Design'
export const LEGAL_EMPLOYER = '株式会社データ・デザイン'
export const HOMEPAGE_URL = 'https://www.datadesign.co.jp/'
export const RECRUIT_HOME_URL = 'https://recruit.datadesign.co.jp/'
export const CAREERS_PAGE_URL = 'https://recruit.datadesign.co.jp/jobs'
export const JOBS_API_URL = 'https://recruit.datadesign.co.jp/wp-json/wp/v2/tj_job'
const PROFILE_URL = 'https://job.mynavi.jp/27/pc/search/corp104502/outline.html'
const cls = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
const clean = value => normalizeText(value) || null
const htmlText = value => value == null || value === '' ? null : visibleText(value).text
const hash = value => createHash('sha256').update(value).digest('hex')
const json = value => { try { return JSON.parse(value) } catch { throw new DataDesignNativeError('invalid native JSON') } }
const absolute = (value, base = RECRUIT_HOME_URL) => { try { return new URL(value, base).href } catch { return null } }
const urlWithoutSlash = value => absolute(value)?.replace(/\/$/, '')
const object = value => value && typeof value === 'object' && !Array.isArray(value)
export class DataDesignNativeError extends Error {
  constructor(message) { super('Data Design native: ' + message); this.name = 'DataDesignNativeError'; this.abortRetries = true }
}
const valid = (condition, message) => { if (!condition) throw new DataDesignNativeError(message) }
const one = (nodes, label) => { valid(nodes.length === 1, 'expected one ' + label); return nodes[0] }
const nativePostingUrl = value => {
  const url = absolute(value)
  valid(url && /^https:\/\/recruit\.datadesign\.co\.jp\/jobs\/[\w%-]+\/?$/.test(url), 'invalid first-party posting URL')
  return url.replace(/\/$/, '')
}
const recordIdentity = r => {
  valid(object(r) && Number.isSafeInteger(r.id) && r.id > 0 && r.status === 'publish' && r.type === 'tj_job' && clean(r.slug), 'invalid native posting identity')
  const url = nativePostingUrl(r.link), values = r.taro_jobs_fields_data?.values
  valid(object(values) && absolute(values.organization_url) === HOMEPAGE_URL && values.organization_name === LEGAL_EMPLOYER, 'native employer identity conflicts')
  valid(url.endsWith('/' + r.slug), 'native slug/posting identity conflicts')
  return { url, values, id: String(r.id), title: clean(values.job_title) || htmlText(r.title?.rendered) }
}
export const buildListingsApiUrl = (page = 1, pageSize = 100) => {
  const url = new URL(JOBS_API_URL)
  url.searchParams.set('per_page', String(pageSize)); url.searchParams.set('page', String(page))
  url.searchParams.set('_fields', 'id,date,date_gmt,modified,modified_gmt,slug,status,type,link,title,content,excerpt,taro_jobs_fields_data,_links')
  return url.href
}
export const hasOfficialHomepageSignal = html => {
  const doc = visibleDocument(html, n => n.tag === 'title' || n.tag === 'a')
  return doc.nodes(n => n.tag === 'title' && /データ・デザイン/.test(decodeLeaf(n.raw))).length === 1
    && doc.nodes(n => n.tag === 'a' && absolute(n.attrs.href, HOMEPAGE_URL) === RECRUIT_HOME_URL).length > 0
}
const hasRecruitHomeSignal = html => {
  const doc = visibleDocument(html, n => n.tag === 'h1' || n.tag === 'a')
  return doc.nodes(n => n.tag === 'title' && decodeLeaf(n.raw).includes(LEGAL_EMPLOYER + '採用サイト')).length === 1
    && doc.nodes(n => n.tag === 'a' && urlWithoutSlash(n.attrs.href) === CAREERS_PAGE_URL).length > 0
}
export const hasOfficialCareersSignal = html => {
  const doc = visibleDocument(html, n => n.tag === 'h1' || n.tag === 'a')
  return doc.nodes(n => n.tag === 'body' && cls(n, 'post-type-archive-tj_job') && cls(n, 'wp-theme-data-design-recruit-theme')).length === 1
    && doc.nodes(n => n.tag === 'h1' && doc.text(n) === '募集要項').length === 1
    && doc.nodes(n => n.tag === 'title' && decodeLeaf(n.raw).includes(LEGAL_EMPLOYER + '採用サイト')).length === 1
}
const advertisedRoles = html => {
  const doc = visibleDocument(html, n => n.tag === 'a')
  return [...new Set(doc.nodes(n => n.tag === 'a' && /^https:\/\/recruit\.datadesign\.co\.jp\/jobs\/[\w%-]+\/?$/.test(absolute(n.attrs.href) || '')).map(n => nativePostingUrl(n.attrs.href)))].sort()
}
const countryAliases = new Map([['jp', ['JP', 'Japan']], ['jpn', ['JP', 'Japan']], ['japan', ['JP', 'Japan']], ['日本', ['JP', 'Japan']], ['in', ['IN', 'India']], ['ind', ['IN', 'India']], ['india', ['IN', 'India']], ['インド', ['IN', 'India']], ['us', ['US', 'United States']], ['usa', ['US', 'United States']], ['united states', ['US', 'United States']], ['united states of america', ['US', 'United States']]])
const country = value => {
  const label = typeof value === 'string' ? clean(value) : object(value) ? clean(value.name || value['@id']) : null
  if (!label) return null
  return countryAliases.get(label.toLowerCase()) || null
}
const geography = (schema, record, values) => {
  const locations = (Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]).filter(object)
  const raw = locations.map(l => l.address?.addressCountry)
  for (const model of [record, values]) for (const [key, value] of Object.entries(model)) if (/^(?:country|countrycode|jobcountry|addresscountry|joblocationcountry)$/i.test(key.replaceAll('_', '').replaceAll('-', '')) && value != null && value !== '') raw.push(value)
  const typed = raw.map(country), codes = [...new Set(typed.filter(Boolean).map(c => c[0]))]
  const known = raw.length > 0 && typed.every(Boolean) && codes.length === 1 && locations.length > 0 && locations.every(l => country(l.address?.addressCountry)?.[0] === codes[0])
  const label = known ? typed[0][1] : null, address = locations.length === 1 ? locations[0].address : null
  const city = clean(address?.addressLocality), state = clean(address?.addressRegion)
  return { country: label, countryCode: known ? codes[0] : null, city, state,
    location: label ? [...new Set([city, state, label].filter(Boolean))].join(', ') : clean(values.job_location),
    evidence: { explicitCountryValues: raw.map(v => typeof v === 'string' ? v : object(v) ? { name: v.name ?? null, id: v['@id'] ?? null } : null), countryCode: known ? codes[0] : null, resolved: known, nativeLocations: locations.map(l => ({ name: l.name ?? null, address: l.address ?? null })) } }
}
const date = (value, label) => {
  if (value == null || value === '') return null
  valid(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) && Number.isFinite(Date.parse(value)), 'invalid original ' + label)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) valid(new Date(value).toISOString().startsWith(value), 'invalid calendar ' + label)
  return value
}
const matchedDate = (a, b, label) => { const left = date(a, label), right = date(b, label); valid(!left || !right || left === right, 'native original ' + label + ' conflicts'); return left || right }
const criteriaNode = n => cls(n, 'entry-content') && cls(n, 'wp-block-post-content')
const childrenMatching = (node, predicate) => node.inert ? [] : [...(predicate(node) ? [node] : []), ...node.children.filter(c => typeof c !== 'string').flatMap(c => childrenMatching(c, predicate))]
const nativeSections = (doc, root) => childrenMatching(root, n => cls(n, 'wp-block-taro-jobs-job-field')).map(node => {
  const field = (node.attrs.class || '').split(/\s+/).find(name => name.startsWith('tj-job-field--'))?.slice('tj-job-field--'.length)
  const titles = childrenMatching(node, n => cls(n, 'tj-job-field__title--' + field)), values = childrenMatching(node, n => cls(n, 'tj-job-field__value--' + field))
  return { field: field || null, title: titles.length === 1 ? doc.text(titles[0]) || null : null, value: values.length === 1 ? doc.text(values[0]) || null : null }
})
const employment = value => /FULL_TIME|full.?time|正社員/i.test(value || '') ? 'Full-time' : /part.?time|パート|アルバイト/i.test(value || '') ? 'Part-time' : /contract|契約/i.test(value || '') ? 'Contract' : clean(value)
const workMode = value => /hybrid|ハイブリッド/i.test(value || '') ? 'Hybrid' : /on.?site|出社|オンサイト/i.test(value || '') ? 'On-site' : /remote|telework|在宅|リモート/i.test(value || '') ? 'Remote' : null

export const extractNativeJob = (record, roleHtml, { now = new Date().toISOString() } = {}) => {
  const { url, values, id, title } = recordIdentity(record)
  const doc = visibleDocument(roleHtml, criteriaNode), rawDoc = readNativeDocument(roleHtml)
  valid(doc.nodes(n => n.tag === 'body' && cls(n, 'single-tj_job') && cls(n, 'postid-' + id)).length === 1, 'role posting identity conflicts')
  valid(absolute(one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'role canonical').attrs.href) === url, 'canonical posting identity conflicts')
  valid(doc.nodes(n => n.tag === 'link' && n.attrs.type === 'application/json' && n.attrs.href === JOBS_API_URL + '/' + id).length === 1, 'REST self posting identity conflicts')
  const schemas = rawDoc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').map(n => json(n.raw)).flatMap(s => Array.isArray(s) ? s : Array.isArray(s['@graph']) ? s['@graph'] : [s]).filter(s => s['@type'] === 'JobPosting')
  const schema = one(schemas, 'native JobPosting schema')
  valid(schema.hiringOrganization?.name === LEGAL_EMPLOYER && absolute(schema.hiringOrganization.sameAs) === HOMEPAGE_URL, 'structured employer identity conflicts')
  valid(title && clean(schema.title) === title && doc.text(one(doc.nodes(n => n.tag === 'h1'), 'visible native title')) === title && htmlText(record.title?.rendered) === title, 'native title conflicts')
  const root = one(doc.nodes(criteriaNode), 'native criteria root'), api = visibleText(record.content?.rendered || '')
  const fullText = doc.text(root), sections = nativeSections(doc, root)
  const criteriaFields = new Set(['job_description', 'responsibilities', 'qualifications', 'skills', 'education_requirements', 'experience_requirements', 'job_benefits'])
  const unrenderedFields = Object.entries(values).filter(([key, value]) => (criteriaFields.has(key) || key.startsWith('cf_')) && htmlText(value) && !sections.some(s => s.field === key.replaceAll('_', '-') && s.value)).map(([key]) => key)
  const full = Boolean(api.text && !api.unresolved && !doc.unresolved && api.text === fullText && sections.length && sections.every(s => s.field && s.title) && !unrenderedFields.length)
  const geo = geography(schema, record, values), postingDate = matchedDate(values.date_posted, schema.datePosted, 'publication'), closingDate = matchedDate(values.valid_through, schema.validThrough, 'expiry')
  const expiry = closingDate && Date.parse(closingDate.length === 10 ? closingDate + 'T23:59:59.999Z' : closingDate)
  const inactive = Boolean(expiry && expiry < Date.parse(now))
  const req = clean(values.requisition_id || values.cf_requisition_id || record.requisition_id)
  valid(!req || sections.some(s => /requisition/.test(s.field) && s.value === req), 'formal requisition lacks native visible evidence')
  const skillsDoc = values.skills ? visibleDocument(values.skills) : null, skillItems = skillsDoc?.nodes(n => n.tag === 'li').map(n => skillsDoc.text(n)).filter(Boolean)
  const profileLinks = doc.nodes(n => n.tag === 'a' && absolute(n.attrs.href) === PROFILE_URL && doc.text(n))
  const declaredProfile = absolute(schema.url) === PROFILE_URL && profileLinks.length > 0
  const additionalScopes = [...new Set(profileLinks.map(() => PROFILE_URL).concat(absolute(schema.url) === PROFILE_URL ? [PROFILE_URL] : []))]
  if (schema.url && ![PROFILE_URL, url].includes(absolute(schema.url))) additionalScopes.push(absolute(schema.url))
  return { source: SOURCE, company: COMPANY, legalEmployer: LEGAL_EMPLOYER, jobId: id, id, sourceJobId: id, nativePostingSlug: record.slug, requisitionId: req,
    title, department: null, country: geo.country, city: geo.city, state: geo.state, location: geo.location,
    sourceUrl: url, applyUrl: declaredProfile ? PROFILE_URL : url, link: declaredProfile ? PROFILE_URL : url,
    applicationUrlIsGeneric: declaredProfile, applicationUrlScope: declaredProfile ? 'company-profile' : 'native-role', applicationPostingContext: { nativePostingId: id, nativePostingSlug: record.slug, sourceUrl: url, formalRequisitionId: req },
    employmentType: employment(values.employment_type || schema.employmentType), remoteStatus: workMode(values.job_location_type),
    postingDate, postedAt: postingDate, nativePublicationDate: postingDate, nativePublicationSource: postingDate ? 'tj_job date_posted + native JobPosting.datePosted' : null, sourcePublicationDateUnavailable: !postingDate, nativePublicationPrecision: postingDate ? postingDate.length === 10 ? 'day' : 'instant' : null,
    closingDate, validThrough: closingDate, sourceClosingDateIsExact: Boolean(closingDate && closingDate.length > 10), sourceClosingDatePrecision: closingDate ? closingDate.length === 10 ? 'day' : 'instant' : null,
    jobDescription: full ? fullText : null, sourceDescription: full ? fullText : null, sourceDetailComplete: full, sourceDetailFailureKind: full ? null : 'native-full-criteria-unresolved', nativeDescriptionSHA256: full ? hash(fullText) : null,
    experienceRequired: htmlText(values.experience_requirements), minimumQualification: htmlText(values.education_requirements) || htmlText(values.qualifications), preferredQualification: null, requiredSkills: skillItems?.length ? skillItems : htmlText(values.skills) ? [htmlText(values.skills)] : null,
    sourceNativeCriteria: { sections, unrenderedFields, visibilityIssues: doc.visibilityIssues, qualifications: htmlText(values.qualifications), education: htmlText(values.education_requirements), skills: htmlText(values.skills), experience: htmlText(values.experience_requirements), custom: Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('cf_')).map(([key, value]) => [key, htmlText(value)])) },
    sourceNativeCountryEvidence: geo.evidence, sourceNativeDates: { published: postingDate, expires: closingDate, cmsCreated: record.date ?? null, cmsModified: record.modified ?? null },
    sourceNativeEmployerEvidence: { brand: COMPANY, legalEmployer: LEGAL_EMPLOYER, corporateHomepage: HOMEPAGE_URL, nativePostType: 'tj_job', nativePostingId: record.id },
    sourceAdditionalRecruitmentScopes: additionalScopes, nativeInactive: inactive, applicationPublicContextValidated: declaredProfile || absolute(schema.url) === url, applicationSubmitted: false, candidateActionsTaken: false }
}

const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: 'follow' })
  return { url: response.url, status: response.status, contentType: response.headers.get('content-type'), headers: Object.fromEntries(response.headers), body: await response.text() }
}
const header = (response, name) => response.headers?.get ? response.headers.get(name) : Object.entries(response.headers || {}).find(([key]) => key.toLowerCase() === name)?.[1]
const denied = response => [401, 403, 429].includes(response?.status) || typeof response?.body === 'string' && /<(?:title|h1)\b[^>]*>\s*(?:access denied|just a moment|verify you are human|request rejected|captcha)/i.test(response.body)
const safeState = record => { const copy = { ...record, taro_jobs_fields_data: { ...record.taro_jobs_fields_data, values: { ...record.taro_jobs_fields_data?.values } } }; delete copy.taro_jobs_fields_data.values.pdf_export; return JSON.stringify(copy) }

export const createDataDesignScraper = (defaults = {}) => ({ async run(options = {}) {
  const settings = { ...defaults, ...options }, load = settings.fetchPage || defaultFetchPage, now = new Date((settings.now || (() => new Date().toISOString()))()).toISOString()
  const maxJobs = settings.maxJobs ?? 0, pageSize = settings.pageSize ?? 100, maxPages = settings.maxPages ?? 50, signal = settings.signal
  valid(!settings.fetchJson && !settings.fetchText || settings.fetchPage, 'native transport requires fetchPage')
  valid(settings.onAudit == null || typeof settings.onAudit === 'function', 'invalid audit observer')
  valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0 && Number.isSafeInteger(pageSize) && pageSize >= 1 && pageSize <= 100 && Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 100, 'invalid enumeration/output budget')
  let requests = 0, pagesFetched = 0
  const reasons = new Set(), additional = new Set()
  const pageAt = async (url, isJson = false, optional = false) => {
    signal?.throwIfAborted()
    const response = await load(url, { method: 'GET', headers: { Accept: isJson ? 'application/json' : 'text/html' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) })
    requests++; signal?.throwIfAborted()
    if (denied(response)) { const error = new DataDesignNativeError('public access denied or gate HTTP ' + response?.status); error.status = response?.status; error.accessDenied = true; if (optional) return { denied: true, status: response?.status }; throw error }
    valid(response?.url === url, 'public response redirect changed employer binding')
    if (optional && response.status !== 200) return { unavailable: true, status: response.status, companyInformationNotPublic: /該当する企業情報は現在公開しておりません/.test(response.body || '') }
    valid(response.status === 200, 'public HTTP ' + response.status)
    valid(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 8 * 1024 * 1024 && (isJson ? /^application\/json\b/i : /^text\/html\b/i).test(response.contentType || ''), 'public response format changed')
    return response
  }
  const surfaces = async () => {
    const home = await pageAt(HOMEPAGE_URL); valid(hasOfficialHomepageSignal(home.body), 'official homepage handoff changed')
    const hub = await pageAt(RECRUIT_HOME_URL); valid(hasRecruitHomeSignal(hub.body), 'official recruit handoff changed')
    const archive = await pageAt(CAREERS_PAGE_URL); valid(hasOfficialCareersSignal(archive.body), 'official native archive changed')
    return { home: advertisedRoles(home.body), hub: advertisedRoles(hub.body), archive: advertisedRoles(archive.body) }
  }
  const inventory = async () => {
    const rows = new Map(); let total, pages
    for (let page = 1; page <= maxPages; page++) {
      const response = await pageAt(buildListingsApiUrl(page, pageSize), true), payload = json(response.body)
      pagesFetched++
      const totalHeader = header(response, 'x-wp-total'), pagesHeader = header(response, 'x-wp-totalpages')
      valid(/^\d+$/.test(String(totalHeader)) && /^\d+$/.test(String(pagesHeader)), 'native pagination total headers missing')
      const count = Number(totalHeader), pageCount = Number(pagesHeader)
      valid(Number.isSafeInteger(count) && count >= 0 && Number.isSafeInteger(pageCount) && pageCount === (count === 0 ? 0 : Math.ceil(count / pageSize)) && Array.isArray(payload) && payload.length === Math.min(pageSize, Math.max(0, count - (page - 1) * pageSize)), 'native pagination/count does not reconcile')
      valid(total == null || total === count && pages === pageCount, 'native pagination total changed')
      total = count; pages = pageCount
      for (const record of payload) { const r = recordIdentity(record); valid(!rows.has(r.id) && ![...rows.values()].some(row => row.link === record.link), 'duplicate native posting across pages'); rows.set(r.id, record) }
      if (page >= pages) { valid(rows.size === total, 'native total count mismatch'); return { rows, total, pages } }
    }
    throw new DataDesignNativeError('native pagination budget exhausted')
  }
  const openingSurfaces = await surfaces(), opening = await inventory(), details = []
  for (const record of opening.rows.values()) {
    const response = await pageAt(nativePostingUrl(record.link)), job = extractNativeJob(record, response.body, { now })
    details.push(job)
    if (!job.country) reasons.add('native-country-unresolved:' + job.jobId)
    if (!job.sourceDetailComplete) reasons.add('native-full-criteria-unresolved:' + job.jobId)
    if (job.nativeInactive) reasons.add('native-role-inactive:' + job.jobId)
    for (const url of job.sourceAdditionalRecruitmentScopes) if (url) additional.add(url)
  }
  const closing = await inventory(), closingSurfaces = await surfaces()
  let primaryComplete = opening.total === closing.total && [...opening.rows].every(([id, row]) => closing.rows.has(id) && safeState(row) === safeState(closing.rows.get(id)))
  if (!primaryComplete) reasons.add('closing-native-inventory-changed')
  if (JSON.stringify(openingSurfaces) !== JSON.stringify(closingSurfaces)) { primaryComplete = false; reasons.add('closing-official-handoffs-changed') }
  for (const links of [...Object.values(openingSurfaces), ...Object.values(closingSurfaces)]) for (const url of links) if (![...opening.rows.values()].some(r => nativePostingUrl(r.link) === url) || ![...closing.rows.values()].some(r => nativePostingUrl(r.link) === url)) { primaryComplete = false; reasons.add('advertised-role-unreconciled:' + url) }
  const publicProfiles = []; let accessDenied = false
  // Public profile inspection occurs only after the primary closing pass. A
  // profile is an additional recruitment scope, never a candidate entry action.
  for (const url of additional) {
    reasons.add('additional-declared-recruitment-channel:' + url)
    if (url !== PROFILE_URL) continue
    let response
    try { response = await pageAt(url, false, true) } catch (error) { reasons.add('additional-recruitment-channel-unavailable'); publicProfiles.push({ url, status: null, inspected: false }); break }
    if (response.denied) { accessDenied = true; reasons.add('additional-recruitment-channel-access-denied:' + response.status); publicProfiles.push({ url, status: response.status, inspected: false }); break }
    if (response.unavailable) { reasons.add('additional-recruitment-channel-unavailable:' + response.status); publicProfiles.push({ url, status: response.status, inspected: false, companyInformationNotPublic: response.companyInformationNotPublic === true }); continue }
    const profile = visibleDocument(response.body), bound = profile.nodes(n => n.tag === 'title' && decodeLeaf(n.raw).includes(LEGAL_EMPLOYER)).length === 1 || profile.nodes(n => /^h[1-3]$/.test(n.tag) && profile.text(n).includes(LEGAL_EMPLOYER)).length > 0
    reasons.add(bound ? 'additional-public-profile-recruitment-scope-unenumerated' : 'additional-public-profile-employer-unresolved')
    publicProfiles.push({ url, status: response.status, inspected: true, employerBound: bound })
  }
  const india = details.filter(job => job.country === 'India'), healthy = india.filter(job => job.sourceDetailComplete && !job.nativeInactive && closing.rows.has(job.jobId) && safeState(opening.rows.get(job.jobId)) === safeState(closing.rows.get(job.jobId)))
  const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
  const eligibility = analyzePublishableJobs(healthy, { now: new Date(now) })
  if (selected.length < healthy.length) reasons.add('source-job-limit')
  const complete = primaryComplete && reasons.size === 0
  const audit = { primaryNativeGlobal: opening.total, confirmedPrimaryIndia: india.length, foreignPrimary: details.filter(job => job.country && job.country !== 'India').length, unknownCountry: details.filter(job => !job.country).length, fullNativeDetails: details.filter(job => job.sourceDetailComplete).length,
    fullHealthyIndia: healthy.length, eligibleIndia: eligibility.eligibleJobs.length, eligibilityFilterCounts: eligibility.filterCounts, returnedIndia: selected.length, primaryInventoryComplete: primaryComplete, inventoryComplete: complete, wholeCompanyIndia: complete ? healthy.length : null, wholeCompanyGlobal: complete ? opening.total : null,
    openingNativeGlobal: opening.total, closingNativeGlobal: closing.total, nativePages: opening.pages, pagesFetched, requests, accessDenied, additionalRecruitmentScopes: publicProfiles, reasons: [...reasons], sourceScopeComplete: complete, lifecycleCleanupAllowed: complete }
  for (const job of selected) Object.assign(job, { scrapedAt: now, companyCareerPage: CAREERS_PAGE_URL, companyDomain: 'datadesign.co.jp', atsPlatform: 'wordpress-jobs-api', sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete, sourceNativeInventoryEvidence: audit })
  Object.defineProperty(selected, 'nativeInventoryAudit', { value: audit })
  settings.onAudit?.(structuredClone(audit))
  return attachInventoryEvidence(selected, { status: complete ? opening.total ? 'complete-inventory' : 'verified-empty' : 'discovery-only', firstParty: true, surface: CAREERS_PAGE_URL, listingComplete: complete, pagesFetched: requests, reportedTotal: complete ? opening.total : null, indiaFacetCount: complete ? healthy.length : null, verifiedAt: now, reason: complete ? 'datadesign-native-inventory-reconciled' : 'datadesign-native-partial:' + [...reasons].join(';') })
} })

export const run = options => createDataDesignScraper().run(options)
