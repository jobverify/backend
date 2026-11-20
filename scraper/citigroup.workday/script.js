import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentNative } from './currentNative20261120.js'

export const SOURCE = "citigroup"
export const COMPANY = "Citigroup"
export const CAREERS_URL = "https://jobs.citi.com/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const createCitigroupScraper = () => ({run:runCurrentNative})
export const run = options => createCitigroupScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
