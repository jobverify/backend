import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run as runNativeBranchMetrics } from '../branchmetrics/script.js'

export const SOURCE = "branch"
export const COMPANY = "Branch"
export const CAREERS_URL = "https://www.branch.io/careers/"
export const DISPOSITION = 'current-native-shared-employer-reader'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
const identityFailure = message => Object.assign(new Error('Branch native: '+message),{
  softFailure:true,upstreamOutage:false,abortRetries:true,failureKind:'coverage_gap',
})

export async function run(options = {}) {
  options.signal?.throwIfAborted()
  let jobs
  try { jobs = await runNativeBranchMetrics(options) }
  catch (error) {
    options.signal?.throwIfAborted()
    if (error?.code === 'BRANCHMETRICS_NATIVE_CONTRACT') throw identityFailure(error.message)
    throw error
  }
  options.signal?.throwIfAborted()
  const audit = Object.getOwnPropertyDescriptor(jobs,'nativeCollectionEvidence')?.value
  // Both registrations name this exact branch.io employer. The native reader
  // independently binds its current corporate client, legal publisher, board,
  // country fields and full own-role criteria; retain those original facts.
  if (!audit || audit.source !== 'branchmetrics' || jobs.some(job=>job.source !== 'branchmetrics'
    || job.companyDomain !== 'branch.io' || job.companyCareerPage !== CAREERS_URL)) {
    throw identityFailure('Shared current employer reader identity unavailable')
  }
  for (const job of jobs) job.source = SOURCE
  Object.defineProperty(jobs,'nativeCollectionEvidence',{
    value:{...audit,source:SOURCE,nativeReaderSource:'branchmetrics'},configurable:true,
  })
  options.signal?.throwIfAborted()
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
