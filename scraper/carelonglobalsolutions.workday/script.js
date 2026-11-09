import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runVerifiedWorkdayBoardUnion} from '../../scraper-support/shared/workdayBoardUnion.js'
import {verifyCarelonBinding,validateCarelonMappedJobs,CAREERS,BOARD} from './nativeBinding.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "carelonglobalsolutions"
export const COMPANY = "Carelon Global Solutions"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'current-official-India-regional-board-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current regional Carelon India corporate handoff and full native Workday roles are verified each run. Whole-company and parent Elevance coverage remain unknown.'

export const run = async (options={}) => {
 if(options.maxJobs!=null)throw Error('Carelon cannot certify a truncated native inventory')
 const timeoutMs=options.timeoutMs??120000
 if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw Error('Invalid Carelon deadline')
 const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline,now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
 const binding=await verifyCarelonBinding({fetchPage:options.fetchPage,signal,now:now()})
 const jobs=await runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,requireEmployer:true,employerPattern:/^Carelon Global Solutions India LLP$/,completeSourceScope:false,scopeReason:'official-Carelon-India-regional-board-not-whole-company-or-Elevance-group',boards:[{tenant:'elevancehealth',site:'carelonglobal_in',scraperDir:currentDir,baseUrl:BOARD}]},{...options,signal,now})
 validateCarelonMappedJobs(jobs);signal.throwIfAborted()
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
