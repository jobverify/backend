import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runNative} from './native.js'
export {PROVIDER_METADATA} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'samsung'
export const COMPANY = 'Samsung'
export const OFFICIAL_CAREERS_URL = 'https://www.samsung.com/in/about-us/careers/'

export const createSamsungScraper = () => ({
  run: runNative,
})

export const run = async (options = {}) => createSamsungScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/samsung/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
