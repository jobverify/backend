import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { verifyOfficialAtsBinding } from '../../scraper-support/utils/officialAtsBinding.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "insulet"
export const COMPANY = "Insulet"
export const CAREERS_URL = 'https://www.insulet.com/'
export const BOARD_URL = 'https://insulet.wd5.myworkdayjobs.com/insuletcareers'

export const run = async ({ fetchPage, signal, nativeDetailRecovery, workdayScraper = runWorkdayScraper } = {}) => {
  await verifyOfficialAtsBinding({ source: SOURCE, officialUrl: CAREERS_URL, boardUrl: BOARD_URL }, { fetchPage, signal })
  return workdayScraper({ company: COMPANY, source: SOURCE, baseUrl: BOARD_URL,
    scraperDir: currentDir, boardIdentityVerified: true, signal, nativeDetailRecovery })
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
