import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runVerifiedWorkdayBoardUnion} from '../../scraper-support/shared/workdayBoardUnion.js'
import {validateCbaDescriptions,verifyFinalIndiaListing,OFFICIAL_BINDING,BOARD,INDIA_ID} from './nativeContract.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "commonwealthbankofaustralia"
export const COMPANY = "Commonwealth Bank of Australia"
export const CAREERS_URL = 'https://www.commbank.com.au/about-us/careers/india.html?ei=india'
export const DISPOSITION = 'verified-current-official-native-India-facet-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'The official CommBank India careers page identifies cba/CommBank_Careers and its actual India country facet. Every selected full native detail and all final listing pages are checked; company-wide inventory remains unknown.'

export const run = async (options={}) => {
  if(options.maxJobs!=null)throw Error('CommBank cannot certify a capped native check')
  const timeoutMs=options.timeoutMs??300000
  if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>360000)throw Error('Invalid CommBank native deadline')
  const now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
  if(!Number.isFinite(Date.parse(now())))throw Error('Invalid CommBank check time')
  const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
  signal.throwIfAborted()
  const jobs=await runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,requireEmployer:true,
    employerPattern:/^CBA Services Private Limited$/,completeSourceScope:false,
    scopeReason:'current-official-CommBank-native-India-country-facet-company-scope-unproven',
    boards:[{tenant:'cba',site:'CommBank_Careers',scraperDir:currentDir,baseUrl:BOARD+'?locationCountry='+INDIA_ID}]},
    {...options,now,signal})
  validateCbaDescriptions(jobs)
  const final=await verifyFinalIndiaListing(jobs,{signal})
  for(const job of jobs){
    job.sourceOfficialBinding=OFFICIAL_BINDING
    job.sourceCompanyCoverageComplete=false;job.sourceScopeComplete=false;job.sourceIndiaJobCount=null
    job.sourceObservedNativeIndiaFacetCount=job.sourceBoardInventories[0].reportedTotal
    job.sourceNativeCountryFacet={parameter:'locationCountry',id:INDIA_ID,descriptor:'India'}
    job.sourceFinalListingEvidence=final
  }
  signal.throwIfAborted()
  return jobs
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
