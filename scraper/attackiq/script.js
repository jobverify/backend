import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createAttackIQNativeScraper} from './native20261108.js'

export const SOURCE = "attackiq"
export const COMPANY = "AttackIQ"
export const CAREERS_URL = "https://www.attackiq.com/who-we-are/careers/"
export const DISPOSITION = 'native-current-posting-extraction;own-country-unresolved'
export const run = options => createAttackIQNativeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
