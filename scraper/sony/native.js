import { createHash } from 'node:crypto'
import { activeHead, activeScripts, decodeNativeEntities, extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

export const URLS = Object.freeze({
  indiaCorporate: 'https://www.sony.co.in/microsite/corporate/',
  indiaCareers: 'https://www.sony.co.in/microsite/careers/',
  indiaFragment: 'https://www.sony.co.in/microsite/careers/career.html',
  consumer: 'https://www.myemploywise.com/asperm/servlet/website?customer_code=sid',
  consumerView: 'https://www.myemploywise.com/asperm/servlet/website',
  softwareCorporate: 'https://sonyindiasoftware.co.in/careers.html',
  software: 'https://careers.sonyindiasoftware.co.in/sonyindiasoftware/',
  tenant: 'https://public.zwayam.com//tenant_management/tenant/group?domain_name=careers.sonyindiasoftware.co.in',
  config: 'https://public.zwayam.com/data-service/v2/company/15532/careersite-configurations',
  search: 'https://public.zwayam.com/jobs/search',
  detail: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  globalCorporate: 'https://www.sonyjobs.com/jobs.html',
  globalSearch: 'https://sonyglobal.wd1.myworkdayjobs.com/wday/cxs/sonyglobal/SonyGlobalCareers/jobs',
})
export const CONSUMER_VIEW_BODY = 'mode=create&customer_code=sid&viewname=Web&modulename=Recruitment&pos_id=null&bwi=null'
export const SOFTWARE_COMPANY_ID = 15532
export const SOFTWARE_DOMAIN = 'careers.sonyindiasoftware.co.in'
export const SOFTWARE_COMPANY_NAME = 'Sony India Software Centre'
export const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
export const hash = value => createHash('sha256').update(String(value)).digest('hex')
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
export const fingerprint = value => hash(JSON.stringify(canonical(value)))
export const requireNative = (condition, message) => {
  if (condition) return
  const error = new Error(`[sony] Current native contract: ${message}`)
  error.name = 'SonyNativeContractError'
  error.abortRetries = true
  error.failureKind = 'parser_or_contract_error'
  throw error
}
export const plain = value => {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return ''
  if (!extractActiveDescription(String(value))) return ''
  const doc = readVisibleNativeDocument(String(value), { strict: true })
  const root = doc.nodes(node => node.tag === 'root')[0]
  return clean(decodeNativeEntities(root ? doc.text(root) : ''))
}
const sameUrl = (left, right) => { try { return new URL(left).href === new URL(right).href } catch { return false } }
const descendants = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)) ]
const matchesAnchor = (doc, node, expected, base) => {
  try { return !!plain(doc.text(node)) && sameUrl(new URL(node.attrs.href || '', base).href, expected) } catch { return false }
}
const activeAnchor = (html, expected, base) => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  return doc.nodes(node => node.tag === 'a').some(node => matchesAnchor(doc, node, expected, base))
}
const visibleFrameSources = html => readVisibleNativeDocument(html, { strict: true }).frames().filter(node => !Object.hasOwn(node.attrs, 'srcdoc')).map(node => node.attrs.src)

export const verifyIndiaCorporate = html => requireNative(activeAnchor(html, URLS.indiaCareers, URLS.indiaCorporate), 'Sony India corporate careers anchor changed')
export const verifyIndiaLoader = html => requireNative(activeScripts(html).some(body => /\.load\(\s*["']career\.html\?_=["']\s*\+\s*new Date\(\)\.getTime\(\)/.test(body)), 'Sony India native career fragment loader changed')
export const verifyIndiaFragment = html => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  const section = doc.nodes(node => node.tag === 'section').find(node => /Current Opportunities/.test(doc.text(node)) && /current opportunities in India/.test(doc.text(node)))
  requireNative(section && descendants(section, node => node.tag === 'a').some(node => matchesAnchor(doc, node, 'http://www.myemploywise.com/asperm/servlet/website?customer_code=sid', URLS.indiaFragment)), 'Sony India scoped EmployWise handoff changed')
}
export const verifyConsumerShell = html => {
  const doc = readNativeDocument(html)
  const onload = doc.nodes(node => node.tag === 'body')[0]?.attrs.onload || ''
  requireNative(/xmlPost\('\.\/website','mode=create&customer_code=sid&viewname='/.test(onload)
    && activeScripts(html).some(body => /var viewname='Web'/.test(body) && /var modulename='Recruitment'/.test(body)), 'EmployWise public unfiltered view contract changed')
}
export const parseConsumerInventory = xml => {
  const one = name => [...String(xml).matchAll(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'g'))].map(match => match[1])
  requireNative(/^\s*<\?xml\b/.test(xml) && one('no_of_records').length === 1 && /^\d+$/.test(one('no_of_records')[0]), 'EmployWise XML count is absent or malformed')
  const count = Number(one('no_of_records')[0])
  requireNative(count === 0 && one('values').length === 1 && !one('values')[0].trim()
    && one('NoNext')[0] === 'true' && one('NoPrevious')[0] === 'true'
    && one('Page')[0] === '0' && one('No_Of_Page')[0] === '0' && one('viewName')[0] === 'Web', 'Sony India native view has new or incomplete positions requiring review')
  return { reportedTotal: 0, listingComplete: true, nativeNoNext: true }
}
export const verifySoftwareCorporate = html => requireNative(activeHead(html).titles.some(title => /Sony India Software Centre/.test(title || ''))
  && visibleFrameSources(html).filter(url => sameUrl(url, URLS.software)).length === 1, 'Sony India Software official iframe handoff changed')
export const softwareClientUrl = html => {
  const doc = readNativeDocument(html)
  const base = doc.nodes(node => node.tag === 'base')[0]?.attrs.href
  requireNative(base === '/sonyindiasoftware/' && activeHead(html).titles.some(title => /Sony India Software/.test(title || '')), 'Sony India Software native shell identity changed')
  const scripts = doc.nodes(node => node.tag === 'script' && /^main\.[a-z0-9]+\.js$/.test(node.attrs.src || ''))
  requireNative(scripts.length === 1, 'Sony native main client is missing or ambiguous')
  return new URL(scripts[0].attrs.src, URLS.software).href
}
export const verifySoftwareClient = script => {
  const matches = [...String(script).matchAll(/\{COMPANYID:"([^"]+)",COMPANYURL:"([^"]+)",DOMAIN:"([^"]+)",APIENDPOINT:"([^"]+)",APIENDPOINTNEW:"([^"]+)"/g)]
  requireNative(matches.length === 1 && matches[0][1] === 'MTU1MzI=' && matches[0][3] === SOFTWARE_DOMAIN
    && matches[0][4] === 'https://public.zwayam.com/' && matches[0][5] === 'https://public.zwayam.com/'
    && ['jobs/search', 'jobs-service/v1/jobs/careersite', 'requisition_service/getReqFieldsForCareersSite', 'careersite-configurations', 'getFormDataFromJson'].every(value => script.includes(value)), 'Sony native client employer/API identity changed')
}
export const verifySoftwareIdentity = (tenant, config) => {
  const company = config?.reponseObject?.company
  requireNative(tenant?.responseStatus === 'SUCCESS' && tenant.responseCode === 200
    && tenant.reponseObject?.name === SOFTWARE_COMPANY_NAME && tenant.reponseObject?.tenantGroupId === 'G1'
    && config?.responseStatus === 'SUCCESS' && config.responseCode === 200 && company?.id === SOFTWARE_COMPANY_ID
    && company.companyName === SOFTWARE_COMPANY_NAME && company.careerSiteUrl === SOFTWARE_DOMAIN && company.domainName === SOFTWARE_DOMAIN, 'Sony native tenant/company identity changed')
}
export const verifyGlobalCorporate = html => requireNative(visibleFrameSources(html).some(url => sameUrl(url, 'https://sonyglobal.wd1.myworkdayjobs.com/SonyGlobalCareers')), 'Sony global Workday publication changed')
export const parseGlobalObservation = payload => {
  requireNative(Number.isSafeInteger(payload?.total) && payload.total >= 0 && Array.isArray(payload.jobPostings) && payload.jobPostings.length <= payload.total, 'Sony global corroborating response is malformed')
  return { reportedTotal: payload.total, observedRows: payload.jobPostings.length, listingComplete: false, scope: 'separate-global-board-not-completely-reviewed' }
}
export const listingSnapshot = records => records.map(record => Object.fromEntries(Object.entries(record).filter(([key]) => /(?:skill|qualification|experience|responsib|requirement|description|role|location|country|^text\d+$|^status$|^displayStatus$|^startDate$|^endtDate$|^createdDate$|^companyId$|^id$|^job(?:Code|Url|Title|Type|VisibiltyLevel)$)/i.test(key)))).sort((left, right) => left.id - right.id)
export const parseSoftwarePage = payload => {
  const data = payload?.data, config = data?.facetedSearchConfig
  requireNative(payload?.code === 200 && data && Array.isArray(data.data) && Number.isSafeInteger(data.totalCount) && data.totalCount >= 0
    && typeof data.hasMoreData === 'boolean' && String(config?.companyId) === '15532' && config?.domain === SOFTWARE_DOMAIN
    && Number.isSafeInteger(Number(config.paginationHowMuch)) && Number(config.paginationHowMuch) > 0, 'Sony native inventory envelope or employer scope changed')
  const records = data.data.map(row => {
    const record = row?._source
    requireNative(record && record.companyId === SOFTWARE_COMPANY_ID && Number.isSafeInteger(record.id) && record.id > 0
      && String(row._id) === String(record.id) && clean(record.jobTitle) && /^[a-z0-9][a-z0-9._~-]*$/i.test(record.jobUrl || '')
      && (record.careerSiteUrl == null || record.careerSiteUrl === SOFTWARE_DOMAIN), 'Sony native posting identity is missing or foreign')
    return record
  })
  requireNative(records.length <= Number(config.paginationHowMuch) && records.length <= data.totalCount, 'Sony native page count is impossible')
  return { records, total: data.totalCount, hasMore: data.hasMoreData, pageSize: Number(config.paginationHowMuch) }
}

const names = new Intl.DisplayNames(['en'], { type: 'region' })
const countryCodes = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = names.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) { countryCodes.set(code.toLowerCase(), code); countryCodes.set(name.toLowerCase(), code) }
}
const countryCode = value => countryCodes.get(clean(value).toLowerCase()) || null
export const ownRoleGeography = (record, detail, custom) => {
  const addresses = record.jobLocationRecord
  // An internal office ID and a city string are insufficient country evidence.
  if (addresses == null || Array.isArray(addresses) && addresses.length === 0) return { known: false, reason: 'native-role-country-unresolved' }
  requireNative(Array.isArray(addresses), 'Sony native address list is malformed')
  const reviewed = addresses.map(address => {
    const code = countryCode(address?.country)
    requireNative(address && address.jobId === record.id && address.companyId === SOFTWARE_COMPANY_ID
      && Number.isSafeInteger(address.id) && address.id > 0 && code && clean(address.city) && clean(address.location)
      && clean(address.formattedLocation) && countryCode(address.formattedLocation.split(',').at(-1)) === code, 'Sony native role address/country identity is malformed or conflicting')
    return { ...address, code }
  })
  if (detail.jobLocationRecord != null && fingerprint(detail.jobLocationRecord) !== fingerprint(addresses)) return { known: false, reason: 'conflicting-native-detail-addresses' }
  const matches = value => typeof value === 'string' && value.split(/\s*[/;|]\s*/).every(part => reviewed.some(address => [address.city, address.location, address.formattedLocation].some(label => clean(part).toLowerCase() === clean(label).toLowerCase())))
  const labels = [record.location, record.locAgg, record.locationDisplayForManageJobs, record.locationSeparatedbySlash, record.officeLocation,
    detail.location, detail.locationDisplayForManageJobs, detail.locationSeparatedbySlash, detail.officeLocation, detail.jobConfigurationData?.Location].filter(value => value != null)
  if (!labels.length || labels.some(value => !matches(value))) return { known: false, reason: 'native-public-location-alternatives-unresolved' }
  const reviewedKeys = new Set(['jobLocationRecord', 'country', 'location', 'locAgg', 'locationDisplayForManageJobs', 'locationSeparatedbySlash', 'officeLocation', 'officeLocationId'])
  const extras = [...Object.entries(record), ...Object.entries(detail)].filter(([key, value]) => !reviewedKeys.has(key)
    && /location|countr|worksite|^state$/i.test(key) && value != null && value !== '' && !(Array.isArray(value) && !value.length))
  if (extras.length || [...Object.keys(custom), ...Object.keys(detail.jobConfigurationData).filter(key => key !== 'Location')].some(key => /location|countr|worksite|^state$/i.test(key))) return { known: false, reason: 'unreviewed-native-geography-fields' }
  for (const value of [record.country, detail.country].filter(value => value != null)) requireNative(countryCode(value) && reviewed.every(address => address.code === countryCode(value)), 'Sony native country fields disagree')
  return { known: true, india: reviewed.filter(address => address.code === 'IN'), all: reviewed }
}
const epochDate = (value, label) => {
  requireNative((typeof value === 'number' && Number.isSafeInteger(value) || typeof value === 'string' && /^\d{13}$/.test(value)) && Number(value) > 0, `Sony ${label} timestamp is malformed`)
  const date = new Date(Number(value))
  requireNative(Number.isFinite(date.getTime()), `Sony ${label} date is outside the supported range`)
  return date.toISOString()
}
const nativeDates = detail => {
  const posted = detail.jobConfigurationData?.['Posted On']
  const modified = detail.isModifiedDateConfiguredForCareerSiteView === true || detail.modifiedDateConfiguredForCareerSiteView === true
  const raw = { postedOn: posted ?? null, createdDate: detail.createdDate ?? null, createDate: detail.createDate ?? null, modifiedDate: detail.modifiedDate ?? null, startDate: detail.startDate ?? null, endtDate: detail.endtDate ?? null }
  let postingDate = null
  if (!modified && posted != null && posted !== '') {
    postingDate = epochDate(posted, 'native public Posted On')
    requireNative(Number(posted) === detail.createdDate, 'Sony public original publication and creation values disagree')
  }
  let closingDate = null
  if (detail.endtDate != null && detail.endtDate !== '') {
    closingDate = typeof detail.endtDate === 'number' || /^\d{13}$/.test(detail.endtDate) ? epochDate(detail.endtDate, 'closing') : detail.endtDate
    requireNative(typeof closingDate === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(closingDate) && Number.isFinite(Date.parse(closingDate)), 'Sony native closing date is unreviewed or malformed')
  }
  return { postingDate, closingDate, ...(postingDate ? { sourcePostingDate: postingDate, sourcePostingDateIsExact: true, sourceDateEvidence: 'zwayam-public-original-posted-on' } : {}),
    ...(closingDate && /T/.test(closingDate) ? { sourceClosingDateIsExact: true } : {}), sourceRawDates: raw,
    sourcePublicationDateReason: modified ? 'native-public-field-configured-to-modification-date' : postingDate ? null : 'native-original-publication-date-not-exposed' }
}
const hiddenMarkup = value => /<[^>]+\b(?:hidden|inert)(?:\s|=|\/?>)|<[^>]+aria-hidden\s*=\s*["']true|(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0(?:[;\s"']|$)|(?:font-size|height|width)\s*:\s*0(?:px|pt|em|rem)?\b)/i.test(String(value))
const placeholder = value => /^(?:please\s+)?enter\s+(?:the\s+)?job\s+description[.!\u2026]*$/i.test(plain(value))
export const parseSonyRole = (record, detail, reqFields) => {
  requireNative(detail && detail.id === record.id && detail.companyId === SOFTWARE_COMPANY_ID && detail.jobUrl === record.jobUrl
    && clean(detail.jobTitle) === clean(record.jobTitle) && String(detail.jobCode) === String(record.jobCode)
    && (detail.companyName == null || clean(detail.companyName) === SOFTWARE_COMPANY_NAME)
    && reqFields?.responseStatus === 'SUCCESS' && reqFields.responseCode === 200 && reqFields.reponseObject?.customDetails
    && typeof reqFields.reponseObject.customDetails === 'object' && !Array.isArray(reqFields.reponseObject.customDetails), 'Sony native detail identity or public criteria fields changed')
  const fields = detail.jobConfigurationData
  requireNative(fields && typeof fields === 'object' && !Array.isArray(fields), 'Sony public detail fields are missing')
  const custom = reqFields.reponseObject.customDetails
  const dates = nativeDates(detail)
  const snapshot = fingerprint({ id: detail.id, companyId: detail.companyId, jobUrl: detail.jobUrl, title: detail.jobTitle, status: detail.status,
    visibility: detail.jobVisibiltyLevel, privateJobShare: detail.privateJobShare, jobType: detail.jobType, fields, custom,
    questions: detail.jobSpecificQuestions, dates, nativeRoleFields: listingSnapshot([detail]), officeLocationId: detail.officeLocationId })
  if (record.status !== 1 || record.displayStatus !== 'Open' || detail.status !== 1 || detail.jobType !== 'J'
    || detail.jobVisibiltyLevel !== 'N' || detail.privateJobShare !== 'N') return { snapshot, reason: 'native-role-not-currently-public' }
  const geography = ownRoleGeography(record, detail, custom)
  if (!geography.known) return { snapshot, reason: geography.reason }
  if (!geography.india.length) return { snapshot, reason: 'explicit-native-foreign-role', foreign: true }
  let complete = true
  const sections = [], seen = new Set(), metadata = new Set(['Department', 'Location', 'Open Positions', 'Posted On', 'Designation'])
  for (const [label, value] of [...Object.entries(fields), ...Object.entries(custom)]) {
    if (metadata.has(label) || value == null || value === '') continue
    if (!['string', 'number', 'boolean'].includes(typeof value)) { complete = false; continue }
    // Preserve ambiguous hidden sections only in native evidence. A partial
    // visible projection cannot certify that the whole criteria field is known.
    if (hiddenMarkup(value)) { complete = false; continue }
    const content = plain(value)
    if (placeholder(value)) complete = false
    if (!content || placeholder(value) || seen.has(content)) continue
    seen.add(content); sections.push(`${label}\n${content}`)
  }
  if (!plain(fields.Description) && !plain(fields.Role)) complete = false
  if (!Array.isArray(detail.jobSpecificQuestions) || detail.jobSpecificQuestions.length > 0) complete = false
  const description = sections.join('\n\n') || null
  if (!description) complete = false
  const locations = geography.india.map(address => clean(address.formattedLocation))
  return { snapshot, job: {
    source: 'sony', company: SOFTWARE_COMPANY_NAME, title: clean(detail.jobTitle), jobId: String(detail.id), requisitionId: clean(detail.referenceNumber) || String(detail.jobCode),
    sourceUrl: `${URLS.software}jobview/${encodeURIComponent(record.jobUrl)}?id=${record.id}`,
    applyUrl: `${URLS.software}jobview/${encodeURIComponent(record.jobUrl)}?id=${record.id}`,
    location: locations.join(' / '), locations, city: clean(geography.india[0].city), country: 'India',
    department: plain(fields.Department) || null, employmentType: null, experienceRequired: plain(fields['Years Of Exp']) || null,
    minimumQualification: plain(fields['Education/Qualification']) || null, preferredQualification: null,
    requiredSkills: plain(fields['Skills Required']).split(',').map(clean).filter(Boolean),
    jobDescription: description, sourceDescription: description, sourceDetailComplete: complete,
    ...(!complete ? { sourceDetailFailureKind: 'unreviewed-or-missing-native-criteria' } : {}), ...dates,
    sourceNativeListingRecord: record, sourceNativeDetailPayload: detail, sourceNativeCustomCriteria: custom,
    sourceNativeCountryEvidence: geography.all, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
  } }
}
