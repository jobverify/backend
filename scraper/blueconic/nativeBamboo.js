import {activeHead,readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {createPublicIO,sha256} from '../../scraper-support/native-sources/publicIO.js'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {countryName,postingDate} from '../../scraper-support/native-sources/jobPostingData.js'
import {matchesAuthoredIntegrity} from '../../scraper-support/native-sources/declaredGreenhouse/reviewedDeclaredAssets.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const corporate='https://www.blueconic.com/about/careers/careers---open-positions'
const origin='https://blueconic.bamboohr.com',client=origin+'/js/embed.js'
const feed=origin+'/jobs/embed2.php?version=1.0.0&format=json'
const clientSHA='362a883600af02dc038eba2666e283565d190390e9c1c8156235e4530d80abf0'
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('BlueConic BambooHR: '+message),{failureKind:'surface_drift_or_fail_closed'})}
export const BLUECONIC_METADATA={source:'blueconic',companyName:'BlueConic',adapter:'script',modulePath:'../../scraper/blueconic/script.js',
 companyCareerPage:corporate,companyDomain:'blueconic.com',atsPlatform:'bamboohr',countryFilter:'India',
 verifiedOn:null,verifiedAt:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,boardIdentityVerified:false,bindingEvidence:null,
 listingComplete:false,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
 verifiedInventoryStatus:'unverified',backfillMode:'discovery-only',zeroResultPolicy:'coverage-gap',
 extractionStrategy:'current-active-employer-BambooHR-embed+same-ID-open-native-country-and-full-criteria+closing',
 paginationStrategy:'unfiltered-employer-declared-native-embed-collection;whole-company-scope-unqualified',
 verifiedSurfaceSummary:'Runtime qualification required. Current BlueConic careers declares BambooHR; historical Greenhouse dates/counts do not qualify current inventory, whole-company totals, applications, persistence or cleanup.'}

const handoff=html=>{
 const doc=readNativeDocument(html),head=activeHead(html)
 // getElementById includes hidden/inert DOM nodes. Retain-tree uniqueness
 // precedes active presentation checks; script/comment text is never parsed.
 const retained=[],stack=[...doc.nodes(n=>n.tag==='root')]
 while(stack.length){const n=stack.pop();retained.push(n);stack.push(...n.children.filter(c=>typeof c==='object'))}
 check(head.titles.length===1&&head.titles[0]==='Open Positions | BlueConic','current official employer title changed')
 check(!retained.some(n=>n.tag==='base'&&n.attrs.href),'document base changes declaration authority')
 check(retained.filter(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')).length===1,'ambiguous retained canonical declaration')
 const canonical=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'))
 check(canonical.length===1&&canonical[0].attrs.href===corporate,'current official canonical changed')
 const mounts=doc.nodes(n=>n.attrs.id==='BambooHR')
 check(retained.filter(n=>n.attrs.id==='BambooHR').length===1&&mounts.length===1&&mounts[0].tag==='div','single retained and active BambooHR mount required')
 const attrs=mounts[0].attrs
 check(attrs['data-domain']==='blueconic.bamboohr.com'&&attrs['data-version']==='1.0.0'&&attrs['data-departmentid']==='', 'current tenant/version or unfiltered department declaration changed')
 const scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.src===client&&!Object.hasOwn(n.attrs,'nomodule')
  &&['','text/javascript','application/javascript','module'].includes(n.attrs.type||''))
 const resolvesToClient=n=>{try{return n.tag==='script'&&typeof n.attrs.src==='string'&&new URL(n.attrs.src,corporate).href===client}catch{return false}}
 check(retained.filter(resolvesToClient).length===1&&scripts.length===1,'single retained and active declared BambooHR client required')
 return {mount:{...attrs},script:{...scripts[0].attrs}}
}
const inventory=model=>{
 check(model?.success===true&&model.version==='1.0.0'&&Array.isArray(model.departments)&&model.labels?.heading==='Open Positions','native embed envelope changed or unavailable')
 check([model,model.meta??{}].every(v=>v.hasMore!==true&&['next','nextPage','nextCursor','cursor'].every(k=>v[k]==null)),'native continuation cannot be discarded')
 const ids=new Set(),departments=new Set(),rows=[]
 for(const d of model.departments){
  check(Number.isSafeInteger(d?.id)&&d.id>0&&!departments.has(d.id)&&clean(d.label)&&Array.isArray(d.positions),'native department identity changed');departments.add(d.id)
  for(const row of d.positions){
   check(Number.isSafeInteger(row?.id)&&row.id>0&&!ids.has(row.id)&&clean(row.name)&&row.url===origin+'/careers/'+row.id,'native posting ID/title/own URL missing, foreign or repeated')
   ids.add(row.id);rows.push({...row,nativeDepartment:{id:d.id,label:d.label}})
  }
 }
 check(rows.length<=500,'native collection exceeds source role bound');return rows
}
const stable=value=>JSON.stringify(value)
export const createBlueConicScraper=(defaults={})=>({name:'blueconic',async run(passed={}){
 const options={...defaults,...passed},timeoutMs=options.timeoutMs??180000,maxJobs=options.maxJobs===Infinity?null:options.maxJobs??null
 check(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=600000,'invalid source timeout')
 check(maxJobs===null||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid maxJobs')
 check(!(options.fetchText||options.fetchJson)||options.fetchPage||options.fetchImpl,'parsed/text-only injection lacks original response provenance')
 const deadline=performance.now()+timeoutMs,deadlineError=Object.assign(Error('BlueConic public source deadline'),{failureKind:'network_or_timeout'})
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(deadlineError),timeoutMs)
 const signal=AbortSignal.any([controller.signal,...(options.signal?[options.signal]:[])])
 const assertActive=()=>{
  signal.throwIfAborted()
  if(performance.now()>=deadline){controller.abort(deadlineError);throw signal.reason}
 }
 const wait=work=>new Promise((resolve,reject)=>{
  const finish=(fn,value)=>{signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason)
  try{assertActive()}catch(error){reject(error);return}
  signal.addEventListener('abort',abort,{once:true})
  let future
  try{future=Promise.resolve(work())}catch(error){finish(reject,error);return}
  // Attach both outcomes before checking elapsed work, including a callback
  // which synchronously overruns its budget and returns a rejected promise.
  future.then(value=>{try{assertActive();finish(resolve,value)}catch(error){finish(reject,error)}},error=>finish(reject,error))
  try{assertActive()}catch(error){finish(reject,error)}
 })
 const allowed=new Set([corporate,client,feed]),held=new Set(),transportErrors=new Map();let requestCount=0,decodedBytes=0,nextStart=0
 const fetchPage=async(url,init)=>{
  assertActive();check(!held.has(new URL(url).hostname),'public host held after access denial or throttling')
  check(++requestCount<=1010,'source request bound exceeded')
  let result
  try{if(options.fetchPage)result=await wait(()=>options.fetchPage(url,{...init,signal}))
  else{
   const start=Math.max(Date.now(),nextStart);nextStart=start+500
   if(start>Date.now())await wait(()=>new Promise(resolve=>{const t=setTimeout(resolve,start-Date.now());t.unref?.()}))
   assertActive();check(!held.has(new URL(url).hostname),'public host became held while queued')
   result=await wait(()=>boundedDeclaredPublicGet(url,{fetchImpl:options.fetchImpl??globalThis.fetch,signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),overflowError:Error('BlueConic native entity exceeds input limit')}))
  }}catch(error){transportErrors.set(url,error);throw error}
  if([401,403,429].includes(result?.status))held.add(new URL(url).hostname)
  if(typeof result?.bodyBase64==='string'){
   decodedBytes+=Buffer.byteLength(result.bodyBase64,'base64');check(decodedBytes<=64*1024*1024,'source decoded-byte bound exceeded')
  }
  return result
 }
 const io=createPublicIO({fetchPage,signal,allowed:url=>allowed.has(url.href)&&!held.has(url.hostname)})
 const load=async url=>{
  assertActive()
  const p=await io.load(url,{fresh:true})
  assertActive()
  if(Number.isInteger(p?.status)&&p.status!==200){
   const status=p.status,kind=[401,403,429].includes(status)?'blocked_or_access_denied':status===408||status>=500?'network_or_timeout':'surface_drift_or_fail_closed'
   throw Object.assign(Error('BlueConic public HTTP '+status+' at '+url),{failureKind:kind,status,httpStatus:status,requestedUrl:url,responseUrl:p.finalURL})
  }
  if(p?.error&&transportErrors.has(url)){
   const cause=transportErrors.get(url),network=/^(?:UND_ERR_(?:CONNECT_TIMEOUT|HEADERS_TIMEOUT|BODY_TIMEOUT|SOCKET)|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN)$/.test(cause?.cause?.code??cause?.code??'')
    ||cause?.name==='TimeoutError'||cause?.name==='TypeError'&&cause.message==='fetch failed'
   throw Object.assign(Error('BlueConic public GET failed at '+url+': '+String(cause?.message??cause),{cause}),{failureKind:network?'network_or_timeout':'surface_drift_or_fail_closed'})
  }
  check(p?.usable&&p.transportQualified&&typeof p.bodyBase64==='string'&&typeof p.originalText==='string','original current public response unavailable at '+url)
  const type=Object.entries(p.headers).find(([k])=>k.toLowerCase()==='content-type')?.[1]?.split(';')[0].trim().toLowerCase()
  const accepted=url===client?['text/javascript','application/javascript']:url===feed||url.endsWith('/detail')?['application/json']:['text/html','application/xhtml+xml']
  check(accepted.includes(type),'current public response media type changed at '+url)
  return p
 }
 const json=async url=>{
  const p=await load(url),m=io.json(p)
  check(m&&typeof m==='object'&&!Array.isArray(m)&&[m,m.meta??{}].every(v=>!v.error&&!v.errors&&v.success!==false&&v.ok!==false
   &&!v.hasError&&!v.failed&&!/^(?:error|failed|failure|unavailable)$/i.test(String(v.status??''))
   &&!(Number.isFinite(Number(v.status))&&Number(v.status)>=400)&&!(Number.isFinite(Number(v.statusCode))&&Number(v.statusCode)>=400)),'native JSON malformed or error envelope')
  return m
 }
 const prove=async()=>{
  const page=await load(corporate),binding=handoff(page.originalText),program=await load(client)
  check(sha256(Buffer.from(program.bodyBase64,'base64'))===clientSHA,'current declared embed client changed')
  check(matchesAuthoredIntegrity({scriptIntegrity:binding.script.integrity??''},program.bodyBase64),'authored embed-client integrity changed')
  return binding
 }
 try{
  assertActive();const openingBinding=await prove(),opening=await json(feed),rows=inventory(opening),observations=[]
  for(const row of rows){
   const own=row.url,detailURL=own+'/detail';allowed.add(own);allowed.add(detailURL)
   const page=await load(own),head=activeHead(page.originalText),detailEnvelope=await json(detailURL),record=detailEnvelope?.result?.jobOpening
   const observation={jobId:String(row.id),source:'blueconic',company:'BlueConic',title:row.name,sourceUrl:own,applyUrl:own,link:own,atsPlatform:'bamboohr',
    sourceNativeListingRecord:structuredClone(row),sourceNativeRecord:structuredClone(record??null),sourceNativeDetailEnvelope:structuredClone(detailEnvelope),
    sourceNativeRoleHead:head,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceApplicationStatusUnqualified:true,sourceNativeIssues:[]}
   const meta=(key,value)=>head.metas.filter(m=>m.property===key).length===1&&head.metas.some(m=>m.property===key&&m.content===value)
   const identity=record?.jobOpeningShareUrl===own&&record.jobOpeningStatus==='Open'&&clean(record.jobOpeningName)===clean(row.name)
    &&meta('og:site_name','BlueConic')&&meta('og:url',own)&&meta('og:title',row.name)
   if(!identity)observation.sourceNativeIssues.push('native employer, posting ID/title/share URL or open status conflict')
   const primary=countryName(record?.location?.addressCountry),advertised=countryName(record?.atsLocation?.country)
   const alternate=record?.atsLocation,alternateHasPlace=alternate&&['country','city','state'].some(k=>clean(alternate[k]))
   const conflict=Boolean(primary&&advertised&&primary!==advertised)
   const country=primary&&!(alternateHasPlace&&!advertised)&&!conflict?(advertised||primary):null
   const description=extractActiveDescription(record?.description)
   if(!country)observation.sourceNativeIssues.push(conflict?'native country declarations conflict':'native worksite country unresolved')
   if(!description)observation.sourceNativeIssues.push('full native role criteria unavailable')
   Object.assign(observation,{country,city:clean(record?.location?.city)||null,state:clean(record?.location?.state)||null,
    location:country?[record?.location?.city,record?.location?.state,country].filter(Boolean).join(', '):null,
    sourceNativeLocation:record?.location??null,sourceNativeAtsLocation:alternate??null,sourceNativeCountryConflict:conflict,sourceCountryScopeUnresolved:!country,
    sourceDetailComplete:Boolean(description),jobDescription:description,sourceDescription:description,sourceNativeDescriptionHTML:record?.description??null,
    employmentType:clean(record?.employmentStatusLabel)||null,department:clean(record?.departmentLabel)||null,postingDate:postingDate(record?.datePosted),
    sourceMinimumExperience:record?.minimumExperience??null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],closingDate:null,
    remoteStatus:null,sourceRemoteStatusUnresolved:true,sourceNativeLocationType:record?.locationType??null,sourceCurrentNativeRoleQualified:Boolean(identity&&country&&description)})
   observations.push(observation)
  }
  const closing=await json(feed);inventory(closing);const closingBinding=await prove()
  const closingInventoryMatches=stable(opening)===stable(closing)&&stable(openingBinding)===stable(closingBinding)
  if(!closingInventoryMatches)for(const o of observations)o.sourceCurrentNativeRoleQualified=false
  const audit={source:'blueconic',opening,closing,openingBinding,closingBinding,closingInventoryMatches,observations,
   rawPages:io.rawPages,issues:io.issues,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,
   qualification:'Current employer-declared native embed channel only. Whole-employer scope, active applications, persistence, publication and zero-inventory cleanup remain unqualified.'}
  await wait(()=>(options.onAudit??(()=>{}))(structuredClone(audit)));await wait(()=>(options.onRecords??(()=>{}))(structuredClone(observations)));assertActive()
  const eligible=observations.filter(o=>o.sourceCurrentNativeRoleQualified&&o.country==='India')
  const jobs=(maxJobs===null?eligible:eligible.slice(0,maxJobs)).map(j=>({...j,scrapedAt:new Date().toISOString()}))
  Object.defineProperty(jobs,'sourceAudit',{value:audit})
  attachSourceObservationEvidence(jobs,{source:'blueconic',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  const result=attachInventoryEvidence(jobs,{firstParty:true,status:'discovery-only',surface:feed,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:requestCount,verifiedAt:new Date().toISOString(),
   reason:'current-employer-declared-BambooHR-native-channel;typed-country-full-criteria-and-closing-checked;whole-company-and-application-publication-unqualified'})
  assertActive();return result
 }finally{clearTimeout(timer)}
}})
