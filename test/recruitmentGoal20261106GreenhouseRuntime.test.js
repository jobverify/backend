import assert from 'node:assert/strict'
import test from 'node:test'
import {setTimeout as delay} from 'node:timers/promises'
import {createNativeGreenhouseScraper,NATIVE_GREENHOUSE_PROFILES} from '../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
import {createNativeRouteScraper,NATIVE_ROUTE_PROFILES} from '../scraper-support/native-sources/declaredGreenhouseRoutes/nativeCareers.js'
import {fixture as routeFixture,replay as routeReplay} from '../scraper-support/native-sources/declaredGreenhouseRoutes/fixtureReplay.js'
import {fixture,replay} from '../scraper-support/native-sources/declaredGreenhouse/fixtureReplay.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
const profile=fixture.profiles.eqtcorporation,source=profile.source,oracle=fixture.oracle[source]
const deferred=()=>{let resolve;return{promise:new Promise(r=>{resolve=r}),resolve:value=>resolve(value)}}
const observe=p=>Promise.race([p,delay(150).then(()=>{throw Error('test observer expired before cancellation settled')})])
const sameRejection=async(p,reason)=>{let caught;try{await observe(p)}catch(error){caught=error}assert.equal(caught,reason)}

for(const p of [...Object.values(NATIVE_GREENHOUSE_PROFILES),...Object.values(NATIVE_ROUTE_PROFILES)])test(p.source+': zero output cap preserves the complete native audit without certifying an empty source',async()=>{
 const ownRoute=Object.hasOwn(NATIVE_ROUTE_PROFILES,p.source),r=ownRoute?routeReplay():replay(),originals=(ownRoute?routeFixture:fixture).oracle[p.source].records
 const jobs=await createNativeGreenhouseScraper(p).run({...r.options,maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(r.audits.length,1);assert.equal(r.audits[0].observations.length,originals.length)
 for(const row of originals){const id=String(row.postId??row.id),job=r.audits[0].observations.find(j=>j.jobId===id);assert.deepEqual(job.sourceNativeRecord,row.nativeOwnPostRecord??row.originalNative)}
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.ok(evidence.pagesFetched>0)
 assert.equal(readSourceObservationEvidence(jobs,p.source).observedRecordCount,originals.length)
})

test('factory zero survives an explicitly undefined runtime job limit while retaining the native audit',async()=>{
 const r=replay(),jobs=await createNativeGreenhouseScraper(profile,{...r.options,maxJobs:0}).run({maxJobs:undefined})
 assert.equal(jobs.length,0);assert.equal(r.audits[0].observations.length,65)
})
test('finite page caps reject before any source read even with a zero result cap',async()=>{
 for(const maxPages of [0,1,-1,NaN,'1',false]){
  let reads=0;await assert.rejects(createNativeGreenhouseScraper(profile).run({maxPages,maxJobs:0,fetchPage:async()=>{reads++;throw Error('unsupported page cap read')}}),/page|inventory.*truncation/i);assert.equal(reads,0)
 }
})
test('undefined page cap retains an unsupported factory cap and rejects before I/O',async()=>{
 let reads=0;await assert.rejects(createNativeGreenhouseScraper(profile,{maxPages:1,fetchPage:async()=>{reads++;throw Error('factory page cap ignored')}}).run({maxPages:undefined,maxJobs:0}),/page|inventory.*truncation/i);assert.equal(reads,0)
})
test('invalid result caps reject before I/O',async()=>{
 for(const maxJobs of [-1,1.5,NaN,Infinity,'1',false,Number.MAX_SAFE_INTEGER+1]){
  let reads=0;await assert.rejects(createNativeGreenhouseScraper(profile).run({maxJobs,fetchPage:async()=>{reads++;throw Error('invalid cap read')}}),/maxJobs|result cap/i);assert.equal(reads,0)
 }
})
test('null and infinite page limits preserve zero output and complete diagnostic audit without inventing coverage',async()=>{
 for(const maxPages of [null,Infinity]){
  const r=replay(),jobs=await createNativeGreenhouseScraper(profile).run({...r.options,maxPages,maxJobs:0})
  assert.equal(jobs.length,0);assert.equal(r.audits[0].observations.length,65);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})
test('positive factory limit survives undefined runtime input while preserving all 65 original role models',async()=>{
 const r=replay(),jobs=await createNativeGreenhouseScraper(profile,{...r.options,maxJobs:1}).run({maxJobs:undefined}),audit=r.audits[0]
 assert.equal(jobs.length,1);assert.equal(audit.observations.length,65);assert.equal(audit.observationHistory.length,65)
 for(const row of oracle.records){const job=audit.observations.find(j=>j.jobId===String(row.postId));assert.deepEqual(job.sourceNativeRecord,row.nativeOwnPostRecord);assert.equal(job.jobDescription,row.fullCriteriaText)}
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('explicit null runtime limit removes a factory limit without truncating native audit',async()=>{
 const r=replay(),jobs=await createNativeGreenhouseScraper(profile,{...r.options,maxJobs:1}).run({maxJobs:null})
 assert.ok(jobs.length>1);assert.equal(r.audits[0].observations.length,65);assert.equal(r.audits[0].observationHistory.length,65)
 for(const job of jobs){assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)}
})
test('cancellation before scheduled source work prevents the first fetch callback',async()=>{
 const controller=new AbortController(),reason={cancel:'before-first-callback'};let reads=0
 const pending=createNativeGreenhouseScraper(profile).run({signal:controller.signal,fetchPage:async()=>{reads++;throw Error('scheduled work escaped cancellation')}})
 controller.abort(reason);await sameRejection(pending,reason);assert.equal(reads,0)
})
test('stalled page callback settles promptly with the exact arbitrary caller reason',async()=>{
 const started=deferred(),controller=new AbortController(),reason=Symbol('caller-stalled-page');let reads=0,audits=0
 const pending=createNativeGreenhouseScraper(profile).run({signal:controller.signal,fetchPage:async()=>{reads++;started.resolve();return new Promise(()=>{})},onAudit:()=>{audits++}})
 await started.promise;controller.abort(reason);await sameRejection(pending,reason);assert.equal(reads,1);assert.equal(audits,0)
})
test('a late page completion after cancellation cannot start another read or audit',async()=>{
 const started=deferred(),completion=deferred(),controller=new AbortController(),reason=Error('late-page-cancel');let reads=0,audits=0
 const pending=createNativeGreenhouseScraper(profile).run({signal:controller.signal,fetchPage:async()=>{reads++;started.resolve();return completion.promise},onAudit:()=>{audits++}})
 await started.promise;controller.abort(reason)
 try{await sameRejection(pending,reason)}finally{completion.resolve({url:profile.primaryURL,status:200,headers:{'content-type':'text/html'},bodyBase64:Buffer.from('<title>late data</title>').toString('base64')})}
 await delay(0);assert.equal(reads,1);assert.equal(audits,0)
})
test('stalled audit callback cannot hold caller cancellation after complete original collection',async()=>{
 const r=replay(),started=deferred(),controller=new AbortController(),reason={cancel:'stalled-audit'}
 const pending=createNativeGreenhouseScraper(profile).run({...r.options,signal:controller.signal,onAudit:async audit=>{assert.equal(audit.observations.length,65);started.resolve();return new Promise(()=>{})}})
 await started.promise;controller.abort(reason);await sameRejection(pending,reason)
})
test('own-route records callback cannot start after its earlier audit callback is cancelled',async()=>{
 const r=replay(),started=deferred(),completion=deferred(),controller=new AbortController(),reason=Error('route-audit-cancel');let recordCallbacks=0
 const pending=createNativeRouteScraper(profile).run({...r.options,signal:controller.signal,onAudit:async()=>{started.resolve();return completion.promise},onRecords:()=>{recordCallbacks++}})
 await started.promise;controller.abort(reason)
 try{await sameRejection(pending,reason)}finally{completion.resolve()}
 await delay(0);assert.equal(recordCallbacks,0)
})
test('a cancelling observation clock cannot replace the exact caller reason with its thrown error',async()=>{
 const controller=new AbortController(),reason={cancel:'output-clock'};let reads=0
 const pending=createNativeGreenhouseScraper(profile).run({signal:controller.signal,now:()=>{controller.abort(reason);throw Error('secondary clock error')},fetchPage:async()=>{reads++;throw Error('clock must precede I/O')}})
 await sameRejection(pending,reason);assert.equal(reads,0)
})
test('the complete injected page callback has a deadline even when it ignores its abort signal',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const started=deferred();let reads=0
 const pending=createNativeGreenhouseScraper(profile).run({fetchPage:async()=>{reads++;started.resolve();return new Promise(()=>{})}})
 await started.promise;t.mock.timers.tick(15001)
 await assert.rejects(observe(pending),/native.*deadline|request.*deadline/i);assert.equal(reads,1)
})
test('the complete audit callback has its own deadline',async t=>{
 const r=replay(),started=deferred();t.mock.timers.enable({apis:['setTimeout']})
 const pending=createNativeGreenhouseScraper(profile).run({...r.options,onAudit:async()=>{started.resolve();return new Promise(()=>{})}})
 await started.promise;t.mock.timers.tick(15001);await assert.rejects(observe(pending),/audit.*deadline/i)
})
test('the source budget applies before scheduled collection starts',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let reads=0
 const pending=createNativeGreenhouseScraper(profile).run({fetchPage:async()=>{reads++;return new Promise(()=>{})}})
 t.mock.timers.tick(900001)
 await assert.rejects(observe(pending),/source.*deadline/i);assert.equal(reads,0)
})
