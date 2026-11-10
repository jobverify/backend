import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {classifyScraperError} from './failureClassification.js'
import {attachInventoryEvidence,readInventoryEvidence} from './inventoryEvidence.js'
import {summarizeRecruitmentRecoveryAudit} from './recruitmentRecoveryAudit.js'

const scraperRoot=fileURLToPath(new URL('../../scraper/',import.meta.url))
const observations=Symbol.for('jobverify.verified-recruitment-observations')
const eligibleKinds=new Set(['surface_drift_or_fail_closed','coverage_gap','source_inventory_unavailable',
 'source_identity_unverified','incomplete_location_scope','upstream_inventory_unavailable','soft_failure'])
const limits={maxRequests:16,maxPages:6,maxDetails:8,sourceTimeoutMs:45000}
const injected=options=>Object.entries(options).some(([key,value])=>key!=='softFailureRecovery'&&value!=null
 && (/fetch|^(?:request|searchJobs|searchRoles|createSession|transport|browser|page|session)$/.test(key)
  ||typeof value==='function'&&key!=='now'))

export function canRecoverSoftRecruitmentFailure(error){
 if(error===null||typeof error!=='object')return false
 const classification=classifyScraperError(error)
 if(!classification.softFailure||classification.upstreamOutage||!eligibleKinds.has(classification.failureKind))return false
 // A source may explicitly label an HTTP denial as a coverage gap. Never
 // use alternate acquisition to work around that denial or a TLS failure.
 const seen=new Set()
 for(let current=error;current&&typeof current==='object'&&!seen.has(current)&&seen.size<8;current=current.cause){
  seen.add(current)
  if(typeof current.code==='string'&&/^(?:CERT_HAS_EXPIRED|ERR_CERT_DATE_INVALID|ERR_TLS_[A-Z_]+|SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_(?:VERIFY_LEAF_SIGNATURE|GET_ISSUER_CERT_LOCALLY))$/.test(current.code))return false
 }
 const physical=classifyScraperError({message:String(error?.message||'').replace(/\bcleanup[\s-]+forbidden\b/gi,''),cause:error?.cause,
  status:error.status??error.statusCode??error.response?.status,code:error.code,name:error.name})
 return !['blocked_or_access_denied','network_or_timeout','upstream_response_pending','configuration_error'].includes(physical.failureKind)
}

// A changed legacy reader can miss a current, explicitly declared public ATS.
// Only positive, employer-bound India records qualify for partial recovery.
// Missing data, unknown country and empty results preserve the original error.
export async function recoverSoftFailedRecruitment(error,provider,options={}){
 options.signal?.throwIfAborted()
 if(options.softFailureRecovery===false||provider.adapter!=='script'||provider.parser==='runtime-verified-recruitment'||!canRecoverSoftRecruitmentFailure(error)
  ||typeof provider.modulePath!=='string'||!path.isAbsolute(provider.modulePath))return null
 const relative=path.relative(scraperRoot,provider.modulePath)
 if(relative.startsWith('..')||path.isAbsolute(relative)||!relative.endsWith('script.js'))return null
 const explicit=options.softFailureRecovery&&typeof options.softFailureRecovery==='object'?options.softFailureRecovery:null
 if(injected(options)&&!explicit)return null
 const requestOptions={signal:options.signal}
 for(const[key,cap]of Object.entries(limits)){
  const supplied=explicit?.[key]??options[key]
  if(supplied!=null&&(!Number.isSafeInteger(supplied)||supplied<=0))return null
  requestOptions[key]=Math.min(supplied??cap,cap)
 }
 const now=explicit?.now??options.now
 if(typeof now==='function')requestOptions.now=now
 for(const key of ['fetchPage','fetchJson','fetchImpl'])if(typeof explicit?.[key]==='function')requestOptions[key]=explicit[key]
 const originalFailureKind=classifyScraperError(error).failureKind
 const diagnostic=(status,audit={})=>({source:provider.source,status,originalFailureKind,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  ...summarizeRecruitmentRecoveryAudit(audit)})
 const preserve=value=>{try{Object.defineProperty(error,'softFailureRecruitmentRecovery',{value,configurable:true})}catch{}}
 try{
  const{createVerifiedRecruitmentScraper}=await import('./verifiedRecruitment.js')
  const jobs=await createVerifiedRecruitmentScraper({...provider,requireCorporateIdentityMatch:true,requireNativeEmployerName:true,
   prioritizeRecruitmentSearch:true,preferIndiaInventory:true,searchIndiaWithoutFacet:true,
   discoverLiteralRecruitmentData:true,allowVerifiedCorporateRedirects:true,allowDeclaredExternalCareersPages:true}).run(requestOptions)
  options.signal?.throwIfAborted()
  const audit=jobs[observations]
  if(!jobs.length){preserve(diagnostic('no-qualified-india-roles',audit));return null}
  for(const job of jobs)Object.assign(job,{sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  attachInventoryEvidence(jobs,{...readInventoryEvidence(jobs),listingComplete:false,lifecycleCleanupAllowed:false})
  Object.defineProperty(jobs,'softFailureRecruitmentRecovery',{value:{...diagnostic('observed-india-roles',audit),returnedIndiaJobs:jobs.length},configurable:true})
  return jobs
 }catch(recoveryError){
  options.signal?.throwIfAborted()
  // Preserve code/configuration defects as real failures; recovery must not
  // turn its own implementation failures into an empty successful result.
  const classification=classifyScraperError(recoveryError)
  if(!classification.softFailure)throw recoveryError
  preserve({...diagnostic('unavailable',recoveryError?.recruitmentObservations),failureKind:classification.failureKind})
  return null
 }
}
