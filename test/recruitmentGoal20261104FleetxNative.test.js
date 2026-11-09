import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/fleetx/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/fleetx-native-quality.json.gz',import.meta.url))))
const home='https://www.fleetx.ai/careers',client=fixture.packets[1].requestedURL,schemas=fixture.packets[2].requestedURL
const sha=value=>createHash('sha256').update(value).digest('hex'),now=()=> '2026-11-05T10:30:00.000Z'
const replay=async(t,edit=()=>{},options={})=>{
 const calls=[],fetchImpl=async(url,init={})=>{
  const original=fixture.packets.find(q=>q.requestedURL===String(url))
  const occurrence=calls.filter(c=>c.url===String(url)).length;calls.push({url:String(url),init,occurrence})
  assert.ok(original,'Uncaptured Fleetx URL: '+url);assert.equal(sha(original.bodyText),original.bodySHA256)
  const q=structuredClone(original);edit(q,occurrence,calls)
  const response=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const {registered,...runOptions}=options
 const runner=registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='fleetx')):source
 let jobs,error;try{jobs=await runner.run({fetchImpl,minIntervalMs:0,now,...runOptions})}catch(e){error=e}
 return {jobs,error,calls}
}
test('Fleetx retains all19 original native openings including the unlabeled Data Analyst location',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.equal(jobs.length,19);assert.equal(calls.length,6)
 const j=jobs.find(j=>j.title==='Data Analyst');assert.ok(j,'The native unlabeled location must not drop its role')
 assert.equal(j.nativeSourceRecord.nativeClientRole.location,'Ahmedabad, Mumbai, Gurgaon')
 assert.equal(j.nativeSourceRecord.nativeClientRole.skills,'Key Skills: SQL, Excel, Data Analysis, Dashboards/MIS, Business Insights')
 assert.ok(j.jobDescription.includes('Ahmedabad, Mumbai, Gurgaon'));assert.equal(j.nativeRoleClosingReconciled,true)
 for(const {init}of calls){assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')}
})
test('Fleetx cannot turn native cities or a company country into public India geography',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 assert.ok(jobs.every(j=>j.country===null&&j.city===null&&j.state===null&&j.location===null&&j.sourceCountryScopeUnresolved===true))
 assert.ok(jobs[0].sourceNativeLocationEvidence.value.includes('Delhi'))
})
test('Fleetx registered metadata and India filter preserve all unknown-country partial records',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{registered:true});assert.ifError(error);assert.equal(jobs.length,19);assert.equal(calls.length,6)
 assert.ok(jobs.every(j=>j.country===null&&j.city===null&&j.location===null&&j.sourceCountryScopeUnresolved===true&&j.sourceDetailComplete===false))
 for(const job of jobs){
  assert.equal(job.applyUrl,null,'A company careers reference must not become a native application URL')
  assert.equal(job.link,null,'No native role or application link is published')
  assert.equal(job.sourceUrl,home,'The original source reference must remain inspectable')
  assert.equal(job.applicationVisited,false);assert.equal(job.activeApplyVerified,false)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Fleetx keeps undisclosed requisitions, canonical role URLs, publication, mode and apply activity unknown',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 assert.ok(jobs.every(j=>j.requisitionId===null&&j.postingDate===null&&j.closingDate===null&&j.remoteStatus===null&&j.employmentType===null
  &&j.nativeCanonicalRoleURL===null&&j.applyUrl===null&&j.applicationVisited===false&&j.firstEverPublication===null))
})
test('Fleetx retains whole native card/client records and original opening/closing bytes without certifying criteria or empty scope',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const j of jobs){
  assert.ok(typeof j.sourceRawNativeHTML==='string','Original page must be retained')
  assert.equal(j.sourceRawNativeHTML,fixture.packets[0].bodyText);assert.equal(j.sourceRawNativeHTMLSHA256,fixture.packets[0].bodySHA256)
  assert.equal(j.sourceRawNativeClient,fixture.packets[1].bodyText);assert.equal(j.sourceRawNativeClientSHA256,fixture.packets[1].bodySHA256)
  assert.equal(j.sourceClosingRawNativeHTML,j.sourceRawNativeHTML);assert.equal(j.sourceClosingRawNativeClient,j.sourceRawNativeClient)
  assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord);assert.ok(j.nativeSourceRecord.visibleCard.text.includes(j.title))
  assert.equal(j.sourceDescription,j.nativeSourceRecord.visibleCard.text);assert.equal(j.sourceDetailComplete,false)
  assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Fleetx caller zero cap and pre-abort perform no reads',async t=>{
 let result=await replay(t,()=>{},{maxJobs:0});assert.ifError(result.error);assert.equal(result.jobs.length,0);assert.equal(result.calls.length,0)
 const reason=Error('Stop Fleetx before reads');result=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(result.error,reason);assert.equal(result.calls.length,0)
})
test('Fleetx positive cap follows all opening and closing observations',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,6)
 assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRecords,19)
})
for(const status of [202,401,403,429,451])test('Fleetx stops at opening HTTP '+status+' without timeout fallback probes',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===home)q.status=status})
 assert.ok(!jobs,'A denied run must not become an empty success');assert.equal(error?.status,status);assert.equal(calls.length,1)
})
test('Fleetx stops after a declared client denial without emitting listing-only records',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===client)q.status=403})
 assert.ok(!jobs);assert.equal(error?.status,403);assert.equal(calls.length,2)
})
test('Fleetx retains earlier partial native facts after a closing denial',async t=>{
 const {jobs,error,calls}=await replay(t,(q,occurrence)=>{if(occurrence&&q.requestedURL===client)q.status=403})
 assert.ifError(error);assert.equal(jobs.length,19);assert.equal(calls.length,4)
 assert.ok(jobs.every(j=>j.nativeRoleClosingReconciled===false&&j.sourceDetailComplete===false))
})
test('Fleetx excludes a known changed closing role before a later denied read',async t=>{
 const {jobs,error,calls}=await replay(t,(q,occurrence)=>{
  if(occurrence&&q.requestedURL===client)q.bodyText=q.bodyText.replace('Key Skills: B2B Sales, New Customer Acquisition','Key Skills: Changed B2B Sales, New Customer Acquisition')
  if(occurrence&&q.requestedURL===schemas)q.status=403
 })
 assert.ifError(error);assert.equal(jobs.length,18);assert.ok(!jobs.some(j=>j.title==='Area Sales Manager'))
 assert.equal(calls.length,5);assert.equal(jobs[0].sourceNativeCollectionAudit.heldNativeRows[0].phase,'closing-client')
})
test('Fleetx inactive opening cards cannot become native roles',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===home)q.bodyText=q.bodyText.replace('</body>','<section hidden><div class="flex flex-col items-start text-left rounded bg-white p-6 shadow"><h3>Injected Role</h3><p>Minimum Exp.: 1 yr</p><p>Key Skills: X</p><p>Location: India</p></div></section></body>')})
 assert.ifError(error);assert.equal(jobs.length,19);assert.ok(!jobs.some(j=>j.title==='Injected Role'))
})
test('Fleetx conflicting duplicate active cards hold the whole affected opening',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===home){
  assert.ok(q.bodyText.includes('Current Openings</div>'))
  q.bodyText=q.bodyText.replace('Current Openings</div>','Current Openings</div><div class="flex flex-col items-start text-left rounded bg-white p-6 shadow"><h3>Area Sales Manager</h3><p>Minimum Exp.: 99 yrs</p><p>Key Skills: Changed criteria</p><p>Location: Unknown</p></div>')
 }})
 assert.ifError(error);assert.equal(jobs.length,18);assert.ok(!jobs.some(j=>j.title==='Area Sales Manager'))
})
for(const type of ['text/plain','application/json'])test('Fleetx non-executable '+type+' script tags cannot authorize page assets',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===home)for(const packet of fixture.packets.slice(1)){
  const path=new URL(packet.requestedURL).pathname;q.bodyText=q.bodyText.replaceAll('src="'+path+'"','type="'+type+'" src="'+path+'"')
 }})
 assert.ok(!jobs);assert.match(error?.message||'',/native page asset/);assert.equal(calls.length,1)
})
test('Fleetx new conflicting closing module ownership cannot resurrect contradicted facts',async t=>{
 const {jobs,error,calls}=await replay(t,(q,occurrence)=>{if(occurrence&&q.requestedURL===schemas)
  q.bodyText=fixture.packets[1].bodyText.replace('Key Skills: B2B Sales, New Customer Acquisition','Key Skills: Contradictory B2B Sales, New Customer Acquisition')
 })
 assert.ifError(error);assert.equal(jobs.length,18);assert.ok(!jobs.some(j=>j.title==='Area Sales Manager'))
 assert.equal(calls.length,5);assert.ok(jobs.every(j=>j.nativeRoleClosingReconciled===false))
 const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows.find(r=>r.title==='Area Sales Manager')
 assert.equal(held.phase,'closing-client');assert.equal(held.closing.clientURL,schemas)
 assert.match(held.closing.rawBody,/Contradictory B2B Sales/)
})
test('Fleetx a timeout is unresolved and stops instead of proving an empty inventory',async()=>{
 let calls=0;const reason=Error('Fleetx timeout')
 await assert.rejects(source.run({fetchPage:async()=>{calls++;return {ok:false,errorName:'TimeoutError',errorMessage:reason.message}},minIntervalMs:0}),/timeout/i)
 assert.equal(calls,1)
})
test('Fleetx cancels a noncooperative transport without awaiting it',async t=>{
 const controller=new AbortController(),reason=Error('Cancel Fleetx transport');let release
 const fetchImpl=()=>new Promise(resolve=>{release=resolve});t.mock.method(globalThis,'fetch',fetchImpl)
 const pending=source.run({fetchImpl,minIntervalMs:0,signal:controller.signal});await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const settled=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),150))])
 const response=new Response(fixture.packets[0].bodyText,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:home});release?.(response)
 if(settled.timeout)t.mock.method(globalThis,'fetch',async()=>{throw reason})
 await pending.catch(()=>{});assert.equal(settled.error,reason)
})
