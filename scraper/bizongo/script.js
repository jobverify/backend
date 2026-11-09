import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentBizongo,inspectCurrentCorporate} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bizongo'
export const COMPANY = 'Bizongo'
export const CAREERS_URL = 'https://bizongo.com/careers'
export const CAREERS_HANDOFF_URL = 'https://careers.bizongo.com/'

export const hasOfficialCareersSignal = html => {try{inspectCurrentCorporate(html);return true}catch{return false}}

export const createBizongoScraper = () => ({
  run: options => runCurrentBizongo(options || {}),
})

export const run = async (options = {}) => createBizongoScraper().run(options)

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
