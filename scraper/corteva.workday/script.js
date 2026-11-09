import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNativeCorteva } from './nativeCurrent.js'

export const SOURCE = "corteva"
export const COMPANY = "Corteva"
export const CAREERS_URL = "https://careers.corteva.com/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runNativeCorteva(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
