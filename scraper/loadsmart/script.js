import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOfficialAtsRecoveryScraper } from '../../scraper-support/utils/officialAtsRecovery.js'
import { runWithCurrentProgrammeZero } from '../../scraper-support/utils/currentProgrammeZeroRecovery.js'
import { runCurrentLoadsmartProgramme } from './currentProgramme.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "loadsmart",
  "companyName": "Loadsmart",
  "companyDomain": "loadsmart.com",
  "companyCareerPage": "https://loadsmart.com/careers/",
  "sourceScopeComplete": false,
  "officialHomepageUrl": "https://loadsmart.com/"
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'runtime-official-ats-recovery'
export const run = options => runWithCurrentProgrammeZero(options, {
  source: SOURCE,
  runPrimary: primaryOptions => createOfficialAtsRecoveryScraper(provider).run(primaryOptions),
  runProgramme: runCurrentLoadsmartProgramme,
})

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
