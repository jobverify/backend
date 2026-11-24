import {isDeepStrictEqual as same} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {need} from './currentFacts20261120.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'
import {currentDatafoldAuthority,HOME,BOARD,FEED} from './currentOwnConsumer20261121.js'
import {currentNativePacket} from './currentNative20261121.js'
import {readFeed,readBoard,readRole} from './currentRoleFacts20261121.js'
export{currentDatafoldAuthority,HOME,BOARD,FEED}
const pure=fn=>{try{return fn()}catch(error){if(error?.nativeContradiction)throw error;throw Object.assign(Error('Datafold current listed projection: '+error.message),{cause:error,abortRetries:true,nativeContradiction:true,softFailure:true,failureKind:'parser_or_contract_error'})}}
export async function runCurrentConfiguredProjection(options={}){
 options.signal?.throwIfAborted();need(!options.fetchPage&&!options.fetchText&&!options.fetchJson&&!options.readPage,'Original complete native Responses required')
 for(const field of['maxJobs','maxPages'])if(options[field]!=null)need(Number.isSafeInteger(options[field])&&options[field]>=0,'Finite supported caller cap differs')
 const at=pure(()=>new Date((typeof options.now==='function'?options.now():options.now)??new Date()).toISOString()),io=currentReader([HOME],[new URL(HOME).origin,new URL(BOARD).origin,new URL(FEED).origin],options),observations=[]
 let complete=false
 try{
  if(options.maxJobs!==0&&options.maxPages!==0){for(const phase of['opening','closing']){
   const own=await io.read(HOME),authority=pure(()=>currentDatafoldAuthority(own.text,at));need(authority.board===BOARD&&authority.feed===FEED,'Current source-specific native account authority differs');io.allow(BOARD)
   const nativeResponse=await io.read(BOARD),native=pure(()=>currentNativePacket(nativeResponse.text,BOARD,at));io.allow(FEED)
   const feedResponse=await io.read(FEED,{kind:'json'}),feed=pure(()=>readFeed({text:feedResponse.text}));need(feed.jobs.length>0,'Empty native board requires a separate publication proof');const board=pure(()=>readBoard(native,feed)),roles=[]
   for(const record of feed.jobs){io.allow(record.jobUrl);const response=await io.read(record.jobUrl),roleNative=pure(()=>currentNativePacket(response.text,record.jobUrl,at,{role:true}));need(same(roleNative.organizationBinding,native.organizationBinding),'Native own-role employer/account differs');roles.push(pure(()=>readRole(roleNative,record,board.jobPostings.find(row=>row.id===record.id),board,at)))}
   observations.push({phase,authority,organizationBinding:native.organizationBinding,originalNativeModel:native.model,originalNativeFeed:feed,roles})
  }
  const binding=value=>({organization:value.organizationBinding,roles:value.roles.map(role=>({id:role.id,title:role.title,url:role.url,country:role.country,posting:role.originalNativePosting,record:role.originalPublicRecord,schema:role.originalSchema})).sort((a,b)=>a.id.localeCompare(b.id))})
  need(same(binding(observations[0]),binding(observations[1])),'Current closing complete listed identity/workplace/application/criteria binding differs');complete=true}
  const jobs=[],audit={source:'datafold',observedAt:at,observations,originalResponses:structuredClone(io.receipts),configuredBoardCurrentIndiaJobs:complete?0:null,configuredBoardClosingQualified:complete,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeProgramsExecuted:false,currentRendererQualified:false,rendererOrUIActivationVerified:false,ownGraphQLBackendResponseAcquired:false,backendApplicationActivationVerified:false,applicationsSubmitted:false,applicationVisited:false,screeningCriteriaAcquired:false,legalEmployerRegistryVerified:false,marketingEmptyMessageUsedAsEvidence:false,configuredScope:'only the current own-authorized native listed board/feed projection reconciled to every original full public role and explicit foreign work/applicant/criteria country; no own browser/GQL result or renderer membership assertion'}
  attachSourceObservationEvidence(jobs,{source:'datafold',recordKind:'vacancy-rows',observedRecordCount:observations[0]?.roles.length??0,observedVacancyCount:observations[0]?.roles.length??0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check()
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:FEED,firstParty:complete,listingComplete:complete,lifecycleCleanupAllowed:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:complete?'paired-current-own-semantic-GQL-account-authority;current-native-board-and-documented-listed-feed;every-full-public-role-and-explicit-work-applicant-criteria-country-foreign;configured-listed-India-projection-only;renderer-GQL-backend-application-company-facet-legal-cleanup-held':'caller-zero-cap-without-current-configured-listed-inventory-proof'})
 }catch(error){io.check();if(nativeUnavailable(error)||error?.nativeContradiction)throw error;return pure(()=>{throw error})}finally{io.close();options.signal?.throwIfAborted()}
}
