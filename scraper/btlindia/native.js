import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
const SOURCE="btlindia",SURFACE="https://www.btlnet.co.in/careers.php"
export const check=(ok,message)=>{if(!ok)throw Object.assign(Error(SOURCE+' native: '+message),{abortRetries:true,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
export const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
export const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,predicate))]
export const one=(nodes,label)=>{check(nodes.length===1,'missing/ambiguous '+label);return nodes[0]}
export const enabled=node=>!Object.hasOwn(node.attrs,'disabled')&&node.attrs['aria-disabled']!=='true'
export const finish=(jobs,{recordKind='vacancy-rows',observedRecordCount=jobs.length,observedVacancyCount=jobs.length,now=()=>new Date().toISOString(),pagesFetched=1,...extra}={})=>{
 const failures=jobs.filter(job=>!job.jobDescription||job.rawNativeRoleEvidence?.identityQualified===false).map(job=>({stage:'native-detail',nativeRoleId:job.requisitionId??job.sourceUrl,kind:job.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,observedListingCount:observedVacancyCount,candidateDetails:observedVacancyCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(job=>!job.location).length,observedUnknownCountries:jobs.filter(job=>!job.country).length,rawProvenanceLimit:'Observed native records only; actual employer-wide vacancy scope, authoritative India/global totals, closing inventory and application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.fullExtractedNativeTextAvailable=Boolean(job.jobDescription);job.sourceDetailComplete=false;job.nativeCriteriaVisibilityQualified=false;job.nativeCountryScopeUnresolved=true;job.sourceCountryScopeUnresolved=true;job.sourceDetailFailureKind='text-only-PDF-country-posting-and-rendered-criteria-unqualified'}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}
export const nativeFetch=async(url,{signal,binary=false,metadata=false,method='GET',body}={})=>{
 signal?.throwIfAborted();const deadline=AbortSignal.timeout(20000),requestSignal=signal?AbortSignal.any([signal,deadline]):deadline
 const aborted=()=>{signal?.throwIfAborted();requestSignal.throwIfAborted()}
 try{const response=await fetch(url,{method,...(body==null?{}:{body}),headers:{'User-Agent':'Mozilla/5.0',Accept:binary?'application/pdf':'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'}:{})},signal:requestSignal});aborted()
  if(!response.ok){await disposeResponseBody(response,{signal,bestEffort:true});throw Object.assign(Error(SOURCE+' native input: HTTP '+response.status),{status:response.status,code:[401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'native_unavailable',abortRetries:true,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
  const requested=new URL(url),final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===requested.pathname.replace(/\/$/,'')
  if(final.origin!==requested.origin||!samePath||final.search!==requested.search){await disposeResponseBody(response,{signal,bestEffort:true});check(false,'unexpected native redirect')}
  const value=binary?Buffer.from(await response.arrayBuffer()):await response.text();aborted();check(value.length<(binary?5000000:3000000),'oversized native input')
  if(!binary)check(!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment|Attention Required)|<Code>\s*AccessDenied/i.test(value),'HTTP200 native access denial or challenge')
  return metadata?{html:value,status:response.status,url:final.href}:value
 }catch(error){signal?.throwIfAborted();if(error.abortRetries)throw error;requestSignal.throwIfAborted();throw Object.assign(Error(SOURCE+' native input: '+error.message),{abortRetries:true,cause:error,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
}
export {readVisibleNativeDocument,readNativeDocument,activeHead}

const readNativePdf=async(value,{signal}={})=>{
 signal?.throwIfAborted()
 const operation=import('./nativePdf.js').then(module=>{signal?.throwIfAborted();return module.readNativePdf(value,{signal})})
 operation.catch(()=>{})
 let listener
 const aborted=signal&&new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()})
 try{const result=await (aborted?Promise.race([operation,aborted]):operation);signal?.throwIfAborted();return result}
 catch(error){signal?.throwIfAborted();throw error}
 finally{if(listener)signal.removeEventListener('abort',listener)}
}
import {createHash} from 'node:crypto'
export const readListings=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),text=doc.text(doc.nodes(n=>n.tag==='root')[0]);check(activeHead(html).titles.some(title=>/BTL/i.test(title))&&/BE PART OF OUR TEAM/i.test(text)&&/btlinrd-hr@btlnet\.com/i.test(text),'employer careers identity/application email')
 const scope=one(doc.nodes(n=>n.attrs.id==='accordion'),'native opportunities scope');check(/Job Opportunities/i.test(doc.text(scope)),'native opportunities heading');const jobs=new Map();let display=0
 for(const heading of within(scope,n=>n.tag==='h4')){const anchors=within(heading,n=>n.tag==='a'&&n.attrs.href&&/\.pdf$/i.test(n.attrs.href)&&enabled(n));if(!anchors.length)continue;const anchor=one(anchors,'native PDF role link'),url=new URL(anchor.attrs.href,SURFACE),title=doc.text(anchor);check(title&&url.origin==='https://www.btlnet.co.in'&&url.pathname.startsWith('/admin/image/career/')&&url.pathname.endsWith('.pdf')&&!url.search&&!url.hash,'foreign/unbound native PDF role route');display++
  if(jobs.has(url.href)){check(jobs.get(url.href).title===title,'one PDF URL has conflicting native role titles');continue}
  jobs.set(url.href,{title,company:'BTL India Pvt. Ltd.',department:null,location:null,city:null,country:null,jobId:null,requisitionId:null,sourceUrl:url.href,applyUrl:'mailto:btlinrd-hr@btlnet.com',employmentType:null,experienceRequired:title.match(/\d+\s+to\s+\d+\s+years?/i)?.[0]||null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,remoteStatus:null,rawNativeRoleEvidence:{identityQualified:true,nativeListingTitle:title,literalAdvertisedHref:anchor.attrs.href,nativeRequisitionId:null,applicationSubmissionQualified:false}})
 }
 check(jobs.size>0,'no active native PDF role links');const result=[...jobs.values()];Object.defineProperty(result,'observedDisplayCardCount',{value:display});return result
}
export const bindDocument=(job,pdf,bytes)=>{
 const role=job.title.match(/^(firmware|hardware|software)(?:\s+design)?\s+engineer(?:\s*\((R&D Improvement & Support)\))?\s*-\s*(\d+)\s+to\s+(\d+)\s+years?$/i),text=pdf.text,intro=norm(text).slice(0,1300),roleIntro=role&&new RegExp('(?:seeking|looking for)[\\s\\S]{0,260}\\b'+role[1]+'\\b','i').test(intro),support=/improvement and support/i.test(intro),npd=/New Product Development\s*\(NPD\)/i.test(text)
 // Compare explicit experience requirements only. Company history such as
 // "started 13 years ago" is retained in pdfText, not treated as a criterion.
 const nativeExperienceRequirements=[...norm(text).matchAll(/\b(?:(Around|About|Approximately)\s+)?(\d+)\s*(?:(to|[-–])\s*(\d+)\s*)?years?\s+(?:of\s+)?experience\b/gi)].map(m=>({literal:m[0],minimum:Number(m[2]),maximum:Number(m[4]??m[2]),qualifier:m[1]??null}))
 const advertisedExperience=role?{minimum:Number(role[3]),maximum:Number(role[4]),literal:job.experienceRequired??job.title}:null
 const experienceConsistency=!nativeExperienceRequirements.length?'not-published':!advertisedExperience?'unqualified':nativeExperienceRequirements.every(r=>r.minimum>=advertisedExperience.minimum&&r.maximum<=advertisedExperience.maximum)?'compatible':'conflict'
 const identityQualified=Boolean(role&&/^BTL India\b/i.test(norm(text))&&roleIntro&&(role[2]?support:!support&&npd)&&experienceConsistency!=='conflict'),locations=text.split(/\n/).map(norm).map(line=>line.match(/^(?:Work )?Location\s*[:-]\s*(.+)$/i)?.[1]).filter(Boolean)
 check(locations.length<=1,'ambiguous native PDF workplace');const qualified=identityQualified&&pdf.visibilityQualified
 return {...job,location:qualified?locations[0]||null:null,jobDescription:qualified&&text.length>200?text:null,rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,identityQualified,advertisedExperience,nativeExperienceRequirements,experienceConsistency,pdfText:text,pdfVisibilityQualified:pdf.visibilityQualified,pdfVisibilityLimits:pdf.visibilityLimits,pdfPages:pdf.pages,pdfDocumentMetadata:pdf.documentMetadata,pdfPublicationDateQualified:false,pdfBodySHA256:createHash('sha256').update(bytes).digest('hex'),pdfRoleProof:{nativeAdvertisedUrl:job.sourceUrl,roleFamily:role?.[1]||null,nativeTeam:role?.[2]?'R&D Improvement & Support':npd?'New Product Development':null,employerMatched:/^BTL India\b/i.test(norm(text)),roleIntroMatched:Boolean(roleIntro)},nativeWorkplaceCandidates:locations,nativeCompanyGeographyQualified:false}}
}
export const collect=async({fetchText=nativeFetch,fetchPdf=(url,options)=>nativeFetch(url,{...options,binary:true}),decodePdf=readNativePdf,now=()=>new Date().toISOString(),signal}={})=>{
 signal?.throwIfAborted();const html=await fetchText(SURFACE,{signal}),listings=readListings(html),jobs=[];let stopped=null,reads=1
 for(const job of listings){let detailed;if(!stopped){try{const bytes=Buffer.from(await fetchPdf(job.sourceUrl,{signal}));reads++;detailed=bindDocument(job,await decodePdf(bytes,{signal}),bytes)}catch(error){signal?.throwIfAborted();stopped={kind:error.code||'native-pdf-unavailable',status:error.status??null,message:error.message};detailed={...job,rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,nativePdfFailure:stopped}}}}else detailed={...job,rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,nativePdfFailure:{kind:'not-attempted-after-native-unavailability'}}}
  jobs.push({...detailed,source:SOURCE,link:job.sourceUrl,scrapedAt:now()})
 }
 return finish(jobs,{observedDisplayCardCount:listings.observedDisplayCardCount,nativeDiscoveryFailures:stopped?[stopped]:[],pagesFetched:reads,now})
}
