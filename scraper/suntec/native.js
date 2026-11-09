export const SOURCE="suntec",SURFACE="https://www.suntecgroup.com/career/",COMPANY="SunTec"

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
const hiddenEverywhere=node=>['elementor-hidden-desktop','elementor-hidden-tablet','elementor-hidden-mobile'].every(name=>cls(node,name))
const readCards=(doc,raw=false)=>{
 const root=one(doc.nodes(n=>n.tag==='root'),'careers document'),parents=parentsOf(root),result=[]
 for(const anchor of doc.nodes(n=>n.tag==='a'&&n.attrs.href&&doc.text(n)==='View Openings')){let card=parents.get(anchor);while(card&&!(within(card,n=>n.tag==='h2').length===1&&within(card,n=>n.tag==='a'&&doc.text(n)==='View Openings').length===1))card=parents.get(card)
  if(!card)continue;let hidden=false;for(let current=card;current;current=parents.get(current))hidden=hidden||hiddenEverywhere(current);if(hidden&&!raw)continue
  const title=doc.text(one(within(card,n=>n.tag==='h2'),'native role title')),url=new URL(anchor.attrs.href,SURFACE)
  need(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.hostname.replace(/^www\./,'')==='suntecgroup.com','unqualified native hiring route')
  result.push({title,sourceUrl:url.href,applyUrl:null,detailUrl:url.href,jobId:null,requisitionId:null,inlineDescription:within(card,n=>n.tag==='p').map(n=>doc.text(n)).join(' '),nativeHiddenEverywhere:hidden})
 }
 return result
}
export const extractListings=html=>{
 const head=canonical(html,SURFACE),doc=visible(html)
 need(head.titles.length===1&&/Work with us - SunTec/i.test(head.titles[0]),'employer careers identity');const tree=one(doc.nodes(n=>n.tag==='root'),'careers root'),parents=parentsOf(tree),headings=doc.nodes(n=>/^h[1-3]$/.test(n.tag)&&doc.text(n)==='Current Openings').filter(node=>{for(let n=node;n;n=parents.get(n))if(hiddenEverywhere(n))return false;return true});need(headings.length===1,'visible native openings scope')
 const candidates=readCards(doc),rawDoc=readNativeDocument(html),raw=readCards(rawDoc,true),allUnique=new Map(),activeUnique=new Map(),nativeDisplayLinks=rawDoc.nodes(n=>n.tag==='a'&&n.attrs.href&&rawDoc.text(n)==='View Openings').filter(n=>{try{const url=new URL(n.attrs.href,SURFACE);return url.protocol==='https:'&&url.hostname.replace(/^www\./,'')==='suntecgroup.com'}catch{return false}}).map(n=>new URL(n.attrs.href,SURFACE).href)
 for(const row of raw)allUnique.set(identity(row.title)+'\n'+row.sourceUrl,row)
 for(const row of candidates){const previous=activeUnique.get(row.sourceUrl);need(!previous||identity(previous.title)===identity(row.title),'conflicting native role title for same route');if(!previous)activeUnique.set(row.sourceUrl,row)}
 const jobs=[...activeUnique.values()].map(row=>({...row,rawNativeRoleEvidence:{identityQualified:true,nativeRoleTitle:row.title,nativeAdvertisedRoleUrl:row.sourceUrl,nativeListingExcerpt:row.inlineDescription,applicationRoleIdentityQualified:false,exactLegalEmployerQualified:false,observedEmployerBrand:'SunTec Group'}}))
 need(raw.length>0,'unsupported native role inventory')
 Object.defineProperty(jobs,'nativeListingEvidence',{value:{observedRecordCount:allUnique.size,observedVacancyCount:jobs.length,observedDisplayCardCount:nativeDisplayLinks.length,duplicateDisplayCardCount:nativeDisplayLinks.length-new Set(nativeDisplayLinks).size,nativeAdvertisedDisplayLinks:nativeDisplayLinks,rawSupportedRoleCardCount:raw.length,unqualifiedNativeHiringRecords:[...allUnique.values()].filter(row=>!activeUnique.has(row.sourceUrl)).map(row=>({title:row.title,href:row.sourceUrl,reason:row.nativeHiddenEverywhere?'all-viewport-hidden':'author-CSS-hidden'}))}})
 return jobs
}
export const hasOfficialCareersSignal=html=>{try{extractListings(html);return true}catch{return false}}
export const extractJobDetail=(html,listing)=>{
 const head=canonical(html,listing.detailUrl||listing.sourceUrl),doc=visible(html),body=one(doc.nodes(n=>n.tag==='body'),'native role body'),scope=one(doc.nodes(n=>n.attrs['data-elementor-type']==='single-post'),'native role post'),ids=(body.attrs.class||'').split(/\s+/).filter(value=>/^postid-\d+$/.test(value));need(ids.length===1,'native post identity')
 const id=ids[0].slice(7);need(cls(scope,'post-'+id)&&head.titles.length===1&&identity(head.titles[0])===identity(listing.title+' - SunTec Group'),'native listing/detail employer/role identity contradiction')
 const titleWidget=one(within(scope,n=>n.tag==='span'&&cls(n,'elementor-button-text')&&identity(doc.text(n))===identity(listing.title)),'visible native post title'),title=doc.text(titleWidget);need(identity(title)===identity(listing.title),'native role heading contradiction')
 const description=one(within(scope,n=>cls(n,'elementor-widget-theme-post-content')),'full native JD'),locations=within(scope,n=>/^h[1-6]$/.test(n.tag)).map(n=>doc.text(n).match(/^Location\s*:\s*(.+)$/i)?.[1]).filter(Boolean),countries=within(scope,n=>/^h[1-6]$/.test(n.tag)).map(n=>doc.text(n).match(/^Country\s*:\s*(.+)$/i)?.[1]).filter(Boolean),geo=geography(locations,countries)
 need(geo.workplaceQualified&&doc.text(description).length>100,'ambiguous native workplace or missing full JD')
 const forms=within(scope,n=>n.tag==='form'),bound=forms.filter(form=>form.attrs.action&&new URL(form.attrs.action,listing.sourceUrl).href===listing.sourceUrl)
 return role({...listing,title,company:'SunTec Group',jobId:id,requisitionId:id,sourceUrl:listing.detailUrl||listing.sourceUrl,applyUrl:bound.length===1?listing.sourceUrl:null,location:geo.location,country:geo.country,jobDescription:doc.text(description),rawNativeRoleEvidence:{...listing.rawNativeRoleEvidence,identityQualified:true,nativeDetailTitle:title,nativePostId:id,nativeGeography:geo,nativeDescriptionHtml:rawSlice(html,n=>cls(n,'elementor-widget-theme-post-content')),nativeApplicationForms:bound.map(n=>n.attrs),applicationRoleIdentityQualified:bound.length===1,applicationSubmissionQualified:false,exactLegalEmployerQualified:false,observedEmployerBrand:'SunTec Group'}})
}
export const collect=async({fetchText=nativeFetch,signal,now,maxJobs=null}={})=>{
 signal?.throwIfAborted();const html=await fetchText(SURFACE,{signal});signal?.throwIfAborted();const listings=extractListings(html),selected=Number.isInteger(maxJobs)&&maxJobs>=0?listings.slice(0,maxJobs):listings,jobs=selected.map(row=>role({...row,company:'SunTec Group',sourceUrl:SURFACE,applyUrl:null})),failures=[];let pagesFetched=1
 for(let index=0;index<selected.length;index++){let detail;try{detail=await fetchText(selected[index].detailUrl,{signal});signal?.throwIfAborted();pagesFetched++}catch(error){signal?.throwIfAborted();failures.push({nativeRoleUrl:selected[index].detailUrl,kind:error.code||'native-detail-unavailable',status:error.status??null});break}jobs[index]=extractJobDetail(detail,selected[index])}
 return finish(jobs,{...listings.nativeListingEvidence,pagesFetched,now,failures,nativeEmployerAttributionLimit:'Observed native SunTec Group brand; no legal employer or SunTec-named corporate alias is certified'})
}
