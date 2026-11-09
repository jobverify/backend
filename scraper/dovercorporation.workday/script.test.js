import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {capturedSource,currentNativeTransport as archivedTransport} from '../../test/helpers/replayCurrentNativeQuality.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {discoverOffices,CAREERS,BOARD} from './nativeContract.js'
import {run} from './script.js'
const redirect=JSON.parse(readFileSync(new URL('./fixtures/official-careers-redirect.json',import.meta.url)))
const currentNativeTransport=(source,mutate)=>archivedTransport(source,mutate,capturedSource(source).requests.map(p=>p.requestedURL==='https://www.dovercorporation.com/about-us/careers/'?structuredClone(redirect):p))
// Retain the archived native role bytes while replacing only its superseded
// corporate binding packets with the captured current first-party redirect.
const replay=async(mutate,options={})=>{
 const transport=currentNativeTransport('dovercorporation',mutate)
 const provider=getScraperCatalog().find(p=>p.source==='dovercorporation')
 const jobs=await createCatalogScraper(provider).run({fetchImpl:(...args)=>transport.fetch(...args),requestIntervalMs:0,now:()=>capturedSource('dovercorporation').completedAt,...options})
 return{jobs,transport}
}
const changeDetail=fn=>p=>{if(p.requestedURL.includes('/job/')){const d=JSON.parse(p.text);fn(d);p.text=JSON.stringify(d)}}

test('current registered reader reconciles 30 full native India roles and five current offices',async()=>{
 const {jobs,transport}=await replay()
 assert.equal(jobs.length,30);assert.equal(transport.remaining,0);assert.equal(transport.consumed,77)
 assert.equal(new Set(jobs.map(j=>j.jobId)).size,30)
 assert.deepEqual(jobs.map(j=>j.jobId),capturedSource('dovercorporation').expected.ids)
 for(const j of jobs){
  assert.equal(j.country,'India');assert.equal(j.sourceDetailComplete,true)
  assert.equal(j.sourceDescription,j.nativeSourceRecord.jobPostingInfo.jobDescription)
  assert.equal(j.nativeHiringOrganization.name,j.nativeSourceRecord.hiringOrganization.name)
  assert.equal(j.postingDate,j.nativeSourceRecord.jobPostingInfo.startDate)
  assert.equal(j.postingDatePrecision,'calendar-date');assert.equal(j.firstEverPostedAt,null)
  assert.equal(j.applyUrl,j.sourceUrl);assert.equal(j.applicationVisited,false)
  assert.equal(j.sourceOfficialBinding.currentHandoffRechecked,true)
  assert.equal(j.sourceNativeLocationFacets.ids.length,5)
  assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)
  assert.equal(j.sourceGlobalJobCount,null);assert.equal(j.sourceIndiaJobCount,null)
 }
 assert.ok(jobs.some(j=>j.location==='Bhiwadi, Rajasthan, India'))
 assert.ok(jobs.some(j=>j.nativeHiringOrganization.name==='Tokheim India Private Ltd'))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('current typed India facets exclude Indiana USA and support the changed Navi Mumbai ID',()=>{
 const packet=capturedSource('dovercorporation').requests.find(p=>p.method==='POST'&&!JSON.parse(p.body).appliedFacets.locations)
 const d=JSON.parse(packet.text),offices=discoverOffices(d)
 assert.equal(offices.length,5);assert.equal(offices.reduce((n,o)=>n+o.count,0),30)
 assert.ok(offices.some(v=>v.id==='fd26dd94fa9b10011f462108868a0000'))
 const values=d.facets.find(v=>v.facetParameter==='locationMainGroup').values.find(v=>v.facetParameter==='locations').values
 assert.ok(values.some(v=>/Indiana.*USA/.test(v.descriptor)))
 assert.ok(offices.every(v=>/, India$/.test(v.descriptor)))
})
test('typed facet ordering is insignificant',async()=>{
 const {jobs}=await replay(p=>{if(p.method==='POST'){const d=JSON.parse(p.text),reverse=a=>{a.reverse();a.forEach(n=>{if(n.values)reverse(n.values)})};reverse(d.facets);p.text=JSON.stringify(d)}})
 assert.equal(jobs.length,30)
})
for(const[name,fn,pattern]of[
 ['foreign country',d=>d.jobPostingInfo.country.descriptor='USA',/country/i],
 ['country code',d=>d.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US',/country/i],
 ['posting UID',d=>d.jobPostingInfo.id='bad',/UID/i],
 ['requisition',d=>d.jobPostingInfo.jobReqId='JR999',/identity/i],
 ['posting site',d=>d.jobPostingInfo.jobPostingSiteId='Foreign',/identity/i],
 ['legal employer',d=>d.hiringOrganization.name='Unrelated India Company',/employer/i],
 ['closed role',d=>d.jobPostingInfo.canApply=false,/closed|available/i],
 ['unpublished role',d=>d.jobPostingInfo.posted=false,/closed|available/i],
 ['future publication',d=>d.jobPostingInfo.startDate='2099-12-31',/future/i],
 ['invalid calendar date',d=>d.jobPostingInfo.startDate='2026-02-30',/calendar/i],
 ['expired role',d=>d.jobPostingInfo.endDate='2026-11-01',/expired/i],
 ['role URL',d=>d.jobPostingInfo.externalUrl+='?foreign=true',/identity/i],
 ['foreign secondary location',d=>d.jobPostingInfo.additionalLocations=['Austin, Texas, USA'],/location|country/i],
])test('holds conflicting native '+name,async()=>assert.rejects(replay(changeDetail(fn)),pattern))
test('native errors and selected listing truncation cannot become successful zero',async()=>{
 await assert.rejects(replay(p=>{if(p.method==='POST'){const d=JSON.parse(p.text);d.error='unavailable';p.text=JSON.stringify(d)}}),/envelope/i)
 await assert.rejects(replay(p=>{if(p.method==='POST'&&JSON.parse(p.body).appliedFacets.locations){const d=JSON.parse(p.text);d.jobPostings=[];p.text=JSON.stringify(d)}}),/truncated/i)
})
test('closing facet drift is rejected',async()=>{
 let reads=0
 await assert.rejects(replay(p=>{if(p.method==='POST'&&!JSON.parse(p.body).appliedFacets.locations&&++reads===2){const d=JSON.parse(p.text),v=d.facets.find(v=>v.facetParameter==='locationMainGroup').values.find(v=>v.facetParameter==='locations').values.find(v=>/, India$/.test(v.descriptor));v.count++;p.text=JSON.stringify(d)}}),/drift/i)
})
test('closing authoritative description drift is rejected',async()=>{
 const reads=new Map()
 await assert.rejects(replay(p=>{if(p.requestedURL.includes('/job/')){const n=(reads.get(p.requestedURL)||0)+1;reads.set(p.requestedURL,n);if(n===2){const d=JSON.parse(p.text);d.jobPostingInfo.jobDescription+='<p>Changed requirements.</p>';p.text=JSON.stringify(d)}}}),/detail drift/i)
})
test('missing, hidden and instruction-only descriptions preserve their rejection',async()=>{
 for(const html of['','<p>Please click Apply now to view the full job description and requirements. Complete your application to access responsibilities.</p>','<div hidden>Design, implement and test software components and investigate customer reports.</div>']){
  const {jobs}=await replay(changeDetail(d=>d.jobPostingInfo.jobDescription=html))
  assert.ok(jobs.every(j=>j.sourceDetailComplete===false&&j.sourceDescription===null&&j.sourceRejectedNativeDescription===html))
 }
})
test('date-only native closing dates retain calendar precision',async()=>{
 const day=capturedSource('dovercorporation').completedAt.slice(0,10)
 const {jobs}=await replay(changeDetail(d=>d.jobPostingInfo.endDate=day))
 assert.ok(jobs.every(j=>j.closingDate===day&&j.sourceClosingDateIsExact===false))
})
test('current corporate denial stops before native reads',async()=>{
 const t=currentNativeTransport('dovercorporation',p=>{if(p.requestedURL===CAREERS)p.status=403})
 await assert.rejects(run({fetchImpl:(...args)=>t.fetch(...args),requestIntervalMs:0}),/HTTP/i)
 assert.deepEqual(t.calls.map(c=>c.url),[CAREERS])
})
test('HTML with inert handoffs cannot replace the current careers-host redirect',async()=>{
 await assert.rejects(replay(p=>{if(p.requestedURL===CAREERS){p.status=200;p.text='<title>Dover Careers</title><template><a href="'+BOARD+'">Jobs</a></template>'}}),/handoff/i)
})
test('changed closing company handoff prevents candidate publication',async()=>{
 let reads=0
 await assert.rejects(replay(p=>{if(p.requestedURL===CAREERS&&++reads===2){p.status=200;p.text='<title>Dover Careers</title><p>Unavailable</p>'}}),/handoff/i)
})
test('native client redirects are checked before fetching their targets',async()=>{
 const t=currentNativeTransport('dovercorporation',p=>{if(p.status===307)p.headers.location='https://foreign.example/client.js'})
 await assert.rejects(run({fetchImpl:(...args)=>t.fetch(...args),requestIntervalMs:0}),/redirect URL/i)
 assert.ok(t.calls.every(c=>!c.url.includes('foreign.example')))
})
test('wrong MIME and caller cancellation are rejected',async()=>{
 await assert.rejects(replay(p=>{if(p.method==='POST')p.headers['content-type']='text/html'}),/MIME/i)
 await assert.rejects(replay(undefined,{signal:AbortSignal.abort(Error('caller cancelled'))}),/caller cancelled/)
})
