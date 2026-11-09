import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = "biogen"
export const COMPANY = "Biogen"
export const CAREERS_URL = "https://www.biogen.com/careers.html"
export const VERIFIED_SURFACE_SUMMARY = 'Read the current corporate-bound public Workday board, reconcile its full native listing and verify country evidence. Unresolved geography and other company recruitment surfaces remain incomplete.'

export const run = async (options = {}) => {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(600000)])
  signal.throwIfAborted()
  let jobs
  try {
    jobs = await runVerifiedWorkdayBoardUnion({ source: SOURCE, company: COMPANY,
      boards: [{ tenant: "biibhr", site: "external", baseUrl: "https://biibhr.wd3.myworkdayjobs.com/external", scraperDir: currentDir }],
      employerPattern: /\bbiogen\b/i, requireEmployer: false,
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
