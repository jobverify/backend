import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLangchainNativeScraper } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "langchain",
  "companyName": "LangChain",
  "companyDomain": "langchain.com",
  "companyCareerPage": "https://www.langchain.com/careers",
  "sourceScopeComplete": false,
  "officialHomepageUrl": "https://langchain.com/"
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'runtime-qualified-native-ashby-inventory'
export const run = options => createLangchainNativeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
