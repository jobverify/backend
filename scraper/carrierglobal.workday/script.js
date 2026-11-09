import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {run as runCarrier} from '../carrier.workday/script.js'
import {verifyCarrierGroupDelegation} from './nativeBinding.js'
import {attachInventoryDelegationEvidence} from '../../scraper-support/utils/inventoryDelegationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "carrierglobal"
export const COMPANY = "Carrier Global"
export const CANONICAL_SOURCE='carrier'
export const CAREERS_URL='https://www.carrier.com/us/en/careers/'
export const DISPOSITION='verified-shared-group-recruiting-surface-delegation-company-scope-partial'
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY='Same current official Carrier group recruiting surface. Canonical jobs retain source carrier, company Carrier and their native legal employers; whole-company coverage remains unknown.'

export const run=async(options={})=>{
 if(options.maxJobs!=null)throw Error('Carrier Global delegation cannot certify a truncated inventory')
 const timeoutMs=options.timeoutMs??120000
 if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw Error('Invalid Carrier Global deadline')
 const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
 const relationship=await verifyCarrierGroupDelegation({fetchPage:options.fetchPage,signal})
 // Return the canonical array and its inventory evidence without rewriting
 // source, company, native legal employers or company-coverage limitations.
 const jobs=await runCarrier({...options,signal});signal.throwIfAborted()
 if(!Array.isArray(jobs)||jobs.some(job=>job.source!==CANONICAL_SOURCE||job.company!=='Carrier'))throw Object.assign(Error('Carrier Global canonical child source/company identity mismatch'),{abortRetries:true,failureKind:'source_identity_unverified'})
 if(relationship.observation)attachInventoryDelegationEvidence(jobs,{source:SOURCE,sources:[CANONICAL_SOURCE],preservesChildSourceAndCompany:true,...relationship.observation})
 return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, CANONICAL_SOURCE)
  }
}
