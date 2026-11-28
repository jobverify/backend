import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCredgenicsScraper,HOMEPAGE_URL,ZAPPYHIRE_BOARD_URL,ZAPPYHIRE_API_BASE} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-publisher-20261128.json.gz',import.meta.url))))
const bodies=new Map()
for(const packet of fixture.packets){
 const body=Buffer.from(packet.bodyBase64,'base64').toString()
 if(!bodies.has(packet.requestedUrl??packet.url))bodies.set(packet.requestedUrl??packet.url,[])
 bodies.get(packet.requestedUrl??packet.url).push(body)
}
const listing=`${ZAPPYHIRE_API_BASE}jobs/jobsearch/?page=1&page_size=100`
const config=`${ZAPPYHIRE_API_BASE}careers/configurations/`
const main='https://recruitcareers.zappyhire.com/en/main.08545c354c03458b.js'
const firstBody=url=>bodies.get(url)?.[0]
const json=url=>JSON.parse(firstBody(url))
const observedIds=json(listing).results.hits.map(row=>row._source.job)
const legacyHeading=value=>{value.results.career_text_heading='CredGenics Careers';return value}
const clone=value=>structuredClone(value)
function replay({legacy=false,mutateJSON=(url,value)=>value,mutateText=(url,value)=>value,signal}={}){
 const calls=[],counts=new Map()
 const count=url=>{const n=(counts.get(url)??0)+1;counts.set(url,n);return n}
 const readText=async(url,options)=>{
  calls.push({url,kind:'text',options});const n=count(url)
  assert.ok(bodies.has(url),`Undeclared text read ${url}`)
  return mutateText(url,firstBody(url),n)
 }
 const readJSON=async(url,options)=>{
  calls.push({url,kind:'json',options});const n=count(url)
  assert.ok(bodies.has(url),`Undeclared native read ${url}`)
  let value=json(url)
  if(legacy&&url===config)value=legacyHeading(value)
  return mutateJSON(url,value,n)
 }
 return {calls,counts,run:()=>createCredgenicsScraper().run({fetchText:readText,fetchJson:readJSON,signal,now:()=> '2026-11-28T03:00:00.000Z'})}
}
const explicitIN=(url,value)=>{
 if(/\/careers\/jobs\/\d+\/$/.test(url))for(const location of value.results.location)location.country_code='IN'
 return value
}
function held(jobs,observed=9){
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory.listingComplete,false)
 assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(inventory.reportedTotal,null)
 assert.equal(inventory.indiaFacetCount,null)
 assert.notEqual(inventory.status,'verified-empty')
 assert.notEqual(inventory.status,'complete-inventory')
 assert.equal(readSourceObservationEvidence(jobs,'credgenics').observedRecordCount,observed)
 const audit=jobs.nativeInventoryEvidence
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.companyGlobalTotal,null)
 assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 return audit
}

test('current complete declared publisher retains all nine genuine null-country DTOs without India or zero authority',async()=>{
 const transport=replay(),jobs=await transport.run()
 assert.equal(jobs.length,0)
 const audit=held(jobs)
 assert.equal(audit.opening.records.length,9)
 assert.equal(audit.closing.records.length,9)
 for(const phase of ['opening','closing'])for(const id of observedIds){
  const entry=audit[phase].records.find(row=>row.record._source.job===id)
  assert.deepEqual(entry.detail,json(`${ZAPPYHIRE_API_BASE}careers/jobs/${id}/`).results)
  assert.equal(entry.reason,'native-country-unqualified')
 }
 assert.equal(transport.counts.get(main),2)
 assert.equal(transport.counts.get(HOMEPAGE_URL),2)
})
test('legacy reviewed heading also holds genuine unknown geography instead of inheriting organization IN',async()=>{
 const jobs=await replay({legacy:true}).run();assert.equal(jobs.length,0);held(jobs)
})
test('explicit IN synthetic geography admits only data observations with full raw criteria and all authority flags held',async()=>{
 const jobs=await replay({legacy:true,mutateJSON:explicitIN}).run()
 assert.equal(jobs.length,9);held(jobs)
 for(const job of jobs){
  assert.equal(job.country,'India')
  for(const key of ['sourceDetailComplete','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete','sourceAvailabilityVerified','applicationPublicContextValidated','activeApplyVerified','sourceScopeComplete','sourceListingComplete','lifecycleCleanupAllowed'])assert.equal(job[key],false,key)
  assert.deepEqual(job.nativeCriteriaData.detail,explicitIN(`${ZAPPYHIRE_API_BASE}careers/jobs/${job.requisitionId}/`,json(`${ZAPPYHIRE_API_BASE}careers/jobs/${job.requisitionId}/`)).results)
  assert.ok(job.jobDescription.trim().length>100)
 }
})
for(const [name,location] of [
 ['missing',[{city:'Noida-Uttar Pradesh'}]],['blank',[{city:'Noida-Uttar Pradesh',country_code:''}]],
 ['foreign',[{city:'Noida-Uttar Pradesh',country_code:'US'}]],['mixed',[{city:'Noida-Uttar Pradesh',country_code:'IN'},{city:'Chennai-Tamil Nadu',country_code:'US'}]],
 ['ambiguous-country',[{city:'Noida-Uttar Pradesh',country_code:['IN']}]],['extra-geography',[{city:'Noida-Uttar Pradesh',country_code:'IN',applicantCountry:'US'}]],
])test(`legacy native ${name} country remains held with complete raw evidence`,async()=>{
 const jobs=await replay({legacy:true,mutateJSON:(url,value)=>{
  if(/\/careers\/jobs\/\d+\/$/.test(url))value.results.location=clone(location)
  return value
 }}).run()
 assert.equal(jobs.length,0);const audit=held(jobs)
 assert.deepEqual(audit.opening.records[0].detail.location,location)
})
test('native extra eligibility and full HTML criteria are retained and cannot become qualified India output',async()=>{
 const raw='<div><h2>Eligibility</h2><p>Applicants must live in US only.</p><table><tr><td>Full criteria</td></tr></table></div>'
 const jobs=await replay({legacy:true,mutateJSON:(url,value)=>{
  explicitIN(url,value)
  if(/\/careers\/jobs\/\d+\/$/.test(url)){value.results.applicantLocationRequirements={name:'United States'};value.results.description=raw}
  return value
 }}).run()
 assert.equal(jobs.length,0)
 const audit=held(jobs)
 for(const phase of ['opening','closing']){
  assert.deepEqual(audit[phase].records[0].detail.applicantLocationRequirements,{name:'United States'})
  assert.equal(audit[phase].records[0].detail.description,raw)
 }
})
test('two native zero snapshots cannot certify company zero or cleanup',async()=>{
 const transport=replay({legacy:true,mutateJSON:(url,value)=>{
  if(url===listing){value.results.total.value=0;value.results.hits=[]}return value
 }})
 const jobs=await transport.run();assert.equal(jobs.length,0);held(jobs,0)
 assert.equal(transport.counts.get(listing),2)
})
for(const [name,change] of [
 ['complete native criteria',(url,value,n)=>{if(n===2&&/\/careers\/jobs\/31\/$/.test(url))value.results.description+='<p>Closing-only criterion</p>';return value}],
 ['unselected null-country raw data',(url,value,n)=>{if(n===2&&/\/careers\/jobs\/31\/$/.test(url))value.results.other_job_settings={newEligibility:'foreign'};return value}],
 ['native membership',(url,value,n)=>{if(url===listing&&n===2)value.results.hits[0]._source.title+=' changed';return value}],
 ['native country',(url,value,n)=>{if(n===2&&/\/careers\/jobs\/31\/$/.test(url))value.results.location[0].country_code='IN';return value}],
])test(`closing ${name} drift rejects the entire result`,async()=>{
 await assert.rejects(replay({legacy:true,mutateJSON:change}).run(),/closing|changed|snapshot|identity/i)
})
for(const [name,change] of [
 ['employer',(url,value)=>{if(url===listing)value.results.hits[0]._source.entity='Unrelated';return value}],
 ['tenant',(url,value)=>{if(url===listing)value.results.hits[0]._source.client='unrelated';return value}],
 ['detail ID',(url,value)=>{if(/\/careers\/jobs\/31\/$/.test(url))value.results.id=999;return value}],
 ['detail title',(url,value)=>{if(/\/careers\/jobs\/31\/$/.test(url))value.results.title='Unrelated';return value}],
 ['duplicate membership',(url,value)=>{if(url===listing)value.results.hits[1]=clone(value.results.hits[0]);return value}],
])test(`unknown geography never bypasses ${name} binding`,async()=>{
 await assert.rejects(replay({legacy:true,mutateJSON:change}).run(),/identity|matches|duplicate|listing|detail/i)
})
for(const [name,change] of [
 ['main full bytes',(url,value)=>url===main?value+'\n/* unreviewed */':value],
 ['runtime bytes',(url,value)=>url.includes('/runtime.')?value+'\n/* changed */':value],
 ['stylesheet bytes',(url,value)=>url.endsWith('.css')?value+'\n.unreviewed{}':value],
 ['board extra own script',(url,value)=>url===ZAPPYHIRE_BOARD_URL?value.replace('</body>','<script src="extra.js"></script></body>'):value],
 ['closing client bytes',(url,value,n)=>url===main&&n===2?value+'\n/* changed */':value],
])test(`current native profile rejects ${name}`,async()=>{
 await assert.rejects(replay({mutateText:change}).run(),/publisher|asset|shell|closing|profile|program/i)
})
test('unreviewed marketing heading cannot enter the finite current publisher profile',async()=>{
 await assert.rejects(replay({mutateJSON:(url,value)=>{if(url===config)value.results.career_text_heading='Careers elsewhere';return value}}).run(),/configuration|heading/i)
})
test('pre-aborted caller retains exact opaque reason and starts no reads',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'caller'});controller.abort(reason)
 const transport=replay({signal:controller.signal})
 await assert.rejects(transport.run(),error=>error===reason)
 assert.equal(transport.calls.length,0)
})
test('caller cancellation rejects promptly during an injected reader and cannot commit or continue late',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'caller-late'}),calls=[]
 let release,entered
 const began=new Promise(resolve=>{entered=resolve})
 const pending=createCredgenicsScraper().run({signal:controller.signal,fetchText:async(url,options)=>{
  calls.push({url,options});entered();return new Promise(resolve=>{release=resolve})
 }})
 await began;controller.abort(reason)
 await assert.rejects(Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('Caller abort was not prompt')),200))]),error=>error===reason)
 assert.equal(calls[0].options.signal,controller.signal)
 release(firstBody(HOMEPAGE_URL));await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls.length,1)
})
test('default reader owns and disposes a late response after exact caller cancellation',async context=>{
 const original=globalThis.fetch;context.after(()=>{globalThis.fetch=original})
 const controller=new AbortController(),reason=Object.freeze({opaque:'late-native-response'})
 let release,entered,cancelled=0
 const started=new Promise(resolve=>{entered=resolve})
 globalThis.fetch=async()=>{entered();return new Promise(resolve=>{release=resolve})}
 const pending=createCredgenicsScraper().run({signal:controller.signal})
 await started;controller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
 const response=new Response(new ReadableStream({cancel(){cancelled++}}),{status:200})
 Object.defineProperty(response,'url',{value:HOMEPAGE_URL})
 release(response)
 await new Promise(resolve=>setTimeout(resolve,20))
 assert.equal(cancelled,1)
})
for(const date of ['2026-02-30T12:00:00.123456Z','2026-11-28T24:00:00Z','2026-11-28T12:61:00Z','2026-11-28'])test(`invalid native timestamp ${date} stays raw and held`,async()=>{
 const jobs=await replay({legacy:true,mutateJSON:(url,value)=>{
  explicitIN(url,value)
  if(/\/careers\/jobs\/\d+\/$/.test(url))value.results.job_publish_date=date
  return value
 }}).run()
 assert.equal(jobs.length,0)
 assert.equal(held(jobs).opening.records[0].detail.job_publish_date,date)
})
test('valid native microsecond timestamps and leap dates remain exact observations',async()=>{
 const jobs=await replay({legacy:true,mutateJSON:(url,value)=>{
  explicitIN(url,value)
  if(/\/careers\/jobs\/31\/$/.test(url))value.results.job_publish_date='2024-02-29T12:34:56.123456Z'
  return value
 }}).run()
 assert.equal(jobs.length,9);held(jobs)
 assert.equal(jobs[0].postingDate,'2024-02-29T12:34:56.123456Z')
})
for(const challenge of [false,true])test(`default native HTTP403 ${challenge?'challenge':'ordinary denial'} is terminal and never starts closing reads`,async context=>{
 const original=globalThis.fetch;context.after(()=>{globalThis.fetch=original})
 const calls=[]
 globalThis.fetch=async url=>{
  calls.push(url)
  const denied=url===listing
  const response=new Response(denied?'Forbidden':firstBody(url),{status:denied?403:200,headers:{'content-type':url.includes('/api/')?'application/json':'text/plain',...(denied&&challenge?{'cf-mitigated':'challenge'}:{})}})
  Object.defineProperty(response,'url',{value:url});return response
 }
 await assert.rejects(createCredgenicsScraper().run(),error=>error.httpStatus===403&&(challenge?error.accessChallenge===true:true))
 assert.equal(calls.filter(url=>url===listing).length,1)
 assert.equal(calls.filter(url=>url===HOMEPAGE_URL).length,1)
})
test('default native HTTP200 challenge remains terminal before parsing or downstream reads',async context=>{
 const original=globalThis.fetch;context.after(()=>{globalThis.fetch=original})
 let reads=0
 globalThis.fetch=async url=>{
  reads++
  const response=new Response(firstBody(url),{status:200,headers:{'cf-mitigated':'challenge'}})
  Object.defineProperty(response,'url',{value:url});return response
 }
 await assert.rejects(createCredgenicsScraper().run(),error=>error.accessChallenge===true)
 assert.equal(reads,1)
})
test('default public response identity cannot be forged with matching HTML from a foreign URL',async context=>{
 const original=globalThis.fetch;context.after(()=>{globalThis.fetch=original})
 let reads=0
 globalThis.fetch=async()=>{
  reads++
  const response=new Response(firstBody(HOMEPAGE_URL),{status:200})
  Object.defineProperty(response,'url',{value:'https://unrelated.example/'});return response
 }
 await assert.rejects(createCredgenicsScraper().run(),/response identity changed/)
 assert.equal(reads,1)
})
test('an explicit vendor role cannot inherit Credgenics employer authority',async()=>{
 const jobs=await replay({legacy:true,mutateJSON:(url,value)=>{
  explicitIN(url,value)
  if(/\/careers\/jobs\/\d+\/$/.test(url))value.results.is_vendor_job=true
  return value
 }}).run()
 assert.equal(jobs.length,0)
 assert.equal(held(jobs).opening.records[0].detail.is_vendor_job,true)
})
for(const url of ['https://user@recruitcareers.zappyhire.com/credgenics/apply?job=31','https://recruitcareers.zappyhire.com/credgenics/apply?job=31&job=999','https://unrelated.example/credgenics/apply?job=31'])test(`unknown geography cannot bypass native application identity ${url}`,async()=>{
 await assert.rejects(replay({legacy:true,mutateJSON:(address,value)=>{
  if(/\/careers\/jobs\/31\/$/.test(address))value.results.job_board_urls.find(row=>row.name==='Career Page').url=url
  return value
 }}).run(),/matches|application/i)
})
test('unfiltered native department metadata may reorder while both original full arrays remain retained',async()=>{
 const jobs=await replay({legacy:true,mutateJSON:(url,value,n)=>{
  if(url===listing&&n===2)value.results.departments.reverse()
  return value
 }}).run()
 assert.equal(jobs.length,0)
 const audit=held(jobs),opening=audit.opening.listingPages[0].results.departments,closing=audit.closing.listingPages[0].results.departments
 assert.deepEqual(opening,json(listing).results.departments)
 assert.deepEqual(closing,[...opening].reverse())
 assert.notDeepEqual(opening,closing)
})
for(const [name,change]of [
 ['new department',values=>[...values,'Unreviewed department']],
 ['missing department',values=>values.slice(1)],
 ['duplicate department',values=>[...values,values[0]]],
 ['malformed department',values=>[...values,null]],
])test(`closing ${name} metadata cannot hide native membership drift`,async()=>{
 await assert.rejects(replay({legacy:true,mutateJSON:(url,value,n)=>{
  if(url===listing&&n===2)value.results.departments=change(value.results.departments)
  return value
 }}).run(),/closing|changed|snapshot|department/i)
})
test('complete genuine final registered36 graph preserves every raw held DTO and coverage/cleanup boundary',async context=>{
 const saved=fixture.registeredCapture
 assert.equal(saved.packets.length,36)
 const original=globalThis.fetch;context.after(()=>{globalThis.fetch=original})
 const queues=new Map(),calls=[]
 for(const packet of saved.packets){
  const body=Buffer.from(packet.bodyBase64,'base64').toString()
  assert.equal(createHash('sha256').update(body).digest('hex'),packet.sha256)
  const key=`${packet.method} ${packet.requestedUrl}`
  if(!queues.has(key))queues.set(key,[])
  queues.get(key).push({packet,body})
 }
 globalThis.fetch=async (input,options={})=>{
  const url=String(input),key=`${options.method??'GET'} ${url}`,row=queues.get(key)?.shift()
  assert.ok(row,`No genuine retained response for ${key}`)
  calls.push(key)
  const response=new Response(row.body,{status:row.packet.status,headers:row.packet.headers})
  Object.defineProperty(response,'url',{value:row.packet.url});return response
 }
 const provider=getScraperCatalog().find(row=>row.source==='credgenics')
 assert.ok(provider.modulePath.replaceAll('\\','/').endsWith('/scraper/credgenics/script.js'))
 const jobs=await createCatalogScraper(provider).run({now:()=>saved.sourceNow})
 assert.equal(calls.length,36)
 assert.ok([...queues.values()].every(queue=>queue.length===0))
 assert.equal(jobs.length,0)
 assert.deepEqual(jobs.nativeCollectionEvidence,saved.expectedNativeAudit)
 assert.equal(readSourceObservationEvidence(jobs,'credgenics').observedRecordCount,9)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(assessment.runnerOutcome.success,false)
 assert.equal(assessment.runnerOutcome.partial,true)
 assert.equal(assessment.runnerOutcome.rawRecords,9)
 assert.equal(assessment.runnerOutcome.failureKind,'coverage_gap')
 assert.equal(assessment.indiaJobs,0)
 assert.equal(assessment.eligibleJobs,0)
 assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})
