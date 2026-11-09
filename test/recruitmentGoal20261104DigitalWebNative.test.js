import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {extractDetailJobData} from '../scraper/digitalwebsolutions/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {filterIndiaJobs} from '../scraper-support/utils/indiaLocationFilter.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/digitalweb-native-quality.json.gz',import.meta.url))))
const ids=['524','512','511','507','498'],unknownIds=['524','512','511','498']
test('DWS fixture preserves all sixteen original paired public responses and production pacing',()=>{
 assert.equal(fixture.countryFilter,'Global');assert.equal(fixture.requests.length,16)
 const prior=new Map()
 for(const p of fixture.requests){
  assert.equal(p.replayed,false);assert.equal(p.method,'GET');assert.ok([200,308].includes(p.status))
  assert.equal(createHash('sha256').update(p.text).digest('hex'),p.bodySHA256);assert.equal(Buffer.byteLength(p.text),p.bodyBytes)
  const origin=new URL(p.requestedURL).origin,started=Date.parse(p.startedAt)
  if(prior.has(origin))assert.ok(started-prior.get(origin)>=850,'Unpaced production request')
  prior.set(origin,started)
 }
 assert.equal(fixture.requests.filter(p=>p.status===308).length,2)
})
function transport(mutate=()=>{}){
 const calls=[],counts=new Map()
 const packet=url=>{
  const candidates=fixture.requests.filter(p=>p.requestedURL===url);assert.ok(candidates.length,'Uncaptured public read '+url)
  const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
  assert.ok(occurrence<=candidates.length,'Repeated uncaptured public read '+url)
  const p=structuredClone(candidates[occurrence-1]);mutate(p,occurrence);calls.push({url,occurrence});return p
 }
 return {calls,options:{requestIntervalMs:0,now:()=> '2026-11-05T06:00:00.000Z',
  fetchImpl:async url=>{const p=packet(url),r=new Response(p.text,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r},
  fetchText:async url=>packet(url).text}}
}
const provider=()=>getScraperCatalog().find(p=>p.source==='digitalwebsolutions')
test('DWS detail mapping leaves a city, remote label and employer address insufficient for own work country',()=>{
 for(const id of unknownIds){
  const p=fixture.requests.find(p=>p.requestedURL.endsWith('/'+id)),job=extractDetailJobData(p.text,{sourceUrl:p.requestedURL,listingLocation:id==='512'?'Hybrid':'Gurgaon'})
  assert.equal(job.country,null,'Missing own job country must stay unknown for '+id)
 }
})
test('DWS registered Global source retains all five full native models and the one own India worksite',async()=>{
 const read=transport(),p=provider();assert.equal(p.countryFilter,'Global')
 const jobs=await createCatalogScraper(p).run(read.options)
 assert.deepEqual(jobs.map(j=>j.jobId),ids);assert.deepEqual(jobs.filter(j=>j.country==='India').map(j=>j.jobId),['507'])
 assert.deepEqual(jobs.filter(j=>j.country===null).map(j=>j.jobId),unknownIds)
 for(const j of jobs){
  assert.equal(String(j.nativeSourceRecord.jobPosting.identifier.value),j.jobId)
  assert.equal(j.nativeSourceRecord.jobPosting.hiringOrganization.name,'Digital Web Solutions')
  assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceClosingQualified,true)
  assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.sourceListingComplete,false)
  assert.equal(j.requisitionId,null);assert.equal(j.legalEmployer,null);assert.equal(j.postingDate,null)
  if(j.country===null){assert.equal(j.city,null);assert.equal(j.location,null);assert.equal(j.sourceCountryScopeUnresolved,true)}
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(read.calls.filter(c=>c.url==='https://www.digitalwebsolutions.com/careers/').length,2)
 assert.equal(read.calls.length,16)
 const observations=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(observations.closedNativeDetails,5);assert.deepEqual(observations.unknownCountryIds,unknownIds)
 const normalized=jobs.map(j=>normalizeScrapedJob(j,p));assert.equal(filterIndiaJobs(normalized).length,1)
})
test('DWS retains responsibilities beyond the native structured 2000-character excerpt',async()=>{
 const read=transport(),jobs=await createCatalogScraper(provider()).run(read.options),job=jobs.find(j=>j.jobId==='512')
 assert.equal(job.nativeSourceRecord.jobPosting.responsibilities.length,2000)
 const section=job.nativeSourceRecord.visibleRole.sections.find(s=>s.heading==='Responsibilities')
 assert.equal(section.text.length,2613)
 assert.match(job.jobDescription,/take initiatives from an idea through execution and results\./)
})
test('DWS zero caps and cancellation settle without public reads',async()=>{
 const never=async()=>assert.fail('No public read for zero limit or cancellation')
 const jobs=await createCatalogScraper(provider()).run({maxJobs:0,fetchText:never,fetchImpl:never})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 const reason=Error('caller stopped')
 await assert.rejects(createCatalogScraper(provider()).run({signal:AbortSignal.abort(reason),fetchText:never,fetchImpl:never}),e=>e===reason)
})
test('DWS does not interpret a country-shaped city name as an explicit work country',async()=>{
 const read=transport(p=>{if(p.requestedURL.endsWith('/507'))p.text=p.text.replace('"addressLocality":"Noida, Uttar Pradesh, India"','"addressLocality":"Georgia"')})
 const jobs=await createCatalogScraper(provider()).run(read.options)
 assert.equal(jobs.length,5);assert.equal(jobs.find(j=>j.jobId==='507').country,null)
})
test('DWS configured caps retain the original Global order and full inventory checks',async()=>{
 const read=transport(),jobs=await createCatalogScraper(provider()).run({...read.options,maxJobs:1})
 assert.deepEqual(jobs.map(j=>j.jobId),['524']);assert.equal(jobs[0].country,null)
 assert.equal(read.calls.length,16);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const status of [401,403,429,451])test('DWS stops all further reads after HTTP '+status,async()=>{
 const target=fixture.requests.find(p=>p.requestedURL.endsWith('/511')).requestedURL
 const read=transport((p,n)=>{if(p.requestedURL===target&&n===1)p.status=status})
 const jobs=await createCatalogScraper(provider()).run(read.options)
 assert.deepEqual(jobs.map(j=>j.jobId),['524','512']);assert.ok(jobs.every(j=>!j.sourceClosingQualified))
 assert.equal(read.calls.length,6);assert.equal(read.calls.at(-1).url,target)
 assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].failures[0].status,status)
})
test('DWS rejects a changed board redirect without following an alternate account',async()=>{
 const read=transport(p=>{if(p.status===308)p.headers.location='/co/other-company'})
 await assert.rejects(createCatalogScraper(provider()).run(read.options),/redirect/i);assert.equal(read.calls.length,2)
})
test('DWS closing checks detect criteria changed beyond the native structured excerpt',async()=>{
 const read=transport((p,n)=>{if(p.requestedURL.endsWith('/512')&&n===2)p.text=p.text.replace('from an idea through execution and results.','from a materially changed final requirement.')})
 const jobs=await createCatalogScraper(provider()).run(read.options)
 assert.deepEqual(jobs.map(j=>j.jobId),['524','511','507','498']);assert.ok(jobs.every(j=>j.sourceClosingQualified))
})
test('DWS requires the role own employer and does not borrow another posting on the same platform',async()=>{
 const read=transport(p=>{if(p.requestedURL.endsWith('/507'))p.text=p.text.replace('"name":"Digital Web Solutions","identifier"','"name":"Another Company","identifier"')})
 const jobs=await createCatalogScraper(provider()).run(read.options)
 assert.equal(jobs.length,4);assert.ok(!jobs.some(j=>j.jobId==='507'))
})
test('DWS leaves contradictory native country fields unresolved',async()=>{
 const read=transport(p=>{if(p.requestedURL.endsWith('/507'))p.text=p.text.replace('"addressLocality":"Noida, Uttar Pradesh, India"','"addressLocality":"Noida, Uttar Pradesh, India","addressCountry":"US"')})
 const jobs=await createCatalogScraper(provider()).run(read.options),target=jobs.find(j=>j.jobId==='507')
 assert.equal(jobs.length,5);assert.equal(target.country,null);assert.equal(target.sourceNativeCountryConflict,true)
})
test('DWS hidden corporate links cannot authorize the native board',async()=>{
 const read=transport(p=>{if(p.requestedURL==='https://www.digitalwebsolutions.com/careers/')p.text='<title>Careers - Digital Web Solutions</title><template><a href="https://hirenext.io/co/digital-web-solutions/">View All Jobs</a></template>'})
 await assert.rejects(createCatalogScraper(provider()).run(read.options),/first-party careers page/i);assert.equal(read.calls.length,1)
})
test('DWS invalid caps settle before any request',async()=>{
 const never=async()=>assert.fail('No public read for an invalid cap')
 for(const maxJobs of [-1,1.5,'1'])await assert.rejects(createCatalogScraper(provider()).run({maxJobs,fetchText:never,fetchImpl:never}),/limit/i)
})
for(const kind of ['challenge','mime'])test('DWS stops after a native '+kind+' response instead of continuing other reads',async()=>{
 const target=fixture.requests.find(p=>p.requestedURL.endsWith('/511')).requestedURL
 const read=transport((p,n)=>{if(p.requestedURL===target&&n===1){
  if(kind==='challenge')p.text='<title>Just a moment...</title><h1>Checking your browser</h1>'
  else p.headers['content-type']='text/plain'
 }})
 const jobs=await createCatalogScraper(provider()).run(read.options)
 assert.deepEqual(jobs.map(j=>j.jobId),['524','512']);assert.equal(read.calls.length,6)
 assert.equal(read.calls.at(-1).url,target)
})
