import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "bp"
export const COMPANY = "BP"
export const CAREERS_URL = 'https://careers.bp.com/'
export const DISPOSITION = 'current-official-workday-native-country-proof'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Read the current corporate-bound native board without country or keyword narrowing. Verify country, employer, requisition, complete descriptions and original dates. Preserve exact native employer names, including the reviewed Castrol and Lubricants UK labels currently advertised through BP careers. Unresolved geography and whole-company scope remain incomplete.'

export const run = async (options = {}) => {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(300000)])
  signal.throwIfAborted()
  let jobs
  try {
    jobs = await runVerifiedWorkdayBoardUnion({ source: SOURCE, company: COMPANY,
      boards: [{ tenant: 'bpinternational', site: 'bpCareers',
        baseUrl: 'https://bpinternational.wd3.myworkdayjobs.com/bpCareers', scraperDir: currentDir }],
      employerPattern: /\bbp\b|^(?:IN0D|INZN) Castrol Services Private Limited$|^IN04 Castrol India Limited$|^GB07 Lubricants UK Limited$/i,
      requireEmployer: true, completeSourceScope: false, allowUnresolvedCountryScope: true,
      scopeReason: 'current-bpCareers-board;proven-India-roles;unresolved-country-records-and-other-company-surfaces-unverified',
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
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
