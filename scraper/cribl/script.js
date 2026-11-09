import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createCriblScraper} from './native20261107.js'
export {createCriblScraper} from './native20261107.js'

export const SOURCE = "cribl"
export const COMPANY = "Cribl"
export const CAREERS_URL = "https://cribl.io/careers/"
export const DISPOSITION = 'live-parser'
export const run = (options={}) => createCriblScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
