import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "blueorigin"
export const COMPANY = "Blue Origin"
export const CAREERS_URL = 'https://www.blueorigin.com/careers/search'

export const run = options => runWorkdayScraper({...options,source:SOURCE,company:COMPANY,baseUrl:'https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin',scraperDir:currentDir,boardIdentityVerified:true})

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
