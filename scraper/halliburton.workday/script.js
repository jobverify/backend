import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNative } from './native.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'halliburton'
export const COMPANY = 'Halliburton'
export const CAREERS_URL = 'https://careers.halliburton.com/search-jobs'
export const DISPOSITION = 'official-native-HTML-India-coverage-gap'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Official native India HTML inventory and full role descriptions; native employer labels and day-precision public dates retained separately from unknown legal employer and original publication. Cleanup forbidden.'
export const run = (options = {}) => runNative(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
