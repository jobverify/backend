import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {createFirstPartyHTMLScraper} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {nativePostingJobs} from '../../scraper-support/shared/nativeJobPosting.js'
import {createSourceConfig} from './parser.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "barracudanetworks"
export const COMPANY = "Barracuda Networks"
export const CAREERS_URL = 'https://www.barracuda.com/company/careers'
export const run = options => {
 const config=createSourceConfig(options)
 config.projectJobs=result=>nativePostingJobs(result,config).map(j=>{const f=j.nativeFacts,cities=[...new Set(f.nativeCountryAddresses.map(a=>String(a.raw.addressLocality||'').trim()).filter(Boolean))],states=[...new Set(f.nativeCountryAddresses.map(a=>String(a.raw.addressRegion||'').trim().replace(/,+$/,'')).filter(Boolean))];return{...j,requisitionId:f.sourceRequisitionID,city:cities.length===1?cities[0]:null,state:states.length===1?states[0]:null,location:[...cities,...states,'India'].join(', '),nativeCorporateLastUpdatedDate:f.nativeCorporateSummary.lastUpdatedDate,nativeCorporateLastUpdatedIsPublicationDate:false,nativeDatePosted:f.nativeJobPosting.datePosted,nativeVisibleDescriptionHTML:f.nativeVisibleDescriptionHTML,nativeLegacyPublicDetailURL:f.nativeCorporateSummary.detailLink,nativeLegacyApplicationURL:f.nativeCorporateSummary.applyLink,remoteStatus:{Hybrid:'Hybrid',Remote:'Remote','On-Site':'On-site',Onsite:'On-site'}[f.nativeCorporateSummary.workDesignation]??null}})
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
