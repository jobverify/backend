import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNative } from './nativeCareers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "nomuraindia"
export const COMPANY = "Nomura India"
export const CAREERS_URL = "https://careers.nomura.com/Nomura/go/Career-Opportunities-India/9050900/"
export const DISPOSITION = "successfactors-rmk-public-native"
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = "Reads actual native category pagination and role HTML, including literal application identity, complete description markup and explicit country fields. Inventory completion, recruitment status, application activation and publication remain unqualified."

export const run = async (options = {}) => runNative(options)

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
