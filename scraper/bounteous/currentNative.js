import {createHash} from 'node:crypto'
import {activeHead,extractActiveDescription,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import{validateBounteousClient}from'./nativeScriptContract.js'

export const CAREER_PAGE_URL='https://www.bounteous.com/careers/search-results'
export const LEVER_ENDPOINT='https://api.lever.co/v0/postings/bounteous/'
export const TURBOHIRE_ENDPOINT='https://www.bounteous.com/turbohire/api/'
export const BOUNTEOUS_JOB_ROUTE_PREFIX='https://www.bounteous.com/careers/job/'
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const check=(ok,message)=>{if(!ok)throw Error('Bounteous native: '+message)}
const canonical=value=>{
 if(Array.isArray(value))return value.map(canonical)
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))
 return value
}
const model=value=>JSON.stringify(canonical(value))
const countryNames=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
const knownCountry=code=>/^[A-Z]{2}$/.test(code)&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)?countryNames.of(code)||null:null
const countryLookup=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=knownCountry(code);if(name){countryLookup.set(code.toLowerCase(),name);countryLookup.set(name.toLowerCase(),name)}}
const countries=row=>{
 const resolve=value=>{
  if(typeof value==='string')return countryLookup.get(value.trim().toLowerCase())||null
  if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['countryCode','countryName','id'].includes(key))){
   const code=typeof value.countryCode==='string'?knownCountry(value.countryCode.toUpperCase()):null,name=typeof value.countryName==='string'?countryLookup.get(value.countryName.toLowerCase()):null
   return code&&code===name?code:null
  }
  return null
 }
 const code=clean(row.country).toUpperCase(),country=resolve(row.country),names=[]
 for(const[field,value]of[['countryName',row.countryName],['categories.country',row.categories?.country]])if(value!=null&&value!=='')names.push({field,value})
 if(row.countries!=null){if(Array.isArray(row.countries))row.countries.forEach((value,index)=>names.push({field:'countries.'+index,value}));else names.push({field:'countries',value:row.countries,unsupportedShape:true})}
 const resolved=names.map(entry=>entry.unsupportedShape?null:resolve(entry.value)),alternatives=[...new Set([country,...resolved].filter(Boolean))]
 const conflicts=names.filter((entry,index)=>!resolved[index]||resolved[index]!==country).map(entry=>({field:entry.field,value:structuredClone(entry.value)}))
 // The native countries array can describe multiple eligible worksites. All
 // explicit foreign alternatives establish India exclusion while their exact
 // primary-country association remains unprojected and preserved below.
 return{country:country&&!conflicts.length?country:null,code,countryName:country,conflicts,nativeNames:names,nativeCountries:alternatives,
  indiaExcluded:Boolean(country&&resolved.every(Boolean)&&alternatives.length&&!alternatives.includes('India'))}
}
const criteria=(row,kind)=>kind==='turbohire'?row.description:[row.description,
 ...(Array.isArray(row.lists)?row.lists.map(list=>'<h3>'+clean(list.text)+'</h3><ul>'+String(list.content||'')+'</ul>'):[]),row.additional].filter(Boolean).join('\n')
const date=row=>{
 if(typeof row.createdAt==='number')return Number.isFinite(row.createdAt)&&row.createdAt>0&&Number.isFinite(new Date(row.createdAt).getTime())?new Date(row.createdAt).toISOString():null
 const raw=clean(row.postedDate||row.datePosted||row.createdAt)
 if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)||!Number.isFinite(Date.parse(raw)))return null
 const [year,month,day]=raw.slice(0,10).split('-').map(Number),calendar=new Date(Date.UTC(year,month-1,day))
 return calendar.getUTCFullYear()===year&&calendar.getUTCMonth()===month-1&&calendar.getUTCDate()===day?raw:null
}
const optionalDatePublished=row=>['postedDate','datePosted','createdAt'].some(key=>row[key]!=null&&row[key]!=='')
const experience=value=>{
 const low=Number.isFinite(value?.MinExp)?value.MinExp:null,high=Number.isFinite(value?.MaxExp)?value.MaxExp:null
 return low!=null&&high!=null?(low===high?`${low} years`:`${low}-${high} years`):low!=null?`${low}+ years`:high!=null?`Up to ${high} years`:null
}
const safeApply=(value,fallback)=>{
 if(!clean(value))return fallback
 const url=new URL(value);check(url.protocol==='https:'&&!url.username&&!url.password,'invalid public role application URL');return url.href
}
export function mapCurrentBounteousRow(row,kind){
 check(row&&clean(row.id)&&clean(row.text),'native posting identity/title missing')
 check(kind!=='turbohire'||/^t__[a-zA-Z0-9-]+$/.test(row.id),'native TurboHire posting identity changed')
 const geography=countries(row),description=criteria(row,kind),sourceUrl=kind==='turbohire'?BOUNTEOUS_JOB_ROUTE_PREFIX+row.id:row.hostedUrl
 if(kind==='lever')check(sourceUrl===`https://jobs.lever.co/bounteous/${row.id}`,'native Lever employer/posting URL mismatch')
 const locations=[...new Set((row.cities||row.categories?.allLocations||[]).map(clean).filter(Boolean))]
 const label=clean(row.categories?.location)||locations.join('; ')||geography.country
 const location=geography.country&&label&&!label.toLowerCase().includes(geography.country.toLowerCase())?label+', '+geography.country:label||null
 const city=locations.length===1?(clean(row.city)||null):null
 const published=optionalDatePublished(row),posted=date(row)
 const full=typeof description==='string'&&extractActiveDescription(description)?.length>=400
 const job={source:'bounteous',company:'Bounteous',title:clean(row.text),jobId:row.id,requisitionId:null,
  department:clean(row.categories?.team||row.categories?.department)||null,location,city,country:geography.country,
  sourceUrl,applyUrl:safeApply(row.applyUrl,sourceUrl),link:sourceUrl,employmentType:clean(row.categories?.commitment)||null,
  experienceRequired:experience(row.experience),minimumQualification:null,preferredQualification:null,
  requiredSkills:Array.isArray(row.skills)?row.skills.map(clean).filter(Boolean):[],postingDate:posted,closingDate:null,
  remoteStatus:({remote:'Remote',hybrid:'Hybrid',onsite:'On-site','on-site':'On-site'})[clean(row.workplaceType).toLowerCase()]||null,
  jobDescription:description,sourceDescription:description,sourceNativeRecord:structuredClone(row),sourceNativeProvider:kind,
  sourceNativePostingDate:row.postedDate??row.datePosted??row.createdAt??null,sourceOriginalPostingDatePublished:published,
  sourcePostingDateUnresolved:published&&!posted,sourceDetailComplete:full,sourceListingComplete:false,
  sourceNativeCountryFields:{code:row.country??null,countryName:row.countryName??null,countries:row.countries??null},
  sourceCountryConflict:geography.conflicts.length>0,sourceCountryEvidence:geography.country?'Current same-ID native feed publishes an explicit worksite country code; every additional typed country field agrees.':null,
  sourceCompanyWideScopeComplete:false,sourceLifecycleCleanupVerified:false}
 return{job,geography,full,kind,record:row,model:model(row)}
}
export const extractCurrentSearchResults=({leverJobs=[],turboHirePayload={}}={})=>[
 ...leverJobs.map(row=>mapCurrentBounteousRow(row,'lever')),
 ...(Array.isArray(turboHirePayload?.response)?turboHirePayload.response:[]).map(row=>mapCurrentBounteousRow(row,'turbohire')),
].filter(result=>result.job.country==='India').map(result=>result.job)

function readHub(html){
 check(activeHead(html).titles.includes('Search Careers & Job Openings | Bounteous'),'current official careers employer identity changed')
 const doc=readNativeDocument(html),scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>n.attrs.src)
 const candidates=[...new Set(scripts.filter(src=>/^\/public\/components-CareersHero-CareersHero-[a-f0-9]+\.js$/.test(src)))]
 check(candidates.length===1,'expected one current declared careers client')
 return new URL(candidates[0],CAREER_PAGE_URL).href
}
function readClient(body){
 validateBounteousClient(body)
 // The published component explicitly concatenates the entire Lever array and
 // TurboHire response array. Its on-page load-more control slices that array.
}
function listing(lever,turbo){
 check(Array.isArray(lever)&&lever.length<=3000,'Lever complete public array is invalid')
 check(turbo&&Object.keys(turbo).length===1&&Array.isArray(turbo.response)&&turbo.response.length<=3000,'TurboHire complete public response array is invalid')
 const rows=[...lever.map(row=>mapCurrentBounteousRow(row,'lever')),...turbo.response.map(row=>mapCurrentBounteousRow(row,'turbohire'))]
 check(new Set(rows.map(row=>row.job.jobId)).size===rows.length,'duplicate posting identity across current feeds')
 return rows
}

export async function runCurrentBounteous(options={}){
 const signal=AbortSignal.any([AbortSignal.timeout(Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:240000),...(options.signal?[options.signal]:[])])
 const wait=promise=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,value)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 check(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid result limit')
 const observations=[]
 const read=async(url,json=false)=>{
  signal.throwIfAborted();const requestedAt=new Date().toISOString(),headers={'User-Agent':USER_AGENT,Accept:json?'application/json':'text/html,application/javascript;q=0.9,*/*;q=0.8'}
  const packet=await wait(Promise.resolve().then(async()=>{
   if(options.fetchPage)return options.fetchPage(url,{signal,headers})
   const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(35000)]),response=await fetch(url,{signal:requestSignal,headers,redirect:'follow'}),body=await response.text();requestSignal.throwIfAborted()
   return{status:response.status,url:response.url,body,capturedAt:new Date().toISOString()}
  }));signal.throwIfAborted()
  const alternate=url.startsWith(TURBOHIRE_ENDPOINT)?url.replace('/api/','/api'):null
  check(packet?.status===200&&(packet.url===url||packet.url===alternate),'HTTP status or final native URL changed at '+url)
  check(typeof packet.body==='string'&&Buffer.byteLength(packet.body)<=5000000,'invalid/oversized native response')
  const observed={url,finalUrl:packet.url,status:packet.status,sha256:createHash('sha256').update(packet.body).digest('hex'),requestedAt,completedAt:new Date().toISOString(),capturedAt:Object.getOwnPropertyDescriptor(packet,'capturedAt')?.value||null}
  observations.push(observed);if(options.onResponse)await wait(Promise.resolve().then(()=>options.onResponse({...observed,body:packet.body})));signal.throwIfAborted()
  if(!json)return packet.body
  try{return JSON.parse(packet.body)}catch{throw Error('Bounteous native: invalid native JSON at '+url)}
 }
 const clientURL=readHub(await read(CAREER_PAGE_URL)),client=await read(clientURL);readClient(client)
 const opening=listing(await read(LEVER_ENDPOINT,true),await read(TURBOHIRE_ENDPOINT,true)),results=[],failures=[]
 let next=0
 await Promise.all([0,1,2,3].map(async()=>{while(next<opening.length){const row=opening[next++];if(row.job.country!=='India')continue
  try{check(row.full,'full native role criteria missing');check(!row.job.sourcePostingDateUnresolved,'published native original date is malformed')
   const url=row.kind==='turbohire'?TURBOHIRE_ENDPOINT+'?id='+row.job.jobId:LEVER_ENDPOINT+row.job.jobId
   const response=await read(url,true),detail=mapCurrentBounteousRow(row.kind==='turbohire'?response?.response:response,row.kind)
   check(detail.job.jobId===row.job.jobId,'requested/public detail posting identity mismatch')
   check(detail.model===row.model,'same-ID full native criteria/model disagrees with feed');results.push(detail)
  }catch(error){signal.throwIfAborted();failures.push({stage:'native-detail',nativeJobId:row.job.jobId,message:error.message})}
 }}))
 const closingClientURL=readHub(await read(CAREER_PAGE_URL));check(closingClientURL===clientURL,'declared careers client changed at closing');readClient(await read(closingClientURL))
 const closing=listing(await read(LEVER_ENDPOINT,true),await read(TURBOHIRE_ENDPOINT,true))
 const closingByID=new Map(closing.map(row=>[row.job.jobId,row])),signature=rows=>model(rows.map(row=>({kind:row.kind,record:row.record})).sort((a,b)=>a.record.id.localeCompare(b.record.id)))
 const stable=signature(opening)===signature(closing),qualified=results.filter(row=>{
  if(closingByID.get(row.job.jobId)?.model===row.model)return true
  failures.push({stage:'closing-detail',nativeJobId:row.job.jobId,message:'native role removed or full criteria/country/date changed at closing'});return false
 }).sort((a,b)=>opening.findIndex(row=>row.job.jobId===a.job.jobId)-opening.findIndex(row=>row.job.jobId===b.job.jobId))
 const unknown=opening.filter(row=>!row.job.country&&!row.geography.indiaExcluded),unknownClosing=closing.filter(row=>!row.job.country&&!row.geography.indiaExcluded),allJobs=qualified.map(row=>row.job)
 const jobs=options.maxJobs==null||options.maxJobs===0?allJobs:allJobs.slice(0,options.maxJobs),complete=stable&&!failures.length&&!unknown.length&&!unknownClosing.length&&jobs.length===allJobs.length
 const audit={source:'bounteous',observedListingCount:opening.length,observedIndiaListingCount:opening.filter(row=>row.job.country==='India').length,
  nativeFeedCounts:{lever:opening.filter(row=>row.kind==='lever').length,turbohire:opening.filter(row=>row.kind==='turbohire').length},
  candidateDetails:opening.length,indiaDetailCandidates:opening.filter(row=>row.job.country==='India').length,extractedDetailJobs:jobs.length,unknownCountryListingCount:unknown.length,
  nonIndiaListingCount:opening.filter(row=>row.geography.indiaExcluded).length,unknownCountries:unknown.map(row=>({id:row.job.jobId,fields:row.job.sourceNativeCountryFields,conflicts:row.geography.conflicts})),
  exclusions:opening.filter(row=>row.geography.indiaExcluded).map(row=>({id:row.job.jobId,country:row.job.country,countries:row.geography.nativeCountries,fields:row.job.sourceNativeCountryFields,conflicts:row.geography.conflicts,reason:'Every role-bound native country interpretation is explicitly non-India; exact multi-country association is preserved, not invented.'})),
  failures,opening:opening.map(row=>({id:row.job.jobId,country:row.job.country})),closing:closing.map(row=>({id:row.job.jobId,country:row.job.country})),
  closingInventoryMatches:stable,listingPaginationComplete:true,sourceScopeComplete:complete,sourceDeclaredBoardScopeComplete:complete,sourceCompanyWideScopeComplete:false,sourceLifecycleCleanupVerified:false,
  originalPostingDatesPublished:allJobs.filter(job=>job.sourceOriginalPostingDatePublished).length,
  originalPostingDatesNotPublished:allJobs.filter(job=>!job.sourceOriginalPostingDatePublished).length,
  observedDetails:results.map(row=>row.job),jobs:jobs.map(job=>({id:job.jobId})),responses:observations}
 for(const job of jobs)Object.assign(job,{scrapedAt:new Date().toISOString(),sourceListingComplete:complete,sourceDeclaredBoardScopeComplete:complete})
 if(jobs.length)jobs[0].nativeCollectionEvidence={...audit,observedDetails:results.map(row=>({id:row.job.jobId,sourceUrl:row.job.sourceUrl,country:row.job.country}))}
 attachInventoryEvidence(jobs,{firstParty:true,surface:CAREER_PAGE_URL,status:complete?(opening.length?'complete-inventory':'verified-empty'):'coverage-gap',listingComplete:complete,
  reportedTotal:opening.length,indiaFacetCount:unknown.length||unknownClosing.length?null:opening.filter(row=>row.job.country==='India').length,pagesFetched:observations.length,verifiedAt:new Date().toISOString(),
  reason:`Current Bounteous declared client merges complete Lever and TurboHire arrays; same-ID full India criteria reconcile with current public detail endpoints and closing full feed models=${stable}; failures=${failures.length}; country gaps=${unknown.length+unknownClosing.length}; absent native dates preserved; company-wide/lifecycle scope remains unknown`})
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
