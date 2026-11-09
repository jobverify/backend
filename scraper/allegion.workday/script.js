import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runAllegionNative} from './nativeRun.js'
import {verifyAllegionBinding,validateAllegionMappedJobs,CAREERS,BOARD} from './nativeBinding.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "allegion"
export const COMPANY = "Allegion"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'current-official-India-regional-board-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current Allegion corporate Explore open jobs handoff binds the exact Workday site. Its Bangalore location facet and full roles are validated each run; whole-company coverage remains unknown.'

export const run = async (options={}) => {
 if(options.maxJobs!=null)throw Error('Allegion cannot certify a truncated native inventory')
 const timeoutMs=options.timeoutMs??120000
 if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw Error('Invalid Allegion deadline')
 const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline,now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
 const binding=await verifyAllegionBinding({fetchPage:options.fetchPage,signal,now:now()})
 const jobs=await runAllegionNative({signal,now})
 if(jobs.length && jobs.some(job=>job.sourceBoardInventories?.length!==1||job.sourceBoardInventories[0].reportedTotal!==jobs.length||job.sourceBoardInventories[0].observedIndia!==jobs.length))throw Error('Allegion regional native count was not fully represented')
 validateAllegionMappedJobs(jobs);signal.throwIfAborted()
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
