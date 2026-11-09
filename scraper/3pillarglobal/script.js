import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'
import THREE_PILLAR_GLOBAL_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = THREE_PILLAR_GLOBAL_CATALOG.source
export const COMPANY = THREE_PILLAR_GLOBAL_CATALOG.companyName
export const CAREERS_URL = THREE_PILLAR_GLOBAL_CATALOG.companyCareerPage
export const DARWINBOX_BOARD_URL = THREE_PILLAR_GLOBAL_CATALOG.darwinboxBoardUrl
export const PROVIDER_METADATA = THREE_PILLAR_GLOBAL_CATALOG

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal, label: SOURCE, timeoutMs: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)', Accept: 'text/html' },
})

export const hasOfficialThreePillarCareersSignal = (html) => (
  /<title>\s*3Pillar Career Opportunities\s*<\/title>/i.test(String(html))
  && [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].some((match) => {
    try { return new URL(match[1], CAREERS_URL).toString() === DARWINBOX_BOARD_URL }
    catch { return false }
  })
)

export const createThreePillarGlobalScraper = ({
  now = () => new Date().toISOString(),
  maxJobs = null,
  pageSize = 10,
  fetchImpl = fetch,
} = {}) => {
  const darwinbox = createDarwinboxScraper({
    companyName: COMPANY, source: SOURCE, companyId: 'main',
    origin: 'https://3pillar.darwinbox.com', pageSize, fetchImpl,
  })
  return {
    async run({ signal, fetchText = defaultFetchText, ...options } = {}) {
      signal?.throwIfAborted()
      if (maxJobs != null && (!Number.isInteger(maxJobs) || maxJobs <= 0)) {
        throw new Error('3Pillar maxJobs must be a positive integer')
      }
      const html = await fetchText(CAREERS_URL, { signal })
      signal?.throwIfAborted()
      if (!hasOfficialThreePillarCareersSignal(html)) {
        throw new Error('3Pillar Global careers page no longer exposes the verified Darwinbox handoff')
      }
      const jobs = await darwinbox.run({ ...options, signal, ...(maxJobs == null ? {} : { maxJobs }) })
      signal?.throwIfAborted()
      return mapJobsWithInventoryEvidence(jobs, (job) => ({
        ...job,
        country: 'India',
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: '3pillar.ai',
        atsPlatform: 'darwinbox',
        ...((maxJobs != null || options.maxJobs != null || options.maxPages != null)
          ? { sourceListingComplete: false } : {}),
      }))
    },
  }
}

export const run = async (options = {}) => createThreePillarGlobalScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
