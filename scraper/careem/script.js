import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCurrentClientGreenhouseScraper } from '../../scraper-support/utils/currentClientGreenhouseInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "careem"
export const COMPANY = "Careem"
// The former /en-AE/ URL now publishes a same-origin 301 to this canonical route.
export const CAREERS_URL = 'https://www.careem.com/en-ae/careers/'
export const DISPOSITION = 'current-owned-Next-client-and-public-Greenhouse-inventory'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Revalidate the current corporate jobs hyperlink, owned Next portal/build, exact reviewed client and all full native postings in two snapshots. Original publication and revision are preserved separately; whole-company coverage, legal employer, eligibility and publication remain unknown.'

const config = {
  source: SOURCE, companyName: COMPANY, companyDomain: 'careem.com', careersURL: CAREERS_URL,
  mode: 'next-reviewed-client', boardToken: 'careem', nativeEmployerNames: [],
  portalURL: 'https://jobs.careem.com/', buildId: 'nSxpzx1UW3MBGDxiNv3QZ',
  clientURL: 'https://jobs.careem.com/_next/static/chunks/pages/_app-2676366f2f21b502.js',
  clientSHA256: 'c2e96bea2ce7c3977f431abe19354a288b796d571c75d201a5123fdf992fd247',
  dutiesPattern: /what\s+you['’]ll\s+(?:do|lead)|(?:key\s+)?responsibilit(?:y|ies)/i,
  requirementsPattern: /what\s+you(?:['’]ll)?\s+(?:need|bring)|qualifications|requirements/i,
  sectionStopPattern: /what\s+we['’]ll\s+provide|what\s+success\s+looks\s+like/i,
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
