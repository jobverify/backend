import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { readNativeDocument, readNativeAttributeTokens, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE = 'omegahealthcaremanagementservices'
const COMPANY = 'Omega Healthcare Management Services'
const LEGAL_ENTITY = 'Omega Healthcare Management Services Private Limited'
const INDIA = 'https://www.omegahms.com/careers-india/'
const ORIGIN = 'https://omegacareers.peoplestrong.com'
const CHANNEL = ORIGIN + '/job/joblist'
const API = ORIGIN + '/api/cp/rest/altone/cp/'
const PARTS = 'basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'
const PRIVATE = ['FirstName', 'LastName', 'Username', 'hiringManagerName']
const PROFILES = {"listing":["organizationUnitComplete","jobPostedDate","locationHierarchyComplete","jobDetailUrl","designation","designationID","hrOrgUnitID","functionalAreaID","worksiteID","targetNationalityID","promoteEmirates","jurisdictionTypeID","authorityTypeID","jurisdictionType","authorityType","requisitionId","jobTitle","jobCode","openings","organizationUnit","industry","functionalArea","role","jobClosureDate","locationHierarchy","expRange","CTCRange","skills","applied","programType","roleType","roleContributionType","employmentTenureType","minBudgetSalary","maxBudgetSalary","DepartmentID","TargetNationality"],"detail":["gradeID","minimumExp","isCampusJob","jobTitle","entityID","requisitionCode","jurisdictionTypeID","maximumExp","skills","qualifications","jobRole","CandidatePortalStartDate","confidential","noOfOpening","payGroupID","CandidatePortalEndDate","tat","minSalary","employmentTenureType","campusSysContentType","RoleName","maxBudgetSalary","functionalArea","JobFamilyCode","jobDescription","gradeCode","designation","CampusType","shiftTo","maxSalary","designationID","WorkflowName","roleType","locationHierarchyComplete","requisitionId","orgUnitCode","Onsite","organizationUnitComplete","hrOrgUnitID","requisitionType","currency","departmentHierarchy","industryName","roleContributionType","programType","jobTitleID","languages","employmentType","functionalDesignation","joiningLocation","EducationSepecializationID","employeeCategoryTypeID","internalJobDescription","educationSepecialization","certifications","authorityTypeID","minBudgetSalary","requisitionStatus","shiftFrom","bandId","worksiteID","functionalDesignationID","jobRoleID","FirstName","LastName","Username","hiringManagerName"],"organization":["orgUnitHierarchy","functionalArea","industry","role","minSalary","maxSalary","currency","ctcRange","accountCode","accountName","projectName","customerInterview","careerStream","projectCategory","primaryLocation","secondaryLocation","tower","workSiteHierarchy","costCenterID","costCenter","workCenterID","workCenter","departmentHierarchy","buHierarchy","divisionHierarchy","currencyDecimalConfiguration"]}
const fail = message => Object.assign(new Error(`[${SOURCE}] PeopleStrong contract: ${message}`), {
  softFailure: true, upstreamOutage: false, failureKind: 'upstream_contract_changed', abortRetries: true,
  sourceScopeComplete: false, lifecycleCleanupAllowed: false, inventoryCleanupAllowed: false,
})
const need = (ok, message) => { if (!ok) throw fail(message) }
const empty = value => value === null || value === undefined || value === '' || Array.isArray(value) && !value.length || value && typeof value === 'object' && !Object.keys(value).length
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const fields = (value, allowed, label) => {
  need(object(value), label + ' object missing')
  for (const [key, item] of Object.entries(value)) need(allowed.includes(key) || empty(item), label + ' unreviewed nonempty carrier: ' + key)
}
const scrub = value => Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE.includes(key)))

const scalarFields = (value, containers, label) => {
  for (const [key, item] of Object.entries(value)) need(containers.includes(key) || empty(item) || typeof item !== 'object', label + ' unreviewed structured carrier: ' + key)
}
// Qualification labels have no mandatory/preferred/minimum-degree authority.
// Admit bounded plain data only; preserve the original string without trimming.
const plainQualificationLabel = value => {
  need(typeof value === 'string' && value.length > 0 && value.length <= 256
    && Buffer.byteLength(value) <= 1024 && value.trim() === value,
  'unreviewed plain qualification label size/whitespace carrier')
  need(/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'&/+\-]*$/u.test(value)
    && !/\b(?:window|document|globalThis|console|eval|function|fetch|require|import|export|constructor|prototype|applicant|candidate|firstName|lastName|userName|hiringManagerName|password|cookie|session|token)\b/i.test(value),
  'unreviewed plain qualification label program/private/grammar carrier')
}
const criterionCarriers = value => {
  if (!value || typeof value !== 'object') return
  for (const [key, item] of Object.entries(value)) {
    need(!/(?:country|address|employer|organization|legalEntity)/i.test(key) || empty(item), 'unreviewed criteria country/authority carrier: ' + key)
    criterionCarriers(item)
  }
}
const messageStatus = (value, label) => {
  fields(value, ['code','messages'], label + ' status authority')
  need(value.code === 200 && value.messages === 'success', label + ' public status changed')
}


// JSON.parse remains the value decoder. The bounded grammar preflight rejects
// duplicate decoded keys instead of silently choosing an authority's last key.
export const parsePeopleStrongJson = raw => {
  need(typeof raw === 'string' && Buffer.byteLength(raw) <= 3 * 1024 * 1024, 'JSON byte contract')
  let at = 0, steps = 0
  const ws = () => { while (/[\t\n\r ]/.test(raw[at] || '\0')) at++ }
  const string = () => {
    need(raw[at] === '"', 'JSON string grammar'); const start = at++
    while (at < raw.length) {
      const c = raw[at++]
      if (c === '"') { try { return JSON.parse(raw.slice(start, at)) } catch { throw fail('JSON string grammar') } }
      if (c === '\\') { need(at < raw.length, 'JSON escape grammar'); at++ }
      else need(c.charCodeAt(0) >= 32, 'JSON control character grammar')
    }
    throw fail('JSON unterminated string')
  }
  const value = depth => {
    need(depth <= 128 && ++steps <= raw.length + 1, 'JSON depth/step contract'); ws()
    const c = raw[at]
    if (c === '{') {
      at++; ws(); const keys = new Set()
      if (raw[at] === '}') { at++; return }
      while (true) {
        ws(); const key = string(); need(!keys.has(key), 'JSON duplicate decoded key'); keys.add(key)
        ws(); need(raw[at++] === ':', 'JSON object grammar'); value(depth + 1); ws()
        if (raw[at] === '}') { at++; return }
        need(raw[at++] === ',', 'JSON object separator grammar')
      }
    }
    if (c === '[') {
      at++; ws(); if (raw[at] === ']') { at++; return }
      while (true) { value(depth + 1); ws(); if (raw[at] === ']') { at++; return }; need(raw[at++] === ',', 'JSON array grammar') }
    }
    if (c === '"') { string(); return }
    const token = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(raw.slice(at))
    need(token, 'JSON value grammar'); at += token[0].length
  }
  value(0); ws(); need(at === raw.length, 'JSON trailing grammar')
  try { return JSON.parse(raw) } catch { throw fail('JSON grammar') }
}

// Inspect authored declarations even in hidden/template subtrees. Script/style
// strings are not reparsed as HTML; no fetched program is ever executed.
const tags = html => {
  const result = []; let at = 0
  while ((at = html.indexOf('<', at)) !== -1) {
    if (html.startsWith('<!--', at)) { const end = html.indexOf('-->', at + 4); need(end >= 0, 'HTML authority comment contract'); at = end + 3; continue }
    const match = /^<([/]?)([a-zA-Z][^\t\n\f\r />]*)/.exec(html.slice(at))
    if (!match) { at++; continue }
    let end = at + match[0].length, quote = null
    for (; end < html.length; end++) { const c = html[end]; if (quote) { if (c === quote) quote = null } else if (c === '"' || c === "'") quote = c; else if (c === '>') break }
    need(end < html.length, 'HTML authority tag contract')
    const name = match[2].toLowerCase(), closing = Boolean(match[1])
    const attrs = readNativeAttributeTokens(html.slice(at + match[0].length, end))
    result.push({ name, closing, attrs }); at = end + 1
    if (!closing && ['script', 'style', 'textarea', 'title', 'iframe', 'xmp', 'noscript'].includes(name)) {
      const re = new RegExp('</' + name + '[\\t\\n\\f\\r ]*>', 'ig'); re.lastIndex = at
      const close = re.exec(html); need(close, 'HTML raw declaration contract'); at = re.lastIndex
    }
  }
  return result
}
const attrsObject = token => {
  const value = {}
  for (const [key, raw] of token.attrs) { need(!Object.hasOwn(value, key), 'duplicate HTML authority attribute'); value[key] = decodeNativeEntities(raw) }
  return value
}
export const discoverPeopleStrongIndiaChannel = html => {
  need(typeof html === 'string', 'corporate handoff HTML missing')
  if (!/peoplestrong[.]com/i.test(html)) return null // Historical Oracle-only fixtures retain their original path.
  const all = tags(html), canonicals = []
  for (const token of all) {
    if (token.closing) continue
    if (token.name === 'base') throw fail('corporate base authority changed')
    if (token.name === 'a' && token.attrs.some(([key, value]) => key === 'href' && decodeNativeEntities(value) === CHANNEL)) {
      const attrs = attrsObject(token)
      need(!Object.keys(attrs).some(key => /^on/i.test(key)), 'native CTA inline event authority changed')
    }
    if (token.name === 'link') {
      const attrs = attrsObject(token)
      if ((attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical')) canonicals.push(attrs.href)
    }
  }
  need(same(canonicals, [INDIA]), 'corporate canonical authority changed')
  const doc = readNativeDocument(html)
  const title = doc.nodes(n => n.tag === 'title')
  need(title.length === 1 && decodeNativeEntities(title[0].raw || '').trim() === 'Careers \u2013 Omega Healthcare', 'corporate title authority changed')
  const links = doc.nodes(n => n.tag === 'a' && /Search Open Positions/i.test(doc.text(n)))
  need(links.length === 1 && links[0].attrs.href === CHANNEL, 'active India CTA handoff authority changed')
  const containsCTA = node => node === links[0] || (node.children || []).some(child => typeof child === 'object' && containsCTA(child))
  for (const ancestor of doc.nodes(containsCTA)) need(!Object.keys(ancestor.attrs || {}).some(key => /^on/i.test(key)), 'native CTA ancestor inline event authority changed')
  return { corporateUrl: INDIA, channelUrl: CHANNEL, nativeOrigin: ORIGIN }
}

const codeId = code => { need(typeof code === 'string' && /^OMH\/[A-Z0-9-]+\/[1-9][0-9]*$/.test(code), 'native identity code'); return code.split('/').at(-1) }
const routeCode = code => { codeId(code); return code.replaceAll('/', '_') }
const detailURL = code => API + 'job/' + routeCode(code) + '/v2?part=' + PARTS + '&isReqId=false'
const orgURL = code => API + 'job/organizationDetails?jobCode=' + code
const listingURL = offset => API + 'jobs/v1?offset=' + offset + '&limit=45'
const rootResponse = (payload, label) => {
  fields(payload, ['response', 'messageCode'], label)
  messageStatus(payload.messageCode, label)
  return payload.response
}
const calendar = (value, label) => {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), label + ' calendar date')
  const date = new Date(value + 'T00:00:00Z')
  need(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value, label + ' calendar date invalid')
  return value
}
const portalDate = (value, label) => {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2} [0-2][0-9]:[0-5][0-9]:[0-5][0-9](?:[.][0-9]+)?$/.test(value) && Number(value.slice(11, 13)) < 24, label + ' local calendar date')
  return calendar(value.slice(0, 10), label)
}
const criteriaText = html => {
  need(typeof html === 'string', 'native criteria missing')
  for (const token of tags(html)) {
    need(/^(?:p|br|ol|ul|li|div|span|b|strong|i|em|u|table|tbody|thead|tfoot|tr|td|th|h[1-6]|a|hr)$/.test(token.name), 'unreviewed native criteria program/authority carrier')
    for (const [key, val] of token.attrs) {
      need(!/^on/i.test(key) && !['name','property','itemprop','itemtype','itemscope','src','srcdoc'].includes(key), 'native criteria semantic authority carrier')
      need(!/(?:country|employer|organization|address)/i.test(key), 'native criteria country/authority carrier')
      if (key === 'href') need(/^https:\/\//.test(val) && !/javascript:/i.test(val), 'native criteria URL authority')
    }
  }
  // Retain ordinary authored text even when hidden. Full original HTML and all
  // additional criteria arrays are separately kept, not inferred as required.
  const text = decodeNativeEntities(html.replace(/<!--[^]*?-->/g, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
  need(text.length >= 80, 'substantive native criteria missing'); return text
}
const hierarchy = (rows, types, label) => {
  need(Array.isArray(rows) && rows.length === types.length, label + ' country/organization hierarchy count')
  const result = {}
  for (const row of rows) {
    fields(row, ['orgUnitType', 'orgUnitName'], label)
    need(types.includes(row.orgUnitType) && !Object.hasOwn(result, row.orgUnitType) && typeof row.orgUnitName === 'string' && row.orgUnitName.trim() === row.orgUnitName && row.orgUnitName, label + ' country/organization hierarchy identity')
    result[row.orgUnitType] = row.orgUnitName
  }
  need(types.every(type => Object.hasOwn(result, type)), label + ' hierarchy missing'); return result
}
export const inspectPeopleStrongRole = ({ listing, detail, organization, now }) => {
  fields(listing, PROFILES.listing, 'listing'); const d = rootResponse(detail, 'detail'); fields(d, PROFILES.detail, 'detail criteria')
  scalarFields(listing, ['skills'], 'listing'); scalarFields(d, ['skills','qualifications','certifications','languages'], 'detail')
  fields(listing.skills, ['mustTohave','goodtohave'], 'listing skill criteria')
  for (const key of ['mustTohave','goodtohave']) need(Array.isArray(listing.skills[key]) && listing.skills[key].every(item => typeof item === 'string'), 'listing skill criteria carrier changed')
  const id = codeId(listing.jobCode)
  need(d.requisitionCode === listing.jobCode && String(d.requisitionId) === id && d.jobTitle === listing.jobTitle && typeof d.jobTitle === 'string' && d.jobTitle.trim(), 'native role identity/title changed')
  need(listing.requisitionId === null || String(listing.requisitionId) === id, 'listing native identity changed')
  need(listing.jobDetailUrl === ORIGIN + '/job/detail/' + routeCode(listing.jobCode), 'native role URL identity changed')
  need(listing.organizationUnit === LEGAL_ENTITY && d.orgUnitCode === LEGAL_ENTITY && d.entityID === '1419' && d.organizationUnitComplete === listing.organizationUnitComplete && d.organizationUnitComplete.startsWith(LEGAL_ENTITY + '>'), 'native role organization authority changed')
  need(d.requisitionStatus === 'OPEN' && d.confidential === false && d.programType === 'External' && listing.applied === false, 'native public status/private contract changed')
  const posted = calendar(listing.jobPostedDate, 'posting'), closes = calendar(listing.jobClosureDate, 'closing')
  need(portalDate(d.CandidatePortalStartDate, 'posting') === posted && portalDate(d.CandidatePortalEndDate, 'closing') === closes && posted <= closes, 'native listing/detail calendar date changed')
  need(typeof now === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(now), 'observation calendar missing')
  const current = now.slice(0, 10); need(posted <= current && current <= closes, 'native public calendar not currently within declared date-only window')
  const missingPublicDescription = d.jobDescription === null || d.jobDescription === ''
  const description = missingPublicDescription ? null : criteriaText(d.jobDescription)
  for (const key of ['skills','qualifications','certifications','languages']) { need(Array.isArray(d[key]), 'native criteria section changed: ' + key); criterionCarriers(d[key]) }
  for (const section of ['qualifications','certifications','languages']) {
    const allowed = section === 'qualifications' ? ['qualificationName','mandatory'] : ['text','mandatory']
    for (const row of d[section]) {
      if (section === 'qualifications' && typeof row === 'string') { plainQualificationLabel(row); continue }
      fields(row, allowed, section + ' criteria'); scalarFields(row, [], section + ' criteria')
      for (const [key, item] of Object.entries(row)) need(empty(item) || key === 'mandatory' && typeof item === 'boolean' || key !== 'mandatory' && typeof item === 'string', section + ' criteria carrier changed')
    }
  }
  if (!empty(d.internalJobDescription)) criteriaText(d.internalJobDescription)
  for (const skill of d.skills) {
    fields(skill, ['text','mandatory'], 'skill criteria'); need(typeof skill.text === 'string' && typeof skill.mandatory === 'boolean', 'native skill criteria changed')
  }
  let country = null, legal = null, own = null, city = null, location = null
  const lh = listing.locationHierarchyComplete, dh = d.locationHierarchyComplete
  need(typeof lh === 'string' && typeof dh === 'string' && lh.split('>').length === 4 && dh.split('>').length === 4 && lh.split('>').every(Boolean) && dh.split('>').every(Boolean), 'native location hierarchy contract changed')
  if (organization !== null) {
    own = rootResponse(organization, 'organization'); fields(own, PROFILES.organization, 'organization')
    scalarFields(own, ['orgUnitHierarchy','workSiteHierarchy','departmentHierarchy'], 'organization')
    need(Array.isArray(own.departmentHierarchy) && own.departmentHierarchy.length === 0, 'unreviewed organization department hierarchy carrier')
    need(empty(own.primaryLocation) && empty(own.secondaryLocation), 'unreviewed alternate country/location carrier')
    need(empty(own.workCenter) || typeof own.workCenter === 'string', 'unreviewed workCenter authority carrier')
    const geo = hierarchy(own.workSiteHierarchy, ['Location','City','State','Country'], 'own worksite')
    const org = hierarchy(own.orgUnitHierarchy, ['Business Unit','Legal Entity'], 'own organization')
    need(org['Legal Entity'] === LEGAL_ENTITY && org['Legal Entity'] + '>' + org['Business Unit'] === d.organizationUnitComplete, 'own Legal Entity/organization identity changed')
    country = nativeCountryName(geo.Country)
    need(country && /^[A-Z]{2}$/.test(geo.Country) && lh.split('>')[0] === geo.Country && dh.split('>')[0] === geo.Country, 'native typed Country conflict or unknown country')
    const typedPath = ['Country','State','City','Location'].map(type => geo[type]).join('>')
    need(typedPath === dh, 'own country/worksite hierarchy contradicts detail')
    legal = { legalEntityName: org['Legal Entity'], sourceField: 'organizationDetails.orgUnitHierarchy[Legal Entity]', workCenterSemantics: 'unclassified-native-business-carrier-not-employer-or-client' }
    if (lh === dh) { city = geo.City; location = geo.Location }
  }
  const businessDetail = scrub(d)
  const model = { jobCode: listing.jobCode, detail: businessDetail, organization: own && structuredClone(own) }
  if (missingPublicDescription) {
    // The observed null is not a brief-only vacancy. All identity, public-state,
    // native calendar, criteria/security and own-country/Legal Entity guards
    // above still own admission before this finite ineligible observation.
    need(own && country && legal, 'missing-description hold requires own organization/country authority')
    need(d.internalJobDescription === null && d.qualifications.length === 0 && d.certifications.length === 0
      && d.languages.length === 0 && d.skills.every(skill => skill.mandatory === false),
    'unreviewed additional criteria with null public description')
    return { job: null, model, hold: { jobCode: listing.jobCode, country,
      sourceNativeEmployerEvidence: legal, reason: d.jobDescription === null ? 'native-public-description-null;optional-skills-not-full-role-criteria' : 'native-public-description-empty;optional-skills-not-full-role-criteria',
      sourceScopeComplete: false, inventoryCleanupAllowed: false } }
  }
  return { hold: null, model, job: {
    jobId: listing.jobCode, title: d.jobTitle, company: COMPANY, companyDomain: 'omegahms.com', country, city, location,
    jobDescription: description, sourceDescription: d.jobDescription, experienceRequired: null, minimumQualification: null,
    preferredQualifications: null, requiredSkills: d.skills.filter(s => s.mandatory).map(s => s.text), employmentType: null,
    workplaceType: null, sourceUrl: listing.jobDetailUrl, url: listing.jobDetailUrl, link: listing.jobDetailUrl,
    applyUrl: null, applicationUrl: null, applicationStatus: 'not-observed-no-application-endpoint-visited',
    postedAt: posted, postedDate: posted, postedDateSource: 'native-CandidatePortalStartDate-local-calendar', sourceClosingDate: closes,
    sourceClosingDateIsExact: false, source: SOURCE, sourceListingComplete: false, sourceScopeComplete: false,
    lifecycleCleanupAllowed: false, inventoryCleanupAllowed: false, sourceDetailComplete: false,
    sourceDetailFailureKind: 'native-granular-facts;scalar-experience-and-full-workplace-scope-unresolved',
    sourceCountryScopeUnresolved: country === null, sourceNativeEmployerEvidence: legal,
    sourceNativeCriteria: { jobDescription: d.jobDescription, internalJobDescription: d.internalJobDescription,
      skills: structuredClone(d.skills), qualifications: structuredClone(d.qualifications), certifications: structuredClone(d.certifications), languages: structuredClone(d.languages),
      ...(d.qualifications.some(row => typeof row === 'string') ? { qualificationStringSemantics: {
        carrier: 'own-native-plain-string-qualification-label', mandatory: null, requiredOrPreferred: null, minimumDegree: null,
        entries: d.qualifications.flatMap((label, index) => typeof label === 'string'
          ? [{ index, label, mandatory: null, classification: 'unclassified-native-label' }] : []),
      } } : {}),
      structuredExperience: { minimumExp: d.minimumExp, maximumExp: d.maximumExp }, listingExperience: listing.expRange,
      unsupportedScalarExperience: null },
    sourceNativeLocations: { listingHierarchy: lh, detailHierarchy: dh, workSiteHierarchy: own?.workSiteHierarchy ?? null,
      scalarLocationUnresolved: lh !== dh || !own, noCityCountryInference: true },
    sourceNativeOrganizationRecord: own && structuredClone(own), sourceNativeRoleRecord: structuredClone(businessDetail),
    sourceNativeListingRecord: structuredClone(listing),
    sourceNativePublicState: { requisitionStatus: d.requisitionStatus, confidential: d.confidential, programType: d.programType,
      campusSysContentType: d.campusSysContentType, isCampusJob: d.isCampusJob, campusHiringEnabled: d.campusHiringEnabled ?? null,
      CandidatePortalStartDate: d.CandidatePortalStartDate, CandidatePortalEndDate: d.CandidatePortalEndDate,
      timezone: null, closingVerified: false, applicationAvailability: 'unobserved' },
    sourcePersonalMetadataOmissions: PRIVATE.map(key => '$.response.' + key), scrapedAt: now,
  } }
}
// Preserve the original pure job projection contract: missing full public
// criteria never becomes a job. Runtime explicitly consumes the observation.
export const projectPeopleStrongRole = input => {
  const observed = inspectPeopleStrongRole(input)
  need(observed.job, 'native criteria missing')
  return observed.job
}

const grant = (url, options) => {
  let parsed; try { parsed = new URL(url) } catch { throw fail('native request grant URL') }
  need(parsed.origin === ORIGIN && !parsed.username && !parsed.password && !parsed.hash, 'native request grant authority')
  const method = options.method ?? 'GET'; let listing = false
  if (parsed.pathname === '/api/cp/rest/altone/cp/jobs/v1') {
    need(/^\?offset=(?:0|[1-9][0-9]*)&limit=45$/.test(parsed.search) && Number.isSafeInteger(Number(parsed.searchParams.get('offset'))) && method === 'POST' && options.body === '{}', 'native listing request grant changed'); listing = true
  } else if (parsed.pathname === '/api/cp/rest/altone/cp/job/organizationDetails') {
    const code = parsed.search.slice('?jobCode='.length); codeId(code)
    need(parsed.search === '?jobCode=' + code && method === 'GET' && options.body === undefined, 'native organization request grant changed')
  } else {
    need(/^\/api\/cp\/rest\/altone\/cp\/job\/OMH_[A-Z0-9-]+_[1-9][0-9]*\/v2$/.test(parsed.pathname) && parsed.search === '?part=' + PARTS + '&isReqId=false' && method === 'GET' && options.body === undefined, 'native detail request grant changed')
  }
  return { method, headers: listing ? { 'Content-Type': 'application/json' } : {}, ...(listing ? { body: '{}' } : {}) }
}
const nativeHttpErrors = new WeakSet()
// Opaque membership, never inspect foreign/caller error properties. The wrapper
// uses this only to preserve a verified denial through its own aggregate catch.
export const isPeopleStrongHttpFailure = error => nativeHttpErrors.has(error)
const cancelSafely = body => { try { Promise.resolve(body?.cancel?.()).catch(() => {}) } catch {} }
export const createPeopleStrongReader = ({ fetchImpl, signal, callerSignal, check, consume, receipts, maxRequests, maxResponseBytes, requestTimeoutMs, now }) => async (url, options = {}) => {
  const init = grant(url, options), deadline = new AbortController()
  const timeout = Object.assign(new Error(`[${SOURCE}] Native request timed out`), { softFailure: true, upstreamOutage: true, failureKind: 'upstream_timeout', abortRetries: true })
  const bound = Math.min(requestTimeoutMs, 12000), end = performance.now() + bound
  const readingSignal = AbortSignal.any([...(signal ? [signal] : []), deadline.signal])
  const checkRead = () => { callerSignal?.throwIfAborted(); check(); signal?.throwIfAborted(); if (performance.now() >= end && !deadline.signal.aborted) deadline.abort(timeout); readingSignal.throwIfAborted() }
  checkRead(); need(receipts.length < maxRequests, 'native request budget exceeded')
  const receipt = { url, method: init.method, request: { ...init, redirect: 'manual', credentials: 'omit' }, requestedAt: now(), bodyComplete: false }
  receipts.push(receipt)
  let response, bodyReader, cancelled = false, responseAuthorityVerified = false
  const cancel = () => { if (cancelled) return; cancelled = true; cancelSafely(bodyReader || response?.body) }
  const timer = setTimeout(() => deadline.abort(timeout), bound)
  const httpError = cause => { const error = Object.assign(new Error(`[${SOURCE}] HTTP ${receipt.status} for ${url}`, cause === undefined ? undefined : { cause }), {
    status: receipt.status, statusCode: receipt.status, requestURL: url, finalURL: receipt.finalUrl,
    softFailure: true, upstreamOutage: true, failureKind: [401,403,406,429,451].includes(receipt.status) ? 'blocked_or_access_denied' : 'upstream_unavailable',
    abortRetries: true, sourceScopeComplete: false, lifecycleCleanupAllowed: false, inventoryCleanupAllowed: false,
    nativeHttpReceipt: { ...receipt },
  }); nativeHttpErrors.add(error); return error }
  try {
    const pending = Promise.resolve().then(() => { checkRead(); return fetchImpl(url, { ...init, redirect: 'manual', credentials: 'omit', signal: readingSignal }) })
    pending.then(late => { if (readingSignal.aborted && late !== response) cancelSafely(late?.body) }, () => {})
    response = await readNativeWithSignal(() => pending, readingSignal)
    Object.assign(receipt, { status: response.status, finalUrl: response.url || url, mime: response.headers?.get?.('content-type') || '' })
    need(Number.isInteger(receipt.status) && receipt.status >= 100 && receipt.status <= 599, 'native HTTP status contract')
    need(receipt.finalUrl === url, 'native response URL/redirect authority changed'); responseAuthorityVerified = true; checkRead()
    need(response.body?.getReader, 'native response byte budget needs streaming body'); bodyReader = response.body.getReader()
    const chunks = []; let size = 0
    while (true) {
      checkRead(); const chunk = await readNativeWithSignal(() => bodyReader.read(), readingSignal); checkRead()
      if (chunk.done) break
      need(chunk.value instanceof Uint8Array, 'native response stream bytes contract')
      need(size + chunk.value.byteLength <= Math.min(maxResponseBytes, 3 * 1024 * 1024), 'native response byte budget exceeded')
      consume(chunk.value.byteLength, size); size += chunk.value.byteLength; chunks.push(Buffer.from(chunk.value)); receipt.observedBytes = size
    }
    const bytes = Buffer.concat(chunks)
    Object.assign(receipt, { bodyComplete: true, bytes: bytes.length, bodySHA256: createHash('sha256').update(bytes).digest('hex'), completedAt: now() })
    checkRead(); if (receipt.status !== 200) throw httpError()
    need(/^application\/(?:json|[a-z0-9.+-]+\+json)(?:;|$)/i.test(receipt.mime), 'native JSON MIME contract changed')
    const payload = parsePeopleStrongJson(bytes.toString('utf8')); checkRead(); return payload
  } catch (error) {
    cancel(); callerSignal?.throwIfAborted()
    let interrupted = false, interruption
    try { check(); signal?.throwIfAborted() } catch (reason) {
      callerSignal?.throwIfAborted()
      // Only the inherited source signal owns this priority. A foreign check
      // failure cannot be silently promoted to public HTTP unavailability.
      if (!signal?.aborted) throw reason
      interrupted = true; interruption = reason
    }
    const cause = interrupted ? interruption : deadline.signal.aborted ? deadline.signal.reason : error
    receipt.completedAt = now()
    if (responseAuthorityVerified && receipt.status && receipt.status !== 200) {
      if (!interrupted && nativeHttpErrors.has(error)) throw error
      throw httpError(cause)
    }
    throw cause
  } finally { clearTimeout(timer); try { bodyReader?.releaseLock?.() } catch {} }
}

export const runPeopleStrongIndia = async context => {
  const { channel, corporate, check, now, receipts, limits } = context
  const read = createPeopleStrongReader(context)
  const listing = async () => {
    const records = [], pages = []; let total = null
    for (let page = 0; ; page++) {
      check(); need(page < limits.maxPages, 'native page budget prevents closed inventory')
      const offset = page * 45, payload = await read(listingURL(offset), { method: 'POST', body: '{}' })
      fields(payload, ['totalRecords','response','messageCode','campusHiring','solrSearch'], 'listing envelope')
      messageStatus(payload.messageCode, 'listing')
      need(Array.isArray(payload.response) && Number.isSafeInteger(payload.totalRecords) && payload.totalRecords >= 0, 'native listing status/count contract')
      if (total === null) total = payload.totalRecords
      need(total === payload.totalRecords && total <= limits.maxJobs && payload.response.length === Math.min(45, Math.max(0, total - offset)), 'native listing total/page contract changed')
      records.push(...payload.response); pages.push({ offset, payload })
      if (records.length >= total) break
    }
    need(new Set(records.map(row => row.jobCode)).size === records.length, 'native listing duplicate identity')
    for (const row of records) { fields(row, PROFILES.listing, 'listing'); codeId(row.jobCode) }
    return { records, pages, total }
  }
  const readRole = async row => {
    const detail = await read(detailURL(row.jobCode)); check()
    const organization = await read(orgURL(row.jobCode)); check()
    return inspectPeopleStrongRole({ listing: row, detail, organization, now: now() })
  }
  const openingListing = await listing(), openingRoles = [], openingHolds = [], observedCountries = [], jobs = []
  for (const row of openingListing.records) {
    const role = await readRole(row); openingRoles.push(role.model)
    observedCountries.push(role.job?.country ?? role.hold?.country ?? null)
    if (role.hold) openingHolds.push(role.hold)
    if (role.job?.country === 'India') jobs.push(role.job)
  }
  const closingRoles = [], closingHolds = []
  for (const row of openingListing.records) {
    const role = await readRole(row); closingRoles.push(role.model)
    if (role.hold) closingHolds.push(role.hold)
  }
  const closingListing = await listing()
  need(same(openingListing, closingListing) && same(openingRoles, closingRoles) && same(openingHolds, closingHolds), 'native closing full business inventory changed')
  const closingChannel = discoverPeopleStrongIndiaChannel(await context.readCorporate())
  need(same(channel, closingChannel), 'corporate closing handoff authority changed'); check()
  const audit = { source: SOURCE, recordKind: 'vacancy-rows', sourceScopeComplete: false, lifecycleCleanupAllowed: false, inventoryCleanupAllowed: false,
    companyGlobalTotal: null, companyIndiaTotal: null, configuredBoardObservationCount: openingListing.records.length, selectedTypedIndiaCount: jobs.length,
    corporate, channel, limits, receipts, verifiedAt: now(), native: { configuredInventoryReconciled: true,
      opening: { listing: openingListing, roles: openingRoles }, closing: { listing: closingListing, roles: closingRoles } },
    scope: 'current-declared-India-channel-only;company-scope-unknown;granular-role-facts-not-backend-eligibility',
    personalMetadataOmissions: PRIVATE.map(key => '$.response.' + key), rawPrivateBodiesRetained: false }
  if (openingHolds.length) {
    // Legacy selectedTypedIndiaCount is the emitted selection, not all typed
    // native India observations. Keep both facts explicit when a role is held.
    Object.assign(audit, { observedTypedIndiaCount: observedCountries.filter(country => country === 'India').length,
      returnedTypedIndiaCount: jobs.length, heldTypedIndiaCount: openingHolds.filter(role => role.country === 'India').length,
      heldNativeRoleCount: openingHolds.length, selectedTypedIndiaCountSemantics: 'returned-full-public-criteria-India-roles;held-records-excluded' })
    audit.native.opening.heldRoles = openingHolds
    audit.native.closing.heldRoles = closingHolds
  }
  for (const [index, job] of jobs.entries()) {
    job.sourceNativePublicState.closingVerified = true
    job.nativeCollectionEvidence = index === 0 ? audit : { source: SOURCE, sourceScopeComplete: false, fullEvidenceOnFirstRole: jobs[0].jobId }
  }
  Object.defineProperty(jobs, Symbol.for('jobverify.omega-inventory'), { value: audit })
  attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', sourceScopeComplete: false, observedRecordCount: openingListing.records.length,
    observedVacancyCount: openingListing.records.length, companyGlobalTotal: null, companyIndiaTotal: null })
  attachInventoryEvidence(jobs, { status: 'discovery-only', surface: INDIA, firstParty: true, listingComplete: false, pagesFetched: openingListing.pages.length + closingListing.pages.length,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: now(), reason: 'company-scope-unverified;granular-native-facts;full-workplace-and-experience-projection-unresolved' })
  check(); return jobs
}
