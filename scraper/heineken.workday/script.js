import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentPublications} from './currentPublication20261120.js'

export const SOURCE = "heineken"
export const COMPANY = "Heineken"
export const CAREERS_URL = "https://careers.theheinekencompany.com/"
export const DISPOSITION = 'current-native-partial-publications'
export const createHeinekenScraper = () => ({run:runCurrentPublications})
export const run = options => runCurrentPublications(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
