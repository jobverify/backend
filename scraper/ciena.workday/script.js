import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { validateCienaDescriptions, OFFICIAL_BINDING } from './nativeContract.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "ciena"
export const COMPANY = "Ciena"
export const CAREERS_URL = 'https://www.ciena.com/careers/working-at-ciena'
export const DISPOSITION = 'verified-official-native-board-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'The current official handoff binds ciena/Careers. Each runtime validates current native India roles and legal employers; whole-company scope and totals remain unknown.'

export const run = async (options={}) => {
  if(options.maxJobs!=null)throw Error('Ciena cannot certify a capped native check')
  const timeoutMs=options.timeoutMs??120000
  if(!Number.isInteger(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw Error('Invalid Ciena deadline')
  const now=typeof options.now==='function'?options.now:()=>new Date(options.now??Date.now()).toISOString()
  if(!Number.isFinite(Date.parse(now())))throw Error('Invalid Ciena check time')
  const deadline=AbortSignal.timeout(timeoutMs),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
  signal.throwIfAborted()
  const jobs=await runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,
    requireEmployer:true,employerPattern:/^(?:Ciena India Private Ltd\.|Ciena India Private Limited|Ciena Communications India Private Limited|Ciena \(Asia\) Limited, Philippine Branch|Ciena Communications, Inc\.)$/,
    completeSourceScope:false,scopeReason:'verified-current-Ciena-native-India-facet-whole-company-recruitment-scope-unproven',
    boards:[{tenant:'ciena',site:'Careers',scraperDir:currentDir,baseUrl:'https://ciena.wd5.myworkdayjobs.com/Careers'}]},
    {...options,now,signal})
  validateCienaDescriptions(jobs)
  for(const job of jobs){job.sourceOfficialBinding=OFFICIAL_BINDING;job.sourceCompanyCoverageComplete=false;job.sourceScopeComplete=false}
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
