import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createRecruitmentObservationAccounting} from '../../scraper-support/utils/recruitmentObservationAccounting.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const ROOT='https://www.disneycareers.com/en/search-jobs?acm=ALL&alrpm=ALL&ascf=%5B%7B%22key%22:%22custom_fields.IndustryCustomField%22,%22value%22:%22ESPN%22%7D%5D'
const ENDPOINT='https://www.disneycareers.com/en/search-jobs/resultspost'
const reviewedUSWorksites=new Set(['Bristol, Connecticut','Charlotte, North Carolina','Los Angeles, California','Connecticut'])
const sha=value=>createHash('sha256').update(value).digest('hex')
const hold=message=>{throw Object.assign(new Error('[espn] '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap'})}
const requireValue=(value,message)=>{if(!value)hold(message)}
const integer=value=>typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null
const one=(document,predicate,subtree)=>{const rows=document.nodes(predicate,subtree);requireValue(rows.length===1,'Ambiguous native search identity');return rows[0]}
const wait=(operation,signal,dispose)=>new Promise((resolve,reject)=>{
 let done=false
 const abort=()=>{if(!done){done=true;signal.removeEventListener('abort',abort);reject(signal.reason)}}
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>{
  if(done||signal.aborted){abort();try{Promise.resolve(dispose?.(value)).catch(()=>{})}catch{};return}
  done=true;signal.removeEventListener('abort',abort);resolve(value)
 },error=>{if(!done){done=true;signal.removeEventListener('abort',abort);reject(error)}})
})

// This recognizes one publisher-declared ESPN brand search. It does not infer
// a company-wide inventory from Disney's account or from an absent India label.
const parse=(html,pageNumber,{opening=false}={})=>{
 const d=readNativeDocument(html)
 // TalentBrew's documented checkbox model reads collapsed accordion lists.
 // Read their UI metadata independently of the visible vacancy row reader;
 // hidden/inert/template ancestors still remain excluded by the tree parser.
 const facetDocument=readNativeDocument(html.replace(/<ul\b[^>]*>/gi,tag=>{
  const attributes=readNativeAttributeTokens(tag.slice(3,-1)),attrs=Object.fromEntries(attributes)
  if(attributes.length!==new Set(attributes.map(([name])=>name)).size)return tag
  return (attrs.class||'').split(/\s+/).includes('search-filter-list')&&attrs['aria-hidden']==='true'
   ?tag.replace(/\saria-hidden\s*=\s*(["'])true\1/i,' aria-hidden="false"'):tag
 }))
 const result=one(d,n=>n.attrs.id==='search-results'),a=result.attrs
 const filters=one(facetDocument,n=>n.attrs.id==='search-filters')
 const total=integer(a['data-total-job-results']),size=integer(a['data-records-per-page'])
 const pages=integer(a['data-total-pages'])
 requireValue(total>0&&size>0&&size<=100&&pages===Math.ceil(total/size)&&pages<=24
  &&integer(a['data-current-page'])===pageNumber,'Native search pagination changed')
 requireValue(a['data-ajax-post-url']==='/en/search-jobs/resultspost'
  &&a['data-ajax-url']==='/en/search-jobs/results'
  &&a['data-search-results-module-name']==='Search Results'
  &&filters.attrs['data-search-filters-module-name']==='Search Filters','Native search endpoint changed')
 for(const key of ['keywords','location','latitude','longitude','custom-facet-name','facet-term','keyword-type','location-type','location-path','organization-ids','postal-code'])
  requireValue(a['data-'+key]==='','Additional native search restriction')
 requireValue(a['data-active-facet-id']==='0'&&a['data-facet-type']==='0'
  &&a['data-show-radius']==='False'&&a['data-refined-keywords']==='[]'
  &&a['data-search-type']==='6'&&a['data-sort-criteria']==='0'&&a['data-sort-direction']==='1'
  &&a['data-distance']==='50'&&filters.attrs['data-radius-unit-type']==='0'
  &&a['data-results-type']===(opening?'0':'1'),'Additional native search criteria')
 for(const [key,value]of Object.entries(filters.attrs))if(key.startsWith('data-filtered-'))requireValue(value==='','Additional static native filter')
 const selected=facetDocument.nodes(n=>n.tag==='input'&&Object.hasOwn(n.attrs,'checked'),filters)
 requireValue(selected.length===1,'Additional or missing employer filter')
 const brand=selected[0].attrs
 requireValue(brand['data-id']==='ESPN'&&brand['data-display']==='ESPN'
  &&brand['data-field-name']==='custom_fields.IndustryCustomField'&&brand['data-facet-type']==='5'
  &&integer(brand['data-count'])===total&&!Object.hasOwn(brand,'disabled'),'Exact ESPN employer facet changed')
 if(opening){
  const meta=one(d,n=>n.tag==='meta'&&n.attrs.name==='search-analytics-applied-facets')
  const facets=JSON.parse(meta.attrs.content)
  requireValue(JSON.stringify(facets)===JSON.stringify({'1':[],IndustryCustomField:['ESPN']}),'Additional applied search scope')
 }
 const countries=one(facetDocument,n=>n.attrs.id==='country-filters-section',filters)
 const countryRows=facetDocument.nodes(n=>n.tag==='input'&&n.attrs['data-facet-type']==='2',countries).map(n=>n.attrs)
 // The current exact brand inventory publishes all vacancies in the US.
 // Unknown, India, overlapping counts, and disabled facets stay held.
 requireValue(countries.attrs['data-enabled']==='true'&&countryRows.length===1
  &&countryRows[0]['data-display']==='United States'&&countryRows[0]['data-id']==='6252001'
  &&integer(countryRows[0]['data-count'])===total&&!Object.hasOwn(countryRows[0],'disabled'),'Country inventory is not an exhaustive non-India scope')
 const list=one(d,n=>n.attrs.id==='search-results-jobs',result)
 requireValue(integer(list.attrs['data-results-count'])===total,'Native list count changed')
 const rows=d.nodes(n=>n.tag==='li',list).map(li=>{
  const anchor=one(d,n=>n.tag==='a'&&n.attrs['data-job-id'],li)
  const id=anchor.attrs['data-job-id'],url=new URL(anchor.attrs.href,ROOT)
  const title=d.text(one(d,n=>n.tag==='h2',anchor)).trim()
  const location=d.text(one(d,n=>(n.attrs.class||'').split(/\s+/).includes('job-location'),anchor)).trim()
  requireValue(/^\d+$/.test(id)&&url.origin===new URL(ROOT).origin
   &&new RegExp('^/en/job/[^/]+/[^/]+/391/'+id+'$').test(url.pathname)&&!url.search&&!url.hash
   &&title&&location&&location.split(/\s*\/\s*/).every(site=>reviewedUSWorksites.has(site)),
  'Native role identity or reviewed complete US worksite changed')
  requireValue(!d.nodes(n=>n.attrs.itemprop==='applicantLocationRequirements',li).length,'Additional applicant eligibility requires review')
  return {id,url:url.href,title,location}
 })
 requireValue(rows.length===Math.min(size,total-(pageNumber-1)*size)
  &&new Set(rows.map(row=>row.id)).size===rows.length,'Native page rows are incomplete or duplicated')
 return {total,size,pages,rows,contentTotal:integer(a['data-total-content-results'])||0,
  signature:JSON.stringify({total,size,pages,brand,countryRows})}
}
const criteria=(opening,page)=>({ActiveFacetID:0,CurrentPage:page,RecordsPerPage:opening.size,
 TotalContentResults:opening.contentTotal,Distance:50,RadiusUnitType:0,Keywords:'',Location:'',Latitude:null,Longitude:null,
 ShowRadius:false,IsPagination:'True',CustomFacetName:null,FacetTerm:null,FacetType:0,
 FacetFilters:[{ID:'ESPN',FacetType:5,Count:opening.total,Display:'ESPN',IsApplied:true,FieldName:'custom_fields.IndustryCustomField'}],
 SearchResultsModuleName:'Search Results',SearchFiltersModuleName:'Search Filters',SortCriteria:0,SortDirection:1,SearchType:6,
 CategoryFacetTerm:null,CategoryFacetType:null,LocationFacetTerm:null,LocationFacetType:null,KeywordType:null,LocationType:null,
 LocationPath:null,OrganizationIds:null,RefinedKeywords:[],PostalCode:null,ResultsType:1,fc:'',fl:'',fcf:'',afc:'',afl:'',afcf:''})

export async function runESPN(options={}){
 const sourceTimeoutMs=options.sourceTimeoutMs??90000,maxRequests=options.maxRequests??48,maxPages=options.maxPages??8
 for(const[value,max]of[[sourceTimeoutMs,180000],[maxRequests,128],[maxPages,24]])requireValue(Number.isSafeInteger(value)&&value>0&&value<=max,'Invalid native request limits')
 const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(new DOMException('ESPN source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 const signal=AbortSignal.any([deadline.signal,...options.signal?[options.signal]:[]])
 const expiresAt=performance.now()+sourceTimeoutMs
 const checkDeadline=()=>{
  // Synchronous injected transports and parsing can prevent timer callbacks
  // from running. Elapsed monotonic time remains authoritative in that case.
  options.signal?.throwIfAborted()
  if(performance.now()>=expiresAt&&!deadline.signal.aborted)deadline.abort(new DOMException('ESPN source deadline exceeded','TimeoutError'))
  signal.throwIfAborted()
 }
 const parseWithinDeadline=(...args)=>{checkDeadline();const value=parse(...args);checkDeadline();return value}
 const receipts=[];let aggregateBytes=0
 const read=async(url,body)=>{
  checkDeadline();requireValue(receipts.length<maxRequests,'Native request budget reached')
  const request=AbortSignal.any([signal,AbortSignal.timeout(15000)]),method=body?'POST':'GET'
  const requestExpiresAt=performance.now()+15000
  const checkReadDeadline=()=>{checkDeadline();request.throwIfAborted();if(performance.now()>=requestExpiresAt)throw new DOMException('ESPN request deadline exceeded','TimeoutError')}
  const raw=await wait(()=>(options.fetchImpl||fetch)(url,{method,redirect:'error',credentials:'omit',cache:'no-store',signal:request,
   headers:{Accept:body?'application/json':'text/html',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),request,late=>late?.body?.cancel())
  let reader;const chunks=[];let size=0
  try{
   checkReadDeadline()
   requireValue(raw.status===200&&raw.url===url,'Native transport status or authority changed')
   const mime=(raw.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()
   requireValue(mime===(body?'application/json':'text/html'),'Native response MIME changed')
   requireValue(Number(raw.headers.get('content-length'))<=4e6,'Native response exceeds byte limit')
   reader=raw.body?.getReader();requireValue(reader,'Missing native response body')
   for(;;){const item=await wait(()=>reader.read(),request);checkReadDeadline();if(item.done)break;size+=item.value.byteLength;requireValue(size<=4e6,'Native response exceeds byte limit');chunks.push(Buffer.from(item.value))}
  }finally{
   try{Promise.resolve(reader?reader.cancel():raw.body?.cancel()).catch(()=>{})}catch{}
   try{reader?.releaseLock()}catch{}
  }
  checkReadDeadline();aggregateBytes+=size;requireValue(aggregateBytes<=24e6,'Native aggregate byte limit reached')
  const text=Buffer.concat(chunks).toString('utf8')
  receipts.push({requestedURL:url,finalURL:raw.url,method,status:raw.status,bodyBytes:size,bodySHA256:sha(text),...(body?{requestBodySHA256:sha(JSON.stringify(body))}:{})})
  if(!body)return text
  const payload=JSON.parse(text)
  checkDeadline()
  requireValue(payload.hasJobs===true&&payload.hasContent===false&&typeof payload.results==='string'&&typeof payload.filters==='string','Native search response contract changed')
  return payload.results+payload.filters
 }
 try{
  const observedAt=options.now?options.now():new Date().toISOString();requireValue(Number.isFinite(Date.parse(observedAt)),'Invalid observation time')
  const opening=parseWithinDeadline(await read(ROOT),1,{opening:true})
  requireValue(opening.pages<=maxPages&&maxRequests>=opening.pages*2,'Native inventory cannot fit request budget')
  const pages=[opening]
  for(let page=2;page<=opening.pages;page++)pages.push(parseWithinDeadline(await read(ENDPOINT,criteria(opening,page)),page))
  requireValue(pages.every(page=>page.signature===opening.signature),'Opening native facet scope changed')
  const rows=pages.flatMap(page=>page.rows)
  requireValue(rows.length===opening.total&&new Set(rows.map(row=>row.id)).size===opening.total,'Native inventory duplicates or misses roles')
  // Close both the advertised root/facets and every paginated inventory page.
  for(let page=1;page<=opening.pages;page++){
   const closing=page===1?parseWithinDeadline(await read(ROOT),1,{opening:true}):parseWithinDeadline(await read(ENDPOINT,criteria(opening,page)),page)
   requireValue(closing.signature===pages[page-1].signature&&JSON.stringify(closing.rows)===JSON.stringify(pages[page-1].rows),'Closing native inventory changed')
  }
  checkDeadline()
  const jobs=[],accounting=createRecruitmentObservationAccounting('espn')
  for(const row of rows)accounting.observe({scope:'talentbrew:391:ESPN',...row})
  accounting.attach(jobs)
  attachInventoryEvidence(jobs,{status:'verified-empty',surface:ROOT,firstParty:true,listingComplete:true,
   lifecycleCleanupAllowed:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:0,verifiedAt:observedAt,
   reason:'current exact ESPN brand-search India scope only; all enumerated US roles and facets stable on closing reads; company scope unverified; cleanup forbidden'})
  Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:{source:'espn',observedAt,
   requestCount:receipts.length,nativeRecords:rows.length,returnedIndiaJobs:0,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   companyGlobalTotal:null,companyIndiaTotal:null,receipts,unresolved:['company-wide-source-scope-unverified'],nativeInventoryReads:[{kind:'talentbrew-brand-search',surface:ROOT,reportedTotal:opening.total}],failures:[]}})
  checkDeadline();return jobs
 }catch(error){
  options.signal?.throwIfAborted()
  if(error.failureKind)throw error
  throw Object.assign(new Error('[espn] Current exact brand inventory could not be verified',{cause:error}),classifyScraperError(error),{softFailure:true,abortRetries:true})
 }finally{clearTimeout(timer)}
}
