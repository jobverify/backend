import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRuntimeVerifiedPublicAtsScraper } from '../../scraper-support/utils/publicAtsRuntimeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "gocardless"
export const COMPANY = "GoCardless"
export const CAREERS_URL = 'https://gocardless.com/about/careers'
export const BOARD_URL = 'https://job-boards.greenhouse.io/gocardless'

export const run = async ({ fetchPage, fetchJson, signal } = {}) => {
  return createRuntimeVerifiedPublicAtsScraper({ source: SOURCE, companyName: COMPANY,
    companyCareerPage: CAREERS_URL, atsPlatform: 'greenhouse', boardToken: 'gocardless',
    runtimeInventoryVerification: { mode: 'board-handoff', boardUrl: BOARD_URL },
  }).run({ fetchPage, fetchJson, signal })
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
