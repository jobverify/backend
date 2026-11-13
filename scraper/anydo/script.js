import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAnyDoCurrentEmpty } from './currentEmpty20261113.js'

export const SOURCE = "anydo"
export const COMPANY = "Any.do"
export const CAREERS_URL = "https://any-do.breezy.hr/"
export const DISPOSITION = 'current-corporate-declared-native-board-empty'
export const run = runAnyDoCurrentEmpty

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
