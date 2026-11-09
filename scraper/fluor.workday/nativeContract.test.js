import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {classifyProviderImplementation} from '../../scripts/reportScriptCatalogTopology.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261022.json.gz',import.meta.url))))
const firstID='1099556664568'
function mock(mutate=r=>r){
 const requests=[],index=new Map(),calls=new Map()
 for(const p of fixture.packets)index.set(p.url,[...(index.get(p.url)||[]),p])
 return{requests,transport:async url=>{
  requests.push(url);const entries=index.get(url);assert.ok(entries,'Unexpected fixture endpoint: '+url)
  const call=calls.get(url)||0;calls.set(url,call+1);const p=entries[Math.min(call,entries.length-1)]
  return mutate({url,status:p.status,headers:p.headers,body:Buffer.from(p.rawBodyBase64,'base64'),bodyComplete:p.bodyComplete,requestedAt:p.requestedAt,completedAt:p.completedAt},requests)
 }}
}
const alter=(r,fn)=>{const p=JSON.parse(r.body.toString('utf8'));fn(p);return{...r,body:Buffer.from(JSON.stringify(p))}}
test('Fluor selected executable replaces empty sentinel with complete global paging and native India role details',async()=>{
 const m=mock(),jobs=await run({transport:m.transport});assert.equal(jobs.length,31)
 assert.equal(classifyProviderImplementation(getScraperCatalog().find(p=>p.source==='fluor')).type,'script')
 const native=jobs[0].nativeCollectionEvidence
 assert.equal(native.observedListingCount,639);assert.equal(native.pagesFetched,64);assert.equal(native.candidateDetails,31)
 assert.equal(native.failures.length,0);assert.equal(native.listingPaginationComplete,true);assert.equal(native.closingInventoryMatches,true)
 assert.equal(m.requests.length,98);assert.ok(m.requests.every(u=>!u.includes('/applications')&&!u.includes('/apply?')&&!u.includes('/login')))
 assert.equal(m.requests.filter(u=>new URL(u).pathname==='/api/apply/v2/jobs').length,65)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,639);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 for(const j of jobs){assert.equal(j.company,'Fluor');assert.equal(j.country,'India');assert.equal(j.source,'fluor');assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.applyUrl,j.nativeFacts.nativeDetail.publicUrl);assert.equal(j.sourceUrl,j.applyUrl);assert.equal(j.sourceDescription,j.nativeFacts.nativeDetail.jobDescription);assert.equal(j.postingDate,new Date(j.nativePostedTs*1000).toISOString())}
 assert.notEqual(jobs[0].nativeFacts.nativeListingRecord.rawNative.t_update,jobs[0].nativePostedTs)
})
test('partial pagination preserves observed India subset and forbids cleanup',async()=>{
 const m=mock(r=>new URL(r.url).searchParams.get('start')==='10'?{...r,status:503,body:Buffer.from('unavailable')}:r)
 const jobs=await run({transport:m.transport});assert.ok(jobs.length>0&&jobs.length<31)
 assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('failed, filtered, private and truncated first pages cannot establish verified empty inventory',async()=>{
 for(const variant of ['HTTP','error','filtered','private','truncated','foreign','duplicate']){
  const m=mock(r=>{if(new URL(r.url).pathname!=='/api/apply/v2/jobs')return r
   if(variant==='HTTP')return{...r,status:503,body:Buffer.from('unavailable')}
   return alter(r,p=>{if(variant==='error')p.error={message:'Unavailable',body:''};if(variant==='filtered')p.query.location='India';if(variant==='private')p.positions[0].isPrivate=true;if(variant==='truncated')p.positions.pop();if(variant==='foreign')p.domain='other.example';if(variant==='duplicate')p.positions[1]=p.positions[0]})})
  await assert.rejects(run({transport:m.transport}),/incomplete|forbidden/i,variant)
 }
})
test('missing descriptions, conflicting countries, role errors and disabled applications remain explicit partial failures',async()=>{
 for(const variant of ['description','country','HTTP','application','date','identity']){
  const m=mock(r=>{if(!r.url.includes('position_id='+firstID+'&'))return r
   if(variant==='HTTP')return{...r,status:503,body:Buffer.from('unavailable')}
   return alter(r,p=>{if(variant==='description')p.data.jobDescription='';if(variant==='country')p.data.standardizedLocations=['London, ENG, GB'];if(variant==='application')p.data.positionUserActions.applyAction={status:'closed'};if(variant==='date')p.data.postedTs=9999999999;if(variant==='identity')p.data.atsJobId='other'})})
  const jobs=await run({transport:m.transport});assert.equal(jobs.length,30,variant);assert.ok(!jobs.some(j=>j.jobId===firstID));assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})
test('changed closing inventory and missing corporate binding retain failure evidence',async()=>{
 const m=mock((r,requests)=>new URL(r.url).searchParams.get('start')==='0'&&requests.filter(u=>u===r.url).length===2?alter(r,p=>{p.count++}):r)
 const jobs=await run({transport:m.transport});assert.equal(jobs.length,31);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)
 const bad=mock(r=>r.url.includes('www.fluor.com')?{...r,body:Buffer.from('<html>Unavailable</html>')}:r)
 await assert.rejects(run({transport:bad.transport}),/incomplete|forbidden/i)
})
test('an observed native listing without India locations is unknown coverage, never verified zero',async()=>{
 const {decode}=await import('../../scraper-support/shared/rmkNativePairHtml.js')
 const change=p=>{for(const row of p.positions)row.locations=['London, United Kingdom'];return p}
 const m=mock(r=>{
  if(new URL(r.url).pathname==='/api/apply/v2/jobs')return alter(r,change)
  if(r.url==='https://careers.fluor.com/careers')return{...r,body:Buffer.from(r.body.toString('utf8').replace(/(<code\b[^>]*id=["']smartApplyData["'][^>]*>)([\s\S]*?)(<\/code>)/i,(_,open,raw,close)=>open+JSON.stringify(change(JSON.parse(decode(raw)))).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&#34;')+close))}
  return r
 })
 const jobs=await run({transport:m.transport});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,639);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(m.requests.filter(u=>u.includes('position_details')).length,0)
})
