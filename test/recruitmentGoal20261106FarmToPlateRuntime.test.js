import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createFarmToPlateScraper,run,HOMEPAGE_URL} from '../scraper/farmtoplate/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/farmtoplate-runtime-originals.json.gz',import.meta.url))))
const now=()=> '2026-11-04T17:55:44.259Z',packets=new Map(fixture.packets.map(p=>[p.requestedURL,p]))
const transport=()=>{const calls=[];return{calls,fetchPage:async url=>{calls.push(url);const p=packets.get(url);assert.ok(p,'Undeclared test request: '+url);return{status:p.status,url:p.finalURL,html:p.bodyText}}}}
const noReads=async()=>assert.fail('Limit must be handled before any source read')
const settled=async pending=>{let timer;try{return await Promise.race([pending.then(value=>({kind:'fulfilled',value}),reason=>({kind:'rejected',reason})),new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'pending'}),200)})])}finally{clearTimeout(timer)}}

test('all six intact historical originals retain their original digests',()=>{
 assert.equal(fixture.diagnosticOnly,true);assert.equal(fixture.sourceQualification,false);assert.equal(packets.size,6)
 for(const p of packets.values()){assert.equal(Buffer.byteLength(p.bodyText),p.bodyBytes);assert.equal(createHash('sha256').update(p.bodyText).digest('hex'),p.bodySHA256)}
})
test('uncapped historical replay preserves every original role object and unresolved country/identity fields',async()=>{
 const t=transport(),jobs=await run({...t,now})
 assert.deepEqual(jobs,fixture.originalUncappedJobs);assert.equal(t.calls.length,6)
 assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,1);assert.ok(jobs.every(j=>j.country===null&&j.location===null))
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.listingComplete,false);assert.equal(inventory.pagesFetched,6);assert.equal(inventory.reportedTotal,null);assert.match(inventory.reason,/closing-not-read/)
})
test('runtime zero limit performs no reads and cannot claim verified emptiness',async()=>{
 const jobs=await run({maxJobs:0,fetchPage:noReads});assert.deepEqual(jobs,[])
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.pagesFetched,0);assert.equal(evidence.firstParty,false);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.notEqual(evidence.status,'verified-empty')
})
test('factory zero limit and undefined runtime override perform no reads',async()=>{
 const jobs=await createFarmToPlateScraper({maxJobs:0}).run({maxJobs:undefined,fetchPage:noReads});assert.deepEqual(jobs,[])
})
test('runtime positive limit stops before unselected details but preserves discovered observation count',async()=>{
 const t=transport(),jobs=await run({...t,now,maxJobs:1});assert.deepEqual(jobs,fixture.originalUncappedJobs.slice(0,1))
 assert.deepEqual(t.calls,[...packets.keys()].slice(0,4));assert.equal(readInventoryEvidence(jobs).pagesFetched,4)
 const evidence=readSourceObservationEvidence(jobs,'farmtoplate');assert.equal(evidence.observedRecordCount,3);assert.equal(evidence.observedVacancyCount,3);assert.equal(evidence.sourceScopeComplete,false)
})
test('factory positive limit survives an undefined runtime override',async()=>{
 const t=transport(),jobs=await createFarmToPlateScraper({maxJobs:1}).run({...t,now,maxJobs:undefined});assert.deepEqual(jobs,fixture.originalUncappedJobs.slice(0,1));assert.equal(t.calls.length,4)
})
test('explicit null runtime cap removes a factory limit and Infinity page cap is accepted',async()=>{
 const t=transport(),jobs=await createFarmToPlateScraper({maxJobs:1}).run({...t,now,maxJobs:null,maxPages:Infinity});assert.deepEqual(jobs,fixture.originalUncappedJobs);assert.equal(t.calls.length,6)
})
test('a larger result cap retains all historical observations',async()=>{
 const t=transport(),jobs=await run({...t,now,maxJobs:99});assert.deepEqual(jobs,fixture.originalUncappedJobs);assert.equal(t.calls.length,6)
})
for(const cap of [-1,1.5,NaN,-Infinity,'1',true,{},1n,Symbol('cap'),Number.MAX_SAFE_INTEGER+1]){
 test('invalid result cap rejects before reads: '+String(cap),async()=>{await assert.rejects(run({maxJobs:cap,fetchPage:noReads}),RangeError)})
}
for(const cap of [-1,0,1,NaN,'1']){
 test('unsupported finite or invalid page cap rejects before reads: '+String(cap),async()=>{await assert.rejects(run({maxPages:cap,fetchPage:noReads}),RangeError)})
}
test('invalid factory cap rejects before reads',async()=>{await assert.rejects(createFarmToPlateScraper({maxJobs:-1}).run({fetchPage:noReads}),RangeError)})
test('already-aborted caller keeps exact reason before zero-limit handling',async()=>{
 const controller=new AbortController(),reason=new Error('caller stopped before run');controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,maxJobs:0,fetchPage:noReads}),error=>error===reason)
})
test('caller cancellation before scheduled fetch prevents the callback from running',async()=>{
 const controller=new AbortController(),reason=new Error('cancel before callback');let calls=0
 const pending=run({signal:controller.signal,fetchPage:async()=>{calls++;return{status:500,html:''}}});controller.abort(reason)
 await assert.rejects(pending,error=>error===reason);assert.equal(calls,0)
})
test('a callback that ignores cancellation cannot keep the reader pending',async()=>{
 const controller=new AbortController(),reason={code:'caller-cancelled'},calls=[]
 const pending=run({signal:controller.signal,fetchPage:(url,{signal})=>{calls.push(url);assert.ok(signal instanceof AbortSignal);controller.abort(reason);return new Promise(()=>{})}})
 const result=await settled(pending);assert.equal(result.kind,'rejected');assert.equal(result.reason,reason);assert.deepEqual(calls,[HOMEPAGE_URL])
})
test('asynchronous cancellation of a stalled callback settles with the same reason',async()=>{
 const controller=new AbortController(),reason=new Error('cancel stalled response');let forwarded,calls=0
 const pending=run({signal:controller.signal,fetchPage:(_url,{signal})=>{calls++;forwarded=signal;setImmediate(()=>controller.abort(reason));return new Promise(()=>{})}})
 const result=await settled(pending);assert.equal(result.kind,'rejected');assert.equal(result.reason,reason);assert.equal(calls,1);assert.equal(forwarded.aborted,true)
})
test('late callback rejection after cancellation is consumed',async()=>{
 const controller=new AbortController(),reason=new Error('early cancellation');let rejectLate
 const pending=run({signal:controller.signal,fetchPage:()=>new Promise((_resolve,reject)=>{rejectLate=reject;setImmediate(()=>controller.abort(reason))})})
 const result=await settled(pending);assert.equal(result.kind,'rejected');assert.equal(result.reason,reason)
 rejectLate(new Error('late callback rejection'));await new Promise(resolve=>setImmediate(resolve))
})
test('synchronous callback errors retain their identity and stop further reads',async()=>{
 const reason=new Error('callback failed');let calls=0
 await assert.rejects(run({fetchPage:()=>{calls++;throw reason}}),error=>error===reason);assert.equal(calls,1)
})
test('an access denial stops after the first page without fallback',async()=>{
 const calls=[];await assert.rejects(run({fetchPage:async url=>{calls.push(url);return{status:403,html:''}}}),/official homepage/);assert.deepEqual(calls,[HOMEPAGE_URL])
})
test('a caller without a signal still receives a per-request deadline signal',async()=>{
 const reason=new Error('deadline signal observed');await assert.rejects(run({fetchPage:(_url,{signal})=>{assert.ok(signal instanceof AbortSignal);assert.equal(signal.aborted,false);throw reason}}),error=>error===reason)
})
test('the registered catalog route preserves zero-I/O and incomplete evidence',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='farmtoplate');assert.ok(provider);assert.equal(provider.adapter,'script')
 const jobs=await createCatalogScraper(provider).run({maxJobs:0,fetchPage:noReads});assert.deepEqual(jobs,[])
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.pagesFetched,0);assert.equal(evidence.firstParty,false);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
})
for(const clockKind of ['runtime','factory'])test('review regression: a throwing '+clockKind+' clock preserves the exact caller cancellation reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({code:'cancelled-from-'+clockKind+'-clock'}),clockError=new Error('distinct clock error'),t=transport()
 const clock=()=>{controller.abort(reason);throw clockError},scraper=createFarmToPlateScraper(clockKind==='factory'?{now:clock}:{})
 await assert.rejects(scraper.run({...t,signal:controller.signal,maxJobs:1,...(clockKind==='runtime'?{now:clock}:{})}),error=>error===reason)
 assert.deepEqual(t.calls,[...packets.keys()].slice(0,3))
})
