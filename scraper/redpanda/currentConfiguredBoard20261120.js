import {isDeepStrictEqual as same} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {need} from './currentFacts20261120.js'
import {currentAuthority,HOME,BOARD,FEED} from './currentPublisher20261120.js'
import {currentFeed} from './currentCollection20261120.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'

export{HOME,BOARD,FEED}
function pure(fn){try{return fn()}catch(error){if(error?.nativeContradiction)throw error;throw Object.assign(Error('Redpanda complete native parser/contract: '+error.message),{cause:error,abortRetries:true,nativeContradiction:true,softFailure:true,failureKind:'parser_or_contract_error'})}}
export async function runCurrentConfiguredBoard(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original native Responses required')
 for(const field of['maxJobs','maxPages'])if(options[field]!=null)need(Number.isSafeInteger(options[field])&&options[field]>=0,'finite supported caller cap differs')
 const at=pure(()=>new Date((typeof options.now==='function'?options.now():options.now)??new Date()).toISOString())
 const io=currentReader([HOME],[...new Set([HOME,FEED].map(url=>new URL(url).origin))],options),observations=[]
 let complete=false
 try{
  if(options.maxJobs!==0&&options.maxPages!==0){
   for(const phase of['opening','closing']){
    const own=await io.read(HOME),authority=pure(()=>currentAuthority(own.text,at))
    need(authority.feed===FEED,'current own connected public feed differs');io.allow(authority.feed)
    const response=await io.read(authority.feed,{kind:'json'}),collection=pure(()=>currentFeed(response.text,authority,at))
    observations.push({phase,authority,...collection})
   }
   const membership=value=>value.rows.map(row=>({id:row.id,title:row.title,url:row.url,application:row.application})).sort((a,b)=>a.id.localeCompare(b.id))
   need(same(membership(observations[0]),membership(observations[1])),'native closing complete listed role membership differs')
   complete=true
  }
  const jobs=[],audit={source:'redpanda',observedAt:at,observations,nativeOpeningInventory:observations[0]?.model.jobs??[],nativeClosingInventory:observations[1]?.model.jobs??[],foreignObservations:observations.flatMap(value=>value.rows.map(row=>({...row,phase:value.phase}))),configuredBoardCurrentIndiaJobs:complete?0:null,configuredBoardClosingQualified:complete,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeProgramsExecuted:false,rendererOrUIActivationVerified:false,backendApplicationActivationVerified:false,applicationsSubmitted:false,originalResponses:structuredClone(io.receipts)}
  attachSourceObservationEvidence(jobs,{source:'redpanda',recordKind:'vacancy-rows',observedRecordCount:observations[0]?.rows.length??0,observedVacancyCount:observations[0]?.rows.length??0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit))
  io.check()
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:FEED,firstParty:complete,listingComplete:complete,lifecycleCleanupAllowed:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:complete?'paired-current-own-connected-listed-public-feed-consumer-and-documented-unfiltered-feed;all-listed-primary-secondary-and-explicit-country-alternatives-foreign;configured-India-projection-only;not-company-wide-or-country-facet-zero':'caller-zero-cap-without-current-configured-inventory-proof'})
 }catch(error){io.check();if(nativeUnavailable(error)||error?.nativeContradiction)throw error;return pure(()=>{throw error})}finally{io.close()}
}
