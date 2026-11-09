import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentSagacious } from './currentNative.js'
export { CAREERS_URL, hasOfficialCareersSignal } from './currentNative.js'

const SOURCE = 'sagaciousresearch'
export const createSagaciousResearchScraper = () => ({ run: runCurrentSagacious })
export const run = options => runCurrentSagacious(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
