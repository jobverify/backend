import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collect, SOURCE, COMPANY, CAREERS_URL } from './native.js'
import { collectCurrentFlatgigs } from './currentInventory.js'
export { SOURCE, COMPANY, CAREERS_URL }
export const DISPOSITION = 'native-widget-partial-observations'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Official publisher widget account observations with unknown reciprocal legal-employer and whole-company scope; native dates and all location variants retained.'
export const createFlatgigsScraper = (configuration = {}) => ({ run: (options = {}) => {
  const current = { ...configuration, ...options }
  // Retained widget receipts and their capture clocks belong to the historical
  // reader. Default HTTP acquisition follows the current corporate handoff.
  return current.fetchPacket || current.captureClock ? collect(current) : collectCurrentFlatgigs(current)
} })
export const run = (options = {}) => createFlatgigsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
