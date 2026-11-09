import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runIkeaNative } from './currentNative.js'

export const SOURCE = "ikea"
export const COMPANY = "IKEA"
export const CAREERS_URL = "https://www.ikea.com/global/en/jobs/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runIkeaNative(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
