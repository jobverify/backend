import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createAsusNativeScraper} from './native20261108.js'

export const SOURCE = "asus"
export const COMPANY = "Asus"
export const CAREERS_URL = "https://careers.asus.com/"
export const DISPOSITION = 'runtime-verified-recruitment'
const scraper=createAsusNativeScraper()
export const run=options=>scraper.run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
