import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFirstPartyComeetProxyScraper } from '../../scraper-support/utils/firstPartyComeetProxyInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "claroty"
export const COMPANY = "Claroty"
export const CAREERS_URL = 'https://claroty.com/careers'
export const DISPOSITION = 'current-primary-Comeet-proxy-inventory-and-public-role-details'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Revalidate the current corporate handoff, primary client, grouped public job APIs, native account/UID/location identities and all public role pages in two snapshots. Preserve full original details HTML. Publication, revision, explicit native status, legal employer, whole-company coverage, eligibility and publication remain unknown.'

const config = {
  source: SOURCE, companyName: COMPANY, companyDomain: 'claroty.com', careersURL: CAREERS_URL,
  listingURL: 'https://claroty.com/open-positions', nativeCompanyUid: 'F2.004', nativeSlug: 'Claroty',
  primaryClientURL: 'https://claroty.com/build/assets/claroty-9xsMoeZ-.js',
  primaryClientSHA256: '4019abb8ceee45dbdf5221441bdf5d45286c80c23326e422a45a78655ee3ced4',
}
export const run = options => createFirstPartyComeetProxyScraper(config).run(options)

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
