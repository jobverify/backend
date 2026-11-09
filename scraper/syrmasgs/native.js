export const SOURCE="syrmasgs",SURFACE="https://syrmasgs.com/job-listing/",COMPANY="Syrma SGS"

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

import {parse} from 'acorn'
import {SYRMA_SGS_CATALOG} from './catalog.js'
export const LIFE=SYRMA_SGS_CATALOG.lifeAtUrl
const identity=value=>norm(value).replace(/[\u2012-\u2015]/g,'-').toLowerCase()
export const extractOfficialJobsUrl=html=>{const doc=visible(html),urls=[...new Set(doc.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,LIFE).href===SURFACE).map(n=>new URL(n.attrs.href,LIFE).href))];return urls.length===1?urls[0]:null}
export const hasOfficialLifeAtSignal=html=>{try{const head=canonical(html,LIFE,{required:false}),doc=visible(html);return head.titles.length===1&&head.titles[0]==='Life at SyrmaSGS - Syrma SGS'&&doc.nodes(n=>/^h[1-4]$/.test(n.tag)&&/Careers at Syrma SGS/.test(doc.text(n))).length>0&&extractOfficialJobsUrl(html)===SURFACE}catch{return false}}
const detailURL=value=>{const url=new URL(value,SURFACE);need(url.origin===new URL(SURFACE).origin&&!url.search&&!url.hash&&/^\/jobs\/[^/]+\/$/.test(url.pathname),'unqualified native role URL');return url.href}
export const extractJobCards=html=>{
 const head=canonical(html,SURFACE,{required:false}),doc=visible(html),cards=doc.nodes(n=>n.tag==='a'&&n.attrs.href&&/More Details/.test(doc.text(n))&&within(n,c=>cls(c,'awsm-job-post-title')).length===1),seen=new Map(),jobs=[]
 need(head.titles.length===1&&head.titles[0]==='Job Listing - Syrma SGS'&&cards.length>0,'employer jobs identity or unsupported empty native inventory')
 for(const card of cards){const title=doc.text(one(within(card,n=>cls(n,'awsm-job-post-title')),'native role title')),url=detailURL(card.attrs.href);if(seen.has(url)){need(identity(seen.get(url))===identity(title),'conflicting duplicate native role title');continue}seen.set(url,title);jobs.push({title,sourceUrl:url,applyUrl:url,jobId:null,requisitionId:null,rawNativeRoleEvidence:{identityQualified:true,nativeRoleTitle:title,nativeAdvertisedRoleUrl:url,exactLegalEmployerQualified:false}})}
 return jobs
}
export const hasOfficialJobsPageSignal=html=>{try{extractJobCards(html);return true}catch{return false}}
const strictJSON=text=>{
 let value,ast;try{value=JSON.parse(text);ast=parse('('+text+')',{ecmaVersion:'latest'})}catch{need(false,'invalid native JobPosting JSON')}
 const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='ObjectExpression'){const keys=node.properties.map(property=>property.key.value??property.key.name);need(new Set(keys).size===keys.length,'duplicate native JobPosting fields')}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)};walk(ast);return value
}
const nativeDate=value=>{
 need(typeof value==='string','non-string native role publication/closing date');const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/)
 need(match,'invalid native role date format');const [,y,m,d,h,min,s]=match.map((value,index)=>index&&index<7?Number(value):value),days=new Date(Date.UTC(y,m,0)).getUTCDate()
 need(y>=1900&&m>=1&&m<=12&&d>=1&&d<=days&&h<24&&min<60&&s<60&&!Number.isNaN(+new Date(value)),'invalid native role calendar date');return value
}
const schemaFor=(html,title,description)=>{
 const doc=readNativeDocument(html),schemas=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>strictJSON(n.raw)).filter(value=>value&&value['@type']==='JobPosting'),schema=one(schemas,'native JobPosting')
 need(identity(schema.title)===identity(title)&&typeof schema.description==='string','native JobPosting role identity conflict')
 const schemaText=visible(schema.description),schemaBody=one(schemaText.nodes(n=>n.tag==='root'),'schema description')
 need(identity(schemaText.text(schemaBody))===identity(description),'rendered/native JobPosting description contradiction')
 return schema
}
export const extractJobDetail=(html,listing)=>{
 const url=detailURL(listing.sourceUrl),head=canonical(html,url),doc=visible(html),body=one(doc.nodes(n=>n.tag==='body'),'native role body'),ids=(body.attrs.class||'').split(/\s+/).filter(value=>/^postid-\d+$/.test(value));need(ids.length===1,'ambiguous native post ID');const id=ids[0].slice(7),article=one(doc.nodes(n=>n.tag==='article'&&n.attrs.id==='post-'+id&&cls(n,'awsm_job_openings')&&cls(n,'status-publish')),'published native role article')
 const title=doc.text(one(within(article,n=>n.tag==='h1'&&cls(n,'entry-title')),'native role title'));need(identity(title)===identity(listing.title)&&head.titles.length===1&&identity(head.titles[0])===identity(title+' - Syrma SGS'),'listing/detail role identity contradiction')
 const description=one(within(article,n=>cls(n,'awsm-job-entry-content')),'full native JD'),text=doc.text(description),schema=schemaFor(html,title,text),locations=[],countries=[]
 for(const node of within(description,n=>['p','li','td','strong'].includes(n.tag))){const line=doc.text(node),location=line.match(/^Location\s*:\s*-?\s*(.+)$/i),country=line.match(/^Country\s*:\s*(.+)$/i);if(location&&line.length<160)locations.push(location[1]);if(country&&line.length<160)countries.push(country[1])}
 for(const node of within(article,n=>cls(n,'awsm-job-specification-item'))){const label=doc.text(node);if(/^Job Location\s*:/i.test(label))locations.push(label.replace(/^Job Location\s*:\s*/i,''));if(/^Country\s*:/i.test(label))countries.push(label.replace(/^Country\s*:\s*/i,''))}
 if(schema.jobLocation){need(schema.jobLocation['@type']==='Place'&&schema.jobLocation.address,'unsupported native role location schema');const address=schema.jobLocation.address;if(typeof address==='string')locations.push(address);else{need(address&&typeof address==='object','invalid native role address');if(address.addressLocality)locations.push(address.addressLocality);if(address.addressCountry){need(typeof address.addressCountry==='string','unsupported native role country schema');countries.push(address.addressCountry)}}}
 const geo=geography(locations,countries);need(geo.workplaceQualified,'conflicting native role workplaces');const form=one(within(article,n=>n.tag==='form'&&n.attrs.id==='awsm-application-form'),'same-role application form'),formIds=within(form,n=>n.tag==='input'&&/^(?:awsm_job_id|job_id|awsm_job_post_id)$/.test(n.attrs.name||'')).map(n=>n.attrs.value)
 need(formIds.every(value=>value===id),'native application/post ID contradiction');need(within(form,n=>n.tag==='input'&&n.attrs.type==='file').length===1,'native resume control missing')
 return role({...listing,title,jobId:id,requisitionId:id,location:geo.location,country:geo.country,employmentType:schema.employmentType||null,postingDate:nativeDate(schema.datePosted),closingDate:schema.validThrough==null?null:nativeDate(schema.validThrough),jobDescription:text,rawNativeRoleEvidence:{...listing.rawNativeRoleEvidence,identityQualified:true,nativePostId:id,nativeDetailTitle:title,nativeGeography:geo,nativeDescriptionHtml:rawSlice(html,n=>cls(n,'awsm-job-entry-content')),nativeJobPosting:schema,nativeDatePosted:schema.datePosted,applicationRoleIdentityQualified:true,applicationSubmissionQualified:false,exactLegalEmployerQualified:false}})
}
export const collect=async({fetchText=nativeFetch,signal,now}={})=>{
 signal?.throwIfAborted();const life=await fetchText(LIFE,{signal});need(hasOfficialLifeAtSignal(life),'official employer life/careers handoff');const html=await fetchText(SURFACE,{signal}),listings=extractJobCards(html),jobs=listings.map(row=>role(row)),failures=[];let pagesFetched=2
 for(let index=0;index<listings.length;index++){let detail;try{detail=await fetchText(listings[index].sourceUrl,{signal});signal?.throwIfAborted();pagesFetched++}catch(error){signal?.throwIfAborted();failures.push({nativeRoleUrl:listings[index].sourceUrl,kind:error.code||'native-detail-unavailable',status:error.status??null});break}jobs[index]=extractJobDetail(detail,listings[index])}
 return finish(jobs,{observedVacancyCount:listings.length,pagesFetched,now,failures,nativeObservedRoleUrls:listings.map(job=>job.sourceUrl),nativeDateQualification:'Explicit same-role first-party JobPosting datePosted retained; dates are not a current inventory count'})
}
