import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { inspectRecruitingBundle } from '../../scraper-support/utils/recruitingBundleContracts.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'dittoinsurance'
export const COMPANY = 'Ditto Insurance'
export const OFFICIAL_HOME_URL = 'https://joinditto.in/'
export const OFFICIAL_CAREERS_URL = 'https://ditto.zappyhire.com/'
export const TENANT = 'dittoinsurance'
export const API_ORIGIN = 'https://dittoinsurance.zappyhire-multitenant-be-prod.zappyhire.com'
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const sameUrl = (a, b) => String(a || '').replace(/\/+$/, '') === String(b || '').replace(/\/+$/, '')
const fail = reason => { throw new Error(`Ditto Insurance native inventory: ${reason}`) }
const knownCountries = new Map(), countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = countryNames.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) knownCountries.set(code, name)
}
const envelope = payload => {
  if (payload?.status !== 1 || payload.errors || !payload.results || typeof payload.results !== 'object') fail('failed or malformed native inventory envelope')
  return payload.results
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)]),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return { status: response.status, url: response.url, html: await response.text() }
}
const defaultFetchJson = (url, options) => fetchJsonWithRetry(url, { ...options, label: SOURCE, timeoutMs: 20000 })

export const hasVerifiedOfficialCareersHandoff = (html = '') => {
  const document = readNativeDocument(html)
  return document.nodes(node => node.tag === 'a' && node.attrs.href).some(node =>
    sameUrl(node.attrs.href, OFFICIAL_CAREERS_URL) && /\bcareers?\b/i.test(document.text(node)))
}

const pageAt = async (url, fetchPage, signal) => {
  signal?.throwIfAborted()
  const page = await fetchPage(url, { signal })
  signal?.throwIfAborted()
  if (page?.status !== 200 || !sameUrl(page.url, url) || typeof page.html !== 'string') fail('employer page or bundle binding unavailable')
  return page.html
}
const indiaLocation = item => {
  if (!item || typeof item.city !== 'string') fail('malformed native location')
  if (item.country_code != null && typeof item.country_code !== 'string') fail('malformed native country')
  const label = clean(item.city), code = clean(item.country_code).toUpperCase()
  const region = /^(?:Bangalore|Bengaluru)[\s,-]+Karnataka(?:[\s,-]+India)?$/i.test(label)
  const explicit = /\bIndia\b/i.test(label)
  const remote = /^(?:Remote)(?:[\s,-]+Remote)?$/i.test(label)
  if (code && !['IN', 'IND', 'INDIA'].includes(code)) {
    if (!knownCountries.has(code)) return { india: false, unknown: true, location: label }
    if (region || explicit) fail('contradictory native country/location')
    return { india: false, unknown: false, location: label }
  }
  if (region || explicit || ['IN', 'IND', 'INDIA'].includes(code)) return {
    india: true, unknown: false, location: remote ? 'Remote' : label,
    city: region ? 'Bangalore' : remote ? null : label.split(/[,-]/)[0].trim(),
  }
  // Organization country, calling-code defaults and generic Remote are not
  // evidence that a vacancy accepts candidates working in India.
  return { india: false, unknown: true, location: label }
}
const validApplyUrl = (value, id, form) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false
    return form ? url.hostname === 'forms.zappyhire.com' && /^\/dittoinsurance\/forms\/\d+\/?$/.test(url.pathname)
      && url.searchParams.getAll('jobId').length === 1 && url.searchParams.get('jobId') === String(id)
      && url.searchParams.get('mode') === 'job-application'
      : url.origin === new URL(OFFICIAL_CAREERS_URL).origin && /^\/apply\/?$/.test(url.pathname)
        && url.searchParams.getAll('job').length === 1 && url.searchParams.get('job') === String(id)
  } catch { return false }
}

export const createDittoInsuranceScraper = ({ pageSize = 100, maxPages = 50, maxJobs = null } = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, signal, now = () => new Date().toISOString() } = {}) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isInteger(maxPages) || maxPages < 1) fail('invalid pagination limits')
    const homepage = await pageAt(OFFICIAL_HOME_URL, fetchPage, signal)
    if (!hasVerifiedOfficialCareersHandoff(homepage)) fail('current employer careers handoff unavailable')
    const portal = await pageAt(OFFICIAL_CAREERS_URL, fetchPage, signal)
    const bundles = readNativeDocument(portal).nodes(node => node.tag === 'script' && !Object.hasOwn(node.attrs, 'nomodule')
      && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')
      && /^main\.[a-z\d]+\.js$/i.test(node.attrs.src || ''))
    if (bundles.length !== 1) fail('current executable main bundle binding unavailable')
    const bundleUrl = new URL(bundles[0].attrs.src, OFFICIAL_CAREERS_URL).href
    const facts = inspectRecruitingBundle(await pageAt(bundleUrl, fetchPage, signal), { sessionTenant: TENANT })
    if (facts.tenantWrites.length !== 1 || facts.tenantWrites[0] !== TENANT
      || !facts.httpGetStaticUrls.includes(`${API_ORIGIN}/api/careers/configurations/`)
      || facts.httpGetStaticUrls.some(url => /\/api\/careers\/(?:draft-)?configurations\//.test(url) && !url.startsWith(`${API_ORIGIN}/`))
      || !facts.httpGetTemplates.some(url => url.startsWith(`${API_ORIGIN}/api/jobs/jobsearch/`))
      || !facts.httpGetTemplates.some(url => url.startsWith(`${API_ORIGIN}/api/careers/jobs/`))) fail('bundle tenant/API contract changed')
    const loadJson = async url => {
      signal?.throwIfAborted()
      const payload = await fetchJson(url, { signal })
      signal?.throwIfAborted()
      return payload
    }
    const config = envelope(await loadJson(`${API_ORIGIN}/api/careers/configurations/`))
    if (clean(config.name) !== COMPANY || !sameUrl(config.website, OFFICIAL_HOME_URL) || config.multiple_entity !== false) fail('employer identity or reciprocal website binding changed')
    const readListing = async () => {
      const rows = [], ids = new Set(), reasons = new Set()
      let total = null, pages = 0
      for (let page = 1; page <= maxPages; page++) {
        const result = envelope(await loadJson(`${API_ORIGIN}/api/jobs/jobsearch/?page=${page}&page_size=${pageSize}`))
        pages++
        if (!Array.isArray(result.hits) || !Number.isSafeInteger(result.total?.value) || result.total.value < 0
          || !['eq', 'gte'].includes(result.total.relation)) fail('malformed native listing total or rows')
        if (result.total.relation !== 'eq') reasons.add('native-total-not-exact')
        if (total != null && result.total.value !== total) reasons.add('native-listing-total-changed')
        total = result.total.value
        for (const hit of result.hits) {
          const row = hit?._source
          if (!row || row.client !== TENANT || row.entity !== COMPANY || !Number.isSafeInteger(row.job) || row.job <= 0
            || hit._id !== `${row.job}${TENANT}` || !clean(row.title) || !clean(row.location)) fail('listing tenant/employer/role identity mismatch')
          if (ids.has(row.job)) fail('repeated or duplicate native listing role')
          ids.add(row.job); rows.push(row)
        }
        if (result.total.relation === 'eq' && rows.length >= total) {
          if (rows.length !== total) fail('native listing rows contradict exact total')
          break
        }
        if (result.hits.length < pageSize) {
          if (result.total.relation === 'eq' && rows.length !== total) fail('truncated native inventory')
          break
        }
        if (page === maxPages) reasons.add('native-listing-page-limit')
      }
      return { rows, ids, reasons, total: reasons.has('native-total-not-exact') ? null : total, pages }
    }
    const initial = await readListing(), reasons = new Set(initial.reasons), jobs = []
    for (const row of initial.rows) {
      let payload
      try { payload = await loadJson(`${API_ORIGIN}/api/careers/jobs/${row.job}/`) }
      catch (error) { signal?.throwIfAborted(); reasons.add(`native-role-detail-unavailable:${row.job}`); continue }
      const role = envelope(payload)
      if (role.id !== row.job || role.entity !== 1 || role.is_vendor_job !== false || !clean(role.title)) fail('detail employer/role/vendor identity mismatch')
      if (['is_active', 'is_published', 'active', 'published'].some(key => Object.hasOwn(role, key) && role[key] !== true)
        || (Object.hasOwn(role, 'closed') && role.closed !== false)) fail('contradictory native active inventory status')
      const careerLinks = (role.job_board_urls || []).filter(link => link.name === 'Career Page')
      if (careerLinks.length !== 1 || !validApplyUrl(careerLinks[0].url, role.id, false)
        || careerLinks[0].feature?.is_active !== true || careerLinks[0].feature?.is_enabled !== true) fail('native career apply identity unavailable')
      const applyUrl = role.apply_url || careerLinks[0].url
      if (!validApplyUrl(applyUrl, role.id, Boolean(role.apply_url))) fail('foreign native apply identity')
      if (!Array.isArray(role.location) || !role.location.length) { reasons.add('native-location-scope-unresolved'); continue }
      const locations = role.location.map(indiaLocation)
      if (locations.some(location => location.unknown)) reasons.add('native-location-scope-unresolved')
      const selected = locations.find(location => location.india)
      if (!selected) continue
      if (!hasSourceDescription({ jobDescription: role.description })) { reasons.add('selected-role-description-unavailable'); continue }
      if (clean(role.title) !== clean(row.title)) reasons.add('listing-detail-title-changed')
      const posted = typeof role.job_publish_date === 'string' && Number.isFinite(Date.parse(role.job_publish_date)) ? role.job_publish_date : null
      if (role.job_publish_date && !posted) reasons.add('invalid-native-publication-date')
      if (role.skills != null && (!Array.isArray(role.skills) || role.skills.some(skill => typeof skill !== 'string'))) fail('malformed native skills')
      jobs.push({ source: SOURCE, company: COMPANY, title: role.title, jobId: String(role.id), requisitionId: String(role.id),
        location: selected.location, city: selected.city, country: 'India',
        sourceUrl: careerLinks[0].url, applyUrl, link: applyUrl,
        companyCareerPage: OFFICIAL_CAREERS_URL, companyDomain: 'joinditto.in', atsPlatform: 'zappyhire',
        department: clean(role.department) || null, employmentType: clean(role.job_type) || null,
        jobDescription: role.description, postingDate: posted, closingDate: null,
        experienceRequired: Number.isFinite(role.experience) && Number.isFinite(role.max_experience)
          ? `${role.experience}-${role.max_experience} years` : null,
        minimumQualification: null, preferredQualification: null, requiredSkills: role.skills || [],
        remoteStatus: /^Remote$/i.test(selected.location) ? 'Remote' : null, scrapedAt: now() })
    }
    const closing = await readListing()
    for (const reason of closing.reasons) reasons.add(reason)
    if (initial.total !== closing.total || initial.ids.size !== closing.ids.size
      || [...initial.ids].some(id => !closing.ids.has(id))) reasons.add('closing-native-role-identities-not-reconciled')
    const capped = Number.isInteger(maxJobs) && maxJobs >= 0 && maxJobs < jobs.length
    const selectedJobs = capped ? jobs.slice(0, maxJobs) : jobs
    if (capped) reasons.add('source-job-limit')
    const listingComplete = reasons.size === 0
    if (!listingComplete) for (const job of selectedJobs) Object.assign(job, {
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
    return attachInventoryEvidence(selectedJobs, { firstParty: true, listingComplete,
      status: listingComplete ? initial.rows.length ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      surface: `${API_ORIGIN}/api/jobs/jobsearch/?page=1&page_size=${pageSize}`,
      pagesFetched: initial.pages + closing.pages, reportedTotal: closing.total, verifiedAt: now(),
      indiaFacetCount: listingComplete ? jobs.length : null,
      reason: listingComplete ? 'ditto-current-employer-native-listings-and-details-reconciled' : `ditto-native-incomplete:${[...reasons].join(';')}` })
  },
})

export const run = async (options = {}) => createDittoInsuranceScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
