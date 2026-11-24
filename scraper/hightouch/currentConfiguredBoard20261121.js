import {isDeepStrictEqual as same} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {need} from './currentFacts20261120.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'
import {HOME,BOARD,FEED,pure,currentPrimary,currentOwnRole,currentBoard,currentFeed,advertisedRegion,ownRoleRequirements,carrier} from './currentCollection20261121.js'
import {declaredRoleProgrammes,qualifyRoleProgramme} from './currentProgramme20261121.js'
export{HOME,BOARD,FEED}from './currentCollection20261121.js'
export async function runCurrentConfiguredBoard(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original native Responses required');for(const field of['maxJobs','maxPages'])if(options[field]!=null)need(Number.isSafeInteger(options[field])&&options[field]>=0,'finite supported caller cap differs')
 const at=pure(()=>new Date((typeof options.now==='function'?options.now():options.now)??new Date()).toISOString()),io=currentReader([HOME],[HOME,BOARD,FEED].map(u=>new URL(u).origin),options),observations=[];let complete=false
 try{
  if(options.maxJobs!==0&&options.maxPages!==0){for(const phase of['opening','closing']){
   const homeBody=await io.read(HOME),primary=pure(()=>currentPrimary(homeBody.text,at)),bindingSummary=primary.rows.find(r=>/\bRemote\b/i.test(r.locationName)&&!advertisedRegion(r.locationName))??primary.rows[0],ownRoles=[]
   async function readRole(summary){const existing=ownRoles.find(r=>r.id===summary.id);if(existing)return existing;const url=HOME+'/'+summary.id;io.allow(url);const original=await io.read(url),role=pure(()=>currentOwnRole(original.text,summary,at));ownRoles.push(role);return role}
   const boundRole=await readRole(bindingSummary);io.allow(boundRole.manifestURL);const manifest=await io.read(boundRole.manifestURL,{kind:'program'}),declaration=pure(()=>declaredRoleProgrammes(primary,boundRole,manifest.text,at,carrier)),originals=[]
   for(const entry of declaration.entries){io.allow(entry.url);originals.push(await io.read(entry.url,{kind:'program'}))}
   const dependencies=[];let ownHandoff
   for(;;){try{ownHandoff=qualifyRoleProgramme(primary,boundRole,declaration,originals,BOARD,dependencies);break}catch(error){const next=declaration.dependencyEntries[dependencies.length];if(!error?.currentProgrammeModuleUnavailable||!next)pure(()=>{throw error});io.allow(next.url);dependencies.push(await io.read(next.url,{kind:'program'}))}}
   io.allow(BOARD);const boardBody=await io.read(BOARD),board=pure(()=>currentBoard(boardBody.text,at));io.allow(FEED);const feedBody=await io.read(FEED,{kind:'json'}),requirements=pure(()=>ownRoleRequirements(feedBody.text,primary))
   for(const summary of requirements)await readRole(summary)
   const current=pure(()=>currentFeed(feedBody.text,board,primary,ownRoles,at));observations.push({phase,authority:primary.authority,ownPrimary:{originalModel:primary.model,rows:primary.rows},ownRoles:ownRoles.map(r=>({url:r.url,id:r.id,posting:r.posting,originalModel:r.model})),ownHandoff,board,...current})
  }
   const ownership=o=>o.board.organizationBinding;need(same(ownership(observations[0]),ownership(observations[1])),'current native closing publisher/account differs');const membership=o=>o.rows.map(r=>({id:r.id,title:r.title,url:r.url,application:r.application,primaryCountry:r.primaryCountry,indiaExclusion:r.indiaExclusion})).sort((a,b)=>a.id.localeCompare(b.id));need(same(membership(observations[0]),membership(observations[1])),'current complete closing advertised membership/workplace scope differs');complete=true
  }
  const jobs=[],audit={source:'hightouch',observedAt:at,observations,nativeOpeningInventory:observations[0]?.model.jobs??[],nativeClosingInventory:observations[1]?.model.jobs??[],foreignObservations:observations.flatMap(o=>o.rows.map(r=>({...r,phase:o.phase}))),configuredBoardCurrentIndiaJobs:complete?0:null,configuredBoardClosingQualified:complete,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeProgramsExecuted:false,rendererOrUIActivationVerified:false,backendApplicationActivationVerified:false,applicationEndpointFetched:false,applicationsSubmitted:false,originalResponses:structuredClone(io.receipts)}
  attachSourceObservationEvidence(jobs,{source:'hightouch',recordKind:'vacancy-rows',observedRecordCount:observations[0]?.rows.length??0,observedVacancyCount:observations[0]?.rows.length??0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check()
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:BOARD,firstParty:complete,listingComplete:complete,lifecycleCleanupAllowed:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:complete?'paired-current-own-Next-advertised-cards-and-connected-form-only-account-with-independent-full-native-board-and-documented-unfiltered-feed;actual-typed-foreign-or-unambiguous-geographic-region-or-matching-role-exclusive-foreign-criteria;missing-country-retained-null;configured-listed-advertised-India-projection-only;not-company-or-facet-zero':'caller-zero-cap-without-current-native-publication-proof'})
 }catch(error){io.check();if(nativeUnavailable(error)||error?.nativeContradiction)throw error;return pure(()=>{throw error})}finally{io.close()}
}
