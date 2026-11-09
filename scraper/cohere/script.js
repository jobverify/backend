import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCoherePublicScraper } from './publicInventory.js'
export const NATIVE_CONTRACT = {
  "source": "cohere",
  "companyName": "Cohere",
  "boardSlug": "cohere",
  "organizationId": "951a1fca-ef74-47dd-9932-d2e6ae54beb2",
  "websiteOrigin": "https://cohere.com",
  "primaryURL": "https://cohere.com/careers",
  "boardURL": "https://jobs.ashbyhq.com/cohere",
  "apiURL": "https://api.ashbyhq.com/posting-api/job-board/cohere"
}
export const SOURCE = NATIVE_CONTRACT.source
export const COMPANY = NATIVE_CONTRACT.companyName
export const CAREERS_URL = NATIVE_CONTRACT.primaryURL
export const run = options => createCoherePublicScraper(NATIVE_CONTRACT).run(options)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
