import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runVerifiedWorkdayBoardUnion} from '../../scraper-support/shared/workdayBoardUnion.js'
import {validateCmeDescriptions,OFFICIAL_BINDING,BOARD,LOCATION_ID} from './nativeContract.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "cmegroup"
export const COMPANY = "CME Group"
export const CAREERS_URL = 'https://www.cmegroup.com/careers.html'
export const DISPOSITION = 'verified-current-native-location-subset-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'The official career handoff identifies cmegroup/cme_careers. Each runtime validates actual current native India details within the advertised Bangalore location facet; whole-company inventory remains unknown.'

export const run = async (options={}) => {
  if(options.maxJobs!=null)throw Error('CME Group cannot certify a capped native check')
  const timeoutMs=options.timeoutMs??180000
  if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>240000)throw Error('Invalid CME Group native deadline')
  const now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
  if(!Number.isFinite(Date.parse(now())))throw Error('Invalid CME Group check time')
  const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
  signal.throwIfAborted()
  const jobs=await runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,
    requireEmployer:true,employerPattern:/^(?:INTEC CME India Pvt Ltd|CME Chicago Mercantile Exchange Inc\.)$/,
    completeSourceScope:false,scopeReason:'current-native-Bangalore-location-facet-not-whole-company-India-inventory',
    boards:[{tenant:'cmegroup',site:'cme_careers',scraperDir:currentDir,baseUrl:BOARD+'?locations='+LOCATION_ID}]},
    {...options,now,signal})
  validateCmeDescriptions(jobs)
  for(const job of jobs){
    job.sourceOfficialBinding=OFFICIAL_BINDING
    job.sourceCompanyCoverageComplete=false;job.sourceScopeComplete=false;job.sourceIndiaJobCount=null
    job.sourceObservedNativeLocationFacetCount=job.sourceBoardInventories[0].reportedTotal
    job.sourceNativeLocationFacet={parameter:'locations',id:LOCATION_ID,descriptor:'Bangalore - Bagmane Tridib'}
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
