import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {createFirstPartyHTMLScraper} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {nativePostingJobs} from '../../scraper-support/shared/nativeJobPosting.js'
import {createSourceConfig} from './parser.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "forvismazars"
export const COMPANY = "Forvis Mazars"
export const CAREERS_URL = 'https://careers.forvismazars.com/'
export const run = options => {
 const config=createSourceConfig(options)
 config.projectJobs=result=>nativePostingJobs(result,config).map(j=>({...j,applicationLinkSource:'native-role-inline-application-entry',nativeWordPressDateGMT:j.nativeFacts.nativeWordPressRecord.date_gmt,nativeWordPressModifiedGMT:j.nativeFacts.nativeWordPressRecord.modified_gmt,nativePublicationDateBasis:'native-public-job-offer-post-date-gmt;corroborated-public-role-WebPage-datePublished',nativeWordPressDescription:j.nativeFacts.nativeWordPressDescription,nativeLocationTerms:j.nativeFacts.nativeLocationTerms,nativeApplicationEntry:j.nativeFacts.nativeApplicationEntry,verifiedPortalBrand:j.nativeFacts.verifiedPortalBrand}))
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
