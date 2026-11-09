import {runApiPortalScraper} from '../../scraper-support/apiPortal/engine.js'
import {expandApiPortalProviderTemplate} from '../../scraper-support/providers/apiPortalTemplates.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {ORIGIN,validateEnvelope,validateBoard,validateRow,validateDetail} from './nativeContract.js'
export const CORPORATE='https://www.bostonscientific.com/en-IN/careers.html',BOARD=ORIGIN+'/careers'
const DOMAIN='bostonscientific.com',OBSERVED_NATIVE_SEARCH_CEILING=500,DIAGNOSTICS=Symbol('bostonscientific-native-diagnostics')
export const readBostonScientificDiagnostics=jobs=>jobs?.[DIAGNOSTICS]||null
const ensure=(ok,message)=>{if(!ok)throw new Error('Boston Scientific: '+message)}
const headers={Accept:'application/json, text/plain, */*','User-Agent':'Mozilla/5.0',Referer:BOARD,Origin:ORIGIN}
async function nativeFetch(url,{signal}={}){const response=await fetch(url,{headers,signal,redirect:'follow'});ensure(response.status===200&&response.url===url,'Unexpected native HTTP status or redirect '+response.status);return response.text()}
const search=(start,country=false)=>`${ORIGIN}/api/pcsx/search?domain=${DOMAIN}&query=&location=&${country?'filter_country=India&':''}start=${start}&limit=10`
function page(payload,{country=false}={}){
 const {data}=validateEnvelope(payload)
 ensure(Number.isSafeInteger(data.count)&&data.count>=0&&data.count<=1000,'Invalid or unsupported native total')
 ensure(Array.isArray(data.positions)&&data.positions.length<=10,'Native10-row pagination contract changed')
 ensure(data.appliedFilters&&typeof data.appliedFilters==='object'&&!Array.isArray(data.appliedFilters),'Native filter scope missing')
 ensure(JSON.stringify(data.appliedFilters)===JSON.stringify(country?{country:['India']}:{}),'Unexpected native search filters')
 return data
}
export async function run({fetchText=nativeFetch,fetchJson=async(u,o)=>JSON.parse(await nativeFetch(u,o)),signal,now=()=>new Date().toISOString(),maxJobs=1000,timeoutMs=120000}={}){
 ensure(Number.isSafeInteger(maxJobs)&&maxJobs>=0&&maxJobs<=1000&&Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid limits')
 const startedAt=now();ensure(typeof startedAt==='string'&&Number.isFinite(Date.parse(startedAt)),'Invalid check time')
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason),timer=setTimeout(()=>controller.abort(new Error('Boston Scientific deadline exceeded')),timeoutMs)
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true})
 const request=async(fn,url,options={})=>{controller.signal.throwIfAborted();const requestSignal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);let listener
  try{return await Promise.race([Promise.resolve().then(()=>fn(url,{...options,signal:requestSignal})),new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true})})])}finally{requestSignal.removeEventListener('abort',listener)}
 }
 try{
  const corporate=await request(fetchText,CORPORATE);ensure(extractOfficialRecruitmentLinks(corporate,CORPORATE).some(l=>l.href===BOARD),'Current exact official handoff unavailable')
  validateBoard(await request(fetchText,BOARD))
  const rows=[],ids=new Set(),unresolvedScopes=[],scopeById=new Map();let total=null,firstSnapshot,pages=0
  for(let start=0;start<=1000;start+=10){
   const data=page(await request(fetchJson,search(start)));pages++
   if(total===null){total=data.count;firstSnapshot=JSON.stringify(data.positions)}else ensure(total===data.count,'Native total drift')
   if(start>=total){ensure(data.positions.length===0,'Terminal page not empty');break}
   ensure(data.positions.length===Math.min(10,total-start),'Truncated native page')
   for(const row of data.positions){
    ensure(!ids.has(row?.id),'Duplicate native identity');ids.add(row?.id)
    try{scopeById.set(row.id,validateRow(row,{now:startedAt}))}catch(error){
     if(!/location|country|India city/i.test(error.message))throw error
     unresolvedScopes.push({id:row.id,reason:error.message,locations:row.locations,standardizedLocations:row.standardizedLocations})
    }
    rows.push(row)
   }
  }
  ensure(rows.length===total,'Full native total does not reconcile')
  const expectedIndia=rows.filter(r=>scopeById.get(r.id)?.india),byId=new Map(rows.map(r=>[r.id,r])),details=new Map(),observedIndia=new Set()
  const provider=expandApiPortalProviderTemplate({source:'bostonscientific',companyName:'Boston Scientific',companyCareerPage:BOARD,atsPlatform:'eightfold',countryFilter:'India',template:'eightfold',templateOptions:{host:'bostonscientific.eightfold.ai',domain:DOMAIN,pageSize:10},config:{
   request:{query:{domain:DOMAIN,query:'',location:'',filter_country:'India'}},pagination:{pageSize:10,maxPages:101},
   mapping:{location:'verifiedIndiaLocation',sourceUrl:'verifiedPublicUrl',applyUrl:'verifiedPublicUrl'},detail:{concurrency:2,required:false},
  }})
  const jobs=await runApiPortalScraper({provider,fetchJson:async(url,options)=>{
   try{
    const raw=await request(fetchJson,url,options),u=new URL(url)
    if(u.pathname==='/api/pcsx/search'){
     const data=page(raw,{country:true});ensure(data.count===expectedIndia.length,'Country facet differs from globally proven India subset')
     return {data:{...data,positions:data.positions.map(row=>{
      ensure(byId.has(row.id)&&JSON.stringify(byId.get(row.id))===JSON.stringify(row),'Country/global native identity or listing drift')
      const scope=validateRow(row,{now:startedAt});ensure(scope.india,'Country filter includes unproven India role');observedIndia.add(row.id)
      return{...row,verifiedIndiaLocation:scope.indiaLocations.map(l=>l.location).join('; '),verifiedPublicUrl:ORIGIN+row.positionUrl}
     })}}
    }
    ensure(u.pathname==='/api/pcsx/position_details','Unexpected shared adapter endpoint')
    const id=Number(u.searchParams.get('position_id')),listing=byId.get(id);ensure(listing,'Unlisted detail identity')
    const detail=validateDetail(raw,listing,{now:startedAt});details.set(id,detail);return{data:detail}
   }catch(error){error.incompleteScope=true;throw error}
  }})
  ensure(observedIndia.size===expectedIndia.length&&jobs.length===expectedIndia.length,'Shared extraction did not reconcile selected India identities')
  const terminal=page(await request(fetchJson,search(Math.ceil(expectedIndia.length/10)*10,true)),{country:true});ensure(terminal.count===expectedIndia.length&&terminal.positions.length===0,'India terminal drift')
  const final=page(await request(fetchJson,search(0)));ensure(final.count===total&&JSON.stringify(final.positions)===firstSnapshot,'Final native snapshot drift')
  const searchCeilingUnresolved=total>=OBSERVED_NATIVE_SEARCH_CEILING
  const complete=!searchCeilingUnresolved&&unresolvedScopes.length===0&&maxJobs>=jobs.length&&readInventoryEvidence(jobs)?.listingComplete===true
  const selected=jobs.slice(0,maxJobs).map(job=>{const detail=details.get(job.jobId),native=byId.get(job.jobId);return{...job,city:detail.scope.indiaLocations[0].city,postingDate:new Date(native.postedTs*1000).toISOString(),sourceListingComplete:complete,sourceDetailComplete:detail.sourceDetailComplete,sourceDetailStatus:detail.sourceDetailComplete?'complete':'missing-content',sourceNativeLocations:native.locations,sourceNativeStandardizedLocations:native.standardizedLocations,scrapedAt:startedAt}})
  Object.defineProperty(selected,DIAGNOSTICS,{value:{reportedGlobalTotal:total,uniqueGlobalIdentities:ids.size,knownIndiaRows:expectedIndia.length,unresolvedScopes,terminalPageVerified:true,finalFirstPageRechecked:true,companyHealthComplete:complete&&selected.every(j=>j.sourceDetailComplete)}})
  return attachInventoryEvidence(selected,{status:complete?(total?'complete-inventory':'verified-empty'):'coverage-gap',surface:BOARD,firstParty:true,listingComplete:complete,pagesFetched:pages,reportedTotal:total,indiaFacetCount:expectedIndia.length,verifiedAt:now(),reason:complete?'global-native-pages-country-facet-details-and-terminal-reconciled':unresolvedScopes.length?'unresolved-native-geography; individually-verified-India-subset':searchCeilingUnresolved?'observed-native-search-ceiling-without-uncapped-contract':'configured-cap-or-incomplete-detail-health'})
 }finally{controller.abort();clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
