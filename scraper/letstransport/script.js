import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeInventoryEvidence, attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { PROFILE_URL, LISTING_URL, exactEmployer, extractNativeCards, verifyProfile, extractNativeDetail } from './native.js'
export { extractNativeCards } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'letstransport'
export const COMPANY = 'LetsTransport'
export const FIRST_PARTY_ROOT_URL = 'https://letstransport.in/we-are-hiring/'

export const createLetsTransportScraper = () => ({
  async run({ fetchImpl = globalThis.fetch, timeoutMs = 60000, signal, now = () => new Date().toISOString(), maxJobs } = {}) {
    let pagesFetched = 0
    const controller = new AbortController()
    const gap = (reason, cause) => Object.assign(new Error(`LetsTransport coverage gap: ${reason}`, { cause }), {
      code: 'LETSTRANSPORT_COVERAGE_GAP', sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      inventoryEvidence: normalizeInventoryEvidence({ status: 'coverage-gap', surface: FIRST_PARTY_ROOT_URL,
        firstParty: false, listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
        verifiedAt: new Date().toISOString(), reason }),
    })
    signal?.throwIfAborted()
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) throw gap('Invalid aggregate timeout')
    const scrapedAt = now()
    if (!Number.isFinite(Date.parse(scrapedAt)) || maxJobs != null && (!Number.isInteger(maxJobs) || maxJobs < 1)) throw gap('Invalid verification date or job cap')
    let timer, onAbort
    const cancelled = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(gap('Aggregate fetch/body timeout')) }, timeoutMs)
      onAbort = () => { controller.abort(signal.reason); reject(signal.reason) }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
    try {
      return await Promise.race([cancelled, (async () => {
        const read = async url => {
        const response = await fetchImpl(url, { signal: controller.signal,
          redirect: 'manual', headers: { accept: 'text/html' } })
        controller.signal.throwIfAborted()
        pagesFetched++
        if (response?.status !== 200 || response.url !== url) throw gap(`Native recruitment HTTP ${response?.status ?? 'unknown'} or redirect identity unavailable`)
        let body
        if (response.body?.getReader) {
          const reader = response.body.getReader(), chunks = []
          let bytes = 0, ended = false
          const cancel = () => { Promise.resolve(reader.cancel()).catch(() => {}) }
          controller.signal.addEventListener('abort', cancel, { once: true })
          try {
            for (;;) {
              const part = await reader.read()
              controller.signal.throwIfAborted()
              if (part.done) { ended = true; break }
              bytes += part.value.byteLength
              if (bytes > 5 * 1024 * 1024) throw gap('Native body exceeds byte bound')
              chunks.push(Buffer.from(part.value))
            }
            body = Buffer.concat(chunks).toString('utf8')
          } finally {
            controller.signal.removeEventListener('abort', cancel)
            if (!ended) cancel()
            try { reader.releaseLock() } catch {}
          }
        } else body = await response.text()
        controller.signal.throwIfAborted()
        if (typeof body !== 'string' || !body.trim() || Buffer.byteLength(body, 'utf8') > 5 * 1024 * 1024) throw gap('Official careers body unavailable or oversized')
        return body
        }
        const page = document(await read(FIRST_PARTY_ROOT_URL))
        if (!page.text(page.root).includes('recruitment@letstransport.team')) throw gap('Official recruitment surface changed')
        if (!page.nodes(n => n.tag === 'a' && (() => { try { return exactEmployer(n.attrs.href) } catch { return false } })()).length) throw gap('Resume-email recruitment surface lacks verified employer-publisher handoff')
        verifyProfile(await read(PROFILE_URL))
        const cards = extractNativeCards(await read(LISTING_URL)), jobs = [], detailGaps = []
        for (const card of cards) {
          const requested = new URL(card.url)
          requested.hostname = 'www.linkedin.com'
          try {
            const detail = extractNativeDetail(await read(requested.href), card, scrapedAt)
            if (detail) jobs.push({ ...detail, source: SOURCE, company: COMPANY, scrapedAt,
              companyCareerPage: FIRST_PARTY_ROOT_URL, atsPlatform: 'linkedin-employer-internship-subset' })
          } catch (error) {
            controller.signal.throwIfAborted()
            detailGaps.push(`${card.id}: ${error.message}`)
          }
        }
        if (JSON.stringify(cards) !== JSON.stringify(extractNativeCards(await read(LISTING_URL)))) throw gap('Employer listing changed during traversal')
        if (!jobs.length) throw gap('No independently active India internship verified; full employer inventory unknown')
        return attachInventoryEvidence(jobs.slice(0, maxJobs), { status: 'coverage-gap', surface: LISTING_URL,
          firstParty: true, listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
          verifiedAt: scrapedAt, reason: 'Official exact LinkedIn profile and reciprocal domain verified. Native India internship subset only; six legacy external postings conflict with expired 2021/2022 ATS detail pages. Full employer scope and external application destinations remain unproven.' + (detailGaps.length ? ` Detail coverage gaps: ${detailGaps.join('; ')}` : '') })
      })()])
    } catch (error) {
      controller.abort()
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'LETSTRANSPORT_COVERAGE_GAP') throw error
      throw gap('Official recruitment transport/body unavailable', error)
    } finally {
      controller.abort()
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createLetsTransportScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/letstransport/script.js')

if (isDirectExecution) {
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
