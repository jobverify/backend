import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNativeArize } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "arizeai",
  "companyName": "Arize AI",
  "companyDomain": "arize.com",
  "companyCareerPage": "https://arize.com/careers/",
  "officialHomepageUrl": "https://arize.com/",
  "sourceScopeComplete": false
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'current-first-party-native-job-list-and-details'
export const run = options => runNativeArize(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
