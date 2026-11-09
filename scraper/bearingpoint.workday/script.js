import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {createFirstPartyHTMLScraper} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {createSourceConfig} from './parser.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'bearingpoint'
export const COMPANY = 'BearingPoint'
export const CAREERS_URL = 'https://www.bearingpoint.com/en-in/careers/open-roles/?country=IN'
export const run = options => createFirstPartyHTMLScraper(createSourceConfig(options)).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
