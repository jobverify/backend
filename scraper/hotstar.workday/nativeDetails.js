import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {extractWorkdayStructuredDetail,buildWorkdayDetailApiUrl} from '../../scraper-support/myworkday/engine.js'
import {mapWithConcurrency} from '../../scraper-support/utils/mapWithConcurrency.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createRecruitmentObservationAccounting} from '../../scraper-support/utils/recruitmentObservationAccounting.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

export const PORTFOLIO_URL='https://www.jiostar.com/portfolio/'
const LEGAL_EMPLOYER='7018 Jiostar India Private Limited'
const sha=value=>createHash('sha256').update(value).digest('hex')
const hold=message=>{throw Object.assign(new Error('[hotstar] '+message),{abortRetries:true,softFailure:true,failureKind:'coverage_gap'})}
const requireValue=(ok,message)=>{if(!ok)hold(message)}
const text=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const words=value=>text(value).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]
const foreignWrittenCountries=[]
const countryNames=new Set()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const name=nativeCountryName(String.fromCharCode(a,b))
 if(name&&name!=='India'&&!countryNames.has(name)){countryNames.add(name);foreignWrittenCountries.push(words(name))}
}
const namesForeignCountry=label=>{
 const tokens=words(label)
 return foreignWrittenCountries.some(country=>tokens.some((_,at)=>country.every((word,index)=>tokens[at+index]===word)))
}
const ownHotstarRole=value=>{
 const canonical=text(value).normalize('NFKC')
 const normalized=canonical.replace(/[^\p{L}\p{N}'’]+/gu,' ')
 if(/\b(?:not|never|without|excluding)\s+(?:an?\s+)?(?:(?:for|at|part of)\s+)?Jio\s*Hotstar\b/i.test(normalized))return false
 // A declared named role for another brand cannot be reassigned merely
 // because it discusses collaboration with Hotstar in the same description.
 for(const match of canonical.matchAll(/\bthis\s+(?:(?:role|position|vacancy)\s+)?is\s+(?:a|an)\s+([a-z][a-z0-9&'-]*(?:\s+[a-z][a-z0-9&'-]*){0,4}?)\s+(?:role|position|vacancy)\b/gi))
  if(!/^(?:Jio\s*Hotstar|individual contributor|high-impact leadership|hands-on)$/i.test(match[1]))return false
 for(const match of canonical.matchAll(/\b(?:this|the)\s+(?:role|position|vacancy)\s+is\s+(?:for|at|within)\s+([^.!?;:]+)/gi))
  if(!/^(?:the\s+)?Jio\s*Hotstar\b/i.test(match[1].trim()))return false
 // Collaboration names the counterparty, not the brand owning this vacancy.
 const ownCriteria=canonical.split(/(?<=[.!?;])\s+/).filter(sentence=>
  !/\b(?:collaborat\w*|partner\w*|work\w*|liais\w*|cooperat\w*)\b[^.!?;]{0,100}\bwith\s+(?:the\s+)?Jio\s*Hotstar\b/i.test(sentence)).join(' ')
 return /\bJio\s*Hotstar(?:['’]s\b|\s+(?:is|are|feels|business|Entertainment|streams|tech|Scale|Ad Platform)\b)|\b(?:at|for|across|within|of|on)\s+(?:the\s+)?Jio\s*Hotstar\b|\b(?:evangelize|positioning|make|building|build|influence|shape|support|drive|reinvent|improve|scale|enhance)\b[^.!?]{0,140}\bJio\s*Hotstar\b/i.test(ownCriteria)
}
const wait=(operation,signal,dispose)=>new Promise((resolve,reject)=>{
 let done=false
 const abort=()=>{if(!done){done=true;signal.removeEventListener('abort',abort);reject(signal.reason)}}
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>{
  if(done||signal.aborted){abort();try{Promise.resolve(dispose?.(value)).catch(()=>{})}catch{};return}
  done=true;signal.removeEventListener('abort',abort);resolve(value)
 },error=>{if(!done){done=true;signal.removeEventListener('abort',abort);reject(error)}})
})

const corporateBrandBinding=(page,board)=>{
 const d=readNativeDocument(page.html)
 const mains=d.nodes(n=>n.attrs.id==='main-content'&&n.attrs.role==='main')
 requireValue(mains.length===1&&d.nodes(n=>/^h[1-6]$/.test(n.tag)&&d.text(n)==='Portfolio',mains[0]).length===1,
  'Current corporate portfolio context changed')
 const entries=d.nodes(n=>n.tag==='ul'&&(n.attrs.class||'').split(/\s+/).includes('portfoliotabdiv'),mains[0])
 const brands=entries.flatMap(list=>d.nodes(n=>n.tag==='li'&&n.attrs['data-post-id'],list)
  .filter(entry=>d.nodes(n=>n.tag==='img'&&n.attrs.alt==='Jio Hotstar Logo'
   &&/^https:\/\/cdn\.jiostar\.com\/jiostar\//.test(n.attrs.src||''),entry).length>0))
 const careers=d.nodes(n=>n.tag==='a'&&n.attrs.href===board&&d.text(n)==='Careers')
 requireValue(brands.length>0&&careers.length>0,'Active corporate portfolio brand or exact Careers delegation is unavailable')
 return {method:'current-corporate-portfolio-brand-and-exact-careers-delegation',surface:PORTFOLIO_URL,
  heading:'Portfolio',portfolioEntryIDs:[...new Set(brands.map(n=>n.attrs['data-post-id']))],boardURL:board,
  nativeBrand:'JioHotstar',bodySHA256:sha(page.html),directHotstarCareersLinkObserved:false}
}
const countryTokens=value=>typeof value==='string'?[value]:[value?.descriptor,value?.alpha2Code]
const nativeIndiaLocation=info=>{
 const primary=text(typeof info.location==='string'?info.location:info.location?.descriptor)
 const office=info.jobRequisitionLocation,officeLabel=text(office?.descriptor)
 for(const country of [info.country,office?.country])if(country!=null)
  requireValue((typeof country==='string'||typeof country==='object'&&!Array.isArray(country))
   &&countryTokens(country).some(value=>typeof value==='string'&&value.trim()),'Malformed supplied native country')
 const own=countryTokens(info.country).filter(v=>typeof v==='string'&&v.trim())
 const nested=countryTokens(office?.country).filter(v=>typeof v==='string'&&v.trim())
 // An office's country cannot qualify another public location. The native
 // requisition office is the explicit public fallback only when it is blank.
 const boundOffice=!primary||primary===officeLabel
 const labels=[...own,...boundOffice?nested:[]]
 requireValue(labels.length>0&&labels.every(v=>/^(?:India|IN|IND)$/i.test(v.trim())),
  'Native country is missing, foreign, or contradictory')
 if(own.length&&nested.length)requireValue(nested.every(v=>/^(?:India|IN|IND)$/i.test(v.trim())),
  'Native public and requisition countries conflict')
 const location=primary||officeLabel
 requireValue(location&&!/^(?:unknown|multiple locations?)$/i.test(location),'Native public worksite unavailable')
 requireValue(!namesForeignCountry(location)&&!namesForeignCountry(officeLabel),
  'Native worksite names a conflicting foreign country')
 return location
}
const detailJob=(payload,listing,binding,now)=>{
 const info=payload?.jobPostingInfo,id=listing.jobId
 requireValue(info&&typeof info==='object'&&!Array.isArray(info),'Missing native jobPostingInfo')
 requireValue(info.jobReqId===id&&text(info.title)===text(listing.title)&&info.externalUrl===listing.sourceUrl
  &&info.jobPostingId===new URL(listing.sourceUrl).pathname.split('/').at(-1)
  &&info.jobPostingSiteId==='JioStar'&&info.canApply===true&&info.posted===true,'Native listing/detail identity or publication changed')
 requireValue(payload.hiringOrganization?.name===LEGAL_EMPLOYER,'Exact native legal employer changed')
 const location=nativeIndiaLocation(info)
 const visible=extractActiveDescription(info.jobDescription)
 requireValue(visible&&visible.length>=100,'Full active native description is unavailable')
 const rolePortion=visible.split(/\bAbout\s+(?:Us|JioStar|the Company)\b\s*:?/i)[0]
 requireValue(ownHotstarRole(rolePortion),'Own role criteria do not affirm the Hotstar brand or explicitly contradict it')
 const detail=extractWorkdayStructuredDetail({...payload,jobPostingInfo:{...info,jobDescription:visible}})
 requireValue(detail&&detail.jobDescription,'Native criteria extraction failed')
 if(detail.postingDate)requireValue(Date.parse(detail.postingDate)<=Date.parse(now),'Native posting date is future')
 if(detail.postingDate&&detail.closingDate)requireValue(Date.parse(detail.closingDate)>=Date.parse(detail.postingDate),
  'Native closing date precedes publication')
 return {...listing,...detail,title:text(info.title),company:'Hotstar',source:'hotstar',country:'India',
  location:/\bIndia\b/i.test(location)?location:location+', India',city:null,
  sourceDescription:visible,jobDescription:visible,sourceNativeDescription:info.jobDescription,
  sourceNativeLegalEmployer:payload.hiringOrganization.name,nativeSourceRecord:payload,
  sourceNativeBrandBinding:binding,sourceListingTitle:listing.title,
  sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  sourceAdditionalLocations:info.additionalLocations||[],
  sourceAdditionalLocationScopeComplete:!info.additionalLocations?.length,
  publicExperienceChecked:true,postingDate:detail.postingDate||null,closingDate:detail.closingDate||null,
  employmentType:typeof info.timeType==='string'?info.timeType:null,scrapedAt:now}
}

export async function collectHotstarNative({options,metadata,validators,normalizePosting}){
 const {homepage,careers,board,jobsAPI,searchText}=metadata
 const maxPages=Number.isSafeInteger(options.maxPages)?options.maxPages:24
 const maxJobs=options.maxJobs??10000,maxRequests=options.maxRequests??512,sourceTimeoutMs=options.sourceTimeoutMs??180000
 for(const[value,max]of[[maxPages,100],[maxJobs,10000],[maxRequests,1024],[sourceTimeoutMs,180000]])
  requireValue(Number.isSafeInteger(value)&&value>0&&value<=max,'Invalid native collection limits')
 const controller=new AbortController(),expires=performance.now()+sourceTimeoutMs
 const timer=setTimeout(()=>controller.abort(new DOMException('Hotstar source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 const signal=AbortSignal.any([controller.signal,...options.signal?[options.signal]:[]])
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()>=expires&&!controller.signal.aborted)controller.abort(new DOMException('Hotstar source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 const receipts=[];let requests=0,aggregateBytes=0
 const read=async(url,{format='json',body}={})=>{
  check();requireValue(++requests<=maxRequests,'Native request budget exhausted')
  const request=AbortSignal.any([signal,AbortSignal.timeout(20000)]),requestExpires=performance.now()+20000
  const guard=()=>{check();request.throwIfAborted();if(performance.now()>=requestExpires)throw new DOMException('Hotstar request deadline exceeded','TimeoutError')}
  const method=body?'POST':'GET',startedAt=new Date().toISOString();let native,status=200,finalURL=url,mime=format==='page'?'text/html':'application/json'
  if(format==='page'&&options.fetchPage){
   const page=await wait(()=>options.fetchPage(url,{signal:request}),request);guard();native=page.html;status=page.status;finalURL=page.url||page.finalUrl;mime=page.contentType||'text/html'
  }else if(body&&options.fetchJson){
   const payload=await wait(()=>options.fetchJson(url,JSON.stringify(body),{signal:request}),request);guard();native=JSON.stringify(payload)
  }else if(!body&&format==='json'&&options.fetchDetailJson){
   const payload=await wait(()=>options.fetchDetailJson(url,{signal:request}),request);guard();native=JSON.stringify(payload)
  }else{
   const raw=await wait(()=>(options.fetchImpl||fetch)(url,{method,redirect:format==='page'?'follow':'error',credentials:'omit',signal:request,
    headers:{Accept:format==='page'?'text/html':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),request,late=>late?.body?.cancel())
   let reader;const chunks=[];let bytes=0
   try{
    guard();requireValue(Number(raw.headers.get('content-length'))<=4e6,'Native body exceeds byte limit')
    reader=raw.body?.getReader();requireValue(reader,'Native response body missing')
    for(;;){const item=await wait(()=>reader.read(),request);guard();if(item.done)break;bytes+=item.value.byteLength;requireValue(bytes<=4e6,'Native body exceeds byte limit');chunks.push(Buffer.from(item.value))}
   }finally{try{Promise.resolve(reader?reader.cancel():raw.body?.cancel()).catch(()=>{})}catch{};try{reader?.releaseLock()}catch{}}
   native=Buffer.concat(chunks).toString('utf8');status=raw.status;finalURL=raw.url;mime=raw.headers.get('content-type')||''
  }
  guard();requireValue(typeof native==='string'&&Buffer.byteLength(native)<=4e6,'Native body exceeds byte limit')
  aggregateBytes+=Buffer.byteLength(native);requireValue(aggregateBytes<=24e6,'Native aggregate byte limit reached')
  receipts.push({url,method,...body?{requestBodySHA256:sha(JSON.stringify(body))}:{},status,finalURL,
   bodyBytes:Buffer.byteLength(native),bodySHA256:sha(native),requestedAt:startedAt,completedAt:new Date().toISOString()})
  if(status!==200){const error=Object.assign(new Error('[hotstar] Native HTTP '+status),{status});throw Object.assign(error,classifyScraperError(error),{softFailure:true,abortRetries:true})}
  requireValue(format==='page'?['text/html','application/xhtml+xml'].includes(mime.split(';')[0].trim().toLowerCase()):mime.split(';')[0].trim().toLowerCase()==='application/json','Native response MIME changed')
  if(format==='page')return {status,url:finalURL,html:native}
  requireValue(finalURL===url,'Native API response authority changed')
  const payload=JSON.parse(native);guard();return payload
 }
 try{
  const now=options.now?options.now():new Date().toISOString();requireValue(Number.isFinite(Date.parse(now)),'Invalid observation time')
  const home=await read(homepage,{format:'page'});validators.homepage(home)
  const homeDocument=readNativeDocument(home.html),titles=homeDocument.nodes(n=>n.tag==='title')
  requireValue(titles.length===1&&/^JioHotstar\s*-\s*Watch TV Shows/i.test(text(titles[0].raw))
   &&homeDocument.nodes(n=>n.tag==='meta'&&n.attrs.name==='description'
    &&/^JioHotstar is India['’]s largest premium streaming platform\b/i.test(n.attrs.content||'')).length===1,
  'Active current Hotstar homepage identity is unavailable')
  const corporate=await read(careers,{format:'page'});validators.careers(corporate)
  const portfolio=await read(PORTFOLIO_URL,{format:'page'});requireValue(portfolio.url===PORTFOLIO_URL,'Corporate portfolio changed authority')
  const binding=corporateBrandBinding(portfolio,board)
  binding.hotstarHomepageIdentity={surface:home.url,bodySHA256:sha(home.html),accessNoticeDelivered:/connecting through a VPN|proxy or .unblocker/i.test(home.html)}
  const boardPage=await read(board,{format:'page'});validators.board(boardPage)
  const postings=[],pages=[],seen=new Set(),accounting=createRecruitmentObservationAccounting('hotstar')
  let total=null,offset=0,exhausted=false
  const search=offset=>({appliedFacets:{},limit:20,offset,searchText})
  const validatePage=(payload,offset)=>{
   requireValue(Number.isSafeInteger(payload.total)&&payload.total>=0&&Array.isArray(payload.jobPostings),'Native inventory contract changed')
   if(total==null)total=payload.total
   // This current CXS tenant reports its total on offset zero and returns the
   // Workday unreported-total sentinel zero on later nonempty pages. The first
   // total, exact row reconciliation and fresh closing pages remain required.
   requireValue((payload.total===total||offset>0&&payload.total===0)
    &&payload.jobPostings.length===Math.min(20,Math.max(0,total-offset)),'Native pagination counts do not reconcile')
   return payload.jobPostings
  }
  for(let page=0;page<maxPages;page++){
   const payload=await read(jobsAPI,{body:search(offset)}),rows=validatePage(payload,offset)
   const normalized=rows.map(row=>normalizePosting(row,now))
   for(let i=0;i<rows.length;i++){
    const job=normalized[i],url=new URL(job.sourceUrl)
    requireValue(!seen.has(job.jobId)&&url.origin===new URL(board).origin&&url.pathname.startsWith('/JioStar/job/')&&!url.search&&!url.hash
     &&new RegExp('_'+job.jobId+'(?:-\\d+)?$').test(new URL(job.sourceUrl).pathname.split('/').at(-1)),
    'Native inventory identity or account changed')
    seen.add(job.jobId);postings.push(job);accounting.observe({scope:'workday:jiostar:JioStar:JioHotstar',id:job.jobId,title:job.title,url:job.sourceUrl})
   }
   pages.push({offset,rows});offset+=rows.length
   if(offset===total){exhausted=true;break}
  }
  requireValue(exhausted&&seen.size===total,'Bounded native inventory is incomplete')
  const failures=[],selected=postings.slice(0,maxJobs)
  const results=await mapWithConcurrency(selected,4,async listing=>{
   try{
    check();const url=buildWorkdayDetailApiUrl(listing.sourceUrl,jobsAPI);requireValue(url,'Unbound native detail URL')
    const payload=await read(url);check();const job=detailJob(payload,listing,binding,now);check();return job
   }catch(error){check();failures.push({stage:'native-detail',id:listing.jobId,url:listing.sourceUrl,reason:error.message.slice(0,220),failureKind:error.failureKind||classifyScraperError(error).failureKind});return null}
  })
  for(const page of pages){
   const closing=validatePage(await read(jobsAPI,{body:search(page.offset)}),page.offset)
   requireValue(JSON.stringify(closing)===JSON.stringify(page.rows),'Closing native inventory changed after details')
  }
  check();const jobs=results.filter(Boolean)
  const collection={source:'hotstar',observedListingCount:postings.length,candidateDetails:selected.length,
   extractedDetailJobs:jobs.length,excludedDetailJobs:0,exclusions:[],failures,
   jobs:jobs.map(job=>({id:job.jobId})),listingPaginationComplete:true,closingInventoryMatches:true,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,retainedResponses:receipts,
   firstExtractedJobID:jobs[0]?.jobId||null,unselectedDetailJobs:postings.length-selected.length}
  const observations={source:'hotstar',observedAt:now,nativeRecords:postings.length,returnedIndiaJobs:jobs.length,
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,requestCount:requests,receipts,failures,binding,
   unresolved:['company-wide-source-scope-unverified',...selected.length<postings.length?['native-detail-selection-budget']:[]]}
  if(selected.length>0&&jobs.length===0&&failures.length===selected.length){
   const kinds=new Set(failures.map(failure=>failure.failureKind))
   const failureKind=kinds.size===1&&['blocked_or_access_denied','network_or_timeout'].includes(failures[0].failureKind)?failures[0].failureKind:'coverage_gap'
   throw Object.assign(new Error('[hotstar] No native candidate detail could be safely qualified; '+failures.length+' retained failures'),
    {softFailure:true,abortRetries:true,failureKind,nativeCollectionEvidence:collection,nativeEvidence:collection,recruitmentObservations:observations})
  }
  if(jobs[0])jobs[0].nativeCollectionEvidence=collection
  accounting.attach(jobs)
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:jobsAPI,firstParty:true,listingComplete:false,
   lifecycleCleanupAllowed:false,pagesFetched:pages.length*2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
   reason:'Current corporate-portfolio-bound JioHotstar keyword inventory and own native India criteria; company-wide scope and lifecycle cleanup remain unqualified'})
  Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:observations})
  check();return jobs
 }finally{clearTimeout(timer)}
}
