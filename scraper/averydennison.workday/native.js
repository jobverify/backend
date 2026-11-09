import {createHash} from 'node:crypto'
import {runApiPortalScraper} from '../../scraper-support/apiPortal/engine.js'
import {fetchSmartRecruitersDetail} from '../../scraper-support/apiPortal/smartRecruitersDetail.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const CORPORATE='https://www.averydennison.com/en/home/careers/search-jobs.html'
export const API='https://api.smartrecruiters.com/v1/companies/AveryDennison/postings'
const TENANT='AveryDennison',NAME='Avery Dennison',MAX_RECORDS=2500
const check=(ok,message)=>{if(!ok)throw Error('Avery Dennison native: '+message)}
const plain=v=>typeof v==='string'&&!!v.trim()
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const customFields=fields=>Array.isArray(fields)?fields.map(f=>({fieldId:f.fieldId,fieldLabel:f.fieldLabel,valueId:f.valueId,valueLabel:f.valueLabel})).sort((a,b)=>String(a.fieldId).localeCompare(String(b.fieldId))):null
const norm=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim().toLowerCase():''
const CLOSED=/\b(?:(?:this |the )?(?:job|position|role)\s+(?:is\s+|has been\s+)?(?:closed|filled|expired|removed|no longer available)|no longer (?:accepting applications|available)|applications (?:are |have been )?closed)\b/i
// Exact active inline client retained at the original corporate observation,
// 2026-10-21T21:12:09.018Z. A frontend revision requires requalification; it must
// never silently authorize another tenant or become a verified empty inventory.
const CLIENT_SHA256='3c58f77d88e80a5108fa559e8cfcc7d696ad15c987f955095cd5e50e1a39f4cf'
const INCOMPLETE_ROLE=/\b(?:description|posting|job ad)\b[^.!?]{0,80}\b(?:truncated|truncation|excerpt(?:ed)?|incomplete|abridged)\b|\b(?:truncated|excerpt(?:ed)?|incomplete|abridged)\b[^.!?]{0,60}\b(?:description|posting|job ad)\b|\b(?:read|view|see)\s+(?:the\s+)?full\s+(?:job\s+)?description\b|\bread\s+more\s*(?:[.!:]|$)/i

const classicScriptType=attrs=>{
 // HTML prepare-the-script-element steps 8-13: a present type overrides
 // language, including explicitly empty type. Only an absent type consults
 // nonempty legacy language. Unsupported type/language executes no JavaScript.
 const type=Object.hasOwn(attrs,'type')
  ?attrs.type===''?'text/javascript':attrs.type.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g,'')
  :attrs.language?'text/'+attrs.language:'text/javascript'
 return /^(?:application\/(?:ecmascript|javascript|x-ecmascript|x-javascript)|text\/(?:ecmascript|javascript(?:1\.[0-5])?|jscript|livescript|x-ecmascript|x-javascript))$/i.test(type)
}
export function parseBinding(html){
 check(typeof html==='string'&&html.length<=3000000,'Corporate body unavailable or over limit')
 const d=readNativeDocument(html),scripts=d.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'src')&&!Object.hasOwn(n.attrs,'nomodule')&&classicScriptType(n.attrs))
 // Authenticate the whole known executable body before reading its advertised
 // CONFIG/API. Quoted archives, comments and dead wrappers have another digest.
 // Never evaluate downloaded JavaScript or accept an unreviewed client revision.
 const matching=scripts.filter(n=>createHash('sha256').update(n.raw??'').digest('hex')===CLIENT_SHA256)
 check(matching.length===1,'Current active corporate client digest absent, duplicated or revised; coverage gap requires requalification')
 check(matching.every(n=>{
  const s=n.raw??''
  return /const\s+CONFIG\s*=\s*\{\s*company:\s*"AveryDennison"\s*,\s*apiBase:\s*"https:\/\/api\.smartrecruiters\.com\/v1\/companies"/.test(s)
   &&s.includes('`${CONFIG.apiBase}/${CONFIG.company}/postings?limit=${limit}&offset=${offset}`')
   &&s.includes('`${CONFIG.apiBase}/${CONFIG.company}/postings/${encodeURIComponent(id)}`')
 }),'Current active corporate client does not bind exact tenant and native listing/detail contract')
 return API
}
function release(value,now){
 check(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value&&Date.parse(value)<=Date.parse(now)+60000,'Native releasedDate missing, malformed or future')
}
function rowContract(row,now){
 check(row&&typeof row==='object'&&!Array.isArray(row),'Malformed listing row')
 check(typeof row.id==='string'&&/^\d{1,25}$/.test(row.id)&&plain(row.name)&&plain(row.refNumber)&&plain(row.uuid)&&plain(row.jobAdId),'Native posting/title/requisition identity missing')
 check(row.company?.identifier===TENANT&&row.company?.name===NAME&&row.visibility==='PUBLIC','Native company or public visibility mismatch')
 check(row.ref===API+'/'+row.id,'Native detail ref or ID mismatch');release(row.releasedDate,now)
 const l=row.location,fields=row.customField
 check(l&&/^[a-z]{2}$/.test(l.country)&&plain(l.city)&&plain(l.fullLocation)&&Array.isArray(fields),'Typed native geography missing')
 const countries=fields.filter(f=>f.fieldId==='COUNTRY')
 check(countries.length===1,'Native Country/Region missing or duplicated')
 if(l.country==='in'||countries[0].valueId==='in'||/\bIndia$/.test(l.fullLocation)||fields.some(f=>norm(f.valueLabel)==='india'&&/country/i.test(f.fieldLabel))){
  check(l.country==='in'&&countries[0].valueId==='in'&&/\bIndia$/.test(l.fullLocation)&&countries[0].valueLabel==='India','Native India country or fullLocation conflict')
  const vacancy=fields.filter(f=>f.fieldLabel==='Country of vacancy')
  check(vacancy.length===1&&vacancy[0].valueLabel==='India','Native Country of vacancy missing or conflicting')
  // Preserve native punctuation: one older record supplies city Bengaluru,.
  const city=norm(l.city).replace(/,+$/,'')
  check(l.fullLocation.split(',').some(part=>norm(part)===city),'Native city contradicts fullLocation')
 }
 return row
}
export function parsePage(payload,offset,{now=new Date().toISOString()}={}){
 check(payload&&typeof payload==='object'&&!Array.isArray(payload)&&!payload.error&&payload.success!==false&&!(Array.isArray(payload.errors)&&payload.errors.length),'Native upstream listing error')
 check(payload.offset===offset&&payload.limit===100&&Number.isSafeInteger(payload.totalFound)&&payload.totalFound>=0&&payload.totalFound<=MAX_RECORDS&&Array.isArray(payload.content),'Native page offset/limit/total/content mismatch')
 check(payload.content.length===Math.min(100,Math.max(0,payload.totalFound-offset)),'Native page size contradicts total')
 payload.content.forEach(r=>rowContract(r,now));check(new Set(payload.content.map(r=>r.id)).size===payload.content.length,'Duplicate native ID within page');return payload
}
function postingURL(value,id){
 let u;try{u=new URL(value)}catch{check(false,'Native public posting URL missing')}
 check(u.protocol==='https:'&&u.hostname==='jobs.smartrecruiters.com'&&!u.port&&!u.username&&!u.password&&!u.hash&&!u.search&&new RegExp('^/'+TENANT+'/'+id+'(?:-[^/]+)?/?$').test(u.pathname),'Native public posting tenant/ID mismatch');return u
}
export async function parseDetail(payload,row,{now=new Date().toISOString()}={}){
 rowContract(row,now);check(row.location.country==='in','Detail requested outside explicit India scope')
 check(payload&&typeof payload==='object'&&!payload.error&&payload.success!==false&&!(Array.isArray(payload.errors)&&payload.errors.length),'Native upstream detail error')
 for(const key of ['id','name','uuid','jobAdId','refNumber','releasedDate'])check(payload[key]===row[key],'Native listing/detail '+key+' mismatch')
 check(payload.company?.identifier===TENANT&&payload.company?.name===NAME&&equal(payload.location,row.location)&&equal(customFields(payload.customField),customFields(row.customField)),'Native listing/detail company/geography/custom-field mismatch')
 check(payload.active===true&&payload.visibility==='PUBLIC'&&plain(payload.jobId),'Native role inactive/private or UUID missing')
 const posted=postingURL(payload.postingUrl,row.id)
 let apply;try{apply=new URL(payload.applyUrl)}catch{check(false,'Native configured application URL missing')}
 check(apply.origin===posted.origin&&apply.pathname===posted.pathname&&!apply.username&&!apply.password&&!apply.hash&&apply.searchParams.size===1&&apply.searchParams.get('oga')==='true','Native application tenant/role/control mismatch')
 const description=extractActiveDescription(payload.jobAd?.sections?.jobDescription?.text),sections=Object.values(payload.jobAd?.sections??{}).map(s=>extractActiveDescription(s?.text)).filter(Boolean).join('\n')
 const roleText=norm(description),companyText=norm(extractActiveDescription(payload.jobAd?.sections?.companyDescription?.text))
 const roleWithoutCompany=companyText?roleText.split(companyText).join(' '):roleText
 check(!INCOMPLETE_ROLE.test(description??'')&&!(roleText&&companyText.includes(roleText))&&roleWithoutCompany.replace(/[^\p{L}\p{N}]/gu,'').length>200,'Native role description is company boilerplate, truncated, excerpted or incomplete')
 const substantive=description?.split(/(?<=[.!?])\s+/).filter(s=>!/(?:please\s+)?(?:click|apply now|check back|see the full job description)/i.test(s)).join(' ')??''
 check(plain(description)&&!CLOSED.test(sections)&&substantive.replace(/[^\p{L}\p{N}]/gu,'').length>200,'Closed, missing or instruction-only native role description')
 const shared=await fetchSmartRecruitersDetail({publicUrl:payload.postingUrl,expectedCompany:TENANT,expectedCountry:'in',expectedLocation:row.location.city,fetchJson:async url=>{check(url===row.ref,'Shared native detail ref mismatch');return payload}})
 return {...payload,...shared}
}

export async function run(options={}){
 check(options.maxJobs==null,'Native truncation forbidden')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),timeoutMs=options.timeoutMs??180000
 check(Number.isFinite(Date.parse(now))&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000,'Invalid bounded options')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Avery Dennison source deadline')),timeoutMs)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,fetchImpl=options.fetchImpl??globalThis.fetch
 let requests=0
 async function bounded(fn){signal.throwIfAborted();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);signal.throwIfAborted()}}
 async function get(url,type='application/json'){
  check(++requests<=5100,'Native request cap exceeded')
  const text=await bounded(()=>fetchTextWithRetry(url,{attempts:1,timeoutMs:20000,signal,method:'GET',redirect:'error',headers:{Accept:type,'User-Agent':'Mozilla/5.0'},label:'averydennison',fetchImpl:async(u,init)=>{
   const response=await bounded(()=>fetchImpl(u,init));check(response.status===200&&response.url===url,'Native response status or final URL mismatch ('+response.status+')')
   const content=response.headers?.get?.('content-type')??'';check(type==='application/json'?/application\/json/i.test(content):/text\/html/i.test(content),'Native response content type changed');return response
  }}))
  check(typeof text==='string'&&text.length<=3000000,'Native body missing or over limit');return type==='application/json'?JSON.parse(text):text
 }
 const pages=[],rows=new Map(),details=new Map(),listingURL=offset=>API+'?limit=100&offset='+offset
 async function fetchPortalJson(url){
  if(url.startsWith(API+'?')){
   const offset=Number(new URL(url).searchParams.get('offset'));check(Number.isSafeInteger(offset)&&offset>=0&&url===listingURL(offset),'Unadvertised listing query')
   const p=parsePage(await get(url),offset,{now});check(!pages.length||p.totalFound===pages[0].payload.totalFound,'Native total drift')
   for(const row of p.content){check(!rows.has(row.id),'Duplicate native ID across pages');rows.set(row.id,row)}
   pages.push({url,payload:p})
   // Preserve every record for pagination, selecting typed India before detail hydration.
   return {...p,content:p.content.map(r=>({...r,nativeCountry:r.location.country}))}
  }
  const row=[...rows.values()].find(r=>r.ref===url);check(row&&row.location.country==='in','Detail ref not advertised by current India listing')
  const payload=await get(url),parsed=await parseDetail(payload,row,{now});details.set(row.id,payload);return parsed
 }
 try{
  parseBinding(await get(CORPORATE,'text/html,application/xhtml+xml'))
  const provider={source:'averydennison',companyName:NAME,countryFilter:'India',companyCareerPage:CORPORATE,atsPlatform:'smartrecruiters-public-postings',config:{
   discovery:{listingApiUrl:API},request:{method:'GET',query:{limit:'100'}},pagination:{strategy:'offset-limit',offsetParam:'offset',limitParam:'limit',pageSize:100,totalCountPath:'totalFound',resultsPath:'content',maxPages:25},
   recordFilter:{include:[{field:'nativeCountry',regex:'^in$',flags:''}]},
   mapping:{jobId:'id',requisitionId:'refNumber',title:'name',location:'location.fullLocation',sourceUrl:'postingUrl',applyUrl:'applyUrl',postingDate:'releasedDate',employmentType:'typeOfEmployment.label',experienceLevel:'experienceLevel.label'},
   detail:{enabled:true,required:true,urlTemplate:API+'/{{jobId}}',concurrency:1,mapping:{jobDescription:'jobDescription',minimumQualification:'minimumQualification'}}
  }}
  const jobs=await runApiPortalScraper({provider,fetchJson:fetchPortalJson}),india=[...rows.values()].filter(r=>r.location.country==='in')
  check(readInventoryEvidence(jobs)?.listingComplete===true&&rows.size===pages[0].payload.totalFound&&details.size===india.length&&jobs.length===india.length,'Shared native enumeration incomplete')
  const terminalURL=listingURL(rows.size),terminal=parsePage(await get(terminalURL),rows.size,{now});check(terminal.totalFound===rows.size&&!terminal.content.length,'Native terminal mismatch')
  for(const p of pages){const last=parsePage(await get(p.url),p.payload.offset,{now});check(equal(last,p.payload),'Native listing fields changed during extraction')}
  const lastTerminal=parsePage(await get(terminalURL),rows.size,{now});check(equal(lastTerminal,terminal),'Native terminal changed during extraction')
  for(const row of india){const last=await get(row.ref);await parseDetail(last,row,{now});check(equal(last,details.get(row.id)),'Native detail fields changed during extraction')}
  signal.throwIfAborted()
  const foreignCountryConflicts=[...rows.values()].filter(r=>r.location.country!=='in'&&r.customField.find(f=>f.fieldId==='COUNTRY').valueId!==r.location.country).map(r=>({id:r.id,country:r.location.country,customCountry:r.customField.find(f=>f.fieldId==='COUNTRY').valueId,location:r.location,customField:r.customField}))
  for(const job of jobs){const d=details.get(job.jobId);Object.assign(job,{
   city:d.location.city,remoteStatus:d.location.remote?'Remote':d.location.hybrid?'Hybrid':'On-site',
   nativeReleasedDate:d.releasedDate,nativePublicationDate:d.releasedDate,nativePublicationDatePrecision:'instant',nativePublicationDateSource:'SmartRecruiters.releasedDate',nativeFirstPublicationDate:null,nativeCreatedAt:null,nativeUpdatedAt:null,nativeClosingDate:null,closingDate:null,postedAt:d.releasedDate,publicationDateQualified:true,nativeDateUnknown:false,
   nativePostingStatus:{active:d.active,visibility:d.visibility},nativeLegalEmployer:null,nativeJobUUID:d.jobId,nativeLocationOriginal:d.location,nativeListingOriginal:rows.get(job.jobId),
   sourceDescription:job.jobDescription,sourceDetailComplete:true,sourceDetailStatus:'active-public-native-full-JD',sourceListingComplete:false,sourceScopeComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,sourceObservedNativeRecords:rows.size,sourceObservedNativeIndiaRecords:india.length,sourceCheckedNativeEnumerationComplete:true,sourceCheckedNativeReconciled:true,sourceExcludedNativeCountryConflicts:foreignCountryConflicts,
   applicationAccessValidated:false,applicationEligibilityQualified:false,applicationSubmitted:false,applicationAccess:'configured-native-application-URL-only',scrapedAt:now,
  })}
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:listingURL(0),firstParty:true,listingComplete:false,pagesFetched:pages.length*2+2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:india.length?'advertised-native-public-tenant-exhausted-and-rechecked-whole-company-scope-unknown':'advertised-native-public-tenant-India-empty-whole-company-zero-unqualified'})
 }finally{clearTimeout(timer)}
}
