import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collect } from './native.js'
export { SOURCE, COMPANY, HOMEPAGE_URL, CAREERS_URL } from './native.js'
import PROVIDER_METADATA from './catalog.js'
export { PROVIDER_METADATA }
export const DISPOSITION = PROVIDER_METADATA.atsPlatform
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const run = options => collect(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, 'abacusai')
}
