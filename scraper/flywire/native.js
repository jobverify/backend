import {buildWorkdayDetailApiUrl,extractWorkdayStructuredDetail} from '../../scraper-support/myworkday/engine.js'
import {fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {readNativeDocument,extractActiveDescription,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {isJobInPublicLocationScope} from '../../src/utils/publicJobLocationScope.js'

export const CAREERS='https://www.flywire.com/company/careers'
export const BOARD='https://flywire.wd108.myworkdayjobs.com/flywirecareers'
export const API='https://flywire.wd108.myworkdayjobs.com/wday/cxs/flywire/flywirecareers/jobs'
const CLIENT='https://prod-wd108.myworkdaycdn.com/wday/asset/candidate-experience-jobs/cx-jobs.min.js'
const INDIA='c4f78be1a8f14da0ab49ce1162348a5e'
// Independently advertised by the board shell's og:description. JobPosting
// appends this non-role text after the complete CXS description on this board.
// Any changed appendix must be reviewed; role prose cannot be discarded as one.
const BOARD_DESCRIPTION='At Flywire, curiosity, meaningful growth, impact, and connection shape everything we do. Our people are trusted, humble, smart, and committed to raising the bar. If you are energized by challenging work, thoughtful collaboration, and building solutions that help the world move money seamlessly, you’ll feel at home here. Not seeing the right role today? Introduce yourself anyway. Share your background and interests, and our recruiting team will reach out if we find the perfect match. Our work experience is the combination of everything that is unique about us: our culture, our core values, our sustainability commitments, our recognition programs, and most importantly, our people. We act with integrity, choose to do the right thing, support each other, and thrive as one global team.'
const check=(ok,message)=>{if(!ok)throw Error('Flywire native: '+message)}
const plain=v=>typeof v==='string'&&v.trim().length>0
const norm=v=>decodeNativeEntities(String(v)).replace(/\s+/g,'').trim()
const key=v=>String(v).toLowerCase().replace(/\b(?:india|ind|in)\b/g,'').replace(/[^\p{L}\p{N}]/gu,'')
const indiaCountryScope=value=>typeof value==='string'&&/^India(?:,\s*Remote)?$/i.test(value.trim())
const indiaCityLocation=value=>{
 const parts=value.split(',').map(part=>part.trim())
 return (parts.length===1||(parts.length===2&&parts[1]==='India'))&&parts[0]
   &&! /^(?:Remote|India|IN|IND)$/i.test(parts[0])&&isJobInPublicLocationScope({location:parts[0]})
}
const closed=/\b(?:(?:job|position|role)\s+(?:is\s+|has been\s+)?(?:closed|filled|expired|removed|no longer available)|no longer accepting applications|applications (?:are |have been )?closed)\b/i
function envelope(p){
 check(p&&typeof p==='object'&&!Array.isArray(p),'Invalid native envelope')
 for(const[k,v]of Object.entries(p)){
  const name=k.toLowerCase().replace(/[_\s-]/g,'')
  check(!['error','errors','errorcode','errormessage','exception','fault'].includes(name),'Native error envelope')
  if(name==='success')check(v===true,'Native unsuccessful envelope')
  if(['status','statuscode','httpstatus','httpstatuscode'].includes(name)&&typeof v!=='object')check(['200','ok','success','successful'].includes(String(v).toLowerCase()),'Native failure status')
  if(['meta','metadata','response','result'].includes(name)&&v!=null)envelope(v)
 }
 return p
}
function row(r){
 check(r&&plain(r.title)&&plain(r.locationsText)&&plain(r.externalPath)&&/^\/job\/[^?#]+\/[^/?#]+$/.test(r.externalPath)&&!/%2f|%5c|\.\./i.test(r.externalPath),'Invalid listing identity')
 check(Array.isArray(r.bulletFields)&&r.bulletFields.length===1&&/^(?:JR|R)-\d+$/.test(r.bulletFields[0]),'Invalid native requisition')
 return r
}
function orderedFacets(entries,groupsOnly=false){
 check(Array.isArray(entries),'Invalid native facet inventory')
 const seen=new Set()
 return entries.map(entry=>{
  check(entry&&typeof entry==='object'&&!Array.isArray(entry),'Invalid native facet identity')
  const group=Array.isArray(entry.values),id=group?entry.facetParameter:entry.id
  check((!groupsOnly||group)&&plain(id),'Invalid native facet identity')
  const identity=(group?'facet:':'value:')+id
  check(!seen.has(identity),'Duplicate native facet identity');seen.add(identity)
  if(entry.count!=null)check(Number.isSafeInteger(entry.count)&&entry.count>=0,'Invalid native facet count')
  return {identity,value:group?{...entry,values:orderedFacets(entry.values)}:{...entry}}
 }).sort((a,b)=>a.identity.localeCompare(b.identity)).map(entry=>entry.value)
}
export function parsePage(text,offset,total){
 const p=envelope(JSON.parse(text));check(Array.isArray(p.jobPostings)&&Number.isSafeInteger(p.total)&&p.total>=0,'Invalid listing records/total')
 const declared=offset===0?p.total:total
 check(declared>0&&declared<=100,'Empty or over-cap native board; zero remains unverified')
 // The captured current client preserves the first-page total when later CXS
 // pages return zero. It resets to page one if offset reaches the total.
 check(offset===0||p.total===0||p.total===total,'Native total drift')
 check(p.jobPostings.length===Math.min(20,declared-offset),'Incomplete native page')
 p.jobPostings.forEach(row);check(new Set(p.jobPostings.map(r=>r.externalPath)).size===p.jobPostings.length,'Duplicate native page identities')
 // Native filter options are keyed by parameter/id. Equal-count options can
 // arrive in different presentation order; preserve all values and counts.
 if(p.facets!=null)p.facets=orderedFacets(p.facets,true)
 return p
}
export function parseBinding(corporate,shell,client){
 const d=readNativeDocument(corporate),links=d.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD&&/^(?:Current )?Job Openings$/i.test(d.text(n)))
 check(links.length>0,'Official corporate job-opening handoff missing')
 check(/tenant:\s*"flywire"/.test(shell)&&/siteId:\s*"flywirecareers"/.test(shell)&&/postingAvailable:\s*null/.test(shell),'Current native board identity changed')
 check(shell.includes('prod-wd108.myworkdaycdn.com')&&shell.includes('/wday/asset/candidate-experience-jobs/')&&shell.includes('cx-jobs.min.js'),'Advertised native client changed')
 const board=readNativeDocument(shell),descriptions=board.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:description')
 check(descriptions.length===1&&norm(descriptions[0].attrs.content)===norm(BOARD_DESCRIPTION),'Independently identified board description changed')
 for(const marker of ['/wday/cxs/${workday.tenant}/${s}/jobs','appliedFacets:e,limit:n,offset:r,searchText:a(t)','method:"POST"','/${encodeURIComponent(e.jobPostingId)}/apply'])check(client.includes(marker),'Advertised inventory/application contract changed')
}
function country(c){
 check(c&&plain(c.descriptor)&&/^[a-f0-9]{32}$/.test(c.id),'Native typed country absent')
 const india=c.id===INDIA
 check(india===(c.descriptor==='India'),'Native country identity contradiction')
 if(c.alpha2Code!=null)check(/^[A-Z]{2}$/.test(c.alpha2Code)&&(c.alpha2Code==='IN')===india,'Native country code contradiction')
 return india
}
export function parseNativeDetail(text,r,{now=new Date().toISOString()}={}){
 row(r);const p=envelope(JSON.parse(text)),i=p.jobPostingInfo
 check(i&&i.jobPostingSiteId==='flywirecareers'&&/^[a-f0-9]{32}$/.test(i.id)&&i.jobReqId===r.bulletFields[0]&&i.title===r.title,'Native detail title/requisition/board mismatch')
 envelope(i);check(i.posted===true&&i.canApply===true,'Native role is closed or application status unavailable')
 if(i.endDate!=null){date(i.endDate,now,false);check(i.endDate>=now.slice(0,10),'Past native closing date')}
 const canonical=BOARD+r.externalPath
 check(i.externalUrl===canonical&&i.jobPostingId===new URL(canonical).pathname.split('/').at(-1),'Canonical/application posting identity mismatch')
 check(new RegExp('_'+i.jobReqId+'(?:-\\d+)?$').test(i.jobPostingId),'Native posting requisition suffix mismatch')
 check(plain(i.location)&&plain(i.jobRequisitionLocation?.descriptor),'Native location missing')
 const india=country(i.country),reqIndia=country(i.jobRequisitionLocation.country)
 check(india===reqIndia&&i.country.id===i.jobRequisitionLocation.country.id&&i.country.descriptor===i.jobRequisitionLocation.country.descriptor,'Native countries conflict')
 check(Array.isArray(i.additionalLocations??[]),'Invalid additional locations')
 for(const l of i.additionalLocations??[])if(l&&typeof l==='object'&&l.country)check(country(l.country)===india&&l.country.id===i.country.id,'Conflicting native secondary country')
 const locations=[i.location,...(i.additionalLocations??[]).map(l=>typeof l==='string'?l:l?.descriptor)]
 check(Array.isArray(i.additionalLocations??[])&&locations.every(plain),'Invalid additional locations')
 const countryScopedRequisition=india&&indiaCountryScope(i.jobRequisitionLocation.descriptor)
 if(india){
  check(i.jobRequisitionLocation.country.alpha2Code==='IN','Native India ISO country missing')
  // A native India/India, Remote requisition describes country scope rather
  // than another city. Specific city descriptors still require exact agreement.
  check(locations.every(l=>(key(l)===key(i.jobRequisitionLocation.descriptor)||(countryScopedRequisition&&indiaCityLocation(l)))
   &&isJobInPublicLocationScope({country:'India',location:l})),'Native India country/location contradiction')
 }else check(!locations.some(l=>/\bIndia\b/i.test(l)||isJobInPublicLocationScope({location:l})),'Foreign country with unresolved India/secondary location')
 if(!/^\d+ Locations?$/i.test(r.locationsText))check(r.locationsText===i.location,'Listing/detail location mismatch')
 else check(Number(r.locationsText.split(' ')[0])===locations.length,'Grouped location count mismatch')
 check(typeof i.jobDescription==='string','Native description field malformed')
 check(!closed.test(extractActiveDescription(i.jobDescription)||''),'Native closed-role description')
 const cxsEmployer=p.hiringOrganization?.name
 check(cxsEmployer==null||typeof cxsEmployer==='string','Malformed native employer')
 return {payload:p,info:i,india,locations,canonical,countryScopedRequisition,listingLocation:r.locationsText,cxsEmployer:cxsEmployer?.trim()||null}
}
function date(value,now,publication=true){
 if(value==null||value==='')return null
 check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'Invalid native publication date')
 const d=new Date(value+'T00:00:00.000Z');check(Number.isFinite(+d)&&d.toISOString().slice(0,10)===value&&(!publication||+d<=Date.parse(now)),'Invalid/future native publication date')
 return d.toISOString()
}
export function parseIndiaPage(html,native,{now}){
 const{info:i,payload,canonical,locations,countryScopedRequisition}=native,d=readNativeDocument(html)
 const canonicalLinks=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 const htmlCanonical='https://flywire.wd108.myworkdayjobs.com/en-US/flywirecareers/job/'+i.jobPostingId
 check(canonicalLinks.length===1&&canonicalLinks[0].attrs.href===htmlCanonical,'Native HTML canonical mismatch')
 const scripts=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),postings=scripts.map(n=>JSON.parse(n.raw)).filter(p=>p['@type']==='JobPosting')
 check(postings.length===1,'Missing or ambiguous native JobPosting')
 const ld=postings[0];check(typeof ld.title==='string'&&decodeNativeEntities(ld.title)===i.title
  &&ld.identifier?.value===i.jobReqId&&typeof ld.identifier.name==='string'&&decodeNativeEntities(ld.identifier.name)===i.title,
  `HTML posting identity mismatch for ${i.jobReqId}: native title ${JSON.stringify(i.title)}, HTML title ${JSON.stringify(ld.title)}, identifier ${JSON.stringify(ld.identifier)}`)
 const places=Array.isArray(ld.jobLocation)?ld.jobLocation:[ld.jobLocation]
 check(places.length>0&&places.every(p=>p?.address?.addressCountry==='India'
  &&(locations.some(l=>key(l)===key(p.address.addressLocality))
   ||(countryScopedRequisition&&indiaCountryScope(p.address.addressLocality)&&key(p.address.addressLocality)===key(i.jobRequisitionLocation.descriptor)))),'Native HTML typed India geography mismatch')
 if(ld.applicantLocationRequirements)check(ld.applicantLocationRequirements.name==='India','Native applicant country contradiction')
 const employer=ld.hiringOrganization?.name?.trim()||null
 check(employer===null||employer==='FW Solutions India LLP [India]','Unreviewed native role employer')
 check(!native.cxsEmployer||native.cxsEmployer===employer,'Native employer contradiction')
 const structured=extractWorkdayStructuredDetail(payload),active=extractActiveDescription(i.jobDescription)
 const substantive=Boolean(structured?.sourceDescription&&active&&active.length>300&&/\b(?:responsibilities|requirements|qualifications|experience|skills|you will|job summary|the opportunity)\b/i.test(active))
 if(substantive){
  const full=norm(structured.sourceDescription),htmlFull=norm(ld.description)
  check(htmlFull===full||htmlFull===full+norm(BOARD_DESCRIPTION),'Native HTML/full JD completeness contradiction')
 }
 check(!closed.test(ld.description||''),'Native HTML role closed')
 const postedAt=date(ld.datePosted,now)
 if(ld.validThrough!=null){date(ld.validThrough,now,false);check(ld.validThrough>=now.slice(0,10),'Past native HTML closing date')}
 if(ld.validThrough!=null&&i.endDate!=null)check(ld.validThrough===i.endDate,'Conflicting native closing dates (CXS '+i.endDate+'; HTML '+ld.validThrough+')')
 const closingDate=ld.validThrough??i.endDate??null
 return {
  source:'flywire',company:'Flywire',jobId:i.jobReqId,requisitionId:i.jobReqId,title:i.title,country:'India',
  city:countryScopedRequisition?(indiaCityLocation(i.location)?i.location.split(',')[0].trim():null):places[0].address.addressLocality,state:null,
  location:i.location,locations,sourceUrl:canonical,link:canonical,nativeHtmlCanonical:htmlCanonical,
  // The advertised current client constructs this route from native location
  // and exact jobPostingId. No form is opened or submitted by this scraper.
  applyUrl:BOARD+'/job/'+encodeURIComponent(i.location.replaceAll(' ','-'))+'/'+encodeURIComponent(i.jobPostingId)+'/apply',
  sourceDescription:substantive?i.jobDescription:null,jobDescription:substantive?structured.sourceDescription:null,
  sourceDetailComplete:substantive,sourceDetailStatus:substantive?'complete':'missing-or-instruction-only-native-description',
  nativeDescriptionOriginal:i.jobDescription,nativeListingDetailOriginal:payload,nativeStructuredJobPosting:ld,
  nativeDatePosted:ld.datePosted??null,nativeStartDate:i.startDate??null,nativePostedOn:i.postedOn??null,nativeEndDate:i.endDate??null,nativeValidThrough:ld.validThrough??null,
  nativeLegalEmployer:employer,nativeCxsEmployer:native.cxsEmployer,nativeCountryOriginal:i.country,nativeLocationOriginal:i.location,
  nativeRequisitionLocationOriginal:i.jobRequisitionLocation,nativeRemoteTypeOriginal:i.remoteType??null,
  ...(countryScopedRequisition?{sourceWorkplaceEvidence:{kind:'native-india-country-scope',listingLocation:native.listingLocation,
   publicPostingLocation:i.location,requisitionLocation:i.jobRequisitionLocation,structuredLocations:places,nativeRemoteType:i.remoteType??null,
   cityProvenance:'native-public-posting-location',workArrangementQualified:false}}:{}),
  postedAt,postingDate:postedAt,closingDate,sourceClosingDateIsExact:false,
  closingDateProvenance:ld.validThrough!=null?'official-jobposting-jsonld-validThrough':i.endDate!=null?'official-workday-cxs-endDate':null,nativeDateUnknown:postedAt===null,
  publicationDateQualified:postedAt!==null,publicationDateProvenance:postedAt?'official-jobposting-jsonld-datePosted':null,originalPublicationDateQualified:false,
  applicationAccessValidated:false,applicationEligibilityQualified:false,applicationAccess:'advertised-native-route-only',applicationSubmitted:false,
  sourceListingComplete:false,sourceScopeComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,scrapedAt:now,
 }
}
export async function runNativeFlywire(options={}){
 check(options.maxJobs==null,'Native inventory truncation forbidden')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),timeout=options.timeoutMs??180000
 check(Number.isFinite(Date.parse(now))&&Number.isInteger(timeout)&&timeout>0&&timeout<=300000,'Invalid bounded runtime options')
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),fetchImpl=options.fetchImpl??globalThis.fetch
 let count=0
 async function request(url,body,kind='json'){
  signal.throwIfAborted();check(++count<=200,'Native request cap exceeded');check(!body||url===API,'Only advertised inventory POST permitted')
  const text=await fetchTextWithRetry(url,{attempts:1,timeoutMs:25000,signal,method:body?'POST':'GET',body,redirect:kind==='client'?'follow':'error',headers:{Accept:kind==='json'?'application/json':kind==='client'?'application/javascript':'text/html','Content-Type':'application/json','User-Agent':'Mozilla/5.0'},fetchImpl:async(u,init)=>{
   const r=await fetchImpl(u,init);signal.throwIfAborted();check(r.status===200,'Native upstream HTTP '+r.status)
   const final=new URL(r.url),expected=new URL(url)
   check(kind==='client'?final.origin===expected.origin&&/^\/wday\/asset\/candidate-experience-jobs\/(?:[\d.]+\/)?cx-jobs.min.js$/.test(final.pathname):r.url===url,'Native final URL mismatch')
   const type=r.headers?.get?.('content-type')||'';check(kind==='json'?/application\/json/i.test(type):kind==='client'?/javascript|ecmascript/i.test(type):/text\/html/i.test(type),'Native content type mismatch');return r
  }})
  check(text.length<=4000000,'Native response over cap');signal.throwIfAborted();return text
 }
 async function pool(items,fn){let i=0;const result=new Array(items.length);const states=await Promise.allSettled(Array.from({length:Math.min(3,items.length)},async()=>{while(i<items.length){signal.throwIfAborted();const at=i++;result[at]=await fn(items[at])}}));const failed=states.find(s=>s.status==='rejected');if(failed)throw failed.reason;return result}
 const corporate=await request(CAREERS,null,'html'),shell=await request(BOARD,null,'html'),client=await request(CLIENT,null,'client');parseBinding(corporate,shell,client)
 const getPage=async(offset,total)=>parsePage(await request(API,JSON.stringify({appliedFacets:{},limit:20,offset,searchText:''})),offset,total)
 const first=await getPage(0),offsets=Array.from({length:Math.ceil(first.total/20)},(_,i)=>i*20),pages=[first,...await pool(offsets.slice(1),o=>getPage(o,first.total))],rows=pages.flatMap(p=>p.jobPostings)
 check(rows.length===first.total&&new Set(rows.map(r=>r.externalPath)).size===rows.length&&new Set(rows.map(r=>r.bulletFields[0])).size===rows.length,'Native total or unique identity mismatch')
 const getDetail=r=>request(buildWorkdayDetailApiUrl(BOARD+r.externalPath,API)).then(t=>parseNativeDetail(t,r,{now}))
 const details=await pool(rows,getDetail),india=details.filter(d=>d.india)
 check(india.length>0,'No qualified India records; zero remains unverified')
 const jobs=await pool(india,async d=>parseIndiaPage(await request(d.canonical,null,'html'),d,{now}))
 const finalPages=await pool(offsets,o=>getPage(o,first.total));check(JSON.stringify(pages)===JSON.stringify(finalPages),'Native inventory changed during reconciliation')
 const finalDetails=await pool(rows,getDetail);check(JSON.stringify(details)===JSON.stringify(finalDetails),'Native details changed during reconciliation')
 const finalJobs=await pool(finalDetails.filter(d=>d.india),async d=>parseIndiaPage(await request(d.canonical,null,'html'),d,{now}));check(JSON.stringify(jobs)===JSON.stringify(finalJobs),'Native India metadata changed during reconciliation')
 signal.throwIfAborted();for(const j of jobs){j.sourceObservedNativeRecords=rows.length;j.sourceObservedNativeIndiaRecords=india.length;j.sourceCheckedAPIEnumerationComplete=true;j.sourceCheckedAPIReconciled=true}
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:pages.length*2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'checked-official-board-exhausted-reconciled-original-publication-and-application-access-unqualified'})
}
