import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {createFirstPartyHTMLScraper} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {nativePostingJobs} from '../../scraper-support/shared/nativeJobPosting.js'
import {createSourceConfig,CAREERS_ROOT} from './parser.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "abbvie"
export const COMPANY = "AbbVie"
export const CAREERS_URL = CAREERS_ROOT

export const run = options => {
 const config=createSourceConfig(options)
 config.projectJobs=result=>nativePostingJobs(result,config).map(j=>({...j,requisitionId:j.nativeFacts.sourceRequisitionID,minimumQualification:j.nativeFacts.minimumQualification,state:j.nativeCountryAddresses[0].raw.addressRegion,nativeDatePosted:j.nativeFacts.nativeSmartRecruitersPosting.releasedDate,nativePostingUUID:j.nativeFacts.nativeSmartRecruitersPosting.uuid,nativeJobAdId:j.nativeFacts.nativeSmartRecruitersPosting.jobAdId,remoteStatus:j.nativeCountryAddresses[0].nativeLocation.hybrid?'Hybrid':j.nativeCountryAddresses[0].nativeLocation.remote?'Remote':'On-site'}))
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
