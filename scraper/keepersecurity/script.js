import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPairedEmployerGreenhouseScraper } from '../../scraper-support/utils/pairedEmployerGreenhouseInventory20261127.js'

export const SOURCE = "keepersecurity"
export const COMPANY = "Keeper Security"
export const CAREERS_URL = "https://www.keepersecurity.com/jobs.html"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Each run verifies the current corporate board handoff and opening and closing complete native Greenhouse inventories.'
export const PROVIDER_METADATA = { source: SOURCE, companyName: COMPANY, nativeEmployerName: 'Keeper Security',
  atsPlatform: 'greenhouse', boardToken: 'keepersecurity', companyCareerPage: CAREERS_URL,
  runtimeInventoryVerification: { mode: 'board-handoff', boardUrl: 'https://job-boards.greenhouse.io/keepersecurity' } }
export const run = options => createPairedEmployerGreenhouseScraper(PROVIDER_METADATA).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
