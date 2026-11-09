import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "huronconsulting"
export const COMPANY = "Huron Consulting"
export const CAREERS_URL = 'https://www.huronconsultinggroup.com/en-in/careers'
export const DISPOSITION = 'current-official-workday-native-country-proof'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Read the complete advertised native board and verify India roles against current country, employer, requisition, description and publication evidence. Unresolved secondary offices are recorded as incomplete coverage; whole-company scope remains unverified.'

export const run = async (options = {}) => {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(300000)])
  signal.throwIfAborted()
  let jobs
  try {
    jobs = await runVerifiedWorkdayBoardUnion({ source: SOURCE, company: COMPANY,
      boards: [{ tenant: 'huron', site: 'huroncareers',
        baseUrl: 'https://huron.wd1.myworkdayjobs.com/huroncareers', scraperDir: currentDir }],
      employerPattern: /\bhuron\b/i, requireEmployer: true,
      completeSourceScope: false, allowUnresolvedCountryScope: true,
      scopeReason: 'current-huroncareers-board;proven-India-roles;unresolved-country-records-and-other-company-surfaces-unverified',
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
