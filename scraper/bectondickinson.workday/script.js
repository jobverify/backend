import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativePostingJobs } from '../../scraper-support/shared/nativeJobPosting.js'
import { createSourceConfig, HOME } from './parser.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "bectondickinson"
export const COMPANY = "Becton Dickinson"
export const CAREERS_URL = HOME
export const DISPOSITION = "official-TalentBrew-native-India"
export const VERIFIED_ON = "2026-10-23"
export const VERIFIED_SURFACE_SUMMARY = "Official BD TalentBrew India inventory with full native descriptions, typed India country evidence, public/Workday requisition identity and original JobPosting dates. Native address discrepancies retained with country-only projection. Whole-employer and production unverified."

export const run = (options = {}) => {
  const config = createSourceConfig(options)
  config.projectJobs = result => nativePostingJobs(result, config).map(job => ({ ...job,
    requisitionId: job.nativeFacts.sourceRequisitionID,
    nativeTalentBrewJobID: job.nativeFacts.nativeTalentBrewJobID,
    nativeTalentBrewOrganizationID: job.nativeFacts.nativeTalentBrewOrganizationID,
    nativePrimaryWorkLocation: job.nativeFacts.nativePrimaryWorkLocation,
    nativeLocationDiscrepancy: job.nativeFacts.nativeLocationDiscrepancy,
    nativeGeographicProjection: job.nativeFacts.nativeGeographicProjection,
    city: job.nativeFacts.projectedCity, state: job.nativeFacts.projectedState,
    location: job.nativeFacts.projectedCity
      ? [job.nativeFacts.projectedCity, job.nativeFacts.projectedState, 'India'].filter(Boolean).join(', ') : 'India',
    employmentType: job.nativeFacts.nativeJobPosting.employmentType ?? null,
  }))
  return createFirstPartyHTMLScraper(config).run(options)
}

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
