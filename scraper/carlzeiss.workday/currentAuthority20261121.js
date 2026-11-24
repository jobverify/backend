import {isDeepStrictEqual} from 'node:util'
import {createZeissReader} from './currentTransport20261121.js'
import {declaredOwnLink,readCurrentZeissLoader,readCurrentZeissChunks,readCurrentZeissProtocol,zeissNativeVariables,readCurrentZeissRows} from './currentProtocol20261121.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
export const SOURCE='carlzeiss',COMPANY='Carl Zeiss',CAREERS_URL='https://www.zeiss.com/career/en/home.html',DISPOSITION='current-own-declared-native-public-query'
const need=(v,message)=>{if(!v)throw firstPartyFailure(SOURCE,message,{failureKind:'coverage_gap',sourceScopeComplete:false})}
export async function run(options={}){
 options.signal?.throwIfAborted();const reader=createZeissReader(options);let opening,closing,reconciled=false
 const audit=()=>({source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null,companyIndiaZeroProven:false,nativeScopedRecordCount:opening?.rows?.length??null,observedRecordCount:opening?.rows?.length??0,observedVacancyCount:opening?.rows?.length??0,recordKind:'vacancy-rows',wholeRawPublisherOpeningClosingEqual:!!closing&&isDeepStrictEqual(opening,closing),wholeNativeRoleCriteriaApplicationClosingReconciled:reconciled,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().requests,applicationInteractions:0,workdayEngineFallbacks:0,holds:['native-India-filtered-cohort-is-not-whole-company-inventory','company-totals-unknown','active-application-submission-and-unselected-closing-date-fields-unverified']})
 const get=async(url,kind)=>{reader.allow(url,kind);return reader.read(url,kind)}
 async function capture(target){
  target.pages=[]
  const home=await get(CAREERS_URL,'html');target.pages.push(home)
  const locationsURL=declaredOwnLink(home.body,home.url,n=>/\/career\/en\/locations\.html$/.test(n.attrs.href??''));const locations=await get(locationsURL,'html');target.pages.push(locations)
  const indiaURL=declaredOwnLink(locations.body,locations.url,(n,d)=>/\/career\/en\/locations\/india\.html(?:#India)?$/.test(n.attrs.href??'')&&/\bIndia$/.test(d.text(n)));const india=await get(indiaURL,'html');target.pages.push(india)
  const searchURL=declaredOwnLink(india.body,india.url,(n,d)=>d.text(n)==='Jobs in India');const search=await get(searchURL,'html');target.pages.push(search)
  target.searchURL=searchURL;target.nativeFilter=zeissNativeVariables(searchURL);target.loader=readCurrentZeissLoader(search.body)
  const remote=await get(target.loader.url,'javascript');target.pages.push(remote);target.chunks=readCurrentZeissChunks(remote.body,remote.url);target.programmes=[]
  const protocols=[]
  for(const url of target.chunks.urls){const chunk=await get(url,'javascript');target.programmes.push(chunk);const protocol=readCurrentZeissProtocol(chunk.body);if(protocol)protocols.push(protocol)}
  need(protocols.length===1,'Exactly one currently consumed native public search protocol required');target.protocol=protocols[0];reader.allow(target.protocol.endpoint,'json');target.nativeData=[];target.rows=[]
  let totalPages=1,total=null,unfiltered=null
  for(let page=1;page<=totalPages;page++){
   reader.check();need(page<=32,'Native scoped pagination exceeds bounded acquisition; company inventory remains unknown')
   const {variables}=zeissNativeVariables(searchURL,page),request={query:target.protocol.query,variables,operationName:target.protocol.operationName},entity=await reader.read(target.protocol.endpoint,'json',{method:'POST',body:request});target.nativeData.push(entity)
   const model=readCurrentZeissRows(entity.value),pagination=model.pagination;need(pagination.page===page&&pagination.pageSize===target.protocol.pageSize,'Native page identity changed');if(total===null){total=pagination.resultCount;unfiltered=pagination.totalJobs;totalPages=pagination.totalPages;target.nativeScopedTotal=total;target.nativeUnfilteredSearchTotal=unfiltered}else need(total===pagination.resultCount&&unfiltered===pagination.totalJobs&&totalPages===pagination.totalPages,'Native scoped/unfiltered counts changed during pagination')
   need(model.rows.length===Math.min(20,total-(page-1)*20),'Native page is incomplete or inconsistent');target.rows.push(...model.rows)
  }
  need(target.rows.length===total&&new Set(target.rows.map(r=>r.jobId)).size===target.rows.length,'Whole scoped native cohort missing/duplicate roles');target.nativeScopedTotal=total
 }
 const semantic=model=>({searchURL:model.searchURL,nativeFilter:model.nativeFilter,protocol:model.protocol,nativeScopedTotal:model.nativeScopedTotal,nativeUnfilteredSearchTotal:model.nativeUnfilteredSearchTotal,wholeNativeData:model.nativeData.map(d=>d.value)})
 try{
  opening={};await capture(opening);closing={};await capture(closing);need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Whole current native scoped roles/criteria/application closing models changed; both captures retained');reconciled=true
  const jobs=opening.rows.filter(r=>r.sourceRoleQualified).map(r=>({...r,sourceUrl:opening.searchURL,sourceWholeNativeRoleModelsClosingEqual:true,sourceDetailComplete:true}))
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});attachInventoryEvidence(jobs,{status:'coverage-gap',surface:opening.searchURL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests.length,reportedTotal:null,verifiedAt:new Date().toISOString(),reason:'current-native-paired-India-location-query-cohort;company-scope-and-unselected-fields-unverified;cleanup-forbidden'})
  const evidence=audit();need(Buffer.byteLength(JSON.stringify(evidence))<=24*1024*1024,'Native retained evidence byte budget');Object.defineProperty(jobs,'recruitmentObservations',{value:evidence,configurable:true});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true});reader.check();options.signal?.throwIfAborted();return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object'){Object.defineProperty(error,'recruitmentObservations',{value:audit(),configurable:true});Object.defineProperty(error,'abortRetries',{value:true,configurable:true})}}catch{};options.signal?.throwIfAborted();throw error}
 finally{await reader.close();options.signal?.throwIfAborted()}
}
