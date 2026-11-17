import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'

const profile=JSON.parse(readFileSync(new URL('./currentNativeProfile20261116.json',import.meta.url),'utf8'))
const corporate='https://corporate.payu.in/careers/',replacement='https://payu.in/careers'
const legacy='https://corporate.payu.com/job-board/'
const sha=value=>createHash('sha256').update(value).digest('hex')
const failure=message=>Object.assign(Error('PayU current native coverage gap: '+message),{softFailure:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw failure(message)}
const one=(rows,label)=>{need(rows.length===1,'Missing or ambiguous '+label);return rows[0]}
const permitted=new Set([corporate,replacement,legacy,...profile.pages.map(p=>p.url),...profile.details.map(p=>p.url)])
const redirects=new Map([[corporate,replacement],[replacement,profile.boardURL]])
export const PAYU_NATIVE_LIMITS=Object.freeze({maxReads:170,maxEntityBytes:2000000,maxAggregateBytes:26000000,sourceTimeoutMs:150000,requestTimeoutMs:15000})
const wait=(promise,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason)}
 Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted){Promise.resolve(value?.body?.cancel?.()).catch(()=>{});reject(signal.reason)}else resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(error)})
 if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true})
})

// Only the two observed first-party 301 handoffs may cross origins. Native
// applications are read as declarations and are never requested or submitted.
export async function fetchReviewedPayUPage(url,{signal}={}){
 need(permitted.has(url),'Unreviewed requested URL')
 const budget=signal?AbortSignal.any([signal,AbortSignal.timeout(PAYU_NATIVE_LIMITS.requestTimeoutMs)]):AbortSignal.timeout(PAYU_NATIVE_LIMITS.requestTimeoutMs)
 let current=url
 for(let hop=0;hop<3;hop++){
  budget.throwIfAborted()
  const response=await wait(fetch(current,{method:'GET',redirect:'manual',credentials:'omit',signal:budget,headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}}),budget)
  if(response.url!==current||response.redirected){await disposeResponseBody(response,{signal:budget,bestEffort:true});throw failure('Unvalidated followed response')}
  if(response.status===301){
   let destination;try{destination=new URL(response.headers.get('location'),current).href}catch{}
   const expected=redirects.get(current)
   await disposeResponseBody(response,{signal:budget})
   need(expected&&destination===expected,'Changed first-party redirect destination')
   current=destination;continue
  }
  let reader,done=false
  try{
   need(response.status===200,'Native HTTP '+response.status)
   need(/^text\/html(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type')||''),'Changed native entity type')
   const length=response.headers.get('content-length');need(length===null||/^\d+$/.test(length)&&Number(length)<=PAYU_NATIVE_LIMITS.maxEntityBytes,'Declared native body cap')
   need(response.body&&typeof response.body.getReader==='function','Missing original native body')
   reader=response.body.getReader();const chunks=[];let bytes=0
   for(;;){const part=await wait(reader.read(),budget);budget.throwIfAborted();if(part.done){done=true;break}bytes+=part.value.byteLength;need(bytes<=PAYU_NATIVE_LIMITS.maxEntityBytes,'Original native body cap');chunks.push(Buffer.from(part.value))}
   const html=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks,bytes))
   return{status:200,url:current,html}
  }finally{
   if(reader&&!done)await disposeResponseReader(reader,{bestEffort:true})
   else if(!reader)await disposeResponseBody(response,{bestEffort:true})
  }
 }
 throw failure('First-party redirect cap')
}

export const isCurrentPayUSurface=page=>page?.status===200&&[corporate,profile.boardURL].includes(page.url)
 &&typeof page.html==='string'&&page.html.includes('https://careers.payu.in/PayU/go/_/514880/')

// Every original document byte is pinned except the reviewed owned data
// slots: two UUIDv4 values, one of two empty override resources and the exact
// three captured tuples of paired subscription label/input identifiers.
// No HTML rewrite, broad numeric substitution or program stripping is used.
function admit(html,entity){
 need(typeof html==='string','Original document unavailable')
 const raw=Buffer.from(html),controlIDs=[];let at=0
 for(let i=0;i<entity.segments.length;i++){
  const segment=entity.segments[i];need(sha(raw.subarray(at,at+segment.bytes))===segment.sha256,'Unreviewed complete original document segment');at+=segment.bytes
  const slot=entity.slots[i];if(!slot)continue
  if(slot.kind.endsWith('uuid-v4')){
   need(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw.subarray(at,at+36).toString('ascii')),'Changed owned UUID data slot');at+=36
  }else if(slot.kind==='reviewed-subscription-control-id'){
   controlIDs.push(raw.subarray(at,at+8).toString('ascii'));at+=8
  }else{
   need(slot.kind==='reviewed-empty-override-version','Unknown original data slot')
   const value=['732179352','1702714809'].find(value=>raw.subarray(at,at+value.length).equals(Buffer.from(value)))
   need(value,'Unreviewed native override resource');at+=value.length
  }
 }
 if(controlIDs.length)need([['j_idt139','j_idt139','j_idt150','j_idt150'],['j_idt199','j_idt199','j_idt210','j_idt210'],['j_idt193','j_idt193','j_idt205','j_idt205']].some(tuple=>JSON.stringify(tuple)===JSON.stringify(controlIDs)),'Unreviewed paired subscription control ownership')
 need(at===raw.length,'Changed original document ownership or cardinality')
 return document(html)
}
function tenant(d){
 const scripts=d.nodes(n=>n.tag==='script'&&!n.attrs.src).map(n=>n.raw||'').join('\n'),tokens=[...scripts.matchAll(/"ssoCompanyId"\s*:\s*'([^']+)'/g)].map(m=>m[1])
 need(tokens.length===1&&tokens[0]===profile.tenant,'Native tenant mismatch')
}
function listing(page,expected,initial=false){
 need(page?.status===200&&(page.url===expected.url||initial&&page.url===corporate),'Native listing response identity changed')
 const d=admit(page.html,expected.entity);tenant(d)
 const table=one(d.nodes(n=>n.tag==='table'&&n.attrs.id==='searchresults'),'native listing table')
 need(table.attrs['aria-label']===expected.range,'Native pagination range changed')
 const rows=d.nodes(n=>n.tag==='tr'&&d.hasClass(n,'data-row'),table)
 need(rows.length===expected.rows.length,'Native advertised row count changed')
 return d
}
function detail(page,expected,now){
 need(page?.status===200&&page.url===expected.url,'Native detail response identity changed')
 const d=admit(page.html,expected.entity);tenant(d)
 const scope=one(d.nodes(n=>Object.hasOwn(n.attrs,'itemscope')&&n.attrs.itemtype==='http://schema.org/JobPosting'),'native JobPosting owner')
 const prop=name=>d.nodes(n=>n.attrs.itemprop===name,scope)
 const title=d.text(one(prop('title'),'native title')),employer=one(prop('hiringOrganization'),'native employer').attrs.content
 need(title===expected.title&&employer===profile.nativeEmployer,'Native title or employer conflict')
 const nativeAddressStrings=prop('streetAddress').map(n=>n.attrs.content)
 need(JSON.stringify(nativeAddressStrings)===JSON.stringify(expected.nativeAddressStrings),'Changed original native addresses')
 const desc=one(prop('description'),'complete native description'),html=d.inner(desc)
 need(Buffer.byteLength(html)===expected.criteriaHTMLBytes&&sha(html)===expected.criteriaHTMLSHA256,'Changed complete original native criteria')
 const criteria=readOriginalNativeCriteria(html,failure)
 need(criteria.sourceDetailComplete===expected.sourceDetailComplete,'Changed full-criteria qualification')
 if(!expected.explicitIndiaPlacement)return null
 // IN is intentionally not translated. Country is established only by this
 // exact role's authored placement statement in the full original criteria.
 need(criteria.sourceDetailComplete&&d.text(desc).includes(expected.explicitIndiaPlacement),'Missing role-owned literal India placement')
 need(nativeAddressStrings.length>0&&nativeAddressStrings.every(s=>/^(?:[^,]+, )?IN$/.test(s)),'Native address contradicts reviewed role-owned placement')
 const applications=[...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>new URL(n.attrs.href,expected.url).href).filter(u=>new URL(u).pathname.includes('/talentcommunity/apply/')))]
 need(applications.length===1&&new URL(applications[0]).origin==='https://careers.payu.in'&&new URL(applications[0]).pathname==='/talentcommunity/apply/'+expected.publicId+'/','Native application identity mismatch')
 const date=one(prop('datePosted'),'native posting date').attrs.content;need(date===expected.nativeDatePosted,'Changed native public date')
 return{...criteria,source:'payu',company:'PayU',companyName:'PayU',officialBrandName:'PayU India',jobId:expected.publicId,sourceJobId:expected.publicId,nativePublicJobId:expected.publicId,title,
  sourceUrl:expected.url,jobUrl:expected.url,jobLink:expected.url,applyUrl:applications[0],link:applications[0],nativeEmployerLabel:employer,legalEmployer:null,
  country:'India',countryCode:'IN',city:null,location:expected.explicitIndiaPlacement,sourceCountryEvidence:{kind:'literal-role-owned-original-criteria-placement',text:expected.explicitIndiaPlacement,metadataCountryCodeSemanticsVerified:false},
  nativeAddressStrings,nativeDatePosted:date,nativeDatePostedMeaning:'native-public-post-date-original-requisition-publication-unknown',postingDate:expected.postingDate,postedAt:expected.postingDate,originalPublicationDate:null,closingDate:null,
  sourceListingComplete:false,sourceScopeComplete:false,sourceRenderedCriteriaComplete:false,sourceActivationComplete:false,sourceApplicationQualificationComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now}
}

export async function runCurrentPayU({initialPage,fetchPage,signal,now=new Date().toISOString()}={}){
 const owned=new AbortController(),source=AbortSignal.any([owned.signal,AbortSignal.timeout(PAYU_NATIVE_LIMITS.sourceTimeoutMs),...(signal?[signal]:[])])
 need(Number.isFinite(Date.parse(now)),'Invalid observation clock')
 const audit={source:'payu',recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
  countryCodeSemanticsVerified:false,nativeFullCriteriaCount:0,placeholderCriteriaCount:0,explicitIndiaPlacementCount:0,countryUnknownRecords:[],explicitPlacementConflicts:[],requests:0,aggregateBytes:0}
 const get=async url=>{
  source.throwIfAborted();need(permitted.has(url)&&++audit.requests<=PAYU_NATIVE_LIMITS.maxReads,'Current native GET cap or URL')
  const budget=AbortSignal.any([source,AbortSignal.timeout(PAYU_NATIVE_LIMITS.requestTimeoutMs)]),page=await wait(fetchPage(url,{signal:budget}),budget)
  budget.throwIfAborted();const bytes=typeof page?.html==='string'?Buffer.byteLength(page.html):0;audit.aggregateBytes+=bytes
  need(bytes>0&&bytes<=PAYU_NATIVE_LIMITS.maxEntityBytes&&audit.aggregateBytes<=PAYU_NATIVE_LIMITS.maxAggregateBytes,'Native entity or aggregate cap');return page
 }
 try{
  listing(initialPage,profile.pages[0],true)
  for(const p of profile.pages.slice(1))listing(await get(p.url),p)
  const rows=profile.pages.flatMap(p=>p.rows);need(rows.length===141&&new Set(rows.map(r=>r.publicId)).size===141,'Unreconciled finite native cohort')
  audit.observedRecordCount=rows.length;audit.observedVacancyCount=rows.length
  const jobs=[];let cursor=0,primaryFailure
  const workers=Array.from({length:3},async()=>{try{for(;;){source.throwIfAborted();const index=cursor++;if(index>=profile.details.length)return;const expected=profile.details[index],job=detail(await get(expected.url),expected,now)
   if(expected.sourceDetailComplete)audit.nativeFullCriteriaCount++;else audit.placeholderCriteriaCount++
   if(job)jobs.push(job);else if(expected.countryHold?.startsWith('explicit-London'))audit.explicitPlacementConflicts.push({publicId:expected.publicId,reason:expected.countryHold});else audit.countryUnknownRecords.push({publicId:expected.publicId,criteriaComplete:expected.sourceDetailComplete})
  }}catch(error){primaryFailure??=error;owned.abort(error);throw error}})
  await Promise.allSettled(workers)
  if(primaryFailure)throw primaryFailure
  for(const p of profile.pages)listing(await get(p.url),p)
  for(const job of jobs){const expected=profile.details.find(d=>d.publicId===job.nativePublicJobId);detail(await get(expected.url),expected,now)}
  listing(await get(corporate),profile.pages[0],true)
  source.throwIfAborted();jobs.sort((a,b)=>profile.details.findIndex(d=>d.publicId===a.nativePublicJobId)-profile.details.findIndex(d=>d.publicId===b.nativePublicJobId));audit.explicitIndiaPlacementCount=jobs.length
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,surface:corporate,pagesFetched:12,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
   reason:'finite-native141-row-six-page-cohort-reconciled;129-original-full-criteria;12-placeholder-criteria-held;3-direct-role-owned-India-placements;IN-country-code-semantics-unestablished;137-country-unknown-and1-explicit-London-placement-conflict-held;renderer-application-and-whole-employer-scope-unknown;cleanup-forbidden'})
 }catch(error){signal?.throwIfAborted();owned.abort(error);if(error&&typeof error==='object')Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true});throw error}
}
