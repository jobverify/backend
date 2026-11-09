import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runVerifiedWorkdayBoardUnion} from '../../scraper-support/shared/workdayBoardUnion.js'
import {verifyCHRobinsonBinding,validateCHRobinsonMappedJobs,CAREERS,BOARD} from './nativeBinding.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "chrobinson"
export const COMPANY = "C.H. Robinson"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'current-official-India-regional-board-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current C.H. Robinson corporate talent-network handoff binds the exact Workday site. Its India country facet and full roles are validated each run; whole-company coverage remains unknown.'

export const run = async (options={}) => {
 if(options.maxJobs!=null)throw Error('C.H. Robinson cannot certify a truncated native inventory')
 const timeoutMs=options.timeoutMs??120000
 if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw Error('Invalid C.H. Robinson deadline')
 const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline,now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
 const binding=await verifyCHRobinsonBinding({fetchPage:options.fetchPage,signal,now:now()})
 const jobs=await runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,requireEmployer:true,employerPattern:/^(?:090 C\.H\. Robinson Worldwide Freight India Private Limited|083 C\.H\. Robinson Worldwide GmbH)$/,completeSourceScope:false,scopeReason:'official-native-India-country-facet-company-and-other-recruitment-surfaces-unresolved',boards:[{tenant:'chrobinson',site:'CHRobinson',scraperDir:currentDir,baseUrl:BOARD}]},{...options,signal,now})
 validateCHRobinsonMappedJobs(jobs);signal.throwIfAborted()
 for(const job of jobs){job.sourceOfficialBinding=binding;job.sourceCompanyCoverageComplete=false;job.sourceScopeComplete=false}
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
