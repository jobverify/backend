import {createDarwinboxScraper} from '../darwinbox/script.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
import {createPublicReader} from './publicRead.js'

const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const text=html=>{const d=readNativeDocument(html);return d.text(d.nodes(n=>n.tag==='root')[0])}
const placeholder=value=>/^(?:please\s+enter\s+(?:the\s+)?job\s+description|enter\s+(?:the\s+)?job\s+description)[.!\s]*$/i.test(clean(text(value??'')))
const india=value=>/^(?:india|in)$/i.test(clean(value))
const countries=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
const reserved=new Set(['ZZ','XA','XB','UN','EU','EZ','QO'])
const knownCountries=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=countries.of(code);if(name&&name!==code&&!reserved.has(code))knownCountries.set(name.toLowerCase(),name)}
function nativeCountry(row){
 const explicit=clean(row.country),address=clean(row.locations),tail=address.split(',').at(-1)?.trim()
 const country=value=>{if(india(value))return'India';if(/^[A-Z]{2}$/.test(value)&&!reserved.has(value)){const name=countries.of(value);return name&&name!==value?name:null}return knownCountries.get(value.toLowerCase())??null}
 const typed=country(explicit),named=country(tail)
 if(explicit&&!typed||typed&&named&&typed!==named)return null
 return typed??named
}
function nativeDetailCountry(detail){
 if(!/^multiple locations$/i.test(clean(detail.officelocation_show_arr)))return nativeCountry({...detail,locations:detail.officelocation_show_arr})
 const explicit=clean(detail.country),typed=nativeCountry({country:explicit}),addresses=detail.tool_tip_locations
 if(explicit&&!typed||!Array.isArray(addresses)||!addresses.length)return null
 const values=addresses.map(location=>typeof location==='string'?nativeCountry({locations:location}):null)
 if(values.some(value=>!value)||new Set(values).size!==1||typed&&typed!==values[0])return null
 return values[0]
}
export function createBoundDarwinboxScraper(c,defaults={}){
 const collect=async(options={})=>{
  const o={...defaults,...options};if(o.fetchText||o.fetchPage||o.probeListingApi)throw Error(c.source+' requires observed status/final URL fetchImpl')
  if(o.maxPages!=null)throw Error(c.source+' bounded full native pagination cannot accept a caller page cap')
  const base=c.origin+'/ms/candidateapi/job/',listing=base+'alljobs?companyId=main',shell=c.origin+'/ms/candidatev2/main/careers/allJobs'
  const reader=createPublicReader({...o,source:c.source,allowedUrl:(url,init)=>{
   if(url===c.officialUrl||url===shell)return(init.method??'GET')==='GET'&&!init.body
   if(url===listing)return init.method==='POST'
   return url.startsWith(base)&&/^[-\w.%]+\?companyId=main$/.test(url.slice(base.length))&&(init.method??'GET')==='GET'&&!init.body
  }})
  const {read,fail}=reader,nativeRoles=[],heldRoles=[],unknownCountries=[]
  const binding=async()=>{
   const html=await(await read(c.officialUrl,{method:'GET'})).text(),doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0]
   // BirlaNu currently streams its unique title/canonical into the body as
   // Next metadata. Read parsed nodes; script strings/comments never bind.
   const titles=doc.nodes(n=>n.tag==='title')
   const links=doc.nodes(n=>n.tag==='a'&&clean(doc.text(n)).toLowerCase()===c.handoffLabel.toLowerCase()).map(n=>{try{return new URL(n.attrs.href,c.officialUrl).href}catch{return null}})
   if(titles.length!==1||!c.title.test(decodeNativeEntities(titles[0].raw))||!doc.text(root).includes(c.companySignal)||!links.includes(c.handoffUrl)||links.some(url=>url!==c.handoffUrl))throw fail('current corporate employer handoff binding changed')
   const canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');if(canonical.length&& (canonical.length!==1||canonical[0].attrs.href!==c.officialUrl))throw fail('current corporate canonical identity changed')
   return{url:c.officialUrl,handoffUrl:c.handoffUrl,visibleText:doc.text(root)}
  }
  const engine=createDarwinboxScraper({companyName:c.companyName,source:c.source,origin:c.origin,fetchImpl:read})
  const snapshot=async()=>{
   const records=[];let pages=0
   const jobs=await engine.run({signal:reader.signal,maxPages:10000,detailEnrichmentBudgetMs:0,fetchListingPage:async args=>{const payload=await engine.fetchListingPageFromApi(args);records.push(...(Array.isArray(payload?.data)?structuredClone(payload.data):[]));pages++;return payload}})
   const evidence=readInventoryEvidence(jobs);if(!evidence?.listingComplete)throw fail('native inventory is incomplete or inconsistent')
   const ids=new Set();for(const r of records){if(!/^[-\w.]+$/.test(String(r.id))||ids.has(String(r.id)))throw fail('native role identity changed');ids.add(String(r.id))}
   return{records,jobs,pages,evidence}
  }
  const hydrate=async snap=>{
   const details=new Map(),failures=new Map()
   for(const r of snap.records){
    const id=String(r.id)
    try{
     const payload=await engine.fetchJobDetailFromApi({jobId:id,signal:reader.signal}),d=payload?.message?.job
     if(!Array.isArray(d)||d.length!==1||String(d[0]?.id)!==id||clean(d[0]?.title)!==clean(r.title)||(payload.status!=null&&!['success',true,200].includes(payload.status)))throw fail('native public detail employer role identity changed')
     details.set(id,structuredClone(d[0]))
    }catch(error){
     reader.signal.throwIfAborted();if(reader.deniedStatus)throw reader.denied(reader.deniedStatus)
     failures.set(id,{jobId:id,reason:'unavailable-or-unbound-native-public-detail',nativeListing:r})
    }
   }
   return{details,failures}
  }
  try{
   const openingBinding=await binding(),opening=await snapshot();nativeRoles.push(...opening.records)
   const firstHydration=await hydrate(opening),openingDetails=firstHydration.details,closingBinding=await binding(),closing=await snapshot(),lastHydration=await hydrate(closing),closingDetails=lastHydration.details
   // Full listing is read AFTER every closing detail, so a role withdrawn
   // during detail hydration cannot remain an apparently current opening.
   const final=await snapshot(),current=new Map(final.records.map(r=>[String(r.id),r])),close=new Map(closing.records.map(r=>[String(r.id),r])),jobs=[]
   for(const r of opening.records){
    const id=String(r.id),d=openingDetails.get(id),country=nativeCountry(r),reason=!same(r,close.get(id))||!same(r,current.get(id))||!same(d,closingDetails.get(id))?'closing-native-role-or-public-criteria-changed':null
    const detailFailure=firstHydration.failures.get(id)??lastHydration.failures.get(id)
    if(detailFailure){heldRoles.push({...detailFailure,nativeDetail:d??null});continue}
    if(reason){heldRoles.push({jobId:id,reason,nativeListing:r,nativeDetail:d});continue}
    if(!country){unknownCountries.push({jobId:id,nativeListing:r,nativeDetail:d});continue}
    const detailCountry=nativeDetailCountry(d)
    if(!detailCountry||detailCountry!==country){heldRoles.push({jobId:id,reason:'conflicting-or-unresolved-native-detail-country',nativeListing:r,nativeDetail:d});continue}
    const extraAddresses=['tool_tip_locations','officelocation_show_arr_list','officelocations_area','officelocations_without_area']
    if(extraAddresses.some(key=>d[key]!=null&&(!Array.isArray(d[key])||d[key].some(value=>{
     if(key==='officelocation_show_arr_list'&&/^multiple locations$/i.test(clean(d.officelocation_show_arr))&&/^multiple locations$/i.test(clean(value)))return false
     return typeof value!=='string'||nativeCountry({locations:value})!==country
    })))){heldRoles.push({jobId:id,reason:'conflicting-or-unresolved-additional-native-worksites',nativeListing:r,nativeDetail:d});continue}
    const employerFields=['company_name','companyName','company']
    if(employerFields.some(key=>[r[key],d[key]].some(value=>value!=null&&(typeof value!=='string'||!c.employerNames.some(name=>name.toLowerCase()===clean(value).toLowerCase()))))){heldRoles.push({jobId:id,reason:'unreviewed-native-hiring-employer',nativeListing:r,nativeDetail:d});continue}
    if(country!=='India')continue
    const job=opening.jobs.find(job=>job.jobId===id)??engine.extractSearchResults({data:[{...r,country:'India'}]}).find(job=>job.jobId===id)
    if(!job){heldRoles.push({jobId:id,reason:'native-country-mapper-disagreement',nativeListing:r,nativeDetail:d});continue}
    try{
     const payload={status:'success',message:{job:[d]}},description=engine.validateJobDetail(payload,job),facts=engine.extractJobDetailFacts(payload,job)
     if(placeholder(description)||!hasSourceDescription({jobDescription:description}))throw Error('missing-public-job-description')
     Object.assign(job,facts,{jobDescription:description,sourceDescription:description,country:'India',companyCareerPage:c.officialUrl,companyDomain:new URL(c.officialUrl).hostname.replace(/^www\./,''),sourceNativeListing:r,sourceNativeDetail:d,sourceDetailComplete:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
     jobs.push(job)
    }catch{heldRoles.push({jobId:id,reason:'unrecovered-or-conflicting-public-detail',nativeListing:r,nativeDetail:d})}
   }
   const stable=same(opening.records,closing.records)&&same(opening.records,final.records),complete=stable&&!heldRoles.length&&!unknownCountries.length
   const evidence={status:complete?(opening.records.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:listing,firstParty:true,listingComplete:complete,pagesFetched:opening.pages+closing.pages+final.pages,reportedTotal:stable?opening.records.length:null,indiaFacetCount:complete?jobs.length:null,verifiedAt:new Date().toISOString(),reason:complete?'current-corporate-declared-Darwinbox-board-full-public-details-and-final-native-closing':'current-declared-board-unresolved-country-public-detail-or-closing-scope'}
   for(const job of jobs)job.sourceListingComplete=complete
   attachInventoryEvidence(jobs,evidence);attachSourceObservationEvidence(jobs,{source:c.source,recordKind:'vacancy-rows',observedRecordCount:nativeRoles.length,observedVacancyCount:nativeRoles.length,sourceScopeComplete:false})
   const result={jobs,nativeRoles,openingDetails:[...openingDetails.values()],closingDetails:[...closingDetails.values()],unknownCountries,heldRoles,openingBinding,closingBinding,inventoryEvidence:evidence,responses:reader.responses,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
   if(o.maxJobs!=null){if(!Number.isSafeInteger(o.maxJobs)||o.maxJobs<0)throw fail('invalid job cap');if(o.maxJobs>0&&jobs.length>o.maxJobs){jobs.splice(o.maxJobs);attachInventoryEvidence(jobs,{...evidence,status:'discovery-only',listingComplete:false,reason:'caller-job-cap-after-full-native-reconciliation'});result.inventoryEvidence=readInventoryEvidence(jobs);for(const job of jobs)job.sourceListingComplete=false}}
   if(o.onAudit)await reader.waitFor(()=>o.onAudit(result));return result
  }catch(error){if(o.signal?.aborted)throw o.signal.reason;if(reader.deniedStatus)throw reader.denied(reader.deniedStatus);throw error}finally{reader.dispose()}
 }
 return{collect,run:async options=>(await collect(options)).jobs}
}
