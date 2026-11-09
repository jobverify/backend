import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCurrentClientGreenhouseScraper } from '../../scraper-support/utils/currentClientGreenhouseInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "auvik"
export const COMPANY = "Auvik"
export const CAREERS_URL = 'https://www.auvik.com/careers/'
export const DISPOSITION = 'current-primary-native-loader-and-public-Greenhouse-inventory'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Revalidate the current primary openings container, top-level native embed registration and all full native postings in two snapshots. Preserve original dates and unknown country scope. Whole-company coverage, legal employer, application access, eligibility and publication remain unknown.'

const config = {
  source: SOURCE, companyName: COMPANY, companyDomain: 'auvik.com', careersURL: CAREERS_URL,
  mode: 'nitro-greenhouse', boardToken: 'auviknetworks', nativeEmployerNames: ['Auvik Networks'],
  embedURL: 'https://boards.greenhouse.io/embed/job_board/js?for=auviknetworks',
  dutiesPattern: /what\s+will\s+(?:I|you)\s+be\s+doing/i,
  requirementsPattern: /what\s+are\s+we\s+looking\s+for/i,
  sectionStopPattern: /are\s+there\s+bonus\s+points|about\s+auvik|compensation\s+details/i,
}
export const run = options => createCurrentClientGreenhouseScraper(config).run(options)

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
