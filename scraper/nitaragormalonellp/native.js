import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE="nitaragormalonellp",SURFACE="https://gormalone.com/careers.html"
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

import {readNativePdf} from './nativePdf.js'
import {createHash} from 'node:crypto'
export const readListings=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),text=doc.text(doc.nodes(n=>n.tag==='root')[0]);check(activeHead(html).titles.some(title=>/Careers at Gormalone/i.test(title))&&/Find your next job at GormalOne/i.test(text)&&/hr@gormalone\.com/i.test(text),'employer careers identity/application email')
 const scope=one(doc.nodes(n=>n.attrs.id==='accordion-style-02'),'native role disclosure scope'),jobs=new Map();let display=0
 for(const anchor of within(scope,n=>n.tag==='a'&&n.attrs.href&&/\.pdf$/i.test(n.attrs.href)&&enabled(n))){const url=new URL(anchor.attrs.href,SURFACE),title=doc.text(anchor);check(title&&url.origin==='https://gormalone.com'&&url.pathname.startsWith('/files/JD/')&&!url.search&&!url.hash,'foreign/unbound native job document');display++
  if(jobs.has(url.href)){check(jobs.get(url.href).title===title,'one PDF URL has conflicting native role titles');continue}
  jobs.set(url.href,{title,company:'NITARA Gormalone LLP',department:null,location:null,city:null,country:null,jobId:null,requisitionId:null,sourceUrl:url.href,applyUrl:'mailto:hr@gormalone.com',employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,rawNativeRoleEvidence:{identityQualified:true,nativeListingTitle:title,literalAdvertisedHref:anchor.attrs.href,nativeRequisitionId:null,applicationSubmissionQualified:false}})
 }
 check(jobs.size>0,'no active native PDF role links');const result=[...jobs.values()];Object.defineProperty(result,'observedDisplayCardCount',{value:display});return result
}
export const bindDocument=(job,pdf,bytes)=>{
 const lines=pdf.text.split(/\n/).map(norm).filter(Boolean),address=lines.findIndex(line=>/^GormalOne LLP\.\s+Mumbai\s+IN$/i.test(line)),prefix=address<0?[]:lines.slice(0,address).filter(line=>!/^\d+\s*\|\s*P\s*a\s*g\s*e$/i.test(line)&&!/^GormalOne LLP$/i.test(line)&&!/^Delivering resources to empower$/i.test(line)),documentTitle=prefix.join(' '),identityQualified=Boolean(documentTitle&&norm(documentTitle).toLowerCase()===norm(job.title).toLowerCase()),locations=lines.map(line=>line.match(/^Work Location\s*:\s*(.+)$/i)?.[1]).filter(Boolean)
 check(locations.length<=1,'ambiguous native PDF workplace');const qualified=identityQualified&&pdf.visibilityQualified
 return {...job,location:qualified?locations[0]||null:null,jobDescription:qualified&&pdf.text.length>200?pdf.text:null,rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,identityQualified,pdfText:pdf.text,pdfDocumentTitle:documentTitle||null,pdfEmployerHeader:address>=0?lines[address]:null,pdfVisibilityQualified:pdf.visibilityQualified,pdfVisibilityLimits:pdf.visibilityLimits,pdfPages:pdf.pages,pdfDocumentMetadata:pdf.documentMetadata,pdfPublicationDateQualified:false,pdfBodySHA256:createHash('sha256').update(bytes).digest('hex'),nativeWorkplaceCandidates:locations,nativeCompanyGeographyQualified:false}}
}
export const collect=async({fetchText=nativeFetch,fetchPdf=(url,options)=>nativeFetch(url,{...options,binary:true}),now=()=>new Date().toISOString(),signal,homepageVerifier}={})=>{
 signal?.throwIfAborted();const homepage=await fetchText('https://gormalone.com/',{signal});check(homepageVerifier?.(homepage),'official homepage identity/handoff');const html=await fetchText(SURFACE,{signal}),listings=readListings(html),jobs=[];let stopped=null,reads=2
 for(const job of listings){let detailed=job;if(!stopped){try{const bytes=Buffer.from(await fetchPdf(job.sourceUrl,{signal}));reads++;detailed=bindDocument(job,await readNativePdf(bytes,{signal}),bytes)}catch(error){signal?.throwIfAborted();stopped={kind:error.code||'native-pdf-unavailable',status:error.status??null,message:error.message};detailed={...job,rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,nativePdfFailure:stopped}}}}else detailed={...job,rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,nativePdfFailure:{kind:'not-attempted-after-native-unavailability'}}}
  jobs.push({...detailed,source:SOURCE,link:job.sourceUrl,scrapedAt:now()})
 }
 return finish(jobs,{observedDisplayCardCount:listings.observedDisplayCardCount,nativeDiscoveryFailures:stopped?[stopped]:[],pagesFetched:reads,now})
}
