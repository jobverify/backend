import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createBase64AINativeScraper} from './native20261108.js'

export const SOURCE = "base64ai"
export const COMPANY = "Base64.ai"
export const CAREERS_URL = "https://base64.ai/careers/"
export const DISPOSITION = 'native-posting-extraction;company-scope-and-render-hiring-unresolved'
export const run = options => createBase64AINativeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
