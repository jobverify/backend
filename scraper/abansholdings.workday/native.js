import { activeScripts, readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CORPORATE_URL = 'https://abansfinserv.com/'
export const CAREERS_URL = 'https://abanscareers.com/'
export const OPENINGS_URL = CAREERS_URL + 'career-openings.aspx'
export const KEKA_URL = 'https://abans.keka.com/careers'
export const IDENTIFIER = '7f72cc0e-e77b-4832-9d67-8b9c42a4da9d'
export const RENDERER_URL = KEKA_URL + '/api/embedjobs/js/' + IDENTIFIER
export const ACTIVE_URL = KEKA_URL + '/api/embedjobs/default/active/' + IDENTIFIER
const ORGANIZATION_URL = KEKA_URL + '/api/organization/default/careerportalinfo'
const GROUP_LINK_URL = KEKA_URL + '/api/embedjobs/grouplinkstatus/' + IDENTIFIER
const clean = value => typeof value === 'string' ? value.trim() : ''
const prove = (ok, reason) => {
  if (!ok) throw Object.assign(new Error('Abans native careers: ' + reason), {
    code: 'ABANS_NATIVE_CONTRACT_UNAVAILABLE', softFailure: true,
    failureKind: 'parser_or_contract_error', abortRetries: true,
  })
}
const request = async (url, { signal, stage } = {}) => {
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000), headers: { Accept: 'application/json,text/html,application/javascript' } })
  if (response.status !== 200 || response.url !== url) throw Object.assign(new Error('Abans careers HTTP or response identity unavailable'), {
    status: response.status, httpStatus: response.status, requestedUrl: url, finalUrl: response.url, stage,
    softFailure: true, abortRetries: true,
    failureKind: [202, 401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'upstream_inventory_unavailable',
  })
  const body = await response.text()
  prove(Buffer.byteLength(body) <= 3 * 1024 * 1024, 'native response size exceeds reviewed contract')
  signal?.throwIfAborted()
  return { status: response.status, finalUrl: response.url, html: body }
}
const defaultPage = (url, options) => request(url, options)
const defaultJson = async (url, options) => JSON.parse((await request(url, options)).html)
const hasLink = (html, base, target) => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
  try { return new URL(node.attrs.href, base).href === target } catch { return false }
})
const countryNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const readPublicationDate = (value, checkedAt) => {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(Z|[+-](\d{2}):(\d{2}))$/)
  prove(match, 'original native publication date is not a timezone-qualified ISO timestamp')
  const [, y, m, d, h, minute, second, , zone, offsetH, offsetM] = match
  const year = Number(y), month = Number(m), day = Number(d)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  prove(year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && Number(h) <= 23 && Number(minute) <= 59 && Number(second) <= 59
    && (zone === 'Z' || Number(offsetH) <= 14 && Number(offsetM) <= 59 && (Number(offsetH) < 14 || Number(offsetM) === 0)),
  'original native publication date has an invalid calendar, clock or timezone')
  const timestamp = Date.parse(value)
  prove(Number.isFinite(timestamp) && timestamp <= Date.parse(checkedAt), 'original native publication date is unavailable or in the future')
  return new Date(timestamp).toISOString()
}
const readInventory = (payload, checkedAt) => {
  prove(Array.isArray(payload), 'active inventory is not a complete native array')
  const ids = new Set()
  return payload.map(record => {
    prove(record && Number.isSafeInteger(record.id) && record.id > 0 && !ids.has(record.id)
      && clean(record.title) && /^AB\d+$/.test(record.jobNumber || ''), 'missing or repeated native job identity')
    ids.add(record.id)
    const description = extractActiveDescription(record.description)
    prove(description, 'full active native description is unavailable')
    const publishedAt = readPublicationDate(record.publishedOn, checkedAt)
    prove(Array.isArray(record.jobLocations), 'invalid native geography inventory')
    const locations = record.jobLocations.map(location => {
      prove(location && Number.isSafeInteger(location.id) && location.id > 0 && clean(location.name)
        && clean(location.city) && typeof location.state === 'string' && /^[A-Z]{2}$/.test(location.countryCode || '')
        && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'QO'].includes(location.countryCode), 'unknown native location identity')
      const country = countryNames.of(location.countryCode)
      prove(country && country.toLowerCase() === clean(location.countryName).toLowerCase(), 'contradictory native country')
      prove(location.countryCode !== 'IN' || !/\b(?:United States|USA|United Kingdom|Canada|Singapore|Germany|Australia|United Arab Emirates)\b/i.test(location.name + ' ' + location.city), 'contradictory India office')
      return Object.fromEntries(['id', 'name', 'city', 'state', 'countryCode', 'countryName'].map(key => [key, location[key]]))
    })
    prove(new Set(locations.map(location => location.id)).size === locations.length, 'repeated native office identity')
    return { record, description, locations, publishedAt }
  })
}
const signature = rows => JSON.stringify(rows.map(({ record, locations }) => ({ id: record.id, title: record.title,
  jobNumber: record.jobNumber, description: record.description, publishedOn: record.publishedOn,
  experience: record.experience, department: record.departmentName, jobType: record.jobType,
  locations: [...locations].sort((a, b) => a.id - b.id),
})).sort((a, b) => a.id - b.id))

export async function runNative({ fetchPage = defaultPage, fetchJson = defaultJson, signal, now = () => new Date().toISOString(), maxJobs = null } = {}) {
  signal?.throwIfAborted()
  prove(maxJobs === null, 'caller cap cannot establish an untruncated inventory')
  const page = async (url, stage) => {
    signal?.throwIfAborted()
    const response = await fetchPage(url, { signal, stage })
    signal?.throwIfAborted()
    if (response.status !== 200) throw Object.assign(new Error('Abans official page HTTP ' + response.status), {
      stage, requestedUrl: url, finalUrl: response.finalUrl || response.url, status: response.status,
      httpStatus: response.status, softFailure: true, abortRetries: true,
      failureKind: [202, 401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'upstream_inventory_unavailable',
    })
    prove((response.finalUrl || response.url) === url && typeof response.html === 'string', 'unverified page final URL or body')
    return response.html
  }
  const json = async (url, stage) => {
    signal?.throwIfAborted()
    const payload = await fetchJson(url, { signal, stage })
    signal?.throwIfAborted()
    return payload
  }
  prove(hasLink(await page(CORPORATE_URL, 'official-corporate'), CORPORATE_URL, CAREERS_URL), 'current corporate careers delegation changed')
  prove(hasLink(await page(CAREERS_URL, 'official-careers'), CAREERS_URL, OPENINGS_URL), 'current openings delegation changed')
  prove(hasLink(await page(OPENINGS_URL, 'official-openings'), OPENINGS_URL, KEKA_URL), 'current exact Keka delegation changed')
  const paths = activeScripts(await page(KEKA_URL, 'native-shell')).flatMap(body => [...body.matchAll(/fetch\(\s*['"](\/ats\/documents\/[a-z\d-]+\/careerportal\/[a-z\d]+\.html)['"]\s*\)/gi)].map(match => match[1]))
  prove(paths.length === 1 && new RegExp('^/ats/documents/' + IDENTIFIER + '/careerportal/[a-z\\d]+\\.html$').test(paths[0]), 'native portal document identity changed')
  const portal = await page(new URL(paths[0], KEKA_URL).href, 'native-portal')
  const configs = activeScripts(portal).flatMap(body => [...body.matchAll(/window\.khConfig\s*=\s*\{([^}]+)\}/g)].map(match => match[1]))
  const value = key => configs[0]?.match(new RegExp('\\b' + key + '\\s*:\\s*["\']([^"\']+)["\']'))?.[1]
  prove(configs.length === 1 && value('identifier') === IDENTIFIER && value('domain') === KEKA_URL + '/'
    && (!value('portalName') || value('portalName') === 'default'), 'native portal configuration identity changed')
  const renderer = await page(RENDERER_URL, 'native-renderer')
  prove(/fetch\(khConfig\.domain\s*\+\s*`api\/embedjobs\/\$\{portalName\}\/active\/`\s*\+\s*khConfig\.identifier\s*\)/.test(renderer)
    && renderer.includes("'jobdetails/' + job.id") && renderer.includes('job.jobLocations'), 'native unpaginated renderer contract changed')
  const organization = await json(ORGANIZATION_URL, 'native-organization')
  prove(organization?.name === 'ABANS GROUP' && organization.shortName === 'ABANS GROUP'
    && organization.careersPortalDomain === 'abans.keka.com' && organization.companyWebsite === CORPORATE_URL, 'native publisher or reciprocal employer identity changed')
  prove((await json(GROUP_LINK_URL, 'native-group-contract'))?.isGroupLinked === false, 'unreviewed linked-group contract')
  const checkedAt = new Date(now()).toISOString()
  const first = readInventory(await json(ACTIVE_URL, 'native-active-list'), checkedAt)
  const last = readInventory(await json(ACTIVE_URL, 'native-active-recheck'), checkedAt)
  prove(signature(first) === signature(last), 'final native inventory drift')
  signal?.throwIfAborted()
  const jobs = first.flatMap(({ record, description, locations, publishedAt }) => {
    const india = locations.filter(location => location.countryCode === 'IN')
    if (!india.length) return []
    const labels = india.map(location => `${location.name}, ${location.state}, India`)
    const url = `${KEKA_URL}/jobdetails/${record.id}`
    return [{ source: 'abansholdings', company: organization.name, nativePublisher: organization.name, legalEmployer: null,
      jobId: String(record.id), requisitionId: record.jobNumber, title: record.title, country: 'India',
      location: labels.join(' / '), locations: labels, city: india.length === 1 ? india[0].city : null,
      state: india.length === 1 ? india[0].state : null, sourceUrl: url, applyUrl: url, link: url,
      sourceDescription: record.description, jobDescription: description, sourceDetailComplete: true,
      postingDate: publishedAt, nativePublishedOn: record.publishedOn, experienceRequired: clean(record.experience) || null,
      department: clean(record.departmentName) || null, employmentType: record.jobType === 2 ? 'Full Time' : null,
      sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false, scrapedAt: checkedAt }]
  })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', firstParty: true, surface: ACTIVE_URL,
    listingComplete: false, pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: checkedAt,
    reason: 'current-official-reciprocal-abans-group-keka-native-contract-rechecked;holdings-only-legal-scope-unreconciled'
      + (first.some(row => !row.locations.length) ? ';native-location-scope-unresolved' : '') })
}
