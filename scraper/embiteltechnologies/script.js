import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { EMBITEL_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = EMBITEL_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPENINGS_URL = PROVIDER_METADATA.openingsPageUrl
export const JOBS_SCRIPT_URL = PROVIDER_METADATA.jobsScriptUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.workdayBoardUrl
export const WORKDAY_API_URL = PROVIDER_METADATA.workdayJobsApiUrl
const CXS_BASE = WORKDAY_API_URL.replace(/\/jobs$/, '')
const PAGE_SIZE = 20
const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' }
const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal, headers: { ...headers, Accept: 'text/html,application/javascript' }, label: SOURCE, timeoutMs: 20000,
})
const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options, headers: { ...headers, Accept: 'application/json',
    'Content-Type': url === JOBS_API_URL ? 'application/x-www-form-urlencoded' : 'application/json' },
  label: SOURCE, timeoutMs: 30000,
})
const normalize = value => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
const decode = value => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number.parseInt(n, 10)))
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
const text = value => { let decoded = String(value ?? ''); for (let pass = 0; pass < 3; pass++) decoded = decode(decoded); return normalize(decoded.replace(/<[^>]*>/g, ' ')) }
const fail = message => { throw new Error('Embitel incomplete current Workday inventory: ' + message) }
const hasLink = (html, expected) => [...String(html).matchAll(/(?:href|src)=["']([^"']+)["']/gi)]
  .some(match => { try { return new URL(decode(match[1]), CAREERS_URL).toString() === expected } catch { return false } })
const indiaCity = location => /\bBangalore\b|\bBengaluru\b|^BLR-/i.test(location) ? 'Bangalore'
  : /\bPune\b/i.test(location) ? 'Pune' : null
const validateHandoff = payload => {
  if (payload?.success !== true || !Array.isArray(payload.data) || !payload.data.length) fail('missing first-party Workday employer handoff')
  // This cached first-party list is identity evidence, not a current inventory:
  // live audit found 41 absent requisitions and 12 current roles missing from it.
  for (const row of payload.data) {
    const url = typeof row?.job_url === 'string' ? row.job_url : ''
    if (!url.startsWith(WORKDAY_BOARD_URL + '/job/') || !/^https:/.test(url)) fail('first-party handoff no longer matches the verified employer board')
    try { if (new URL(url).origin !== new URL(WORKDAY_BOARD_URL).origin) fail('invalid first-party handoff') } catch { fail('malformed first-party handoff') }
  }
}
const getInventory = async fetchPage => {
  const first = await fetchPage(0)
  const total = first?.total
  if (!Number.isSafeInteger(total) || total < 0 || total > 10000) fail('missing native reported total')
  const rows = [], ids = new Set(), paths = new Set()
  for (let offset = 0; offset < Math.max(1, total); offset += PAGE_SIZE) {
    const page = offset === 0 ? first : await fetchPage(offset)
    const expected = Math.min(PAGE_SIZE, Math.max(0, total - offset))
    if ((page?.total !== total && !(offset > 0 && page?.total === 0)) || !Array.isArray(page?.jobPostings)
      || page.jobPostings.length !== expected) fail('native count changed or pagination truncated')
    for (const row of page.jobPostings) {
      const id = row?.bulletFields?.[0]
      if (typeof row?.title !== 'string' || !normalize(row.title) || typeof row.locationsText !== 'string' || !normalize(row.locationsText)
        || !Array.isArray(row.bulletFields) || row.bulletFields.length !== 1 || !/^JR\d+$/.test(id ?? '')
        || typeof row.externalPath !== 'string' || !/^\/job\/[^?\s#]+$/.test(row.externalPath)
        || !new RegExp('_' + id + '(?:-\\d+)?$').test(row.externalPath)
        || ids.has(id) || paths.has(row.externalPath)) fail('missing or duplicate native job identity')
      ids.add(id); paths.add(row.externalPath); rows.push(row)
    }
  }
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}
const mapDetail = (row, payload) => {
  const info = payload?.jobPostingInfo, id = row.bulletFields[0], url = WORKDAY_BOARD_URL + row.externalPath
  if (!info || payload?.hiringOrganization?.name !== PROVIDER_METADATA.verifiedHiringOrganization
    || info.jobPostingSiteId !== 'Embitel_Technologies' || info.jobReqId !== id || info.jobPostingId !== row.externalPath.split('/').pop()
    || normalize(info.title) !== normalize(row.title) || normalize(info.location) !== normalize(row.locationsText)
    || info.externalUrl !== url || info.canApply !== true || info.posted !== true
    || typeof info.jobDescription !== 'string' || !text(info.jobDescription)) fail('employer, detail identity or current application status disagrees')
  if (info.additionalLocations?.length) fail('unresolved additional location countries')
  const country = info.country, officeCountry = info.jobRequisitionLocation?.country, code = officeCountry?.alpha2Code
  if (!/^[A-Z]{2}$/.test(code ?? '') || !country?.id || country.id !== officeCountry?.id
    || country.descriptor !== officeCountry.descriptor
    || new Intl.DisplayNames(['en'], { type: 'region' }).of(code) !== country.descriptor) fail('unresolved or contradictory structured location country')
  const city = code === 'IN' ? indiaCity(info.location) : null
  if (code === 'IN' && !city) fail('unresolved India city')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(info.startDate ?? '') || !Number.isFinite(Date.parse(info.startDate))
    || new Date(info.startDate).toISOString().slice(0, 10) !== info.startDate) fail('missing native posting date')
  return {
    title: normalize(info.title), company: COMPANY, department: null,
    location: code === 'IN' ? normalize(info.location) + ', India' : normalize(info.location), city,
    country: code === 'IN' ? 'India' : country.descriptor,
    jobId: id, requisitionId: id, sourceUrl: url, applyUrl: url, employmentType: normalize(info.timeType) || null,
    experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
    postingDate: new Date(info.startDate).toISOString(), closingDate: null, jobDescription: text(info.jobDescription),
  }
}
const fingerprint = inventory => JSON.stringify([...inventory.rows].sort((a, b) => a.externalPath.localeCompare(b.externalPath)))

export const createEmbitelTechnologiesScraper = ({ maxJobs = null, now = () => new Date().toISOString() } = {}) => ({
  async run({ signal, fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const request = async (fetcher, url, options = {}) => {
      signal?.throwIfAborted()
      const result = await fetcher(url, { ...options, signal })
      signal?.throwIfAborted()
      return result
    }
    if (maxJobs != null && (!Number.isInteger(maxJobs) || maxJobs <= 0)) throw new Error('Embitel maxJobs must be a positive integer')
    const careers = await request(fetchText, CAREERS_URL)
    if (!/Opportunities At Embitel/i.test(careers) || !hasLink(careers, PROVIDER_METADATA.openingsHandoffUrl)) {
      throw new Error('Embitel official careers page no longer exposes the current openings handoff')
    }
    const openings = await request(fetchText, OPENINGS_URL)
    if (!/CARIAD India Jobs/i.test(openings) || !hasLink(openings, JOBS_SCRIPT_URL) || !String(openings).includes(JOBS_API_URL)) {
      throw new Error('Embitel openings page no longer exposes the verified public jobs client')
    }
    const script = await request(fetchText, JOBS_SCRIPT_URL)
    if (!/action\s*:\s*["']get_wdhub_job["']/.test(script) || !/type\s*:\s*["']POST["']/i.test(script)
      || !/const data = response\.data/.test(script) || !/data\.forEach/.test(script)) throw new Error('Embitel public jobs client handoff changed')
    validateHandoff(await request(fetchJson, JOBS_API_URL, { method: 'POST', body: 'action=get_wdhub_job' }))
    const listRequest = offset => request(fetchJson, WORKDAY_API_URL, {
      method: 'POST', body: JSON.stringify({ appliedFacets: {}, limit: PAGE_SIZE, offset, searchText: '' }),
    })
    const first = await getInventory(listRequest)
    const details = await mapWithConcurrency(first.rows, 4, async row => mapDetail(row, await request(fetchJson, CXS_BASE + row.externalPath)))
    const last = await getInventory(listRequest)
    if (first.total !== last.total || fingerprint(first) !== fingerprint(last)) fail('native inventory changed during detail validation')
    const jobs = details.filter(job => job.country === 'India')
    const selected = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = now(), complete = selected.length === jobs.length
    const result = selected.map(job => ({
      ...job, source: SOURCE, link: job.applyUrl, scrapedAt, companyCareerPage: CAREERS_URL, companyDomain: 'embitel.com',
      atsPlatform: 'first-party-ajax+workday', ...(!complete ? { sourceListingComplete: false } : {}),
    }))
    return attachInventoryEvidence(result, {
      status: !complete ? 'coverage-gap' : first.total ? 'complete-inventory' : 'verified-empty',
      surface: WORKDAY_API_URL, firstParty: true, listingComplete: complete,
      pagesFetched: first.pages + last.pages + first.total + 4, reportedTotal: first.total, indiaFacetCount: jobs.length,
      verifiedAt: scrapedAt, reason: complete
        ? 'Official Embitel handoff and full unfiltered Workday pages, every legal employer/posted/applicable detail, structured country, and stable native count reconciled.'
        : 'Explicit requested cap omits validated India roles.',
    })
  },
})
export const run = async (options = {}) => createEmbitelTechnologiesScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
