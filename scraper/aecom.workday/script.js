import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNativeAecom } from './nativeCurrent.js'

export const SOURCE = "aecom"
export const COMPANY = "AECOM"
export const CAREERS_URL = "https://aecom.com/careers/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runNativeAecom(SOURCE, options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
