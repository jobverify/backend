import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE="continualengine",SURFACE="https://www.continualengine.com/careers/"
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

const rawControls=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>rawControls(n,predicate))]
const withoutApply=node=>typeof node==='string'?node:{...node,children:node.children.filter(child=>typeof child==='string'||!(child.tag==='a'&&(child.attrs.class||'').split(/\s+/).includes('apply_now'))).map(withoutApply)}
export const readAccordion=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),raw=readNativeDocument(html).nodes(n=>n.tag==='root')[0],titles=activeHead(html).titles
 check(titles.some(title=>/Career/i.test(title)&&/Continual Engine/i.test(title)),'employer careers identity')
 const headings=doc.nodes(n=>n.tag==='h3'&&doc.hasClass(n,'elementor-tab-title')&&enabled(n)),jobs=[],seen=new Set()
 for(const heading of headings){const id=heading.attrs.id,contentId=heading.attrs['aria-controls'],title=doc.text(heading);check(id&&contentId&&/^[\w-]+$/.test(id)&&/^[\w-]+$/.test(contentId)&&title,'unbound accordion role control');check(!seen.has(id),'duplicate role control');seen.add(id)
  check(rawControls(raw,n=>n.attrs.id===id).length===1&&rawControls(raw,n=>n.attrs.id===contentId).length===1,'duplicate/missing native accordion binding')
  const panels=doc.nodes(n=>n.attrs.id===contentId);check(panels.length<=1,'ambiguous active panel');const panel=panels[0]||null
  if(panel)check(panel.attrs['aria-labelledby']===id&&panel.attrs['data-tab']===heading.attrs['data-tab'],'accordion role/panel identity contradiction')
  const links=panel?within(panel,n=>n.tag==='a'&&doc.hasClass(n,'apply_now')&&enabled(n)):[];check(links.length<=1,'ambiguous application link');const applyUrl=links[0]?.attrs.href||null;check(!applyUrl||/^mailto:contact@continualengine\.com$/i.test(applyUrl),'foreign/unbound native application route')
  const description=panel?doc.text(withoutApply(panel)):null
  jobs.push({title,company:'Continual Engine',department:null,location:null,city:null,country:null,jobId:null,requisitionId:null,sourceUrl:SURFACE+'#'+id,applyUrl,employmentType:null,experienceRequired:description?.match(/(?:minimum of|minimum|at least)\s+(\d+\+?\s*(?:years?|months?))/i)?.[1]||null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:description&&description.length>80?description:null,remoteStatus:null,rawNativeRoleEvidence:{identityQualified:true,nativeControlId:id,nativePanelId:contentId,nativePanelRenderingQualified:Boolean(panel),nativeRequisitionId:null,applicationSubmissionQualified:false,nativePublicationDate:null,nativeClosingDate:null}})
 }
 check(jobs.length>0,'no active native opening controls');return jobs
}
