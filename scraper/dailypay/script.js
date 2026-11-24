import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentConfiguredBoard } from './currentConfiguredBoard20261120.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "dailypay",
  "companyName": "DailyPay",
  "companyDomain": "dailypay.com",
  "companyCareerPage": "https://www.dailypay.com/careers/",
  "officialHomepageUrl": "https://www.dailypay.com/",
  "sourceScopeComplete": false
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'current-declared-native-configured-board-typed-country-projection'
export const createDailyPayScraper = () => ({run:options=>runCurrentConfiguredBoard(options)})
export const run = options => createDailyPayScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
