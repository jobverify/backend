import {structure,publicRead,stable,norm,sha} from '../bizongo/publicRead.js'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseRetryAfterHeader} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profiles={
 academoredutech:{name:'Academor',id:'82553226',tenant:'academor',url:'https://www.linkedin.com/company/academor/'},
 amazecodes:{name:'Amazecodes Solutions Pvt Ltd',id:'9482063',tenant:'amazecodes-solutions-pvt-ltd',url:'https://www.linkedin.com/company/amazecodes-solutions-pvt-ltd/',search:'https://www.linkedin.com/jobs/search/?f_C=9482063&geoId=102713980'},
 anaptycodeemy:{name:'Anapty CodeEmy Technologies Pvt. Ltd.™',id:'108095496',tenant:'codeemy',url:'https://in.linkedin.com/company/codeemy',search:'https://www.linkedin.com/jobs/search/?f_C=108095496&geoId=102713980'},
 campussutra:{name:'Campus Sutra',id:'3032227',tenant:'campus-sutra',url:'https://in.linkedin.com/company/campus-sutra',search:'https://www.linkedin.com/jobs/search/?f_C=3032227&geoId=102713980'},
}
const nativeProfileURL=(value,config)=>{
 try{const url=new URL(value);return url.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(url.hostname)&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&['/company/'+config.tenant,'/company/'+config.tenant+'/'].includes(url.pathname)}catch{return false}
}
const aliases=config=>['www.linkedin.com','in.linkedin.com'].flatMap(host=>['','/'].map(end=>'https://'+host+'/company/'+config.tenant+end))
const gap=(surface,reason)=>({status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason})
const failure=(source,message,status=null)=>Object.assign(Error(source+': '+message),{source,status,abortRetries:true,softFailure:true,upstreamOutage:[401,403,429,999].includes(status),failureKind:[401,403,429,999].includes(status)?'blocked_or_access_denied':'source_inventory_unavailable',inventoryEvidence:gap(profiles[source].url,message)})
const requireNative=(value,source,message)=>{if(!value)throw failure(source,message)}
const header=(headers,name)=>typeof headers?.get==='function'?headers.get(name):Object.entries(headers||{}).find(([key])=>key.toLowerCase()===name)?.[1]??null
const cancel=body=>{try{Promise.resolve(body?.cancel?.()).catch(()=>{})}catch{}}

export function inspectConfiguredLinkedInProfile(source,html){
 const config=profiles[source];requireNative(config,source,'unreviewed source identity')
 const s=structure(html),schemas=s.visible(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').flatMap(node=>{
  let value;try{value=JSON.parse(node.raw)}catch{throw failure(source,'malformed current employer schema')}
  return[value,...(Array.isArray(value['@graph'])?value['@graph']:[])]
 }),organizations=schemas.filter(node=>node['@type']==='Organization'&&node.name===config.name&&nativeProfileURL(node.url,config))
 requireNative(organizations.length===1&&s.visible(node=>node.tag==='h1'&&norm(s.text(node))===config.name).length===1,source,'current configured native employer identity changed')
 const org=organizations[0],ids=[]
 for(const node of s.visible(node=>node.tag==='a'&&node.attrs.href))try{
  const outer=new URL(node.attrs.href);if(outer.protocol!=='https:'||!['www.linkedin.com','in.linkedin.com'].includes(outer.hostname)||outer.port)continue
  const redirect=outer.searchParams.get('session_redirect');if(!redirect)continue
  const target=new URL(redirect);if(target.protocol!=='https:'||!['www.linkedin.com','in.linkedin.com'].includes(target.hostname)||target.port||target.pathname!=='/search/results/people/')continue
  const values=JSON.parse(target.searchParams.get('facetCurrentCompany'));if(Array.isArray(values))ids.push(...values.map(String))
 }catch{ /* Public employee-facet references are read as identity data only. */ }
 requireNative(ids.length>0&&ids.every(value=>value===config.id),source,'current native organization ID is unqualified or conflicting')
 const commentary=node=>!s.active(node)||node.tag==='script'?'':node.tag==='br'?'\n':node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):commentary(child)).join('')
 const servedPosts=s.visible(node=>node.attrs['data-test-id']==='main-feed-activity-card__commentary').map(node=>norm(commentary(node)))
 const nativeAnnouncements=schemas.filter(node=>node['@type']==='SocialMediaPosting').map(post=>{
  let url;try{url=new URL(post.url)}catch{throw failure(source,'invalid native announcement URL')}
  const id=url.pathname.match(new RegExp('^/posts/'+config.tenant+'_[^/]+-activity-(\\d+)-[^/]+$'))?.[1]
  requireNative(url.origin==='https://www.linkedin.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&id&&post.mainEntityOfPage===post.url,source,'native public announcement identity changed')
  requireNative(post.author?.['@type']==='Organization'&&post.author.name===config.name&&nativeProfileURL(post.author.url,config),source,'native public announcement employer changed')
  requireNative(typeof post.text==='string'&&post.text.trim()&&typeof post.datePublished==='string'&&Number.isFinite(Date.parse(post.datePublished)),source,'native public announcement text/date unqualified')
  return{kind:'native-public-employer-announcement',nativeAnnouncementId:id,sourceUrl:post.url,originalText:post.text,originalTextSHA256:sha(post.text),announcementPublishedAt:post.datePublished,
   hiringSignal:/\b(?:hiring|we are looking for|we['’]re looking for)\b/i.test(post.text),nativeTextParity:servedPosts.includes(norm(post.text)),nativeTextQualification:'served-announcement-schema-and-markup;not-a-verified-full-native-job-description',
   jobId:null,requisitionId:null,jobPostingDate:null,country:null,jobDescription:null,fullNativeJobDescriptionQualified:false,applicationActionPerformed:false}
 })
 requireNative(nativeAnnouncements.length<=100&&new Set(nativeAnnouncements.map(row=>row.nativeAnnouncementId)).size===nativeAnnouncements.length,source,'duplicate or excessive native announcement identities')
 const activeJobsLinks=s.visible(node=>node.tag==='a'&&node.attrs.href).flatMap(node=>{try{const url=new URL(node.attrs.href);return url.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(url.hostname)&&!url.port&&(/^\/jobs\/view\//.test(url.pathname)||url.searchParams.get('f_C')===config.id)?[{url:url.href,label:s.text(node)}]:[]}catch{return[]}})
 const employerIdentity={name:org.name,organizationId:config.id,profileURL:org.url,publishedWebsite:org.sameAs??null}
 return{nativeOrganizationId:config.id,employerIdentity,originalNativeOrganization:org,nativeAnnouncements,activeJobsLinks,model:{employerIdentity,nativeAnnouncements:[...nativeAnnouncements].sort((a,b)=>a.nativeAnnouncementId.localeCompare(b.nativeAnnouncementId)),activeJobsLinks:[...activeJobsLinks].sort((a,b)=>a.url.localeCompare(b.url))}}
}

export function inspectConfiguredLinkedInSearch(source,html){
 const config=profiles[source],s=structure(html),forms=s.visible(node=>node.tag==='form'&&node.attrs.id==='jserp-filters')
 requireNative(forms.length===1&&forms[0].attrs.action==='https://www.linkedin.com/jobs/search/'&&(!forms[0].attrs.method||forms[0].attrs.method.toLowerCase()==='get'),source,'published native search filter form changed')
 // A selected company checkbox stays part of this GET request while its
 // dropdown is collapsed. This is submitted request state, not JD visibility.
 const owner=node=>{if(Object.hasOwn(node.attrs,'form'))return node.attrs.form==='jserp-filters';for(let parent=s.parents.get(node);parent;parent=s.parents.get(parent))if(parent.tag==='form')return parent===forms[0];return false}
 const disabled=node=>{for(let parent=node;parent;parent=s.parents.get(parent))if((parent===node||parent.tag==='fieldset')&&Object.hasOwn(parent.attrs,'disabled'))return true;return false}
 const successful=node=>node.tag==='input'&&owner(node)&&!disabled(node)&&(!['checkbox','radio'].includes(node.attrs.type)||Object.hasOwn(node.attrs,'checked'))
 const values=name=>[...new Set(s.nodes.filter(node=>successful(node)&&node.attrs.name===name).map(node=>node.attrs.value??''))]
 const keywordValues=values('keywords'),nativeCompanyFilters=values('f_C'),nativeGeographyFilters=values('geoId'),nativeHeadings=s.visible(node=>['h1','title'].includes(node.tag)).map(node=>s.text(node))
 const cards=s.visible(node=>/^urn:li:jobPosting:\d+$/.test(node.attrs['data-entity-urn']||'')).map(node=>({nativePostingId:node.attrs['data-entity-urn'].slice('urn:li:jobPosting:'.length),originalServedText:s.text(node)}))
 requireNative(cards.length<=1000&&new Set(cards.map(row=>row.nativePostingId)).size===cards.length,source,'duplicate or excessive unqualified native job cards')
 return{keywordValues,nativeCompanyFilters,nativeGeographyFilters,nativeHeadings,unexpectedKeywordRestriction:keywordValues.some(value=>value!==''),employerFilterBound:nativeCompanyFilters.length===1&&nativeCompanyFilters[0]===config.id,geographyFilterBound:nativeGeographyFilters.length===1&&nativeGeographyFilters[0]==='102713980',observedJobCardCount:cards.length,unqualifiedNativeCards:cards,nativeVacancyTotal:null,nativeIndiaTotal:null,qualification:'configured-guest-search-observation;unwanted-keyword-or-unreviewed-native-inventory-never-proves-employer-zero'}
}

export function createCurrentLinkedInProfileScraper(source,defaults={}){
 const config=profiles[source];if(!config)throw Error('Unreviewed configured LinkedIn source')
 return{async run(passed={}){
  const options={...defaults,...passed},caller=options.signal,budget=options.collectionBudgetMs??options.timeoutMs??90000,requestBudget=options.requestTimeoutMs??20000
  if(!Number.isSafeInteger(budget)||budget<1||budget>300000||!Number.isSafeInteger(requestBudget)||requestBudget<1||requestBudget>30000)throw TypeError('Invalid current guest source bound')
  caller?.throwIfAborted()
  const allowed=new Set([...aliases(config),...(config.search?[config.search]:[])]),denied=new Map(),transport=options.fetchPage??options.fetchText??options.fetchImpl??globalThis.fetch
  const fetchPage=async(url,request)=>{
   requireNative(allowed.has(url),source,'undeclared source route is not an authorized public read')
   const host=new URL(url).hostname;if(denied.has(host))throw denied.get(host)
   const signal=AbortSignal.any([request.signal,AbortSignal.timeout(requestBudget)]),supplied=options.fetchPage||options.fetchText
   let response
   try{response=await withCallerSignal(()=>transport(url,{...request,signal:supplied?(caller??signal):signal}),signal)}catch(error){if(caller?.aborted)throw caller.reason;if([401,403,429,999].includes(error?.status)){const retained=Object.isExtensible(error)?error:failure(source,'current guest public access denied',error.status);Object.assign(retained,{source,abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied',inventoryEvidence:gap(config.url,'current guest public access denied')});if(Number.isFinite(error.retryDelayMs))retained.retryDelayMs=error.retryDelayMs;denied.set(host,retained);throw retained}throw error}
   requireNative(Number.isInteger(response?.status)&&typeof response.url==='string'&&allowed.has(response.url),source,'public response HTTP status/final URL identity unavailable')
   const status=response.status,headers=new Headers(response.headers||{})
   if([401,403,429,999].includes(status)){const error=failure(source,'current guest public access denied HTTP '+status,status),retry=parseRetryAfterHeader(header(response.headers,'retry-after'));if(retry!=null)error.retryDelayMs=retry;denied.set(host,error);cancel(response.body);throw error}
   if([301,302,303,307,308].includes(status)){cancel(response.body);return{url:response.url,status,headers,html:''}}
   if(status!==200){cancel(response.body);throw failure(source,'current configured public HTTP '+status,status)}
   let html=response.html??(typeof response.body==='string'?response.body:undefined)
   if(html===undefined&&typeof response.body?.getReader==='function'){
    const reader=response.body.getReader(),chunks=[];let size=0
    try{while(true){const value=await withCallerSignal(()=>reader.read(),signal);if(value.done)break;size+=value.value.byteLength;requireNative(size<=4*1024*1024,source,'public body exceeds source byte bound');chunks.push(Buffer.from(value.value))}html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));reader.releaseLock()}finally{cancel(reader)}
   }else if(html===undefined&&typeof response.text==='function')html=await withCallerSignal(()=>response.text(),signal)
   requireNative(typeof html==='string'&&Buffer.byteLength(html)<=4*1024*1024,source,'public body missing or exceeds source byte bound')
   return{url:response.url,status,headers,html}
  }
  return publicRead({source,company:config.name},{...options,fetchPage,fetchText:undefined,fetchImpl:undefined,collectionBudgetMs:budget,onAudit:report=>options.onAudit?.({...report,publicPages:report.publicPages.map(({html,...receipt})=>receipt)})},async({read,stamp,audit,publicPages})=>{
   const snapshot=async phase=>{
    const profile=inspectConfiguredLinkedInProfile(source,await read(config.url,{phase,allowedFinalUrls:aliases(config)}))
    let search=null
    if(config.search)try{search=inspectConfiguredLinkedInSearch(source,await read(config.search,{phase}))}catch(error){if(caller?.aborted)throw caller.reason;await audit({...profile,configuredSearch:null,nativeQueryFailure:{status:error.status??null,failureKind:error.failureKind??null},inventoryEvidence:error.inventoryEvidence??gap(config.url,'configured native query unavailable'),closingReconciled:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false});throw error}
    return{profile,search}
   }
   const first=await snapshot('opening'),last=await snapshot('closing'),closingReconciled=stable([first.profile.model,first.search])===stable([last.profile.model,last.search]),evidence={...gap(config.url,config.search?'configured-company-guest-search-has-unqualified-or-unwanted-keyword-scope;native-announcements-are-not-complete-vacancy-inventory':'configured-native-company-profile-without-published-employer-job-inventory'),verifiedAt:stamp(),pagesFetched:publicPages.length}
   await audit({...first.profile,configuredSearch:first.search,closingReconciled,inventoryEvidence:evidence,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
   requireNative(closingReconciled,source,'closing native employer/announcement/search model changed')
   requireNative(!first.profile.activeJobsLinks.length,source,'current public employer job handoff requires a reviewed native collector')
   if(first.search)requireNative(first.search.employerFilterBound&&first.search.geographyFilterBound&&!first.search.observedJobCardCount,source,'unqualified current native search scope/cards require a reviewed vacancy collector')
   const jobs=attachInventoryEvidence([],evidence)
   return attachSourceObservationEvidence(jobs,{source,recordKind:'hiring-signals',observedRecordCount:1+first.profile.nativeAnnouncements.length,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  })
 }}
}
