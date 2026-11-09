import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE="deitelengineeringsolutionsllp",SURFACE="https://deitel.in/career/"
export const check=(ok,message)=>{if(!ok)throw Object.assign(Error(SOURCE+' native: '+message),{abortRetries:true,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
export const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
export const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,predicate))]
export const one=(nodes,label)=>{check(nodes.length===1,'missing/ambiguous '+label);return nodes[0]}
export const enabled=node=>!Object.hasOwn(node.attrs,'disabled')&&node.attrs['aria-disabled']!=='true'
export const finish=(jobs,{recordKind='vacancy-rows',observedRecordCount=jobs.length,observedVacancyCount=jobs.length,now=()=>new Date().toISOString(),pagesFetched=1,...extra}={})=>{
 const failures=jobs.filter(job=>!job.jobDescription||job.rawNativeRoleEvidence?.identityQualified===false).map(job=>({stage:'native-detail',nativeRoleId:job.requisitionId??job.sourceUrl,kind:job.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,observedListingCount:observedVacancyCount,candidateDetails:observedVacancyCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(job=>!job.location).length,observedUnknownCountries:jobs.filter(job=>!job.country).length,rawProvenanceLimit:'Observed native records only; actual employer-wide vacancy scope, authoritative India/global totals, closing inventory and application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}
export const nativeFetch=async(url,{signal,binary=false,metadata=false,method='GET',body}={})=>{
 signal?.throwIfAborted();const deadline=AbortSignal.timeout(20000),requestSignal=signal?AbortSignal.any([signal,deadline]):deadline
 const aborted=()=>{signal?.throwIfAborted();requestSignal.throwIfAborted()}
 try{const response=await fetch(url,{method,...(body==null?{}:{body}),headers:{'User-Agent':'Mozilla/5.0',Accept:binary?'application/pdf':'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'}:{})},signal:requestSignal});aborted()
  if(!response.ok){await response.body?.cancel();throw Object.assign(Error(SOURCE+' native input: HTTP '+response.status),{status:response.status,code:[401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'native_unavailable',abortRetries:true,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
  const requested=new URL(url),final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===requested.pathname.replace(/\/$/,'')
  if(final.origin!==requested.origin||!samePath||final.search!==requested.search){await response.body?.cancel();check(false,'unexpected native redirect')}
  const value=binary?Buffer.from(await response.arrayBuffer()):await response.text();aborted();check(value.length<(binary?5000000:3000000),'oversized native input')
  if(!binary)check(!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment|Attention Required)|<Code>\s*AccessDenied/i.test(value),'HTTP200 native access denial or challenge')
  return metadata?{html:value,status:response.status,url:final.href}:value
 }catch(error){aborted();if(error.abortRetries)throw error;throw Object.assign(Error(SOURCE+' native input: '+error.message),{abortRetries:true,cause:error,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
}
export {readVisibleNativeDocument,readNativeDocument,activeHead}

export const verifyHomepage=html=>{const doc=readVisibleNativeDocument(html,{strict:true});check(activeHead(html).titles.some(title=>/DEITEL/i.test(title)&&/Engineering/.test(title)),'employer homepage identity');check(doc.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,'https://deitel.in/').href===SURFACE).length>0,'active employer careers handoff')}
export const readRoleAreas=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),titles=activeHead(html).titles
 check(titles.length===1&&/Career/i.test(titles[0])&&/DEITEL/i.test(titles[0]),'careers page identity')
 check(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href===SURFACE,'careers canonical identity')
 const content=one(doc.nodes(n=>doc.hasClass(n,'entry-content')),'native careers content')
 check(/Candidates with relevant experience in following areas can apply to/i.test(doc.text(content))&&/hr@deitel\.in/.test(doc.text(content)),'active role-area invitation')
 const list=one(within(content,n=>n.tag==='ul'),'role-area list'),areas=within(list,n=>n.tag==='li').map(n=>doc.text(n)).filter(Boolean)
 check(areas.length>0&&new Set(areas).size===areas.length,'missing/duplicate role-area observations')
 return finish([],{recordKind:'role-areas',observedRecordCount:areas.length,observedVacancyCount:0,observedRoleAreas:areas.map(title=>({title,recordKind:'role-area',nativeVacancyIdentityQualified:false,location:null,country:null})),generalApplicationEmail:'hr@deitel.in',actualVacancyCount:null})
}
