export const SOURCE="pragyarefrigerationandelectricalsprivatelimited",SURFACE="https://pragyarefrigeration.in/careers/",COMPANY="Pragya Refrigeration and Electricals Private Limited"

import {readNativeDocument,activeHead,activeScripts,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {document as sourceDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export {readNativeDocument,activeHead,activeScripts,readVisibleNativeDocument,sourceDocument}
export const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
export const cls=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
export const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
export const allRaw=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>allRaw(child,predicate))]
const gap=()=>({status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null})
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error(SOURCE+' native: '+message),{abortRetries:true,inventoryEvidence:gap()})}
export const one=(rows,label)=>{need(rows.length===1,'missing/ambiguous '+label);return rows[0]}
export const parentsOf=root=>{const result=new Map();const walk=node=>{for(const child of node.children||[])if(typeof child!=='string'){result.set(child,node);walk(child)}};walk(root);return result}
export const rawSlice=(html,predicate)=>{const doc=sourceDocument(html),node=one(allRaw(doc.root,predicate),'raw role carrier');need(Number.isInteger(node.end),'unclosed raw role carrier');return doc.outer(node)}
export const canonical=(html,url,{required=true}={})=>{const doc=readNativeDocument(html),head=one(doc.nodes(n=>n.tag==='head'),'native head'),links=within(head,n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'));need(links.length===(required?1:links.length),'missing native canonical');need(links.length<=1&&links.every(n=>n.attrs.href===url),'native canonical role identity conflict');return {titles:within(head,n=>n.tag==='title').map(n=>norm(n.raw)),metas:within(head,n=>n.tag==='meta').map(n=>n.attrs)}}
export const visible=html=>readVisibleNativeDocument(html,{strict:true})
export const role=(values={})=>({title:null,company:COMPANY,location:null,city:null,state:null,country:null,department:null,jobId:null,requisitionId:null,sourceUrl:SURFACE,applyUrl:null,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,remoteStatus:null,...values})
export const finish=(jobs,{observedVacancyCount=jobs.length,observedRecordCount=observedVacancyCount,recordKind=observedRecordCount===observedVacancyCount?'vacancy-rows':'mixed',pagesFetched=1,now=()=>new Date().toISOString(),failures=[],...extra}={})=>{
 const time=new Date(now());need(!Number.isNaN(+time),'invalid extraction clock')
 const audit={source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,observedListingCount:observedVacancyCount,candidateDetails:observedVacancyCount,extractedDetailJobs:jobs.filter(j=>j.jobDescription&&j.rawNativeRoleEvidence?.identityQualified!==false).length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Native source observations only. Employer-wide global/India counts, exact legal employer, closing inventory, unpublished role dates and successful application submission remain unqualified.',...extra}
 for(const job of jobs){job.source=SOURCE;job.companyCareerPage=SURFACE;job.companyDomain=new URL(SURFACE).hostname.replace(/^www\./,'');job.scrapedAt=time.toISOString();job.link=job.applyUrl||job.sourceUrl;job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{...gap(),pagesFetched,verifiedAt:time.toISOString(),reason:failures.length?'native-observations-with-unavailable-or-unqualified-details':'native-observed-subset-with-unqualified-company-scope'})
}
const arrangement=/^(?:remote|hybrid|on[ -]?site|work from home|multiple locations|not specified|tbd|n\/?a)$/i
export const geography=(statements,countryStatements=[])=>{
 const native=statements.map(norm).filter(Boolean),countries=countryStatements.map(norm).filter(Boolean),values=[...new Set(native.filter(value=>!arrangement.test(value)))],explicit=[]
 for(const value of countries){need(!arrangement.test(value),'arrangement used as native country');explicit.push(/^(?:India|IN)$/i.test(value)?'India':/^(?:US|USA|United States(?: of America)?)$/i.test(value)?'US':value)}
 for(const value of values){if(/^US\s*-\s*\S/.test(value))explicit.push('US');if(/^(?:India|IN)$/i.test(value)||/(?:^|,)\s*India\s*$/.test(value))explicit.push('India')}
 const uniqueCountries=[...new Set(explicit)];need(uniqueCountries.length<=1,'conflicting explicit native country/workplace statements')
 const most=values.slice().sort((a,b)=>b.length-a.length)[0]||null,consistent=values.every(value=>value===most||most?.split(/[,/]/).map(norm).includes(value))
 return {location:consistent?most:null,country:consistent?(uniqueCountries[0]||null):null,nativeWorkplaceStatements:native,nativeCountryStatements:countries,workplaceQualified:consistent,unqualifiedWorkplaceStatements:consistent?[]:native}
}
export const nativeFetch=async(url,{signal,metadata=false}={})=>{
 signal?.throwIfAborted();const target=new URL(url),origin=new URL(SURFACE);need(target.protocol==='https:'&&!target.username&&!target.password&&target.hostname.replace(/^www\./,'')===origin.hostname.replace(/^www\./,''),'unqualified native request route')
 const own=new AbortController(),timeout=Object.assign(Error(SOURCE+' native request timeout'),{name:'TimeoutError',abortRetries:true,inventoryEvidence:gap()}),timer=setTimeout(()=>own.abort(timeout),20000),attempt=signal?AbortSignal.any([signal,own.signal]):own.signal
 const aborted=()=>{signal?.throwIfAborted();attempt.throwIfAborted()};let response,reader
 const wait=promise=>new Promise((resolve,reject)=>{let settled=false;const cleanup=()=>attempt.removeEventListener('abort',abort),abort=()=>{if(settled)return;settled=true;cleanup();reject(signal?.aborted?signal.reason:attempt.reason)};attempt.addEventListener('abort',abort,{once:true});if(attempt.aborted)abort();Promise.resolve(promise).then(value=>{cleanup();if(settled){try{Promise.resolve(value?.body?.cancel()).catch(()=>{})}catch{}return}settled=true;resolve(value)},error=>{cleanup();if(settled)return;settled=true;reject(error)})})
 const cancel=()=>{try{Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{})}catch{}}
 try{response=await wait(fetch(url,{method:'GET',redirect:'manual',headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,application/json,application/javascript,text/css;q=0.9,*/*;q=0.8'},signal:attempt}));aborted()
  if(response.status!==200){cancel();throw Object.assign(Error(SOURCE+' native HTTP '+response.status),{status:response.status,code:[401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'native_unavailable',abortRetries:true,inventoryEvidence:gap()})}
  need(!response.url||response.url===url,'unqualified native final URL');need(!response.headers?.get('content-length')||Number(response.headers.get('content-length'))<=2_000_000,'oversized native body')
  reader=response.body?.getReader();need(reader,'missing native body');const chunks=[];let size=0
  for(;;){const chunk=await wait(reader.read());aborted();if(chunk.done)break;size+=chunk.value.byteLength;need(size<=2_000_000,'oversized native body');chunks.push(Buffer.from(chunk.value))}
  const html=Buffer.concat(chunks).toString('utf8');aborted();need(!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment|Attention Required)|<Code>\s*AccessDenied|cf-chl-/i.test(html),'native access denial or challenge');return metadata?{html,status:200,url:response.url||url}:html
 }catch(error){cancel();aborted();if(error.abortRetries)throw error;throw Object.assign(Error(SOURCE+' native transport: '+error.message),{abortRetries:true,cause:error,inventoryEvidence:gap()})}
 finally{clearTimeout(timer);try{reader?.releaseLock()}catch{}}
}

export const API='https://pragyarefrigeration.in/wp-json/wp/v2/pages?slug=careers'
const titleText=value=>norm(value).replace(/\s*:\s*-*\s*$/,'')
const cards=(html,pageId)=>{
 const doc=visible(html),root=one(doc.nodes(n=>n.attrs['data-elementor-type']==='wp-page'&&n.attrs['data-elementor-id']===String(pageId)),'published careers page carrier'),parents=parentsOf(root),heading=one(within(root,n=>n.tag==='h3'&&doc.text(n)==='Open positions'),'native Open positions heading')
 let header=heading;while(header&&!cls(header,'e-parent'))header=parents.get(header);need(header,'native openings section binding')
 const siblings=parents.get(header)?.children.filter(c=>typeof c!=='string'&&!c.inert)||[],group=siblings[siblings.indexOf(header)+1];need(group&&cls(group,'e-parent'),'native role group following openings heading')
 const columns=within(group,n=>cls(n,'e-child')&&within(n,c=>c.tag==='h3').length===1),seen=new Map(),result=[]
 need(columns.length>0,'unsupported empty native role section')
 for(const column of columns){const title=titleText(doc.text(one(within(column,n=>n.tag==='h3'),'native role heading'))),paragraphs=within(column,n=>n.tag==='p').map(n=>doc.text(n)),label=pattern=>paragraphs.filter(value=>pattern.test(value)),qual=label(/^Qualification\s*:/i),exp=label(/^Experience\s*:/i),duties=label(/^(?:Roll|Role)\s*:/i),locations=label(/^(?:Work |Job )?Location\s*:/i).map(value=>value.replace(/^(?:Work |Job )?Location\s*:\s*/i,'')),countries=label(/^Country\s*:/i).map(value=>value.replace(/^Country\s*:\s*/i,'')),geo=geography(locations,countries),text=doc.text(column)
  need(title&&qual.length<=1&&exp.length<=1&&duties.length<=1,'ambiguous native role fields');if(seen.has(title)){need(seen.get(title)===text,'ambiguous duplicate role title with conflicting native text');continue}seen.set(title,text)
  result.push({title,carrierId:column.attrs['data-id']||null,text,qualification:qual[0]?.replace(/^Qualification\s*:\s*/i,'')||null,experience:exp[0]?.replace(/^Experience\s*:\s*/i,'')||null,complete:qual.length===1&&exp.length===1&&duties.length===1,geo})
 }
 return result
}
export const isVerifiedCareersPage=page=>Boolean(page&&page.type==='page'&&page.status==='publish'&&page.slug==='careers'&&Number.isInteger(page.id)&&page.link===SURFACE&&typeof page.content?.rendered==='string')
export const extractJobs=(payload,{html}={})=>{
 need(Array.isArray(payload)&&payload.length===1&&isVerifiedCareersPage(payload[0]),'published careers API page identity')
 const page=payload[0],apiCards=cards(page.content.rendered,page.id)
 if(html){const head=canonical(html,SURFACE);need(head.titles.length===1&&/Pragya Refrigeration/i.test(head.titles[0]),'official careers employer identity');const shown=cards(html,page.id);need(shown.length===apiCards.length&&shown.every((row,index)=>row.title===apiCards[index].title&&row.carrierId===apiCards[index].carrierId&&row.text===apiCards[index].text),'published API/rendered role identity or content contradiction')}
 return apiCards.map(card=>role({title:card.title,location:html?card.geo.location:null,country:html?card.geo.country:null,sourceUrl:SURFACE,applyUrl:SURFACE,experienceRequired:card.experience,minimumQualification:card.qualification,jobDescription:html&&card.complete?card.text:null,rawNativeRoleEvidence:{identityQualified:true,nativePageId:page.id,nativeRoleTitle:card.title,nativeCarrierId:card.carrierId,nativePageDate:page.date??null,nativePageModified:page.modified??null,nativeGeography:card.geo,unqualifiedNativeDescription:html&&card.complete?null:card.text,nativeVisibleRoleCorroborated:Boolean(html),applicationRoleIdentityQualified:false,applicationSubmissionQualified:false,exactLegalEmployerQualified:false,rawDateQualification:'WordPress page creation/modification dates are not role posting dates'}}))
}
export const collect=async({fetchJson,fetchText=nativeFetch,signal,now}={})=>{
 signal?.throwIfAborted();const payload=fetchJson?await fetchJson(API,{signal}):JSON.parse(await nativeFetch(API,{signal}));signal?.throwIfAborted();const partialJobs=extractJobs(payload),failures=[];let html
 try{html=await fetchText(SURFACE,{signal});signal?.throwIfAborted()}catch(error){signal?.throwIfAborted();failures.push({kind:error.code||'native-rendered-page-unavailable',status:error.status??null});return finish(partialJobs,{pagesFetched:1,now,failures})}
 return finish(extractJobs(payload,{html}),{pagesFetched:2,now,nativePageId:payload[0].id,nativePageDates:{created:payload[0].date??null,modified:payload[0].modified??null}})
}
