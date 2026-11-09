import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {createFirstPartyHTMLScraper} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {nativePostingJobs} from '../../scraper-support/shared/nativeJobPosting.js'
import {createSourceConfig,HOME} from './parser.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "cvent"
export const COMPANY = "Cvent"
export const CAREERS_URL = HOME

export const run = options => {
 const config=createSourceConfig(options)
 config.projectJobs=result=>nativePostingJobs(result,config).map(j=>({...j,requisitionId:j.nativeFacts.sourceRequisitionID,jobDescription:j.nativeFacts.nativeSchemaDescription,sourceDescription:j.nativeFacts.nativeSchemaDescription,nativeDatePosted:j.nativeFacts.nativePostedDate.raw,location:j.nativeFacts.nativeJibeRecord.full_location,state:j.nativeCountryAddresses[0].raw.addressRegion==='UNAVAILABLE'?null:j.nativeCountryAddresses[0].raw.addressRegion,...j.nativeFacts.sharedJibeNormalizedFields}))
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
