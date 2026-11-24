import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {need,mergeObservation} from './currentFacts20261120.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'
import {HOME,FEED,NATIVE,ownAuthority,nativePacket} from './currentAuthority20261121.js'
import {readFeed,ambiguousRows,maybeIndia,rowFrom,listingPartial,fullRole} from './currentRoles20261121.js'
export {HOME,FEED,ownAuthority,nativePacket}

const contradiction=error=>error?.nativeContradiction?error:Object.assign(Error('Verint current publication: '+error.message),{cause:error,nativeContradiction:true,abortRetries:true,softFailure:true,failureKind:'parser_or_contract_error'})
const pure=fn=>{try{return fn()}catch(error){throw contradiction(error)}}
export async function runCurrentVerintPublished(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchPage&&!options.fetchText&&!options.fetchJson&&!options.readPage,'original complete Response transport required')
 for(const field of['maxJobs','maxPages'])if(options[field]!=null)need(Number.isSafeInteger(options[field])&&options[field]>=0,'finite caller cap required')
 const at=pure(()=>{const value=Object.hasOwn(options,'now')?(typeof options.now==='function'?options.now():options.now):new Date();need(value!=null&&(value instanceof Date||['string','number'].includes(typeof value)),'valid supplied observation clock required');return new Date(value).toISOString()}),io=currentReader([HOME],[new URL(HOME).origin,NATIVE,new URL(FEED).origin],options),observations=[],held=new Map(),opening=new Map(),closing=new Map()
 const hold=(id,error)=>{held.set(id,{id,error:error.message,nativeContradiction:true,failureKind:'parser_or_contract_error'})}
 try{
  if(options.maxJobs!==0&&options.maxPages!==0)for(const phase of['opening','closing']){
   const own=await io.read(HOME),authority=pure(()=>ownAuthority(own.text,at));io.allow(authority.board)
   const boardResponse=await io.read(authority.board),board=pure(()=>nativePacket(boardResponse.text,authority.board,at,{board:authority.board}));io.allow(FEED)
   const feedResponse=await io.read(FEED,{kind:'json'}),feed=pure(()=>readFeed(feedResponse.text)),ambiguous=ambiguousRows(feed),roles=[],candidates=[]
   for(const record of feed.jobs){
    if(!maybeIndia(record)&&!opening.has(record?.id))continue
    const id=record?.id;let row,job
    try{row=pure(()=>rowFrom(record,board,at,ambiguous));candidates.push(row.id)}catch(error){hold(id,contradiction(error));continue}
    if(held.has(row.id))continue
    io.allow(row.url)
    try{
     const response=await io.read(row.url),packet=pure(()=>nativePacket(response.text,row.url,at,{board:authority.board,row,organizationBinding:board.organizationBinding}));job=pure(()=>fullRole(row,packet,at))
    }catch(error){
     io.check();if(io.denied.has(new URL(row.url).origin))throw error
     if(nativeUnavailable(error))job=pure(()=>listingPartial(row,{unavailable:error}))
     else{hold(row.id,contradiction(error));continue}
    }
    try{job=pure(()=>mergeObservation(phase==='closing'?opening.get(row.id):null,job,phase));if(phase==='opening')opening.set(row.id,job);else if(opening.has(row.id))closing.set(row.id,job);roles.push({id:row.id,title:row.title,url:row.url,job,originalPublicRecord:record})}catch(error){hold(row.id,contradiction(error))}
   }
   if(phase==='closing')for(const id of opening.keys())if(!candidates.includes(id))hold(id,Error('current closing India publication missing or unresolved'))
   observations.push({phase,authority,organizationBinding:board.organizationBinding,originalNativeBoardModel:board.model,originalNativeFeed:feed,roles})
  }
  const jobs=[...closing.values()].filter(job=>!held.has(job.jobId)).slice(0,options.maxJobs??Infinity)
  for(const job of jobs){if(job.sourceDetailUnavailable){job.sourceDetailClosingQualified=false;job.detailClosingQualified=false}job.sourceCompanyInventoryUnresolved=true;job.sourceNativeApplication.closingQualified=true}
  const audit={source:'verintsystems',observedAt:at,observations,originalResponses:structuredClone(io.receipts),heldRoles:[...held.values()],qualifiedIndiaJobs:jobs.length,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeProgramsExecuted:false,rendererOrUIActivationVerified:false,backendApplicationActivationVerified:false,applicationsSubmitted:false,applicationVisited:false,legalEmployer:null,scope:'Only independently qualified current India role partials. Unknown/foreign records, all company inventory, formal requisition IDs, legal employer, application controls, renderer/backend activation and cleanup remain held.'}
  attachSourceObservationEvidence(jobs,{source:'verintsystems',recordKind:'vacancy-rows',observedRecordCount:observations[0]?.originalNativeFeed.jobs.length??0,observedVacancyCount:observations[0]?.roles.length??0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOME,firstParty:observations.length>0,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:'current-own-declared-native-Verint-public-India-partials-only;paired-native-board-feed-role-facts;company-facets-legal-formal-requisition-application-renderer-backend-cleanup-held'})
 }catch(error){io.check();if(nativeUnavailable(error)||error?.nativeContradiction)throw error;throw contradiction(error)}finally{io.close();options.signal?.throwIfAborted()}
}
