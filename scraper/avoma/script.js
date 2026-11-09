import { runKulaPublicApi } from '../../scraper-support/shared/kulaPublicApi.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractKulaNativeJobs, resolveKulaJobDescriptions } from '../../scraper-support/utils/kulaFlight.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "avoma"
export const COMPANY = "Avoma"
export const CAREERS_URL = 'https://www.avoma.com/careers'
export const KULA_JOBS_URL = 'https://careers.kula.ai/avoma?jobs=true'
const requireNative = (value, message) => { if (!value) throw new Error(`Avoma native contract: ${message}`) }
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const date = value => {
  if (value == null) return null
  requireNative(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'invalid role date')
  return new Date(value).toISOString()
}

function indiaOffice(office) {
  requireNative(office && typeof office === 'object' && !Array.isArray(office), 'office required')
  for (const key of ['country', 'country_code', 'city', 'location', 'name']) requireNative(office[key] == null || typeof office[key] === 'string', 'office text malformed')
  const code = text(office.country_code).toUpperCase(), country = text(office.country)
  requireNative(/^[A-Z]{2}$/.test(code) && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)
    && regions.of(code) !== code && regions.of(code).toLowerCase() === country.toLowerCase(), 'unknown or conflicting country')
  const location = text(office.location)
  requireNative(location && location.toLowerCase().endsWith(`, ${country.toLowerCase()}`), 'native full location conflicts with country')
  requireNative(!text(office.city) || text(location.split(',')[0]).toLowerCase() === text(office.city).toLowerCase(), 'native city conflicts with full location')
  return code === 'IN'
}

export const mapKulaJobs = rows => {
  requireNative(Array.isArray(rows), 'native roles required')
  const seen = new Set(), jobs = []
  for (const row of rows) {
    const id = String(row?.id ?? '')
    requireNative(/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) && !seen.has(id), 'missing or duplicate identity')
    seen.add(id)
    requireNative(row.account_id === 1278 && row.listed === true && row.is_confidential === false
      && ['external', 'internal_and_external'].includes(row.kind) && text(row.title), 'public account/role mismatch')
    const postingDate = date(row.launch_at), closingDate = date(row.end_at)
    requireNative(!postingDate || Date.parse(postingDate) <= Date.now(), 'future publication date')
    requireNative(Array.isArray(row.ats_job?.offices) && row.ats_job.offices.length, 'native offices required')
    const scopes = row.ats_job.offices.map(indiaOffice)
    if (!scopes.some(Boolean)) continue
    const offices = row.ats_job.offices.filter((_office, i) => scopes[i])
    const jobDescription = typeof row.ats_job.job_description === 'string' && !/^\$[a-z\d]+$/i.test(row.ats_job.job_description.trim())
      ? row.ats_job.job_description.trim() || null : null
    const applyUrl = `https://careers.kula.ai/avoma/${id}/?jobs=true`
    const complete = hasSourceDescription({ jobDescription })
    jobs.push({ title: text(row.title), company: COMPANY, source: SOURCE, jobId: id, requisitionId: id,
      location: [...new Set(offices.map(office => text(office.location)))].join('; '), city: text(offices[0].city) || null, country: 'India',
      department: text(row.ats_job.ats_department?.name) || null,
      employmentType: ({ full_time: 'Full-time', contract: 'Contract', internship: 'Internship' })[row.ats_job.employment_type] || null,
      sourceUrl: applyUrl, applyUrl, postingDate, closingDate, ...(closingDate ? { sourceClosingDateIsExact: true } : {}),
      jobDescription, minimumQualification: null, preferredQualification: null, requiredSkills: [],
      sourceListingComplete: false, sourceDetailComplete: complete, ...(!complete ? { sourceDetailFailureKind: 'missing-content' } : {}) })
  }
  return jobs
}

export const extractSearchResults = html => mapKulaJobs(resolveKulaJobDescriptions(html, extractKulaNativeJobs(html, { accountName: 'avoma' })))

export async function run(options = {}) {
  if (!options.fetchText || options.fetchJson) return runKulaPublicApi({ source: 'avoma', mapKulaJobs }, options)
  const { fetchText, signal } = options
  const fetchPage = fetchText || (async url => {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) })
    requireNative(response.ok && response.url === url, 'native HTTP failure or unexpected redirect')
    return response.text()
  })
  const html = await fetchPage(KULA_JOBS_URL)
  const rows = extractKulaNativeJobs(html, { accountName: 'avoma' })
  const jobs = mapKulaJobs(resolveKulaJobDescriptions(html, rows))
  return attachInventoryEvidence(jobs, { status: 'discovery-only', firstParty: true, listingComplete: false,
    surface: KULA_JOBS_URL, reportedTotal: null, indiaFacetCount: jobs.length, pagesFetched: 1,
    verifiedAt: new Date().toISOString(), reason: 'observed-kula-page-whole-board-completeness-unverified' })
}

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
