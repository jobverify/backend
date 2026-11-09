import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE="bluestock",SURFACE="https://bluestock.in/careers/"
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

const verify=(html,kind)=>{const titles=activeHead(html).titles;check(titles.some(title=>/Bluestock/i.test(title)&&/(?:career|job)/i.test(title)),'employer '+kind+' identity')}
export const readHighlights=html=>{
 verify(html,'careers');const doc=readVisibleNativeDocument(html,{strict:true}),jobs=[]
 for(const alert of doc.nodes(n=>n.tag==='div'&&(doc.hasClass(n,'alert')||n.attrs.role==='alert'))){const titles=within(alert,n=>n.tag==='strong').map(n=>doc.text(n)).filter(Boolean),links=within(alert,n=>n.tag==='a'&&n.attrs.href&&/Apply Now/i.test(doc.text(n))&&enabled(n));if(!titles.length||!links.length)continue
  check(titles.length===1&&links.length===1,'ambiguous promoted role/application');const url=new URL(links[0].attrs.href,SURFACE);check(url.protocol==='https:'&&!url.username&&!url.password,'invalid advertised application URL')
  jobs.push({title:titles[0],company:'Bluestock Fintech',department:null,location:null,city:null,country:null,jobId:null,requisitionId:null,sourceUrl:SURFACE,applyUrl:url.href,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,companyCareerPage:SURFACE,companyDomain:'bluestock.in',atsPlatform:'custom-careers-pages',rawNativeRoleEvidence:{identityQualified:true,recordKind:'promoted-role',nativeDescriptionPublished:false,nativeRequisitionId:null,applicationSubmissionQualified:false}})
 }
 check(new Set(jobs.map(job=>job.applyUrl+'|'+job.title)).size===jobs.length,'duplicate promoted role signal');return jobs
}
export const readCategories=html=>{
 verify(html,'categories');const doc=readVisibleNativeDocument(html,{strict:true}),categories=[]
 for(const card of doc.nodes(n=>doc.hasClass(n,'job-category-card'))){const title=doc.text(one(within(card,n=>n.tag==='h5'),'category title')),count=doc.text(one(within(card,n=>n.tag==='p'),'category count')).match(/^(\d+)\s+Job Openings$/i),link=one(within(card,n=>n.tag==='a'&&n.attrs.href&&/View All Jobs/i.test(doc.text(n))&&enabled(n)),'category route'),url=new URL(link.attrs.href,SURFACE)
  check(count&&url.origin==='https://bluestock.in'&&url.pathname==='/careers/jobs/apply/'&&!url.search&&!url.hash,'unbound category/application route');categories.push({title,publishedOpeningCount:Number(count[1]),advertisedApplicationUrl:url.href,recordKind:'category',nativeVacancyIdentityQualified:false})
 }
 check(new Set(categories.map(row=>row.title)).size===categories.length,'duplicate category observations');return categories
}
export const categoryObservations=html=>{const categories=readCategories(html);return finish([],{recordKind:'categories',observedRecordCount:categories.length,observedVacancyCount:0,observedCategories:categories,observedCategoryCount:categories.length,actualVacancyCount:null})}
export const bindApplication=(job,html)=>{
 const titles=activeHead(html).titles,label=norm(job.title).replace(/\s+(?:Internship|Intern)(?:\s*(?:&|\/)\s*Job)?$/i,'').toLowerCase()
 const labels=titles.map(title=>title.match(/^(.+?)(?:\s*-\s*|\s+)(?:Internship|Intern\s*\/\s*Job)\s+Application(?:\s*-\s*Bluestock(?:\s+Fintech)?)?$/i)?.[1]).filter(Boolean).map(value=>norm(value).toLowerCase())
 const conflict=labels.length>0&&(labels.length!==1||labels[0]!==label)
 return {...job,applyUrl:conflict?null:job.applyUrl,rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,identityQualified:!conflict,advertisedApplicationUrl:job.applyUrl,applicationLandingTitles:titles,applicationRoleLabels:labels,applicationRoleIdentityQualified:labels.length===1&&!conflict,applicationRoleConflict:conflict}}
}
