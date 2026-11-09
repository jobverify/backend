import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document, decode } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nuro'
export const COMPANY = 'Nuro'
export const OFFICIAL_CAREERS_URL = 'https://www.nuro.ai/careers'
export const NATIVE_JOBS_URL = 'https://boards-api.greenhouse.io/v1/boards/nuro/jobs/?content=true'

const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
// These native labels are explicit California locations observed in the
// complete official feed. Unrecognized geography never implies non-India.
const verifiedForeignLocations = new Set(['Mountain View, California (HQ)', 'California - SF', 'California - LA', 'California - Santa Clara'])
const explicitForeignCountry = /(?:^|[,;\s])(?:United States(?: of America)?|USA|United Kingdom|Canada|Germany|France|Japan|China|Australia|Singapore)(?:\s*\))?$/i
const conflictingForeignSignal = /\b(?:California|United States(?: of America)?|USA|US|United Kingdom|UK|Canada|Germany|France|Japan|China|Australia|Singapore)\b/i
const validNativeDate = value => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText), month = Number(monthText), day = Number(dayText)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}
const roleUrl = (value, id) => {
  let url
  try { url = new URL(value) } catch { throw new Error('Nuro invalid role URL') }
  if (url.protocol !== 'https:' || !['nuro.ai', 'www.nuro.ai'].includes(url.hostname)
    || url.port || url.username || url.password || url.hash || url.pathname !== '/careersitem'
    || [...url.searchParams.keys()].length !== 1 || url.searchParams.get('gh_jid') !== id) {
    throw new Error('Nuro role URL identity mismatch')
  }
  return url.href
}

export const parseNativeInventory = payload => {
  if (payload?.error != null || payload?.success === false || payload?.ok === false
    || payload?.hasError === true || payload?.failed === true
    || (payload?.errors != null && (!Array.isArray(payload.errors) || payload.errors.length > 0))
    || (payload?.status !== undefined && ![200, '200', 'ok', 'success'].includes(payload.status))
    || (payload?.statusCode !== undefined && payload.statusCode !== 200)) {
    throw new Error('Nuro native API returned an error envelope')
  }
  if (!Array.isArray(payload?.jobs) || !Number.isSafeInteger(payload?.meta?.total)
    || payload.meta.total < 0 || payload.meta.total !== payload.jobs.length
    || payload.hasMore || payload.nextPage || payload.nextCursor) throw new Error('Nuro incomplete native inventory')
  const seen = new Set()
  const jobs = []
  for (const native of payload.jobs) {
    const id = String(native?.id ?? '')
    const title = clean(native?.title)
    const location = clean(native?.location?.name)
    if (!/^[1-9]\d*$/.test(id) || seen.has(id) || !title || !location || native.company_name !== COMPANY) {
      throw new Error('Nuro invalid or duplicate native role identity')
    }
    seen.add(id)
    const sourceUrl = roleUrl(native.absolute_url, id)
    if (native.content != null && typeof native.content !== 'string') throw new Error('Nuro invalid native description')
    const parts = location.split(/\s*;\s*|\s+\/\s+/)
    const indiaLocations = []
    for (const part of parts) {
      if (/^remote$/i.test(part)) throw new Error('Nuro unresolved native geography: ' + part)
      const indiaCandidate = isIndiaJob({ location: part })
      if ((indiaCandidate || /\bIndia\b/i.test(part)) && conflictingForeignSignal.test(part)) throw new Error('Nuro contradictory native geography: ' + part)
      if (indiaCandidate) indiaLocations.push(part)
      else if (!verifiedForeignLocations.has(part) && !explicitForeignCountry.test(part)) {
        throw new Error('Nuro unresolved native geography: ' + part)
      }
    }
    if (!indiaLocations.length) continue
    const postingDate = native.first_published || null
    if (postingDate && !validNativeDate(postingDate)) throw new Error('Nuro invalid original publication date')
    const closingDate = native.application_deadline || null
    if (closingDate && !validNativeDate(closingDate)) throw new Error('Nuro invalid application deadline')
    const description = native.content ? decode(native.content) : null
    const detailsComplete = hasSourceDescription({ sourceDescription: description })
    jobs.push({
      source: SOURCE, company: COMPANY, companyCareerPage: OFFICIAL_CAREERS_URL, atsPlatform: 'greenhouse',
      jobId: id, requisitionId: native.requisition_id || id, title,
      location: indiaLocations[0], locations: indiaLocations, country: 'India',
      city: indiaLocations[0].split(',')[0] === 'India' ? null : indiaLocations[0].split(',')[0],
      sourceUrl, applyUrl: sourceUrl, link: sourceUrl,
      jobDescription: description, sourceDescription: description,
      sourceDetailComplete: detailsComplete, sourceListingComplete: detailsComplete,
      department: clean(native.departments?.[0]?.name) || null,
      employmentType: clean(native.metadata?.find(field => field.name === 'Time Type')?.value) || null,
      postingDate, closingDate, ...(closingDate ? { sourceClosingDateIsExact: /T/.test(closingDate) } : {}),
    })
  }
  return { total: payload.meta.total, jobs }
}

export const createNuroScraper = () => ({
  async run({ fetchImpl = fetch, signal, requestTimeoutMs = 15000, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const runTimeout = AbortSignal.timeout(120000)
    const runSignal = signal ? AbortSignal.any([signal, runTimeout]) : runTimeout
    let pagesFetched = 0
    const request = async (url, json = false) => {
      runSignal.throwIfAborted()
      const deadline = new AbortController()
      const requestSignal = AbortSignal.any([runSignal, deadline.signal])
      const timer = setTimeout(() => deadline.abort(new Error('Nuro request deadline timeout')),
        Math.max(1, Math.min(30000, Number(requestTimeoutMs) || 15000)))
      let onAbort
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(requestSignal.reason)
        requestSignal.addEventListener('abort', onAbort, { once: true })
      })
      try {
        // Bound both fetch and body consumption even for injected transports
        // that do not implement AbortSignal themselves.
        return await Promise.race([aborted, (async () => {
          requestSignal.throwIfAborted()
          const response = await fetchImpl(url, { signal: requestSignal,
            headers: { Accept: json ? 'application/json' : 'text/html,application/javascript', 'User-Agent': 'JobverifyScraper/1.0' } })
          requestSignal.throwIfAborted()
          if (response.status !== 200) throw new Error(`Nuro HTTP ${response.status} for ${url}`)
          if (response.url !== url) throw new Error('Nuro native request redirected outside the verified identity')
          const body = json ? await response.json() : await response.text()
          requestSignal.throwIfAborted()
          pagesFetched++
          return body
        })()])
      } finally {
        clearTimeout(timer)
        requestSignal.removeEventListener('abort', onAbort)
      }
    }
    const html = await request(OFFICIAL_CAREERS_URL)
    const doc = document(html)
    const htmlNodes = doc.nodes(node => node.tag === 'html')
    const bodies = doc.nodes(node => node.tag === 'body')
    const meta = (property, content) => doc.nodes(node => node.tag === 'meta'
      && node.attrs.property === property && node.attrs.content === content).length > 0
    if (htmlNodes.length !== 1 || bodies.length !== 1 || !meta('og:site_name', COMPANY)
      || !meta('og:title', 'Careers') || !doc.text(bodies[0]).includes('Open Roles')) {
      throw new Error('Nuro official careers identity changed')
    }
    doc.outer(htmlNodes[0]); doc.outer(bodies[0])
    const candidates = [...new Set(doc.nodes(node => node.tag === 'script').flatMap(node => {
      try {
        const url = new URL(node.attrs.src, OFFICIAL_CAREERS_URL)
        return url.origin === new URL(OFFICIAL_CAREERS_URL).origin
          && /^\/_nuxt\/[a-z0-9]+\.modern\.js$/.test(url.pathname) && !url.search && !url.hash ? [url.href] : []
      } catch { return [] }
    }))]
    if (!candidates.length || candidates.length > 24) throw new Error('Nuro official client-script schema changed')
    // Prioritize the observed careers component; changed builds still search
    // the other active same-origin modules within the bounded candidate set.
    candidates.sort((a, b) => Number(b.endsWith('/7114896.modern.js')) - Number(a.endsWith('/7114896.modern.js')))
    let bound = false
    for (let index = 0; index < candidates.length && !bound; index += 4) {
      const fetched = await Promise.allSettled(candidates.slice(index, index + 4).map(url => request(url)))
      bound = fetched.some(result => result.status === 'fulfilled'
        && result.value.includes(`$axios.get("${NATIVE_JOBS_URL}")`) && result.value.includes('populateJobs(data.jobs)'))
    }
    runSignal.throwIfAborted()
    if (!bound) throw new Error('Nuro official native jobs API handoff changed or could not be fetched')
    const inventory = parseNativeInventory(await request(NATIVE_JOBS_URL, true))
    const checkedAt = now()
    const incompleteDetails = inventory.jobs.some(job => job.sourceDetailComplete === false)
    return attachInventoryEvidence(inventory.jobs.map(job => ({ ...job, scrapedAt: checkedAt })), {
      status: incompleteDetails ? 'discovery-only' : inventory.total === 0 ? 'verified-empty' : 'complete-inventory',
      surface: NATIVE_JOBS_URL, firstParty: true, listingComplete: !incompleteDetails, pagesFetched,
      reportedTotal: inventory.total, indiaFacetCount: inventory.jobs.length, verifiedAt: checkedAt,
      reason: incompleteDetails ? 'native-india-roles-missing-substantive-source-content'
        : inventory.jobs.length ? 'complete-native-greenhouse-inventory-india-projection'
        : inventory.total ? 'complete-native-greenhouse-inventory-no-india-roles' : 'native-greenhouse-explicit-zero-total',
    })
  },
})

export const run = async (options = {}) => createNuroScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
