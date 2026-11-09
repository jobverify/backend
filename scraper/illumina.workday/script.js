import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "illumina"
export const COMPANY = "Illumina"
export const CAREERS_URL = 'https://www.illumina.com/company/careers.html'
export const DISPOSITION = 'current-official-workday-native-country-proof'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Both currently advertised employee and university Workday boards are required. Verify native country, employer, requisition, full descriptions and original dates; reconcile duplicate requisitions and both closing inventories. Unresolved geography and other company recruitment surfaces remain incomplete. A malformed native listing is a source failure.'

export const run = async (options = {}) => {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(300000)])
  signal.throwIfAborted()
  let jobs
  try {
    jobs = await runVerifiedWorkdayBoardUnion({ source: SOURCE, company: COMPANY,
      boards: [
        { tenant: 'illumina', site: 'illumina-careers',
          baseUrl: 'https://illumina.wd1.myworkdayjobs.com/illumina-careers', scraperDir: currentDir },
        { tenant: 'illumina', site: 'illumina-universityrecruiting',
          baseUrl: 'https://illumina.wd1.myworkdayjobs.com/illumina-universityrecruiting', scraperDir: path.join(currentDir, 'university') },
      ],
      employerPattern: /\billumina\b/i, requireEmployer: true,
      completeSourceScope: false, allowUnresolvedCountryScope: true,
      scopeReason: 'current-Illumina-employee-and-university-boards;proven-India-roles;unresolved-country-records-and-other-company-surfaces-unverified',
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
