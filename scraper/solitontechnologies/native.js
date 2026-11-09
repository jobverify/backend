export const SOURCE="solitontechnologies",SURFACE="https://www.solitontech.com/careers",COMPANY="Soliton Technologies"

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

const identity=value=>norm(value).replace(/[\u2012-\u2015]/g,'-').toLowerCase()
const roleURL=value=>{const url=new URL(value,SURFACE);need(url.origin===new URL(SURFACE).origin&&!url.search&&!url.hash&&/^\/careers\/\d+$/.test(url.pathname),'unqualified native role URL');return url.href}
export const extractListings=html=>{
 const head=canonical(html,SURFACE,{required:false}),doc=readNativeDocument(html),rendered=visible(html)
 need(head.titles.length===1&&head.titles[0]==='Careers | Soliton Technologies','employer careers identity')
 need(doc.nodes(n=>/^h[1-3]$/.test(n.tag)&&doc.text(n)==='Open Positions Available').length===1,'active native openings scope')
 const cards=doc.nodes(n=>cls(n,'op-card')),seen=new Map(),jobs=[]
 need(cards.length>0,'unsupported native role inventory')
 for(const card of cards){const title=doc.text(one(within(card,n=>n.tag==='h4'),'native role title')),links=within(card,n=>n.tag==='a'&&n.attrs.href&&/^Apply\b/.test(doc.text(n))),url=roleURL(one(links,'native role link').attrs.href),id=new URL(url).pathname.split('/').at(-1)
  need(title,'empty native role title');if(seen.has(url)){need(identity(seen.get(url))===identity(title),'conflicting duplicate native role title');continue}seen.set(url,title)
  const listingVisible=rendered.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,SURFACE).href===url).length>0
  jobs.push({title,sourceUrl:url,applyUrl:null,jobId:id,requisitionId:id,department:null,rawNativeRoleEvidence:{identityQualified:false,nativeAdvertisedRoleUrl:url,unqualifiedNativeListingTitle:title,nativeListingVisibilityQualified:listingVisible,discoveryOnly:true,exactLegalEmployerQualified:false,applicationAvailabilityQualified:false}})
 }
 return jobs
}
export const hasOfficialCareersSignal=html=>{try{extractListings(html);return true}catch{return false}}
export const extractJobDetail=(html,listing)=>{
 const url=roleURL(listing.sourceUrl),head=canonical(html,url,{required:false}),doc=visible(html),main=one(doc.nodes(n=>n.tag==='main'&&n.attrs.id==='main-content'),'native role main')
 const title=doc.text(one(within(main,n=>n.tag==='h1'&&cls(n,'jd-title')),'native role heading'))
 need(identity(title)===identity(listing.title)&&head.titles.length===1&&identity(head.titles[0])===identity(title+' | Soliton Careers | Soliton Technologies'),'listing/detail role identity contradiction')
 const prose=one(within(main,n=>cls(n,'jd-prose')),'full native JD'),lines=within(prose,n=>['p','li','h2','h3','h4'].includes(n.tag)&&!within(n,c=>c!==n&&['p','li'].includes(c.tag)).length).map(n=>doc.text(n)),values=[],countries=[],statements=[],unqualified=[]
 let qualifier=null
 for(const line of lines){if(/^(?:(?:if|when|where)\s+(?:necessary|needed|required|applicable)|travel(?: locations?)?|company (?:profile|locations?))\s*:?$/i.test(line)){qualifier=line;continue}
  const country=line.match(/^Country\s*:\s*(.+)$/i);if(country){if(qualifier)unqualified.push({statement:line,reason:qualifier});else countries.push(country[1]);continue}
  const field=line.match(/^Work\s+Location\s*\(([^)]+)\)/i)||line.match(/^Work\s+Location\s*[:\-\u2013\u2014]\s*(.+?)\.?$/i)
  if(field){statements.push(line);if(qualifier)unqualified.push({statement:line,reason:qualifier});else values.push(field[1].replace(/\.$/,''))}
 }
 const geo=geography(values,countries),chips=within(main,n=>cls(n,'jd-chip')).map(n=>doc.text(n)),buttons=within(main,n=>n.tag==='button'&&(cls(n,'jd-apply-hero')||cls(n,'jd-sidebar-apply')))
 need(doc.text(prose).length>100,'missing native full JD')
 return role({...listing,title,location:geo.location,country:geo.country,department:chips[0]||null,employmentType:chips[1]||null,experienceRequired:chips[2]||null,requiredSkills:within(prose,n=>cls(n,'jd-skill')).map(n=>doc.text(n)),jobDescription:doc.text(prose),applyUrl:null,rawNativeRoleEvidence:{...listing.rawNativeRoleEvidence,identityQualified:true,nativeDetailTitle:title,nativeDescriptionHtml:rawSlice(html,n=>cls(n,'jd-prose')),nativeWorkplaceStatements:statements,nativeGeography:geo,unqualifiedNativeWorkplaceStatements:unqualified,nativeApplicationControls:buttons.map(n=>({text:doc.text(n),attrs:n.attrs})),applicationAvailabilityQualified:false,applicationSubmissionQualified:false,applicationStateQualification:'captured controls do not prove an enabled native application route',exactLegalEmployerQualified:false,nativeHead:head}})
}
export const collect=async({fetchText=nativeFetch,signal,now,maxJobs=null}={})=>{
 signal?.throwIfAborted();const html=await fetchText(SURFACE,{signal});signal?.throwIfAborted();const listings=extractListings(html),selected=Number.isInteger(maxJobs)&&maxJobs>=0?listings.slice(0,maxJobs):listings,jobs=[],failures=[];let pagesFetched=1
 for(let index=0;index<selected.length;index++){let detail;try{detail=await fetchText(selected[index].sourceUrl,{signal});signal?.throwIfAborted();pagesFetched++}catch(error){signal?.throwIfAborted();if(!jobs.length)throw error;failures.push({nativeRoleId:selected[index].jobId,kind:error.code||'native-detail-unavailable',status:error.status??null});break}jobs.push(extractJobDetail(detail,selected[index]))}
 return finish(jobs,{observedRecordCount:listings.length,observedVacancyCount:jobs.length,pagesFetched,now,failures,nativeObservedCandidateRoleUrls:listings.map(j=>j.sourceUrl),unqualifiedNativeDiscoveryCandidates:listings.filter(row=>!jobs.some(job=>job.jobId===row.jobId)),nativeListingVisibilityQualification:'Raw listing links supply discovery only; public fields come from independently visible and identity-bound native details',applicationAvailabilityQualified:false})
}
