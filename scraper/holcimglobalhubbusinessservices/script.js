import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runFamily} from '../holcim.workday/parser.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='holcimglobalhubbusinessservices',COMPANY='Holcim Global Hub Business Services',CAREERS_URL='https://careers.holcimgroup.com/holcim_ghbs/go/Job-at-Holcim-GHBS/8823002/'
export const CATEGORY_URL=CAREERS_URL
export const createHolcimGlobalHubBusinessServicesScraper=()=>({run:options=>runFamily(SOURCE,options)})
export const run=options=>runFamily(SOURCE,options)

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
