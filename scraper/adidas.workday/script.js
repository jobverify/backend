import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAdidasNative } from './nativeCareers.js'

export const SOURCE = "adidas"
export const COMPANY = "Adidas"
export const CAREERS_URL = "https://careers.adidas-group.com/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runAdidasNative(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
