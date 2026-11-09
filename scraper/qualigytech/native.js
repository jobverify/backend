export const SOURCE="qualigytech",SURFACE="https://www.qualigytech.com/careers/",COMPANY="Qualigy Tech"

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

export const HOME='https://www.qualigytech.com/',CAREERS=SURFACE,ARCHIVE='https://www.qualigytech.com/jobs/'
const identity=value=>norm(value).replace(/[\u2012-\u2015]/g,'-').toLowerCase()
const validate=(html,url,title)=>{const head=canonical(html,url,{required:false});need(head.titles.length===1&&title.test(head.titles[0]),'native employer/page identity');return visible(html)}
export const hasOfficialHomepageSignal=html=>{try{const doc=validate(html,HOME,/^QualigyTech\s*[\u2012-\u2015-]\s*Empowering Through Innovation$/);return doc.nodes(n=>n.tag==='a'&&n.attrs.href===CAREERS).length>0}catch{return false}}
export const extractCurrentCards=html=>{
 const doc=validate(html,CAREERS,/^Careers \| QualigyTech$/),root=one(doc.nodes(n=>n.tag==='root'),'careers root'),parents=parentsOf(root),markers=doc.nodes(n=>n.tag==='h2'&&/^(?:Onsite )?Featured Openings$/.test(doc.text(n))),order=new Map(doc.nodes(()=>true).map((node,index)=>[node,index])),jobs=[],discovery=[],seenNodes=new Set(),seenDisplay=new Set();let observedDisplayCount=0
 need(markers.length===2,'current native Featured/Onsite openings scopes')
 for(const marker of markers){const next=doc.nodes(n=>n.tag==='h2'&&order.get(n)>order.get(marker))[0]
  for(const heading of doc.nodes(n=>n.tag==='h3'&&order.get(n)>order.get(marker)&&(!next||order.get(n)<order.get(next)))){let card=parents.get(heading);while(card&&!(cls(card,'et_pb_text_inner')&&within(card,n=>n.tag==='h3').length===1))card=parents.get(card);if(!card||seenNodes.has(card))continue;seenNodes.add(card)
   const title=doc.text(heading),paragraphs=within(card,n=>n.tag==='p').map(n=>doc.text(n)),text=doc.text(card);if(!paragraphs.some(value=>/^Responsibilities\s*:/i.test(value))){discovery.push({title,text,reason:'unqualified-current-card-kind'});continue}
   observedDisplayCount++;const carrierShape=node=>typeof node==='string'?node:node.inert?null:{tag:node.tag,attrs:node.attrs,children:node.children.map(carrierShape).filter(value=>value!==null)},displayKey=doc.text(marker)+'\n'+JSON.stringify(carrierShape(card));if(seenDisplay.has(displayKey))continue;seenDisplay.add(displayKey)
   const locations=paragraphs.map(value=>value.match(/^(?:Work |Job )?Location\s*:\s*(.+)$/i)?.[1]).filter(Boolean),countries=paragraphs.map(value=>value.match(/^Country\s*:\s*(.+)$/i)?.[1]).filter(Boolean),geo=geography(locations,countries)
   jobs.push(role({title,sourceUrl:CAREERS,applyUrl:CAREERS,location:geo.location,country:geo.country,rawNativeRoleEvidence:{identityQualified:false,nativeRoleObservationQualified:true,nativeCurrentHiringGroup:doc.text(marker),nativeCurrentCardTitle:title,nativeRoleText:text,nativeGeography:geo,unqualifiedNativeDescription:text,fullJobDescriptionQualified:false,nativeRequisitionIdentityQualified:false,applicationRoleIdentityQualified:false,applicationSubmissionQualified:false,exactLegalEmployerQualified:false,qualificationLimit:'Current role card only; no native ID or detail/application identity links this card to a legacy post with the same title'}}))
  }
 }
 need(jobs.length>0,'unsupported current native role cards');Object.defineProperty(jobs,'nativeCardDiscovery',{value:discovery});Object.defineProperty(jobs,'nativeObservedDisplayCount',{value:observedDisplayCount});return jobs
}
export const hasOfficialCareersPageSignal=html=>{try{extractCurrentCards(html);return true}catch{return false}}
const detailURL=value=>{const url=new URL(value,SURFACE);need(url.origin===new URL(SURFACE).origin&&!url.search&&!url.hash&&/^\/jobs\/[a-z0-9-]+\/$/.test(url.pathname),'unqualified native role URL');return url.href}
export const extractArchiveListings=html=>{
 const doc=validate(html,ARCHIVE,/^Jobs \| QualigyTech$/),root=one(doc.nodes(n=>n.tag==='root'),'archive root'),parents=parentsOf(root),titleLink=node=>{for(let p=parents.get(node);p;p=parents.get(p))if(p.tag==='a')return p;return null},titles=doc.nodes(n=>cls(n,'job-title')).filter(n=>{const link=titleLink(n);return link?.attrs.href&&/^https:\/\/www\.qualigytech\.com\/jobs\/[^/]+\/$/.test(link.attrs.href)}),jobs=[],seen=new Map()
 need(titles.length>0,'unsupported empty native archive')
 for(const heading of titles){let card=parents.get(heading);while(card&&!(within(card,n=>cls(n,'job-title')).length===1&&within(card,n=>/^sjb_less_content_\d+$/.test(n.attrs.id||'')).length===1))card=parents.get(card)
  need(card,'unbound native role card');const title=doc.text(heading),excerpt=one(within(card,n=>/^sjb_less_content_\d+$/.test(n.attrs.id||'')),'native role excerpt'),url=detailURL(titleLink(heading).attrs.href),id=excerpt.attrs.id.match(/\d+$/)[0]
  need(within(card,n=>n.tag==='a'&&/^Read More$/i.test(doc.text(n))).every(n=>detailURL(n.attrs.href)===url),'native card title/detail route contradiction')
  if(seen.has(url)){need(identity(seen.get(url))===identity(title),'conflicting duplicate native role title');continue}seen.set(url,title)
  const locations=within(card,n=>cls(n,'job-location')).map(n=>doc.text(n));for(const node of within(excerpt,n=>['strong','p'].includes(n.tag))){const value=doc.text(node).match(/^Job\s+location\s*:\s*([^:]+)$/i);if(value&&!/Responsibilities|\.\.\./.test(value[1]))locations.push(value[1])}
  const geo=geography(locations)
  jobs.push({title,sourceUrl:url,applyUrl:url,jobId:id,requisitionId:id,location:geo.location,country:null,rawNativeRoleEvidence:{identityQualified:true,nativeAdvertisedRoleUrl:url,nativeRoleTitle:title,nativePostId:id,nativeListingWorkplaceStatements:locations,nativeListingExcerpt:doc.text(excerpt),exactLegalEmployerQualified:false}})
 }
 return jobs
}
export const hasOfficialJobsArchiveSignal=html=>{try{extractArchiveListings(html);return true}catch{return false}}
export const extractJobDetail=(html,listing)=>{
 const url=detailURL(listing.sourceUrl),doc=validate(html,url,/\| QualigyTech$/),scope=one(doc.nodes(n=>cls(n,'sjb-detail')),'native role detail'),title=doc.text(one(within(scope,n=>n.tag==='h2'),'native role heading')),body=one(doc.nodes(n=>n.tag==='body'),'native role body'),postIds=(body.attrs.class||'').split(/\s+/).filter(value=>/^postid-\d+$/.test(value))
 need(identity(title)===identity(listing.title),'listing/detail role title contradiction');need(postIds.length===1,'ambiguous native post identity');const id=postIds[0].slice(7)
 const form=one(within(scope,n=>n.tag==='form'&&n.attrs.id==='sjb-application-form'),'native role application form'),formIds=(form.attrs.class||'').split(/\s+/).filter(value=>/^sjb-job-\d+$/.test(value))
 need(formIds.length===1&&formIds[0]==='sjb-job-'+id&&(!listing.jobId||listing.jobId===id),'native listing/detail/application identity contradiction')
 need(within(form,n=>n.tag==='input'&&n.attrs.type==='file'&&n.attrs.name==='applicant_resume').length===1,'native application resume control changed')
 const description=one(within(scope,n=>cls(n,'job-description')),'full native JD'),locations=within(scope,n=>cls(n,'job-location')).map(n=>doc.text(n)),countries=[]
 for(const node of within(description,n=>['p','strong'].includes(n.tag))){const text=doc.text(node),location=text.match(/^Job\s+location\s*:\s*(.+)$/i),country=text.match(/^Country\s*:\s*(.+)$/i);if(location)locations.push(location[1]);if(country)countries.push(country[1])}
 locations.push(...(listing.rawNativeRoleEvidence?.nativeListingWorkplaceStatements||[]));const geo=geography(locations,countries);need(geo.workplaceQualified,'conflicting native listing/detail workplaces')
 need(doc.text(description).length>100,'missing native full JD')
 return role({...listing,title,jobId:id,requisitionId:id,location:geo.location,country:geo.country,employmentType:within(scope,n=>cls(n,'job-type')).map(n=>doc.text(n))[0]||null,jobDescription:doc.text(description),rawNativeRoleEvidence:{...listing.rawNativeRoleEvidence,identityQualified:true,nativeDetailTitle:title,nativePostId:id,nativeDescriptionHtml:rawSlice(html,n=>cls(n,'job-description')),nativeGeography:geo,nativeRelativePostedDate:within(scope,n=>cls(n,'job-date')).map(n=>doc.text(n)),applicationRoleIdentityQualified:true,applicationSubmissionQualified:false,exactLegalEmployerQualified:false}})
}
export const hasOfficialJobDetailSignal=(html,url)=>{try{const doc=validate(html,url,/\| QualigyTech$/);return doc.nodes(n=>n.tag==='form'&&n.attrs.id==='sjb-application-form').length===1}catch{return false}}
export const collect=async({fetchText=nativeFetch,signal,now}={})=>{
 signal?.throwIfAborted();const home=await fetchText(HOME,{signal});need(hasOfficialHomepageSignal(home),'official homepage identity/handoff');const careers=await fetchText(CAREERS,{signal}),jobs=extractCurrentCards(careers),failures=jobs.map(job=>({nativeRoleTitle:job.title,kind:'native-current-card-detail-identity-unqualified'})),legacyNativeSnapshots=[];let pagesFetched=2,html
 try{html=await fetchText(ARCHIVE,{signal});signal?.throwIfAborted();pagesFetched++}catch(error){signal?.throwIfAborted();failures.push({kind:error.code||'legacy-native-archive-unavailable',status:error.status??null})}
 if(html){try{const listings=extractArchiveListings(html);for(const listing of listings){let detail;try{detail=await fetchText(listing.sourceUrl,{signal});signal?.throwIfAborted();pagesFetched++}catch(error){signal?.throwIfAborted();failures.push({nativeRoleId:listing.jobId,kind:error.code||'legacy-native-snapshot-unavailable',status:error.status??null});break}legacyNativeSnapshots.push({...extractJobDetail(detail,listing),observationQualification:'Separate legacy WP snapshot; relationship to current careers cards is unqualified'})}}catch(error){signal?.throwIfAborted();failures.push({kind:'legacy-native-snapshot-qualification-failed',message:error.message})}}
 return finish(jobs,{observedRecordCount:jobs.nativeObservedDisplayCount,observedVacancyCount:jobs.length,pagesFetched,now,failures,duplicateNativeDisplayCopies:jobs.nativeObservedDisplayCount-jobs.length,unqualifiedCurrentCardRecords:jobs.nativeCardDiscovery,legacyNativeSnapshots,legacyNativeSnapshotCount:legacyNativeSnapshots.length,crossEraDistinctVacancyCount:null,rawProvenanceLimit:'Current card observations and separately attributed legacy snapshots. Equal titles do not bind their workplace, JD, application or requisition IDs. No combined distinct vacancy total, legal employer or company/India inventory is certified.'})
}
