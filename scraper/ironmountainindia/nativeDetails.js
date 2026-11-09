import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { parseWorkdayNativeLifecycleDate } from '../../scraper-support/myworkday/nativeLifecycleDates.js'

const ORIGIN = 'https://ironmountain.jobs'
const WORKDAY = 'https://ironmountain.wd5.myworkdayjobs.com'
const SITE = 'iron-mountain-jobs'
const requireNative = (ok, message) => { if (!ok) throw new Error(`Iron Mountain native ${message}`) }
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const legalEmployers = new Set([
  '45101 Web Werks India Pvt Ltd', '45900 Iron Mountain Services Private Limited',
  '45000 Iron Mountain India Private Ltd', '68300 Iron Mountain SRL', '45015 Capital Record Centre Private Limited',
])
const countries = new Map([
  ['IND', { name: 'India', alpha2: 'IN' }], ['ROU', { name: 'Romania', alpha2: 'RO' }], ['POL', { name: 'Poland', alpha2: 'PL' }],
])

const parseEntry = entry => {
  let url
  try { url = new URL(entry?.url) } catch { requireNative(false, 'sitemap role URL is malformed') }
  const [place, titleSlug, guid, marker, ...extra] = url.pathname.split('/').filter(Boolean)
  requireNative(url.origin === ORIGIN && !url.username && !url.password && !url.search && !url.hash
    && !extra.length && marker === 'job' && /^[a-z0-9-]+-ind$/.test(place || '')
    && /^[a-z0-9-]+$/.test(titleSlug || '') && /^[A-F0-9]{32}$/.test(guid || ''), 'sitemap role identity changed')
  return { guid, titleSlug, citySlug: place.slice(0, -4) }
}

export const buildNativeDataUrl = entry => `https://microsites.dejobs.org/ironmountain-jobs/data/${parseEntry(entry).guid}.json`

export const validateNativeNlx = (entry, value) => {
  const role = parseEntry(entry)
  requireNative(value?.guid === role.guid && value.id === `seo.joblisting.${role.guid}`
    && value.company === 'Iron Mountain' && ['http://ironmountain.jobs/', `${ORIGIN}/`].includes(value.company_canonical_microsite)
    && value.country === 'India' && value.country_short === 'IND' && value.title_slug === role.titleSlug
    && value.city_slug === role.citySlug && norm(value.city) && norm(value.title) && /^J\d+$/.test(value.reqid || '')
    && value.link === `https://de.jobsyn.org/${role.guid}10`, 'NLX role, employer, India office or application conflicts with sitemap')
  return value
}

export const resolveNativeWorkday = receipt => {
  let url
  try { url = new URL(receipt?.url) } catch { requireNative(false, 'application redirect URL is malformed') }
  requireNative(receipt?.status === 200 && url.origin === WORKDAY && !url.username && !url.password && !url.hash
    && /^\/iron-mountain-jobs\/job\/[^/]+\/[^/]+\/apply$/.test(url.pathname)
    && [...url.searchParams.keys()].every(key => key === 'source') && url.searchParams.getAll('source').length <= 1,
  'application redirect leaves the configured Workday tenant or board')
  const path = url.pathname.replace(/\/apply$/, '')
  return { applyUrl: url.href, primaryUrl: WORKDAY + path, cxsUrl: `${WORKDAY}/wday/cxs/ironmountain${path}`,
    postingId: path.split('/').at(-1) }
}

const office = value => {
  requireNative(typeof value === 'string', 'native office is missing')
  const parts = value.split('|').map(norm)
  requireNative(parts.length >= 3 && parts.every(Boolean) && countries.has(parts[0]), 'native office country set is unresolved')
  return { country: countries.get(parts[0]).name, alpha2: countries.get(parts[0]).alpha2, city: parts[1], raw: value }
}
const calendar = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  requireNative(match, 'primary publication date is missing or malformed')
  const [, y, m, d] = match.map(Number), date = new Date(Date.UTC(y, m - 1, d))
  requireNative(date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d, 'primary publication date is invalid')
  return value
}

export const extractNativeIronJob = (entry, rawNlx, applyReceipt, payload, { now = new Date() } = {}) => {
  const nlx = validateNativeNlx(entry, rawNlx), target = resolveNativeWorkday(applyReceipt), info = payload?.jobPostingInfo
  requireNative(payload?.userAuthenticated === false && info?.jobReqId === nlx.reqid && norm(info.title) === norm(nlx.title)
    && info.jobPostingSiteId === SITE && info.jobPostingId === target.postingId && info.externalUrl === target.primaryUrl
    && info.posted === true && info.canApply === true, 'primary role, site, public status or application conflicts with NLX')
  requireNative(legalEmployers.has(payload.hiringOrganization?.name), 'primary legal employer is outside the observed official group scope')
  requireNative(info.additionalLocations === undefined || Array.isArray(info.additionalLocations), 'additional native office inventory is malformed')
  const offices = [info.location, ...(info.additionalLocations || [])].map(office), primary = offices[0]
  requireNative(info.country?.descriptor === primary.country && info.jobRequisitionLocation?.country?.descriptor === primary.country
    && /^[a-f0-9]{32}$/i.test(info.country?.id || '') && info.jobRequisitionLocation.country.id === info.country.id
    && info.jobRequisitionLocation.country.alpha2Code === primary.alpha2
    && offices.some(place => place.country === 'India' && place.city === norm(nlx.city)), 'primary country or assigned India office conflicts with NLX')
  requireNative(typeof info.jobDescription === 'string' && extractActiveDescription(info.jobDescription), 'primary published role description is missing')
  const postingDate = calendar(info.startDate)
  requireNative(typeof nlx.date_added === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(nlx.date_added)
    && Number.isFinite(new Date(nlx.date_added).getTime()) && new Date(nlx.date_added).toISOString() === nlx.date_added && nlx.date_added.slice(0, 10) === postingDate,
  'primary publication date conflicts with the NLX date added')
  const comparisonClock = new Date(now)
  requireNative(Number.isFinite(comparisonClock.getTime()), 'publication comparison clock is invalid')
  requireNative(new Date(nlx.date_added).getTime() <= comparisonClock.getTime(), 'publication date is in the future of the source run clock')
  let closing
  try { closing = parseWorkdayNativeLifecycleDate(info.endDate, { field: 'endDate' }) }
  catch (error) { requireNative(false, error.message) }
  return { title: info.title, company: 'Iron Mountain India', department: null, country: 'India', city: nlx.city, state: null,
    location: `${nlx.city}, India`, jobId: nlx.guid, requisitionId: info.jobReqId,
    sourceUrl: entry.url, applyUrl: target.applyUrl, employmentType: info.timeType || null,
    experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
    postingDate, closingDate: closing.raw, sourceClosingDateIsExact: closing.exact,
    jobDescription: info.jobDescription, sourceDescription: info.jobDescription,
    jobDescriptionHtml: info.jobDescription, sourceDetailComplete: true,
    sourceNativePrimaryUrl: target.primaryUrl, sourceNativePrimaryCountry: primary.country,
    sourceNativeWorkdayLocations: offices.map(place => place.raw),
    sourceNativeDates: { sitemapLastmod: entry.lastmod ?? null, nlxDateAdded: nlx.date_added ?? null,
      nlxDateNew: nlx.date_new ?? null, nlxDateUpdated: nlx.date_updated ?? null, workdayStartDate: info.startDate, workdayEndDate: closing.raw },
    sourceNativeDatePrecision: { workdayStartDate: 'calendar-date', workdayEndDate: closing.precision },
    sourceNativeStatusEvidence: { nlxIsPosted: nlx.is_posted ?? null, workdayPosted: info.posted, workdayCanApply: info.canApply },
    sourceNativeEmployerEvidence: { nlxCompany: nlx.company, primaryLegalEmployer: payload.hiringOrganization.name,
      configuredWorkdayTenant: WORKDAY, configuredWorkdaySite: SITE, scope: 'Official Iron Mountain group careers board' },
  }
}
