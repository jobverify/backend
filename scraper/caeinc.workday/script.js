import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = "caeinc"
export const COMPANY = "CAE Inc."
export const CAREERS_URL = "https://www.cae.com/careers/"
export const VERIFIED_SURFACE_SUMMARY = 'Read the current corporate-bound public Workday board, reconcile its full native listing and verify country evidence. Unresolved geography and other company recruitment surfaces remain incomplete.'

export const run = async (options = {}) => {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(600000)])
  signal.throwIfAborted()
  let jobs
  try {
    jobs = await runVerifiedWorkdayBoardUnion({ source: SOURCE, company: COMPANY,
      boards: [{ tenant: "cae", site: "career", baseUrl: "https://cae.wd3.myworkdayjobs.com/career", scraperDir: currentDir }],
      employerPattern: /\bcae\b|^107 FLIGHTSCAPE INDIA PRIVATE LIMITED$|^77 RGNFTI \(Gondia\)$/i, requireEmployer: false,
      completeSourceScope: false, allowUnresolvedCountryScope: true,
      scopeReason: 'current-corporate-bound-Workday-board;proven-India-roles-only;unresolved-geography-and-other-recruitment-surfaces-unverified',
    }, { ...options, signal, nativeDetailRecovery: false })
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
