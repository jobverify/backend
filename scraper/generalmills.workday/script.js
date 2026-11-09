import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = "generalmills"
export const COMPANY = "General Mills"
export const CAREERS_URL = "https://www.careers.generalmills.com/career-areas"
export const VERIFIED_SURFACE_SUMMARY = 'Read the current corporate-bound public Workday board, reconcile its full native listing and verify country evidence. Unresolved geography and other company recruitment surfaces remain incomplete.'

export const run = async (options = {}) => {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(600000)])
  signal.throwIfAborted()
  let jobs
  try {
    jobs = await runVerifiedWorkdayBoardUnion({ source: SOURCE, company: COMPANY,
      boards: [{ tenant: "genmills", site: "GMI_External_Careers", baseUrl: "https://genmills.wd1.myworkdayjobs.com/GMI_External_Careers", scraperDir: currentDir }],
      // This board omits the legal employer on some public roles. Keep that
      // native field null; every nonempty employer must still match this source.
      employerPattern: /\b(?:general|genl)\s+mills\b/i, requireEmployer: false,
      completeSourceScope: false, allowUnresolvedCountryScope: true,
      scopeReason: 'current-corporate-bound-Workday-board;proven-India-roles-only;unresolved-geography-and-other-recruitment-surfaces-unverified',
    }, { ...options, signal, nativeDetailRecovery: false,
      // Recheck only the individual transient native read. A late HTTP502 must
      // not discard and restart the already reconciled global enumeration.
      nativeFetchJson: (url, init) => fetchJsonWithRetry(url, { ...init,
        fetchImpl: options.fetchImpl || globalThis.fetch, attempts: 3,
        baseDelayMs: options.nativeRetryBaseDelayMs ?? 1000,
        timeoutMs: options.requestTimeoutMs ?? 25000, label: 'generalmills-native-check',
      }),
    })
  } catch (error) { signal.throwIfAborted(); throw error }
  signal.throwIfAborted()
  for (const job of jobs) Object.assign(job, {
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
  })
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
