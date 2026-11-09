import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE="saginfotech",SURFACE="https://saginfotech.com/career.aspx"
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

export const readCards=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),titles=activeHead(html).titles
 check(titles.some(title=>/SAG Infotech/i.test(title)&&/(?:career|job|vacanc)/i.test(title)),'employer careers identity')
 check(doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&/^Current Openings(?:\s*\(\s*HR\b[^)]*\))?$/i.test(doc.text(n))).length===1,'active current openings heading')
 const cards=doc.nodes(n=>doc.hasClass(n,'career-box-dt')),seen=new Set(),jobs=[]
 for(const card of cards){const title=doc.text(one(within(card,n=>n.tag==='span'&&doc.hasClass(n,'dispmsg')),'card role title')),heading=one(within(card,n=>n.tag==='h3'),'role heading'),experience=within(heading,n=>n.tag==='span').map(n=>doc.text(n));check(experience.length===1,'ambiguous native experience')
  const visible=doc.text(card),count=visible.match(/No\. of Vacancies:\s*(\d+)\s*\)\s*-\s*\(\s*(\d+)\s*\)/i),anchor=one(within(card,n=>n.tag==='a'&&n.attrs.href&&/APPLY NOW/i.test(doc.text(n))&&enabled(n)),'native application link'),url=new URL(anchor.attrs.href,SURFACE)
  check(count&&url.origin==='https://saginfotech.com'&&url.pathname==='/ApplyCareer.aspx'&&url.searchParams.get('code')===count[2]&&[...url.searchParams.keys()].length===1&&!url.hash,'unbound visible role code/application link')
  check(!seen.has(count[2]),'duplicate native role code');seen.add(count[2])
  const requirements=doc.text(one(within(card,n=>n.tag==='ul'),'role requirements'))
  check(requirements.length>80,'missing substantive native role requirements')
  jobs.push({title,experienceRequired:experience[0],openingsCount:Number(count[1]),applyUrl:url.href,jobId:count[2],requisitionId:count[2],jobDescription:requirements,location:null,city:null,country:null,postingDate:null,closingDate:null,rawNativeRoleEvidence:{identityQualified:true,listingTitle:title,listingHeading:doc.text(heading),nativeCode:count[2],nativeRequirements:requirements,applicationSubmissionQualified:false,nativePublicationDate:null,nativeClosingDate:null}})
 }
 check(jobs.length>0,'no active native opening cards');return jobs
}
export const verifyApplication=(html,job)=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),expected='Apply for '+job.title+'-Code('+job.requisitionId+')',isHeader=n=>['h1','h2','h3','h4','span','p','label'].includes(n.tag)&&/^Apply for .+-Code\(\d+\)$/i.test(doc.text(n)),statements=doc.nodes(isHeader).filter(n=>within(n,child=>child!==n&&isHeader(child)).length===0).map(n=>doc.text(n)),field=doc.nodes(n=>n.tag==='input'&&n.attrs.id?.endsWith('_txtapplyingfor')&&n.attrs.type!=='hidden')
 check(statements.length===1&&statements[0]===expected&&field.length===1&&field[0].attrs.value===job.title,'application role title/code contradiction')
 return {...job,rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,applicationRoleHeader:statements[0],applicationTitleField:field[0].attrs.value,applicationLandingIdentityQualified:true}}
}
