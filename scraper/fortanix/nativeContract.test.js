import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run as runNative} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261022.json.gz',import.meta.url))))
// Replay immutable native packets at their recorded observation time. They are
// historical evidence, rather than a claim of current source availability.
const replayAt=fixture.packets.map(packet=>packet.completedAt).sort().at(-1)
const run=options=>runNative({...options,now:()=>replayAt})
const widget='https://apply.workable.com/api/v1/widget/accounts/337112',firstID='465FBC5BDA'
function mock(mutate=r=>r){const requests=[],index=new Map(),calls=new Map();for(const p of fixture.packets)index.set(p.url,[...(index.get(p.url)||[]),p]);return{requests,transport:async url=>{requests.push(url);const list=index.get(url);assert.ok(list,'Unexpected fixture request: '+url);const i=calls.get(url)||0;calls.set(url,i+1);const p=list[Math.min(i,list.length-1)];return mutate({...p,body:Buffer.from(p.rawBodyBase64,'base64')},requests)}}}
const alter=(r,fn)=>{const p=JSON.parse(r.body.toString('utf8'));fn(p);return{...r,body:Buffer.from(JSON.stringify(p))}}
const text=(r,fn)=>({...r,body:Buffer.from(fn(r.body.toString('utf8')))})
test('Fortanix selected executable replaces sentinel with ten India roles from complete nineteen-role native inventory',async()=>{
 const m=mock(),jobs=await run({transport:m.transport});assert.equal(jobs.length,10);const n=jobs[0].nativeCollectionEvidence
 assert.equal(n.observedListingCount,19);assert.equal(n.nativeReportedTotal,19);assert.equal(n.candidateDetails,10);assert.equal(n.failures.length,0);assert.equal(n.listingPaginationComplete,true);assert.equal(n.closingInventoryMatches,true);assert.equal(m.requests.length,16)
 assert.ok(m.requests.every(u=>!u.includes('/apply')||u.includes('https://apply.workable.com/')));assert.ok(m.requests.every(u=>!new URL(u).pathname.endsWith('/apply')&&!u.includes('/applications/')&&!u.includes('/login')))
 for(const j of jobs){assert.equal(j.source,'fortanix');assert.equal(j.company,'Fortanix');assert.equal(j.country,'India');assert.equal(j.requisitionId,null);assert.equal(j.sourceUrl,j.nativeFacts.nativeListingRecord.rawWidget.url);assert.equal(j.applyUrl,j.nativeFacts.nativeListingRecord.rawWidget.application_url);assert.equal(j.sourceDescription,['description','requirements','benefits'].map(k=>j.nativeFacts.nativeDetail[k]).filter(v=>typeof v==='string').join('\n\n'));assert.equal(j.postingDate,j.nativeFacts.nativeDetail.published);assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)}
 const remote=jobs.find(j=>j.jobId===firstID);assert.equal(remote.city,null);assert.equal(remote.location,'India');assert.equal(remote.remoteStatus,'Remote')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,19);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const a=analyzePublishableJobs(jobs,{now:new Date('2026-10-22T23:30:00Z')});assert.equal(a.eligibleJobs.length,4);assert.equal(a.filterCounts.old,6)
})
test('missing native counts, stale listing, changed corporate account and truncated widget cannot become verified zero',async()=>{
 for(const variant of ['count','stale','account','truncated','duplicate','application','HTTP']){const m=mock(r=>{
  if(variant==='count'&&r.url.endsWith('/llms.txt'))return text(r,s=>s.replace('19 current openings','unavailable'))
  if(variant==='stale'&&r.url.endsWith('/jobs.md'))return text(r,s=>s.replace('2026-10-22','2026-01-01'))
  if(variant==='account'&&r.url.includes('/_next/'))return text(r,s=>s.replaceAll('337112','999999'))
  if(r.url!==widget)return r
  if(variant==='HTTP')return{...r,status:503,body:Buffer.from('Unavailable')}
  return alter(r,p=>{if(variant==='truncated')p.jobs.pop();if(variant==='duplicate')p.jobs[1]=p.jobs[0];if(variant==='application')p.jobs[0].application_url='https://other.example.test/apply'})
 });await assert.rejects(run({transport:m.transport}),/incomplete|forbidden/i,variant)}
})
test('missing descriptions, unpublished roles, country changes and failed India details remain partial',async()=>{
 for(const variant of ['description','state','country','account','date','HTTP']){const m=mock(r=>{
  if(!r.url.endsWith('/jobs/'+firstID))return r
  if(variant==='HTTP')return{...r,status:503,body:Buffer.from('Unavailable')}
  return alter(r,p=>{if(variant==='description')p.description='';if(variant==='state')p.state='archived';if(variant==='country'){p.locations[0].country='United Kingdom';p.locations[0].countryCode='GB'}if(variant==='account')p.accountUid='different-account';if(variant==='date')p.published='2099-10-05T00:00:00.000Z'})
 });const jobs=await run({transport:m.transport});assert.equal(jobs.length,9,variant);assert.ok(!jobs.some(j=>j.jobId===firstID));assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)}
})
test('closing inventory drift preserves validated details while recording incomplete evidence',async()=>{
 const m=mock((r,requests)=>r.url===widget&&requests.filter(u=>u===widget).length===2?alter(r,p=>{p.jobs[0].title+=' changed'}):r)
 const jobs=await run({transport:m.transport});assert.equal(jobs.length,10);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('counted native zero remains a whole-employer coverage gap',async()=>{
 const m=mock(r=>{
  if(r.url.endsWith('/llms.txt'))return text(r,s=>s.replace('19 current openings','0 current openings'))
  if(r.url.endsWith('/jobs.md'))return text(r,s=>s.split(/\r?\n/).filter(l=>!l.startsWith('|')||l.startsWith('| Title |')||/^\|[-|]+\|$/.test(l)).join('\n'))
  if(r.url===widget)return alter(r,p=>{p.jobs=[]});return r
 });const jobs=await run({transport:m.transport});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})
test('script and markdown MIME types are explicit opt-ins and advertised script text is never executed',async()=>{
 const {createSourceConfig}=await import('./parser.js'),{createFirstPartyHTMLScraper}=await import('../../scraper-support/shared/firstPartyHtmlJobs.js')
 const config=createSourceConfig({now:()=>replayAt});delete config.expectedContentType;const m=mock(),blocked=await createFirstPartyHTMLScraper(config).collect({transport:m.transport});assert.equal(blocked.jobs.length,0);assert.ok(blocked.failures.some(f=>/content type/.test(f.message)))
 assert.equal(globalThis.__fortanixExecuted,undefined);const safe=mock(r=>r.url.includes('/_next/')?text(r,s=>s+';globalThis.__fortanixExecuted=true;'):r);assert.equal((await run({transport:safe.transport})).length,10);assert.equal(globalThis.__fortanixExecuted,undefined)
 for(const suffix of['/llms.txt','/_next/']){const bad=mock(r=>r.url.includes(suffix)?{...r,headers:{...r.headers,'content-type':'text/plain'}}:r);await assert.rejects(run({transport:bad.transport}),/incomplete|forbidden/i)}
})

test('historical native packets fail the live listing freshness guard after 48 hours',async()=>{
 const m=mock()
 await assert.rejects(runNative({transport:m.transport,now:()=>new Date(Date.parse(replayAt)+48*3600000).toISOString()}),/incomplete|forbidden/i)
})
