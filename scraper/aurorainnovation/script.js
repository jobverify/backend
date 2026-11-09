import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeAbortSignals, fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'aurorainnovation'
export const COMPANY = 'Aurora Innovation'
export const FIRST_PARTY_CAREERS_URL = 'https://aurora.tech/careers/'
export const JOBS_INDEX_URL = 'https://aurora.tech/api/jobs-index'
const INDIA = /\bindia\b|\bbengaluru\b|\bbangalore\b|\bhyderabad\b|\bpune\b|\bgurugram\b|\bgurgaon\b|\bmumbai\b|\bchennai\b|\bnoida\b|\bdelhi\b/i
// Native location labels use US city/state pairs. A generic remote flag grants no India eligibility.
const US_STATE = /,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*$/
const FOREIGN = /\b(?:United States|USA|United Kingdom|Canada|Germany|Singapore|Australia|France|China|Japan)\b/i
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
const text = value => typeof value === 'string' && value.trim().length > 0
const indiaLocation = value => INDIA.test(value) && filterIndiaJobs([{ location: value }]).length > 0 && !US_STATE.test(value) && !FOREIGN.test(value)
const fail = reason => { throw new Error(`[${SOURCE}] Invalid native jobs inventory: ${reason}`) }

export const createAuroraInnovationScraper = () => ({
  async run({ fetchJson = fetchJsonWithRetry, signal, timeoutMs = 20000 } = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) throw new Error('Aurora timeoutMs must be between 1 and 60000')
    const requestSignal = composeAbortSignals(signal, AbortSignal.timeout(timeoutMs))
    requestSignal.throwIfAborted()
    const payload = await fetchJson(JOBS_INDEX_URL, { signal: requestSignal, timeoutMs, attempts: 1, label: SOURCE })
    requestSignal.throwIfAborted()
    if (!payload || payload.error || payload.success === false || payload.ok === false
      || (Array.isArray(payload.errors) ? payload.errors.length > 0 : Boolean(payload.errors))
      || /^(?:error|failed|failure|unavailable)$/i.test(String(payload.status || ''))
      || Number(payload.statusCode) >= 400 || Number(payload.status) >= 400 || payload.hasMore === true || payload.nextCursor || payload.nextPage || !Array.isArray(payload.jobs)) fail('failed or paginated envelope')
    let index
    try { index = JSON.parse(payload.index) } catch { fail('missing native search index') }
    const records = payload.jobs
    if (!index || !Number.isInteger(index.documentCount) || index.documentCount !== records.length
      || !index.documentIds || typeof index.documentIds !== 'object' || Array.isArray(index.documentIds)) fail('search index count mismatch')
    const indexIds = Object.values(index.documentIds)
    if (indexIds.length !== records.length || new Set(indexIds).size !== records.length) fail('search index identities mismatch')
    if (!Array.isArray(payload.facets?.locations) || payload.facets.locations.some(value => !text(value))) fail('missing location facets')
    const identities = new Set()
    let scopeComplete = true
    for (const record of records) {
      if (!record || !UUID.test(record.id) || identities.has(record.id) || !indexIds.includes(record.id) || !text(record.title)) fail('missing or duplicate role identity/title')
      identities.add(record.id)
      let applyUrl
      try { applyUrl = new URL(record.applyLink) } catch { fail('invalid application URL') }
      if (applyUrl.origin !== 'https://aurora.tech' || applyUrl.pathname !== '/careers' || applyUrl.username || applyUrl.password
        || applyUrl.hash || applyUrl.searchParams.get('ashby_jid') !== record.id || [...applyUrl.searchParams].length !== 1) fail('foreign application identity')
      if (!Array.isArray(record.locations) || record.locations.some(value => !text(value) || !payload.facets.locations.includes(value))) fail('invalid location inventory')
      if (record.searchText != null && typeof record.searchText !== 'string') fail('invalid source content')
      if (!record.locations.length || record.locations.some(value => !indiaLocation(value) && !(US_STATE.test(value) || FOREIGN.test(value)))) scopeComplete = false
      if (record.locations.some(value => INDIA.test(value) && (US_STATE.test(value) || FOREIGN.test(value)))) scopeComplete = false
    }
    const jobs = records.flatMap(record => {
      const location = record.locations.find(indiaLocation)
      if (!location) return []
      return [{
        title: record.title.trim(), source: SOURCE, company: COMPANY, jobId: record.id,
        requisitionId: record.jobId || record.id, department: record.category || null,
        location, country: 'India', employmentType: record.employmentType || null,
        sourceUrl: `https://aurora.tech/careers/${record.id}`, applyUrl: record.applyLink, link: record.applyLink,
        postingDate: record.publishedDate || null, jobDescription: text(record.searchText) ? record.searchText.trim() : null,
        scrapedAt: new Date().toISOString(),
      }]
    })
    const complete = scopeComplete && jobs.every(job => text(job.jobDescription))
    if (!complete) for (const job of jobs) job.sourceListingComplete = false
    return attachInventoryEvidence(jobs, {
      status: complete ? records.length ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      surface: JOBS_INDEX_URL, firstParty: true, listingComplete: complete, pagesFetched: 1,
      reportedTotal: records.length, indiaFacetCount: jobs.length, verifiedAt: new Date().toISOString(),
      reason: complete ? 'official-jobs-index-identities-and-native-document-count-reconciled'
        : !scopeComplete ? 'native-location-scope-unresolved' : 'selected-role-description-unavailable',
    })
  },
})
export const run = async (options = {}) => createAuroraInnovationScraper().run(options)

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
