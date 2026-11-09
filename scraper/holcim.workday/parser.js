import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative,oneNative,hasClass,nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {verifyRmkCompanyToken,readRmkLocationCountry} from '../../scraper-support/shared/successFactorsRmk.js'
import {parseNativeRole} from '../../scraper-support/shared/rmkNativePair.js'
import {parseNativeTilePage} from '../../scraper-support/shared/successFactorsNativeTiles.js'
import {createFirstPartyHTMLScraper,createHTMLTransport} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryDelegationEvidence} from '../../scraper-support/utils/inventoryDelegationEvidence.js'
import {createHash} from 'node:crypto'
export const ORIGIN='https://careers.holcimgroup.com',HOME=ORIGIN+'/',SEARCH=ORIGIN+'/search/',CATEGORY=ORIGIN+'/holcim_ghbs/go/Job-at-Holcim-GHBS/8823002/'
export const QUERY='?q=&sortColumn=referencedate&sortDirection=desc&searchby=location&d=10',API=ORIGIN+'/tile-search-results'+QUERY+'&startrow=',CHILD_API=ORIGIN+'/holcim_ghbs/tile-search-results/category/8823002?startrow='
const rolePath=/^\/(?:[A-Za-z][A-Za-z0-9_]*\/)?job\/[^/]+\/([1-9]\d{5,15})\/$/,ensure=(v,m)=>requireNative(v,'Holcim native: '+m)
const field=(d,node,name)=>{const values=d.nodes(n=>n.attrs.id?.endsWith('-section-'+name+'-value'),node).map(n=>d.text(n));ensure(values.length>0&&new Set(values).size===1&&values[0],'Missing/conflicting tile '+name);return values[0]}
const property=(d,node,name)=>d.nodes(n=>n.attrs.itemprop===name,node).map(n=>n.attrs.content??d.text(n))
const countryCode=label=>{try{return readRmkLocationCountry(label)}catch(e){if(/,\s*CH,\s*CH-\u00ad\d{4}$/.test(label))return'CH';throw e}}
export function createSourceConfig({source='holcim',now=()=>new Date().toISOString()}={}){
 ensure(['holcim','holcimglobalhubbusinessservices'].includes(source),'Unknown source ownership');const child=source!=='holcim',companyName=child?'Holcim Global Hub Business Services':'Holcim',boardURL=child?CATEGORY:SEARCH,current=Date.parse(now());ensure(Number.isFinite(current),'Invalid observation clock');let model
 const nativeConfig={source,companyName,origin:ORIGIN,companyToken:'holcimgrou',nativeEmployer:'HOLCIM Group',requisitionProperty:'customfield2'},allowedDetails=new Set()
 function validateURL(value){const u=new URL(value);ensure(u.href===value&&u.origin===ORIGIN&&!u.username&&!u.password&&!u.hash,'Unqualified native public URL');if(value===HOME||value===boardURL||allowedDetails.has(value))return u;const offset=u.searchParams.get('startrow');ensure(/^[1-9]\d*$/.test(offset||'')&&Number(offset)<=10000&&Number(offset)%25===0&&value===(child?CHILD_API:API)+Number(offset),'Unqualified native continuation/application read');return u}
 function parseTile(d,tile,offset,index){ensure(tile.tag==='li'&&hasClass(tile,'job-tile')&&tile.attrs['data-row-index']===String(offset+index+1),'Native tile index/layout mismatch');const u=new URL(tile.attrs['data-url'],ORIGIN),id=rolePath.exec(u.pathname)?.[1];ensure(id&&u.origin===ORIGIN&&!u.search&&!u.hash&&!u.username&&!u.password,'Native public posting identity missing');if(child)ensure(u.pathname.startsWith('/holcim_ghbs/job/'),'Child inventory changed namespace');const links=d.nodes(n=>n.tag==='a'&&hasClass(n,'jobTitle-link'),tile),title=d.text(links[0]);ensure(title&&links.length>0&&links.every(n=>d.text(n)===title&&new URL(n.attrs.href,ORIGIN).href===u.href),'Responsive native identity conflict');const grouped=field(d,tile,'multilocation'),locations=grouped.split('•').map(norm);ensure(locations.length>0&&locations.length<=32&&locations.every(Boolean),'Native location list missing');const codes=locations.map(countryCode);allowedDetails.add(u.href);return{id,jobId:id,title,url:u.href,sourceUrl:u.href,locations,expectedLocationCount:locations.length,countryCode:codes[0],nativeCountryCodes:codes,nativeGroupedLocationLabel:grouped,rawListingHTML:d.outer(tile)}}
 return{source,companyName,boardURL,validateURL,sameReadIdentity:(a,b)=>a===b,
  handoffs:[{url:HOME,verify(html){const d=document(html);verifyRmkCompanyToken(html,nativeConfig);ensure(d.text(oneNative(d.nodes(n=>n.tag==='h1'),'Holcim heading'))==='Holcim Careers','Native portal brand changed');ensure(d.nodes(n=>n.tag==='a'&&n.attrs.href==='https://www.holcim.com/'&&d.text(n)==='Company Homepage').length>0,'Current corporate backlink missing');ensure(d.nodes(n=>n.tag==='a'&&n.attrs.href==='/search/').length>0,'Current native global search handoff missing')}}],
  parseListing(html,url){const p=parseNativeTilePage(html,url,model,{validateURL,nativeConfig,apiPrefix:child?CHILD_API:API,parseTile,initialPath:new URL(boardURL).pathname,expectedApiEndpoint:child?'tile-search-results/category/8823002':'tile-search-results',expectedSearchQuery:child?'':QUERY});model??=p.model;return p},
  pageFingerprint:p=>JSON.stringify({total:p.reportedTotal,lastPage:p.lastPage,rows:p.records.map(r=>[r.id,r.title,r.url,r.locations]),errors:p.errors}),
  candidateForIndia:row=>row.nativeCountryCodes.includes('IN')&&(!row.url.includes('/holcim_ghbs/job/')||child),
  parseDetail(html,row){const d=document(html);verifyRmkCompanyToken(html,nativeConfig);const headTitle=row.url.includes('/holcim_hssa/job/');const roleConfig=headTitle?{...nativeConfig,readNativeTitle(doc){const head=oneNative(doc.nodes(n=>n.tag==='head'),'native head'),title=oneNative(head.children.filter(n=>typeof n!=='string'&&n.tag==='title'),'native document title'),raw=norm(title.raw);ensure(raw.endsWith(' Job Details | HOLCIM Group'),'Native document title employer suffix changed');return raw.slice(0,-' Job Details | HOLCIM Group'.length)}}:nativeConfig;const fact=parseNativeRole(html,row,roleConfig,new Date(current).toISOString());if(fact.excluded)return fact;const description=oneNative(d.nodes(n=>n.attrs.itemprop==='description'),'full role description'),complete=fact.sourceDetailComplete===true||d.text(description).length>=180&&/About the Role|Scope|Job Purpose|Job Responsibilities|Key Requirements|Desired (?:Candidate )?Profile|Qualifications|Responsibilities/i.test(d.text(description));ensure(complete,'Missing complete native description');ensure(fact.postingDate&&Number.isFinite(Date.parse(fact.postingDate))&&Date.parse(fact.postingDate)<=current,'Native publication missing/invalid/future');ensure(!fact.closingDate||fact.closingDate>=fact.postingDate,'Native expiry precedes publication');ensure(fact.requisitionId&&fact.requisitionId!==row.id,'Native requisition missing or conflated with public posting ID');const app=new URL(fact.applyUrl);ensure(app.origin===ORIGIN&&app.pathname==='/talentcommunity/apply/'+row.id+'/'&&app.search==='?locale=en_US'&&!app.hash,'Native application identity/locale mismatch');ensure(fact.nativeLocations.length===row.expectedLocationCount&&fact.nativeLocations.every(a=>a.nativeCountryCode==='IN'),'Mixed-country detail requires independent source contract');const labels=fact.nativeLocations.map(a=>[a.addressLocality,a.addressRegion,'India'].filter(Boolean).join(', '));return{...fact,sourceDetailComplete:true,sourceDetailStatus:'complete',sourceDetailFailureKind:undefined,nativeTitleEvidence:headTitle?'native-HTML-document-title;no-visible-heading-or-microdata-title':'native-microdata-title',nativeMicrodata:{...fact.nativeMicrodata,title:headTitle?null:fact.nativeMicrodata.title},id:row.id,jobId:row.id,nativePublicJobId:row.id,nativeListingRecord:row,locations:labels,nativeMicrodataDescriptionPreserved:true,lifecycleCleanupAllowed:false,sourceScopeComplete:false,sourceListingComplete:false,applicationVisited:false,firstEverPublication:null,legalEmployer:null,sourcePublicationDateBasis:'native-datePosted;original-first-ever-publication-unknown'}},
  projectJobs(result){const{jobs,listingRecords,retainedResponses,unknownRawFailures,...summary}=result,delegated=child?[]:listingRecords.filter(r=>r.nativeCountryCodes.includes('IN')&&r.url.includes('/holcim_ghbs/job/')),compact={...summary,extractedDetailJobs:jobs.length,listingRecordCount:listingRecords.length,unknownRawFailureCount:unknownRawFailures.length,delegatedIndiaRecords:delegated.map(r=>({id:r.id,url:r.url,source:'holcimglobalhubbusinessservices'})),fullBatchEvidenceOnFirstExtractedJob:true,retainedResponses:retainedResponses.map(({url,status,bodyBytes,bodySHA256,requestedAt,completedAt})=>({url,status,bodyBytes,bodySHA256,requestedAt,completedAt}))};return jobs.map((j,i)=>({...j,nativeDelegatedIndiaRecords:compact.delegatedIndiaRecords,nativeCollectionEvidence:i===0?{...result,delegatedIndiaRecords:compact.delegatedIndiaRecords}:compact}))},
 }
}
const ownsParentJobs=jobs=>Array.isArray(jobs)&&jobs.every(job=>job&&job.source==='holcim'&&job.company==='Holcim'&&!job.sourceUrl?.includes('/holcim_ghbs/job/')&&Array.isArray(job.nativeDelegatedIndiaRecords)&&job.nativeDelegatedIndiaRecords.every(row=>row.source==='holcimglobalhubbusinessservices'))
export async function verifyHolcimRecruitmentReference({parentEvidence,parentJobs=[],transport,signal}={}){
 const requireReference=(condition,message)=>ensure(condition,'recruitment reference: '+message)
 const deadline=signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)
 let listener
 try{
  deadline.throwIfAborted()
  requireReference(ownsParentJobs(parentJobs),'Parent/child ownership or attribution changed')
  requireReference(parentEvidence?.source==='holcim'&&parentEvidence.handoffVerified===true&&Array.isArray(parentEvidence.listingRecords)&&Array.isArray(parentEvidence.retainedResponses),'Actual parent native binding/listing unavailable')
  const decode=response=>{
   requireReference(response?.status===200&&typeof response.rawBodyBase64==='string'&&/^text\/html\b/i.test(response.headers?.['content-type']||''),'Parent native HTML response unavailable')
   const body=Buffer.from(response.rawBodyBase64,'base64');requireReference(body.length>0&&body.length<=2*1024*1024,'Parent native response body bound')
   return{...response,body,html:new TextDecoder('utf-8',{fatal:true}).decode(body)}
  }
  const home=decode(parentEvidence.retainedResponses.find(response=>response.url===HOME))
  const parentConfig=createSourceConfig()
  for(const step of parentConfig.handoffs)step.verify(home.html)
  const parentRows=parentEvidence.listingRecords.filter(row=>row.url?.startsWith(ORIGIN+'/holcim_ghbs/job/')&&row.nativeCountryCodes?.includes('IN'))
  requireReference(parentRows.length>0,'No actual parent India business-unit reference')
  const childConfig=createSourceConfig({source:'holcimglobalhubbusinessservices'})
  const read=transport||createHTMLTransport(childConfig,{signal:deadline})
  const page=await Promise.race([Promise.resolve().then(()=>read(CATEGORY,{method:'GET',redirect:'manual',credentials:'omit',signal:deadline})),new Promise((_,reject)=>{listener=()=>reject(deadline.reason);deadline.addEventListener('abort',listener,{once:true})})])
  deadline.throwIfAborted()
  requireReference(page?.url===CATEGORY&&(page.finalUrl??page.url)===CATEGORY&&page.status===200&&page.bodyComplete===true&&page.body instanceof Uint8Array&&page.body.length>0&&page.body.length<=2*1024*1024&&/^text\/html\b/i.test(page.headers?.['content-type']||''),'Child native HTTP identity, MIME or body unavailable')
  const html=new TextDecoder('utf-8',{fatal:true}).decode(page.body),doc=readNativeDocument(html)
  const canonical=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
  requireReference(canonical.length===1&&canonical[0].attrs.href===CATEGORY&&doc.nodes(node=>node.tag==='title').some(node=>norm(node.raw)==='Global Hub Business Services'),'Child native company/category identity unavailable')
  const anchors=doc.nodes(node=>node.tag==='a'&&node.attrs.href)
  requireReference(anchors.some(node=>new URL(node.attrs.href,ORIGIN).href===CATEGORY&&doc.text(node)==='Jobs at Holcim Global Hub Business Services')&&anchors.some(node=>new URL(node.attrs.href,ORIGIN).href===ORIGIN+'/go/All-Jobs/8790902/'&&doc.text(node)==='Holcim Group Jobs'),'Explicit child self-label or reciprocal Holcim group handoff unavailable')
  const category=childConfig.parseListing(html,CATEGORY)
  requireReference(category.errors.length===0,'Unresolved child native tile criteria')
  const tuple=row=>JSON.stringify([row.id,row.title,row.url,row.locations,row.nativeCountryCodes])
  const match=parentRows.find(parent=>category.records.some(child=>child.nativeCountryCodes.includes('IN')&&tuple(child)===tuple(parent)))
  requireReference(match,'Current native posting/title/URL/typed-location tuple does not reconcile')
  requireReference(parentJobs.every(job=>job.nativeDelegatedIndiaRecords.some(reference=>reference.id===match.id&&reference.url===match.url&&reference.source==='holcimglobalhubbusinessservices')),'Matching child ownership reference unavailable')
  const listing=parentEvidence.retainedResponses.filter(response=>response.url!==HOME&&response.status===200).map(decode).find(response=>typeof match.rawListingHTML==='string'&&response.html.includes(match.rawListingHTML))
  requireReference(listing,'Actual parent native row backing unavailable')
  const native=[{...home,finalUrl:home.url,capturedAt:home.completedAt},{...listing,finalUrl:listing.url,capturedAt:listing.completedAt},{...page,body:Buffer.from(page.body),finalUrl:page.finalUrl??page.url,capturedAt:page.completedAt??page.capturedAt}]
  // This is a current recruitment-surface reference, not executable child
  // delegation, matching wrapper jobs, child totals or company completeness.
  // Historic and untimed transports never acquire the source invocation clock.
  if(!native.every(response=>typeof response.capturedAt==='string'&&Number.isFinite(Date.parse(response.capturedAt))&&Date.parse(response.capturedAt)>0&&Date.parse(response.capturedAt)<=Date.now()))return null
  return{source:'holcim',sources:['holcimglobalhubbusinessservices'],preservesChildSourceAndCompany:true,
   verifiedAt:new Date(Math.min(...native.map(response=>Date.parse(response.capturedAt)))).toISOString(),
   evidence:{method:'native-group-and-business-unit-recruitment-reference',url:CATEGORY,responses:native.map(response=>({url:response.url,finalUrl:response.finalUrl,status:response.status,sha256:createHash('sha256').update(response.body).digest('hex')}))}}
 }catch(error){signal?.throwIfAborted();deadline.throwIfAborted();throw Object.assign(Error('Holcim native recruitment reference unverified: '+error.message,{cause:error}),{abortRetries:true})}
 finally{deadline.removeEventListener('abort',listener)}
}

export const runFamily=async(source,options={})=>{
 if(source!=='holcim')return createFirstPartyHTMLScraper(createSourceConfig({...options,source})).run(options)
 const deadline=AbortSignal.timeout(540000),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
 const jobs=await createFirstPartyHTMLScraper(createSourceConfig({...options,source})).run({...options,signal})
 signal.throwIfAborted()
 ensure(ownsParentJobs(jobs),'recruitment reference: Parent/child ownership changed')
 try{
  const proof=await verifyHolcimRecruitmentReference({parentEvidence:jobs[Symbol.for('jobverify.native-html-evidence')],parentJobs:jobs,transport:options.transport,signal})
  if(proof)attachInventoryDelegationEvidence(jobs,proof)
  Object.defineProperty(jobs,'sourceDelegationAudit',{value:{status:proof?'native-scoped-reference-verified':'unverified',referenceOnly:true,childExecuted:false,childCountsInferred:false,wholeCompanyComplete:false,reason:proof?'native-same-tenant-business-unit-reference':'native-reference-clock-unavailable-or-future'}})
 }catch(error){
  signal.throwIfAborted()
  // A failed optional relationship check cannot discard genuine own jobs or
  // convert their already partial inventory into a current child reference.
  Object.defineProperty(jobs,'sourceDelegationAudit',{value:{status:'unverified',referenceOnly:true,childExecuted:false,childCountsInferred:false,wholeCompanyComplete:false,reason:error.message}})
 }
 signal.throwIfAborted();return jobs
}
