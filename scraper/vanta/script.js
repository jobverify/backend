import path from 'node:path'
import { fileURLToPath } from 'node:url'
import provider from './catalog.js'
import { createAshbyPairNativeScraper } from '../../scraper-support/shared/ashbyPairNative20261027.js'
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const VERIFIED_ON = provider.verifiedOn
export const PROVIDER_METADATA = provider
export const createVantaScraper = options => createAshbyPairNativeScraper({"source":"vanta","company":"Vanta","token":"vanta","domain":"vanta.com","careersUrl":"https://www.vanta.com/company/careers"},options)
export const run = options => createVantaScraper(options).run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
