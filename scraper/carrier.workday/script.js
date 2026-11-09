import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runCarrierNative} from './nativeRun.js'
import {verifyCarrierBinding,CAREERS} from './nativeBinding.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "carrier"
export const COMPANY = "Carrier"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'current-official-India-facet-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current Carrier corporate and public role handoffs and full native Workday roles are verified each run. Whole-company coverage remains unknown.'

export const run = async (options={}) => {
 if(options.maxJobs!=null)throw Error('Carrier cannot certify a truncated native inventory')
 const timeoutMs=options.timeoutMs??120000
 if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw Error('Invalid Carrier deadline')
 const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline,now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
 const binding=await verifyCarrierBinding({fetchPage:options.fetchPage,signal,now:now()})
 const jobs=await runCarrierNative({binding,signal,now:now()})
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
