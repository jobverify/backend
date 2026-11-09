import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createDailyhuntScraper} from './native.js'
export {createDailyhuntScraper} from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'dailyhunt'
export const COMPANY = 'Dailyhunt'
export const FIRST_PARTY_ROOT_URL = 'https://www.eternoinfo.com/'

export const run = async (options = {}) => createDailyhuntScraper(options).run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/dailyhunt/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
