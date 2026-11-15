import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runWorkdayWithPartialFallback, runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { createNativeDetailRecovery, currentNativeDetailRecovery } from '../../scraper-support/utils/nativeDetailRecovery.js'
const dir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='blackstone'
export const COMPANY='Blackstone'
export const CAREERS_URL='https://www.blackstone.com/careers/careers-blackstone/'
const baseUrl='https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Careers'
const board={tenant:'blackstone',site:'Blackstone_Careers',baseUrl,scraperDir:dir}
const campus={tenant:'blackstone',site:'Blackstone_Campus_Careers',baseUrl:'https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Campus_Careers',scraperDir:path.join(dir,'boards/campus')}
const settings={source:SOURCE,company:COMPANY,employerPattern:/^\d+ Blackstone COE India Private Limited$/,boards:[board,campus]}
const fallback={...settings,boards:[{...board,baseUrl:baseUrl+'?locations=d480b8d24fe310015bdde132ce210000',scraperDir:path.join(dir,'boards/india-fallback')},campus]}
const runBoards=async options=>{
  try{return await runWorkdayWithPartialFallback(settings,fallback,options)}
  catch(error){
    options?.signal?.throwIfAborted()
    if(error?.message==='Verified Workday board union: cross-board complete listing identities unavailable'){
      // The experienced board was read, but the engine did not expose its full
      // listing identities for a cross-board duplicate check. Independently
      // recheck this board; it cannot establish campus or whole-company scope.
      const jobs=await runVerifiedWorkdayBoardUnion({...settings,boards:[board],completeSourceScope:false,
        scopeReason:'experienced-native-india-roles-rechecked;campus-and-cross-board-identities-unverified'},options)
      const sourceFullScopeFailure={name:error.name,message:error.message,failureKind:'incomplete_cross_board_identity_scope'}
      const evidence={source:SOURCE,scope:'experienced-board-native-india-roles',sourceScopeComplete:false,
        lifecycleCleanupAllowed:false,sourceFullScopeFailure,
        unverifiedAdditionalBoards:[{tenant:campus.tenant,site:campus.site,baseUrl:campus.baseUrl}]}
      Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
      for(const job of jobs)job.sourceFullScopeFailure=sourceFullScopeFailure
      return jobs
    }
    if(error?.failureKind!=='incomplete_location_scope' || !error.sourceFullScopeFailure)throw error
    // The campus attempt is current and recorded. Its unresolved secondary
    // geography cannot discard verified India rows or certify India-empty.
    const jobs=await runVerifiedWorkdayBoardUnion({...fallback,boards:[fallback.boards[0]],completeSourceScope:false,
      scopeReason:'experienced-native-india-subset-campus-geography-unresolved'},options)
    for(const job of jobs){job.sourceFullScopeFailure=error.sourceFullScopeFailure
      job.sourceAdditionalBoardFailure={site:campus.site,name:error.name,message:error.message,failureKind:error.failureKind}}
    return jobs
  }
}

export const run=async(options={})=>{
  const existing=options.nativeDetailRecovery??currentNativeDetailRecovery()
  if(existing!=null)return runBoards({...options,nativeDetailRecovery:existing})
  // Reuse only identity-matched native receipts acquired in this source
  // attempt. The shared union still performs fresh closing detail reads.
  const recovery=createNativeDetailRecovery()
  try{return await runBoards({...options,nativeDetailRecovery:recovery})}
  finally{recovery.closed=true;recovery.receipts.clear();recovery.receiptBytes=0}
}
