import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPairedEmployerGreenhouseScraper } from '../../scraper-support/utils/pairedEmployerGreenhouseInventory20261127.js'

export const SOURCE = "honeycomb"
export const COMPANY = "Honeycomb"
export const CAREERS_URL = "https://www.honeycomb.io/careers"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Each run reconciles the current corporate role links with opening and closing complete native Greenhouse inventories.'
export const PROVIDER_METADATA = { source: SOURCE, companyName: COMPANY, nativeEmployerName: 'Honeycomb.io',
  atsPlatform: 'greenhouse', boardToken: 'honeycomb', companyCareerPage: CAREERS_URL,
  runtimeInventoryVerification: { mode: 'role-links-exact', boardUrl: 'https://job-boards.greenhouse.io/honeycomb',
    employerHandoffPages: ['https://www.honeycomb.io/careers/open-roles'] } }
export const run = options => createPairedEmployerGreenhouseScraper(PROVIDER_METADATA).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
