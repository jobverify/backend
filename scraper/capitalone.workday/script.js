import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { verifyCapitalOneHandoff, CAREERS, BOARD } from './nativeBinding.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "capitalone"
export const COMPANY = "Capital One"
export const CAREERS_URL = CAREERS
export const BANGALORE_LOCATION_ID = '0f0572524957105948f71e0c0ba44c1d'
export const run = async (options = {}) => {
  if(options.maxJobs != null)throw Error('Capital One does not permit truncated native extraction')
  const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)
  const fetchText=async url=>{signal.throwIfAborted();const r=await fetch(url,{signal,headers:{accept:'text/html','user-agent':'Mozilla/5.0'}});if(r.status!==200||r.url!==url)throw Error('Capital One current official HTTP failure or redirect');return r.text()}
  const binding=await verifyCapitalOneHandoff({fetchText})
  const jobs=await runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,requireEmployer:false,
    employerPattern:/Capital\s+One/i,completeSourceScope:false,scopeReason:'observed-Bangalore-native-location-subset-not-whole-company-India-inventory',
    boards:[{tenant:'capitalone',site:'Capital_One',scraperDir:currentDir,baseUrl:BOARD+'?locations='+BANGALORE_LOCATION_ID}]},
    {...options,signal,now:typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()})
  if(!jobs.some(j=>j.requisitionId===binding.nativeRequisitionId&&j.sourceUrl===binding.applyUrl.replace(/\/apply$/,'')))throw Error('Capital One official role and current native selected records disagree')
  for(const job of jobs)job.sourceOfficialBinding=binding
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
