import {isDeepStrictEqual as same} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {need} from './currentFacts20261120.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'
import {HOME,BOARD,CLIENT,FEED,pure,currentAuthority,currentBoard,currentFeed} from './currentCollection20261120.js'
import {qualifyV1Consumer} from './currentV1Consumer20261120.js'
export{HOME,BOARD,CLIENT,EMBED,FEED}from './currentCollection20261120.js'
const SOURCE='influxdata'
export async function runCurrentConfiguredBoard(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original native Responses required');for(const field of['maxJobs','maxPages'])if(options[field]!=null)need(Number.isSafeInteger(options[field])&&options[field]>=0,'finite supported caller cap differs')
 const at=pure(()=>new Date((typeof options.now==='function'?options.now():options.now)??new Date()).toISOString()),io=currentReader([HOME],[HOME,BOARD,CLIENT,FEED].map(url=>new URL(url).origin),options),observations=[];let complete=false
 try{
  if(options.maxJobs!==0&&options.maxPages!==0){for(const phase of['opening','closing']){
   const ownBody=await io.read(HOME),authority=pure(()=>currentAuthority(ownBody.text,at));io.allow(CLIENT);const clientBody=await io.read(CLIENT,{kind:'program'}),consumer=pure(()=>qualifyV1Consumer({homeHTML:ownBody.text,program:clientBody.text,homeURL:HOME,boardURL:BOARD,clientURL:CLIENT}));need(consumer.baseURL===BOARD,'connected native consumer account differs');io.allow(consumer.consumerURL);const boardBody=await io.read(consumer.consumerURL),board=pure(()=>currentBoard(boardBody.text,consumer.consumerURL,at));io.allow(FEED);const feedBody=await io.read(FEED,{kind:'json'}),current=pure(()=>currentFeed(feedBody.text,board,at));observations.push({phase,authority,declaredClient:{url:CLIENT,originalProgram:clientBody.text,connectedConsumer:consumer},board,...current})
  }
   need(same(observations[0].board.organizationBinding,observations[1].board.organizationBinding),'native closing publisher/account differs');const membership=value=>value.rows.map(row=>({id:row.id,title:row.title,url:row.url,application:row.application})).sort((a,b)=>a.id.localeCompare(b.id));need(same(membership(observations[0]),membership(observations[1])),'native closing complete role membership differs');complete=true
  }
  const jobs=[],audit={source:SOURCE,observedAt:at,observations,nativeOpeningInventory:observations[0]?.model.jobs??[],nativeClosingInventory:observations[1]?.model.jobs??[],foreignObservations:observations.flatMap(observation=>observation.rows.map(row=>({...row,phase:observation.phase}))),configuredBoardCurrentIndiaJobs:complete?0:null,configuredBoardClosingQualified:complete,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeProgramsExecuted:false,rendererOrUIActivationVerified:false,backendApplicationActivationVerified:false,applicationsSubmitted:false,originalResponses:structuredClone(io.receipts)}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations[0]?.rows.length??0,observedVacancyCount:observations[0]?.rows.length??0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check()
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:BOARD,firstParty:complete,listingComplete:complete,lifecycleCleanupAllowed:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:complete?'paired-current-own-declared-connected-v1-client-consumer-and-documented-unfiltered-public-feed;all-listed-primary-and-secondary-workplaces-explicitly-foreign;configured-typed-India-projection-only;not-company-wide-or-country-facet-zero':'caller-zero-cap-without-native-inventory-proof'})
 }catch(error){io.check();if(nativeUnavailable(error)||error?.nativeContradiction)throw error;return pure(()=>{throw error})}finally{io.close()}
}
