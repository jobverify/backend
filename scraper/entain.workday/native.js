import {runApiPortalScraper} from '../../scraper-support/apiPortal/engine.js'
import {fetchSmartRecruitersDetail} from '../../scraper-support/apiPortal/smartRecruitersDetail.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const CORPORATE='https://www.entaingroup.com/'
export const API='https://api.smartrecruiters.com/v1/companies/Entain/postings'
const CAREER='https://careers.smartrecruiters.com/Entain',MAX_RECORDS=300
const check=(ok,message)=>{if(!ok)throw Error('Entain native: '+message)}
const plain=v=>typeof v==='string'&&v.trim().length>0
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const CLOSED=/\b(?:(?:this |the )?(?:job|position|role)\s+(?:is\s+|has been\s+)?(?:closed|filled|expired|removed|no longer available)|no longer (?:accepting applications|available)|applications (?:are |have been )?closed)\b/i

export function parseBinding(html){
 check(typeof html==='string'&&html.length<=3000000,'Corporate body unavailable or over limit')
 const d=readNativeDocument(html),links=d.nodes(n=>n.tag==='a'&&n.attrs.href===CAREER&&/^Careers$/i.test(d.text(n)))
 check(links.length>0,'Current corporate active Careers link does not bind native Entain token')
 return CAREER
}
function release(value,now){
 check(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value&&Date.parse(value)<=Date.parse(now)+60000,'Native releasedDate missing, malformed or future')
 return value
}
function rowContract(row,now){
 check(row&&typeof row==='object'&&!Array.isArray(row),'Malformed native listing')
 check(typeof row.id==='string'&&/^\d{1,25}$/.test(row.id)&&plain(row.name)&&plain(row.refNumber)&&plain(row.uuid)&&plain(row.jobAdId),'Native posting/title/requisition identity missing')
 check(row.company?.identifier==='Entain'&&row.company?.name==='Entain'&&row.visibility==='PUBLIC','Native company/public visibility mismatch')
 check(row.location?.country==='in'&&plain(row.location.city)&&plain(row.location.fullLocation)&&/\bIndia$/.test(row.location.fullLocation),'Native explicit India country/location missing or conflicting')
 // fullLocation may start with a state or office. Require its comma-delimited
 // geography to contain the typed native city, without deriving a city from
 // the first label or silently choosing between contradictory native fields.
 const normalized=value=>value.replace(/\s+/g,' ').trim().toLowerCase()
 check(row.location.fullLocation.split(',').some(part=>normalized(part)===normalized(row.location.city)),'Native city contradicts or is absent from fullLocation')
 check(row.ref===API+'/'+row.id,'Native detail ref or posting ID mismatch')
 release(row.releasedDate,now)
 return row
}
export function parsePage(payload,offset,{now=new Date().toISOString()}={}){
 check(payload&&typeof payload==='object'&&!Array.isArray(payload)&&!payload.error&&payload.success!==false&&!(Array.isArray(payload.errors)&&payload.errors.length),'Native upstream listing error')
 check(payload.offset===offset&&payload.limit===100&&Number.isSafeInteger(payload.totalFound)&&payload.totalFound>=0&&payload.totalFound<=MAX_RECORDS&&Array.isArray(payload.content),'Native offset/limit/total/content contract mismatch')
 check(payload.content.length===Math.min(100,Math.max(0,payload.totalFound-offset)),'Native page size contradicts total')
 payload.content.forEach(row=>rowContract(row,now))
 check(new Set(payload.content.map(row=>row.id)).size===payload.content.length,'Duplicate native IDs within page')
 return payload
}
function postingURL(value,id){
 let u;try{u=new URL(value)}catch{check(false,'Native public posting URL absent')}
 check(u.protocol==='https:'&&u.hostname==='jobs.smartrecruiters.com'&&!u.port&&!u.username&&!u.password&&!u.hash&&!u.search&&new RegExp('^/Entain/'+id+'(?:-[^/]+)?/?$').test(u.pathname),'Native public posting tenant/ID mismatch')
 return u
}
export async function parseDetail(payload,row,{now=new Date().toISOString()}={}){
 rowContract(row,now)
 check(payload&&typeof payload==='object'&&!payload.error&&payload.success!==false&&!(Array.isArray(payload.errors)&&payload.errors.length),'Native upstream detail error')
 for(const key of ['id','name','uuid','jobAdId','refNumber','releasedDate'])check(payload[key]===row[key],'Native listing/detail '+key+' mismatch')
 check(payload.company?.identifier==='Entain'&&payload.company?.name==='Entain'&&equal(payload.location,row.location),'Native listing/detail company/location mismatch')
 check(payload.active===true&&payload.visibility==='PUBLIC','Native role inactive or private')
 check(plain(payload.jobId),'Native job UUID missing')
 const posted=postingURL(payload.postingUrl,row.id)
 let apply;try{apply=new URL(payload.applyUrl)}catch{check(false,'Configured native apply URL missing')}
 check(apply.origin===posted.origin&&apply.pathname===posted.pathname&&!apply.username&&!apply.password&&!apply.hash&&apply.searchParams.size===1&&apply.searchParams.get('oga')==='true','Native configured application tenant/role/control mismatch')
 const description=extractActiveDescription(payload.jobAd?.sections?.jobDescription?.text)
 const activeSections=Object.values(payload.jobAd?.sections??{}).map(s=>extractActiveDescription(s?.text)).filter(Boolean).join('\n')
 const substantive=description?.split(/(?<=[.!?])\s+/).filter(s=>!/(?:please\s+)?(?:click|apply now|check back|see the full job description)/i.test(s)).join(' ')??''
 check(plain(description)&&!CLOSED.test(activeSections)&&substantive.replace(/[^\p{L}\p{N}]/gu,'').length>200&&/\b(?:responsibilities|requirements|qualifications|what you|who you|experience|skills|duties|you will|the role|working with|working closely)\b/i.test(substantive),'Closed, missing or instruction-only native role description')
 // Shared exact-tenant/native-country/full-description validator; the payload
 // was fetched once from the documented native ref. No public URL is invented.
 const shared=await fetchSmartRecruitersDetail({publicUrl:payload.postingUrl,expectedCompany:'Entain',expectedCountry:'in',expectedLocation:row.location.city,fetchJson:async url=>{check(url===row.ref,'Shared native detail ref mismatch');return payload}})
 return {...payload,...shared}
}

export async function run(options={}){
 check(options.maxJobs==null,'Native truncation forbidden')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),timeoutMs=options.timeoutMs??180000
 check(Number.isFinite(Date.parse(now))&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000,'Invalid bounded options')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Entain source deadline')),timeoutMs)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,fetchImpl=options.fetchImpl??globalThis.fetch
 let requests=0
 async function bounded(fn){
  signal.throwIfAborted();let listener
  try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);signal.throwIfAborted()}
 }
 async function get(url,type='application/json'){
  check(++requests<=650,'Native request cap exceeded')
  const text=await bounded(()=>fetchTextWithRetry(url,{attempts:1,timeoutMs:20000,signal,method:'GET',redirect:'error',headers:{Accept:type,'User-Agent':'Mozilla/5.0'},label:'entain',fetchImpl:async(u,init)=>{
   const response=await bounded(()=>fetchImpl(u,init))
   check(response.status===200&&response.url===url,'Upstream status or exact final URL mismatch ('+response.status+')')
   const content=response.headers?.get?.('content-type')??''
   check(type==='application/json'?/application\/json/i.test(content):/text\/html/i.test(content),'Native response content type changed')
   return response
  }}))
  check(typeof text==='string'&&text.length<=3000000,'Native body unavailable or over limit')
  return type==='application/json'?JSON.parse(text):text
 }
 const pages=[],rows=new Map(),details=new Map()
 function listingURL(offset){const u=new URL(API);u.searchParams.set('destination','PUBLIC');u.searchParams.set('country','in');u.searchParams.set('offset',offset);u.searchParams.set('limit',100);return u.href}
 async function fetchPortalJson(url){
  const u=new URL(url)
  if(u.pathname===new URL(API).pathname&&u.origin===new URL(API).origin){
   const offset=Number(u.searchParams.get('offset'))
   check(url===listingURL(offset)&&Number.isSafeInteger(offset)&&offset>=0,'Unreviewed native listing query')
   const page=parsePage(await get(url),offset,{now});check(!pages.length||page.totalFound===pages[0].payload.totalFound,'Native total drift')
   for(const row of page.content){check(!rows.has(row.id),'Duplicate native ID across pages');rows.set(row.id,row)}
   pages.push({url,payload:page});return page
  }
  const row=[...rows.values()].find(row=>row.ref===url);check(row,'Detail endpoint not advertised by current native listing')
  const payload=await get(url),parsed=await parseDetail(payload,row,{now});details.set(row.id,payload);return parsed
 }
 try{
  parseBinding(await get(CORPORATE,'text/html,application/xhtml+xml'))
  const provider={source:'entain',companyName:'Entain',countryFilter:'India',companyCareerPage:'https://entaincareers.com/',atsPlatform:'smartrecruiters-public-postings',config:{
   discovery:{listingApiUrl:API},request:{method:'GET',query:{destination:'PUBLIC',country:'in'}},pagination:{strategy:'offset-limit',offsetParam:'offset',limitParam:'limit',pageSize:100,totalCountPath:'totalFound',resultsPath:'content',maxPages:3},
   mapping:{jobId:'id',requisitionId:'refNumber',title:'name',location:'location.fullLocation',sourceUrl:'postingUrl',applyUrl:'applyUrl',postingDate:'releasedDate',employmentType:'typeOfEmployment.label',experienceLevel:'experienceLevel.label',remoteStatus:{path:'location.hybrid',valueMap:{true:'Hybrid',false:'On-site'}}},
   detail:{enabled:true,required:true,urlTemplate:API+'/{{jobId}}',concurrency:1,mapping:{jobDescription:'jobDescription',minimumQualification:'minimumQualification'}}
  }}
  const jobs=await runApiPortalScraper({provider,fetchJson:fetchPortalJson})
  check(readInventoryEvidence(jobs)?.listingComplete===true&&rows.size===pages[0].payload.totalFound&&details.size===rows.size,'Shared native inventory incomplete')
  // Confirm a genuine empty terminal beyond the declared list, then repeat all
  // pages and full details. A late closure, rate limit or changed field fails.
  const terminalURL=listingURL(rows.size),terminal=parsePage(await get(terminalURL),rows.size,{now})
  check(terminal.totalFound===rows.size&&terminal.content.length===0,'Native terminal mismatch')
  for(const p of pages){const last=parsePage(await get(p.url),p.payload.offset,{now});check(equal(last,p.payload),'Native listing fields changed during extraction')}
  const lastTerminal=parsePage(await get(terminalURL),rows.size,{now});check(equal(lastTerminal,terminal),'Native terminal changed during extraction')
  for(const row of rows.values()){const last=await get(row.ref);await parseDetail(last,row,{now});check(equal(last,details.get(row.id)),'Native detail fields changed during extraction')}
  signal.throwIfAborted()
  for(const job of jobs){const d=details.get(job.jobId),row=rows.get(job.jobId);Object.assign(job,{
   city:d.location.city,
   nativeReleasedDate:d.releasedDate,nativePublicationDate:d.releasedDate,nativeFirstPublicationDate:null,nativeUpdatedAt:null,nativeClosingDate:null,closingDate:null,postedAt:d.releasedDate,publicationDateQualified:true,nativeDateUnknown:false,
   nativePostingStatus:{active:d.active,visibility:d.visibility},nativeLegalEmployer:null,nativeJobUUID:d.jobId,nativeLocationOriginal:d.location,nativeListingOriginal:row,nativeBrand:d.customField?.find(x=>x.fieldLabel==='Brands')?.valueLabel??null,
   sourceDescription:job.jobDescription,sourceDetailComplete:true,sourceDetailStatus:'active-public-native-full-JD',sourceListingComplete:false,sourceScopeComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,sourceObservedNativeIndiaRecords:rows.size,sourceCheckedNativeEnumerationComplete:true,sourceCheckedNativeReconciled:true,
   applicationAccessValidated:false,applicationEligibilityQualified:false,applicationSubmitted:false,applicationAccess:'configured-native-application-URL-only',scrapedAt:now,
  })}
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:listingURL(0),firstParty:true,listingComplete:false,pagesFetched:pages.length*2+2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:rows.size?'native-public-India-tenant-surface-exhausted-and-rechecked-whole-group-scope-unknown':'native-public-India-tenant-surface-verified-empty-whole-group-zero-unqualified'})
 }finally{clearTimeout(timer)}
}
