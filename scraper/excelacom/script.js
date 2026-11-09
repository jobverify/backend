import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasClass, normalize, readHtml } from './nativeHtml.js'

export const COMPANY_CAREERS_URL = 'https://www.excelacom.com/careers.html'
export const BOARD_URL = 'https://phg.tbe.taleo.net/phg02/ats/careers/v2/searchResults?org=EXCELACOM&cws=38'
// Historical diagnostic feed only. The runtime inventories the native board.
export const RSS_FEED_URL = 'https://phg.tbe.taleo.net/phg02/ats/servlet/Rss?org=EXCELACOM&cws=38&WebPage=SRCHR_V2&WebVersion=0&_rss_version=2'
const STATE_REFERENCE = 'https://www.census.gov/library/reference/code-lists/ansi/ansi-codes-for-states.html'
const US_STATE_CODES = Object.fromEntries([
  ['Alabama', 'AL'], ['Alaska', 'AK'], ['Arizona', 'AZ'], ['Arkansas', 'AR'], ['California', 'CA'], ['Colorado', 'CO'], ['Connecticut', 'CT'], ['Delaware', 'DE'], ['District of Columbia', 'DC'], ['Florida', 'FL'], ['Georgia', 'GA'], ['Hawaii', 'HI'], ['Idaho', 'ID'], ['Illinois', 'IL'], ['Indiana', 'IN'], ['Iowa', 'IA'], ['Kansas', 'KS'], ['Kentucky', 'KY'], ['Louisiana', 'LA'], ['Maine', 'ME'], ['Maryland', 'MD'], ['Massachusetts', 'MA'], ['Michigan', 'MI'], ['Minnesota', 'MN'], ['Mississippi', 'MS'], ['Missouri', 'MO'], ['Montana', 'MT'], ['Nebraska', 'NE'], ['Nevada', 'NV'], ['New Hampshire', 'NH'], ['New Jersey', 'NJ'], ['New Mexico', 'NM'], ['New York', 'NY'], ['North Carolina', 'NC'], ['North Dakota', 'ND'], ['Ohio', 'OH'], ['Oklahoma', 'OK'], ['Oregon', 'OR'], ['Pennsylvania', 'PA'], ['Rhode Island', 'RI'], ['South Carolina', 'SC'], ['South Dakota', 'SD'], ['Tennessee', 'TN'], ['Texas', 'TX'], ['Utah', 'UT'], ['Vermont', 'VT'], ['Virginia', 'VA'], ['Washington', 'WA'], ['West Virginia', 'WV'], ['Wisconsin', 'WI'], ['Wyoming', 'WY'],
].map(([name, code]) => [name.toUpperCase(), code]))
const need = (condition, message) => { if (!condition) throw new Error(`Excelacom native: ${message}`) }
const one = (nodes, label) => { need(nodes.length === 1, `expected one ${label}`); return nodes[0] }
const titleKey = value => normalize(value).replace(/[–—]/g, '-').normalize('NFKC')
const countries = { IN: 'India', INDIA: 'India', US: 'United States', USA: 'United States', 'UNITED STATES': 'United States', 'UNITED STATES OF AMERICA': 'United States' }
const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const recognizedCountries = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b)
  if (['EU', 'EZ', 'QO', 'UN', 'XA', 'XB', 'ZZ'].includes(code)) continue
  const name = regionNames.of(code)
  if (name) { recognizedCountries.set(code, name); recognizedCountries.set(name.toUpperCase(), name) }
}
const nativeCountry = value => {
  const raw = normalize(typeof value === 'object' && value ? value.name : value)
  return raw ? countries[raw.toUpperCase()] || recognizedCountries.get(raw.toUpperCase()) || null : null
}

const nativeUrl = (value, { pathName, rid = null } = {}) => {
  let url
  try { url = new URL(value, BOARD_URL) } catch { throw new Error('Excelacom native: invalid URL') }
  need(url.origin === 'https://phg.tbe.taleo.net' && !url.username && !url.password && url.searchParams.getAll('org').length === 1 && url.searchParams.get('org') === 'EXCELACOM' && url.searchParams.getAll('cws').length === 1 && url.searchParams.get('cws') === '38', 'board identity mismatch')
  if (pathName) need(url.pathname === `/phg02/ats/careers/v2/${pathName}`, 'native URL path mismatch')
  if (rid !== null) need(url.searchParams.getAll('rid').length === 1 && url.searchParams.get('rid') === String(rid), 'role application identity mismatch')
  url.hash = ''
  return url.href
}
const roleId = value => {
  const url = new URL(nativeUrl(value, { pathName: 'viewRequisition' }))
  const id = url.searchParams.get('rid')
  need(url.searchParams.getAll('rid').length === 1 && /^\d+$/.test(id || ''), 'missing native posting ID')
  return id
}

const defaultFetchText = async (url, options = {}) => {
  const response = await fetch(url, { method: 'GET', redirect: 'manual', headers: { Accept: 'text/html,application/xhtml+xml' }, signal: options.signal || AbortSignal.timeout(45000) })
  return { status: response.status, url: response.url, body: await response.text() }
}
const requestHtml = async (url, fetchText, options) => {
  // No retry and no fallback after any denial or unexpected response.
  const result = await fetchText(url, { method: 'GET', signal: options.signal })
  const response = typeof result === 'string' ? { status: 200, url, body: result } : result
  need(response && response.status === 200, `HTTP ${response?.status ?? 'unknown'}; stopping public access`)
  need(!response.url || new URL(response.url).href === new URL(url).href, 'unexpected redirect; stopping public access')
  need(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 4000000, 'missing or oversized native HTML')
  const d = readHtml(response.body)
  const title = d.nodes(n => n.tag === 'title').map(n => n.raw || '').join(' ')
  const body = d.text(d.root)
  need(!/verify you are human|just a moment|access denied|request blocked|robot check/i.test(title)
    && !/^(?:access denied|request blocked|verify you are human)|complete the captcha to continue/i.test(body), 'explicit access gate; stopping public access')
  return response.body
}

export const parseOfficialBinding = html => {
  const d = readHtml(html)
  const hiringWords = /\b(?:careers?|jobs?|openings?|vacancies|recruitment|hiring)\b/i
  const hiringContext = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (!['section', 'article', 'main', 'aside', 'div', 'nav', 'footer'].includes(parent.tag)) continue
      const children = parent.children.filter(child => typeof child !== 'string' && !child.inert)
      const headings = children.filter(child => /^h[1-6]$/.test(child.tag))
        .concat(children.filter(child => child.tag === 'header').flatMap(header => d.nodes(child => /^h[1-6]$/.test(child.tag), header)))
      if (headings.some(heading => hiringWords.test(d.text(heading))) || hiringWords.test(parent.attrs['aria-label'] || '')) return true
      // A separate office/footer/nav block cannot inherit a careers heading
      // from the outer page. Its own hiring heading still qualifies above.
      if (['footer', 'nav', 'aside'].includes(parent.tag)) return false
    }
    return false
  }
  const links = d.nodes(n => n.tag === 'a' && n.attrs.href).map(n => ({ text: normalize(d.text(n)), url: new URL(n.attrs.href, COMPANY_CAREERS_URL).href, hiringContext: hiringContext(n) }))
  const bound = links.filter(link => {
    try { nativeUrl(link.url, { pathName: 'jobSearch' }); return true } catch { return false }
  })
  need(bound.length > 0 && new Set(bound.map(link => link.url)).size === 1, 'current official careers binding missing or ambiguous')
  const extraChannels = links.filter(link => {
    if (link.url === COMPANY_CAREERS_URL || bound.some(b => b.url === link.url)) return false
    if (!link.hiringContext && !hiringWords.test(`${link.text} ${link.url}`) && !/^mailto:.*(?:careers|jobs|recruit)/i.test(link.url)) return false
    try {
      const url = new URL(link.url)
      return !(['www.excelacom.com', 'excelacom.com'].includes(url.hostname) && url.pathname === '/careers.html')
    } catch { return true }
  }).map(link => link.url)
  return { careersUrl: COMPANY_CAREERS_URL, boardEntryUrl: bound[0].url, extraChannels: [...new Set(extraChannels)] }
}

export const parseNativeListing = html => {
  const d = readHtml(html), scope = one(d.nodes(n => n.attrs.id === 'oracletaleocwsv2-wrapper'), 'native board scope')
  const count = normalize(d.text(one(d.nodes(n => hasClass(n, 'oracletaleocwsv2-panel-number'), scope), 'Positions Matched count')))
  need(/^\d+$/.test(count), 'invalid native matched count')
  const jobs = d.nodes(n => n.tag === 'a' && hasClass(n, 'viewJobLink'), scope).map(n => {
    const sourceUrl = nativeUrl(n.attrs.href, { pathName: 'viewRequisition' }), jobId = roleId(sourceUrl), title = normalize(d.text(n))
    need(title, 'empty native listing title')
    return { jobId, title, sourceUrl }
  })
  need(new Set(jobs.map(job => job.jobId)).size === jobs.length, 'duplicate listing posting identity')
  const next = d.nodes(n => n.tag === 'a' && n.attrs.href && n.attrs['aria-disabled'] !== 'true' && !Object.hasOwn(n.attrs, 'disabled') && !hasClass(n, 'disabled'), scope)
    .filter(n => n.attrs.rel?.split(/\s+/).includes('next') || /^(?:next(?:\s+page)?|[>»›]+)$/i.test(normalize(n.attrs['aria-label'] || d.text(n))))
    .map(n => nativeUrl(n.attrs.href, { pathName: 'searchResults' }))
  need(new Set(next).size <= 1, 'ambiguous native next-page control')
  return { jobs, reportedTotal: Number(count), nextUrl: next[0] || null }
}

const enumerate = async (startUrl, fetchText, options) => {
  const visited = new Set(), jobs = [], pages = []
  let url = startUrl, reportedTotal = null
  while (url) {
    need(!visited.has(url) && visited.size < 1000, 'pagination cycle or excessive page count')
    visited.add(url)
    const page = parseNativeListing(await requestHtml(url, fetchText, options))
    reportedTotal ??= page.reportedTotal
    need(page.reportedTotal === reportedTotal, 'native inventory total changed during pagination')
    jobs.push(...page.jobs)
    pages.push({ url, ids: page.jobs.map(job => job.jobId) })
    url = page.nextUrl
  }
  need(jobs.length === reportedTotal && new Set(jobs.map(job => job.jobId)).size === reportedTotal, 'terminal native inventory count or identity mismatch')
  return { jobs, reportedTotal, pages }
}

const calendarDate = value => {
  if (!value) return null
  // Some native Taleo postings use Java's Date.toString format, including
  // an explicit GMT zone. Accept only that observed format and round-trip
  // every component; Date.parse alone would normalize impossible dates.
  const nativeGmt = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT (\d{4})$/.exec(normalize(value))
  if (nativeGmt) {
    const [, weekday, month, day, hour, minute, second, year] = nativeGmt
    const monthNumber = String(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month) + 1).padStart(2, '0')
    const instant = `${year}-${monthNumber}-${day}T${hour}:${minute}:${second}.000Z`, parsed = new Date(instant)
    need(!Number.isNaN(parsed.getTime()) && parsed.toISOString() === instant && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parsed.getUTCDay()] === weekday, 'invalid native job date')
    return instant
  }
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|[ T])/.exec(normalize(value))
  need(match && !Number.isNaN(Date.parse(match[1])) && new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) === match[1], 'invalid native job date')
  // Taleo's current datePosted has no timezone. Preserve its calendar date;
  // observation time and RSS modification time are never publication evidence.
  return /T.*(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? new Date(value).toISOString() : match[1]
}
const jobPostings = value => Array.isArray(value) ? value.flatMap(jobPostings) : value && typeof value === 'object'
  ? [...([value['@type']].flat().includes('JobPosting') ? [value] : []), ...(value['@graph'] ? jobPostings(value['@graph']) : [])] : []
const section = (lines, label) => {
  const at = lines.findIndex(line => new RegExp(`^${label}:?$`, 'i').test(line))
  if (at < 0) return null
  const end = lines.findIndex((line, i) => i > at && /^(?:Who We Are|Who You Are|Role and Responsibilities|Required Qualifications|Preferred Qualifications|Compensation and Benefits|EEO Statement|Skills|Required Skills|Education|Experience):?$/i.test(line))
  return lines.slice(at + 1, end < 0 ? undefined : end).join('\n') || null
}

const qualifyCountry = (address, fields) => {
  const explicit = nativeCountry(address.addressCountry), visible = nativeCountry(fields.Country || fields['Location Country'])
  const region = normalize(address.addressRegion), state = normalize(fields.Location)
  const stateCode = US_STATE_CODES[state.toUpperCase()]
  const regionParts = /^([A-Z]{2})-([A-Z0-9]{1,3})$/.exec(region)
  const regionCountry = regionParts ? nativeCountry(regionParts[1]) : null
  const nativeExplicitCountry = explicit || visible
  need(!(regionCountry && nativeExplicitCountry && regionCountry !== nativeExplicitCountry), 'conflicting native country and worksite region')
  // Georgia is also a country, so its bare Location name is insufficient for
  // this contradiction check; an explicit US-GA region is unambiguous.
  const unambiguousUSState = stateCode && stateCode !== 'GA'
  need(!(unambiguousUSState && nativeExplicitCountry && nativeExplicitCountry !== 'United States'), 'conflicting native country and worksite state')
  need(!(unambiguousUSState && regionCountry && regionCountry !== 'United States'), 'conflicting native worksite state and country region')
  need(!(regionParts?.[1] === 'US' && stateCode && regionParts[2] !== stateCode), 'conflicting native worksite state and region')
  const usRegion = /^US-(?:TX|MO)$/.test(region)
  const qualifiedUS = usRegion || (['MO', 'TX'].includes(stateCode) && !region)
  need(!(explicit && visible && explicit !== visible), 'conflicting native job countries')
  need(!(qualifiedUS && (explicit || visible) && (explicit || visible) !== 'United States'), 'conflicting native country and worksite')
  if (explicit || visible) return { country: explicit || visible, evidence: { kind: 'explicit-native-job-country', nativeField: explicit ? 'JobPosting.jobLocation.address.addressCountry' : 'Country', nativeValue: explicit ? address.addressCountry : visible, nativeCountryMissing: false } }
  // Retained Census ANSI state table corroborates these exact job-owned fields.
  // This never searches a JD, a city, interview location or corporate address.
  if (qualifiedUS) return {
    country: 'United States', evidence: { kind: 'officially-qualified-native-job-worksite', nativeField: usRegion ? 'JobPosting.jobLocation.address.addressRegion' : 'Location', nativeValue: usRegion ? region : state, nativeCountryMissing: true, inference: 'native job worksite region/state qualified against the official US state table', referenceUrl: STATE_REFERENCE },
  }
  if (/^India$/i.test(state)) return { country: 'India', evidence: { kind: 'explicit-native-job-worksite-country', nativeField: 'Location', nativeValue: state, nativeCountryMissing: true } }
  return { country: null, evidence: { kind: 'unresolved-native-country', nativeCountryMissing: true, nativeWorksite: state || null, nativeRegion: region || null } }
}

export const parseNativeDetail = (html, row) => {
  const d = readHtml(html), scope = one(d.nodes(n => n.attrs.id === 'oracletaleocwsv2-wrapper'), 'native role scope')
  need(roleId(row.sourceUrl) === row.jobId, 'listing posting identity mismatch')
  const postings = d.nodes(n => n.tag === 'script' && n.attrs.type?.toLowerCase() === 'application/ld+json', scope).flatMap(n => {
    try { return jobPostings(JSON.parse(n.raw)) } catch { throw new Error('Excelacom native: invalid JobPosting JSON') }
  })
  const posting = one(postings, 'native JobPosting')
  need(roleId(posting.url) === row.jobId, 'structured native role identity mismatch')
  const sidebar = one(d.nodes(n => hasClass(n, 'well') && hasClass(n, 'oracletaleocwsv2-job-description'), scope), 'native role fields')
  const visibleTitle = one(sidebar.children.filter(n => typeof n !== 'string' && n.tag === 'strong' && !n.inert), 'visible role title')
  need(titleKey(d.text(visibleTitle)) === titleKey(row.title) && titleKey(posting.title) === titleKey(row.title), 'native role title identity mismatch')
  const employer = normalize(posting.hiringOrganization?.name)
  need(/^Excelacom(?:,? Inc\.?)?$/i.test(employer), 'native employer identity mismatch')
  const fields = {}
  for (const node of d.nodes(n => n.tag === 'div', sidebar)) {
    const children = node.children.filter(n => typeof n !== 'string' && !n.inert)
    const label = children.find(n => n.tag === 'span' && hasClass(n, 'small'))
    const value = children.find(n => n.tag === 'strong')
    if (label && value) {
      const key = normalize(d.text(label))
      need(!Object.hasOwn(fields, key), 'duplicate native job field')
      fields[key] = normalize(d.text(value)) || null
    }
  }
  const code = fields['Job Code'] || null, identifier = posting.identifier?.value == null ? null : String(posting.identifier.value)
  need(!code || !identifier || identifier === code, 'structured identifier and visible Job Code disagree')
  const description = d.text(one(d.nodes(n => n.attrs.name === 'cwsJobDescription', scope), 'full visible native description'))
  need(description.length >= 120 && /[\p{L}\p{N}]/u.test(description), 'missing full visible native description')
  const applications = d.nodes(n => n.tag === 'a' && /\bApply Now\b/i.test(normalize(d.text(n))), scope).map(n => nativeUrl(n.attrs.href, { pathName: 'applyRequisition', rid: row.jobId }))
  need(applications.length > 0 && new Set(applications).size === 1, 'missing or conflicting role application identity')
  const address = posting.jobLocation?.address || {}, { country, evidence } = qualifyCountry(address, fields)
  const city = fields['Location City'] || null, state = fields.Location || null
  const location = [...new Set([city, state, country].filter(Boolean))].join(', ') || null
  const lines = description.split('\n'), nativeType = normalize(posting.employmentType) || null
  const closingDate = calendarDate(posting.validThrough)
  return {
    title: row.title, company: 'Excelacom', source: 'excelacom', nativeEmployer: employer,
    companyDomain: 'excelacom.com', companyCareerPage: COMPANY_CAREERS_URL,
    atsPlatform: 'oracle-taleo', jobId: row.jobId, postingId: row.jobId,
    requisitionId: fields['Requisition ID'] || fields['Requisition Number'] || null,
    nativeJobCode: code, nativeIdentifier: identifier, nativeJobFields: fields,
    country, city, state, location, sourceCountryEvidence: evidence,
    sourceUrl: row.sourceUrl, applyUrl: applications[0], link: applications[0],
    employmentType: nativeType && !/^(?:any status|any|not specified)$/i.test(nativeType) ? nativeType : null,
    nativeEmploymentType: nativeType, workType: null,
    postingDate: calendarDate(posting.datePosted), sourcePostingDateRaw: posting.datePosted || null,
    sourcePostingDateProvenance: posting.datePosted ? 'native JobPosting.datePosted' : null,
    closingDate, sourceClosingDateIsExact: Boolean(closingDate && /T/.test(closingDate)),
    jobDescription: description, sourceDescription: description,
    minimumQualification: section(lines, 'Required Qualifications') || section(lines, 'Education'),
    preferredQualification: section(lines, 'Preferred Qualifications'),
    experienceRequired: lines.filter(line => /\b\d+\+?\s*(?:years?|yrs?)\b/i.test(line)).join('\n') || null,
    requiredSkills: (section(lines, 'Required Skills') || section(lines, 'Skills'))?.split('\n') || [],
    sourceDetailComplete: true,
  }
}

export const isIndiaJob = job => job?.country === 'India'
export const filterIndiaJobs = jobs => jobs.filter(isIndiaJob)

export const createExcelacomScraper = ({ maxJobs = null, now = () => new Date() } = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const binding = parseOfficialBinding(await requestHtml(COMPANY_CAREERS_URL, fetchText, options))
    const search = readHtml(await requestHtml(binding.boardEntryUrl, fetchText, options))
    const form = one(search.nodes(n => n.tag === 'form' && n.attrs.id === 'TBE_theForm'), 'advertised native search form')
    const startUrl = nativeUrl(form.attrs.action, { pathName: 'searchResults' })
    need(startUrl === BOARD_URL && form.attrs.method?.toLowerCase() === 'post', 'unexpected native search contract')
    // Fresh anonymous GET of the advertised results action carries no filters or
    // cookies; candidate forms and application endpoints are never requested.
    const opening = await enumerate(startUrl, fetchText, options), allJobs = []
    for (const row of opening.jobs) allJobs.push(parseNativeDetail(await requestHtml(row.sourceUrl, fetchText, options), row))
    const closing = await enumerate(startUrl, fetchText, options)
    const identity = inventory => inventory.jobs.map(j => [j.jobId, titleKey(j.title), j.sourceUrl].join('|')).sort().join('\n')
    need(opening.reportedTotal === closing.reportedTotal && identity(opening) === identity(closing), 'closing native inventory changed')
    const unresolved = allJobs.filter(job => !job.country), india = filterIndiaJobs(allJobs)
    const limit = options.maxJobs ?? maxJobs
    need(limit == null || (Number.isInteger(limit) && limit >= 0), 'invalid output limit')
    const selected = limit == null || limit === 0 ? india : india.slice(0, limit)
    const reasons = [...unresolved.map(job => `country-unresolved:${job.jobId}`), ...binding.extraChannels.map(() => 'additional-hiring-channel'), ...(selected.length < india.length ? ['output-limit'] : [])]
    const complete = reasons.length === 0, scrapedAt = new Date((options.now || now)()).toISOString()
    const jobs = selected.map(job => ({ ...job, scrapedAt, sourceGlobalJobCount: opening.reportedTotal, sourceObservedIndiaJobCount: india.length, sourceNativeListingComplete: true, sourceListingComplete: complete, sourceScopeComplete: complete, sourceOfficialBinding: { ...binding, companyCoverageComplete: complete } }))
    return attachInventoryEvidence(jobs, { status: !complete ? 'coverage-gap' : opening.reportedTotal === 0 ? 'verified-empty' : 'complete-inventory', surface: BOARD_URL, firstParty: true, listingComplete: complete, pagesFetched: opening.pages.length + closing.pages.length, reportedTotal: opening.reportedTotal, indiaFacetCount: complete ? india.length : null, verifiedAt: scrapedAt, reason: reasons.join(';') || 'official-native-pages-full-details-and-matching-closing-inventory' })
  },
})
export const run = options => createExcelacomScraper().run(options)
