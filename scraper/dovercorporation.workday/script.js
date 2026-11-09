import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runNative} from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "dovercorporation"
export const COMPANY = "Dover Corporation"
export const CAREERS_URL = 'https://careers.dovercorporation.com/'
export const DISPOSITION = 'official-native-India-office-subset-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Checks the exact current first-party careers-host redirect to Workday, advertised public client, current typed India office facets, every selected page and full role, and final publisher/listing/detail reconciliation. Whole-company recruitment scope remains unknown.'

export const run = async (options={}) => {
  if(options.maxJobs!=null)throw Error('Dover cannot certify truncated selected office inventory')
  const timeoutMs=options.timeoutMs??180000
  if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>240000)throw Error('Invalid Dover deadline')
  const now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
  if(!Number.isFinite(Date.parse(now())))throw Error('Invalid Dover check time')
  const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
  return runNative({signal,now,fetchImpl:options.fetchImpl,requestIntervalMs:options.requestIntervalMs})
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
