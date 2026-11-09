import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runVerifiedWorkdayBoardUnion} from '../../scraper-support/shared/workdayBoardUnion.js'
import {validateCochlearDescriptions,verifyFinalLocationListing,OFFICIAL_BINDING,BOARD,LOCATION_IDS} from './nativeContract.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "cochlear"
export const COMPANY = "Cochlear"
export const CAREERS_URL = 'https://www.cochlear.com/in/en/corporate/careers/jobs-at-cochlear'
export const DISPOSITION = 'verified-current-official-native-India-location-subset-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'The official Cochlear careers page identifies cochlear/Cochlear_Careers. Four explicitly advertised India locations form the checked native subset. Every selected full native detail and final listing page is checked; company-wide global and India inventory remain unknown.'

export const run = async (options={}) => {
  if(options.maxJobs!=null)throw Error('Cochlear cannot certify a capped native check')
  const timeoutMs=options.timeoutMs??180000
  if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>240000)throw Error('Invalid Cochlear native deadline')
  const now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
  if(!Number.isFinite(Date.parse(now())))throw Error('Invalid Cochlear check time')
  const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
  signal.throwIfAborted()
  const jobs=await runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,requireEmployer:true,
    employerPattern:/^C71 Cochlear Medical Device Company India Private Limited \(India\)$/,completeSourceScope:false,
    scopeReason:'verified-native-India-location-union-company-scope-unproven',
    boards:[{tenant:'cochlear',site:'Cochlear_Careers',scraperDir:currentDir,baseUrl:BOARD+'?'+LOCATION_IDS.map(id=>'locations='+id).join('&')}]},
    {...options,now,signal})
  validateCochlearDescriptions(jobs)
  const final=await verifyFinalLocationListing(jobs,{signal})
  for(const job of jobs){
    job.sourceOfficialBinding=OFFICIAL_BINDING
    job.sourceCompanyCoverageComplete=false;job.sourceScopeComplete=false;job.sourceIndiaJobCount=null
    job.sourceObservedNativeLocationFacetCount=job.sourceBoardInventories[0].reportedTotal
    job.sourceNativeLocationFacets={parameter:'locations',ids:LOCATION_IDS,scope:'explicit-current-India-locations-only'}
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
