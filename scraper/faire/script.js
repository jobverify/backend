import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNativeFaire } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "faire",
  "companyName": "Faire",
  "companyDomain": "faire.com",
  "companyCareerPage": "https://www.faire.com/careers/openings",
  "officialHomepageUrl": "https://www.faire.com/",
  "sourceScopeComplete": false
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'current-official-native-employee-and-consultant-feeds'
export const run = options => runNativeFaire(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
