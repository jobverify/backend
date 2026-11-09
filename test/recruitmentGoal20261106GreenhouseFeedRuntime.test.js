import assert from 'node:assert/strict'
import test from 'node:test'
import {setTimeout as delay} from 'node:timers/promises'
import {createDeclaredJobFeedScraper,DECLARED_JOB_FEED_PROFILES} from '../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import {fixture,replay} from '../scraper-support/native-sources/declaredJobFeeds/fixtureReplay.js'
const profile=DECLARED_JOB_FEED_PROFILES.cymulate
const deferred=()=>{let resolve;return{promise:new Promise(r=>{resolve=r}),resolve:()=>resolve()}}
const observe=p=>Promise.race([p,delay(150).then(()=>{throw Error('test observer expired before cancellation settled')})])

test('the delegated feed records hook cannot start after caller cancellation of the earlier audit hook',async()=>{
 const r=replay(),started=deferred(),finish=deferred(),controller=new AbortController(),reason={cancel:'feed-audit'};let records=0,caught
 const pending=createDeclaredJobFeedScraper(profile).run({...r.options,signal:controller.signal,onAudit:async()=>{started.resolve();return finish.promise},onRecords:()=>{records++}})
 await started.promise;controller.abort(reason)
 try{await observe(pending)}catch(error){caught=error}finally{finish.resolve()}
 await delay(0);assert.equal(caught,reason);assert.equal(records,0)
})
test('the delegated feed records hook cannot start after the audit deadline has rejected the run',async t=>{
 const r=replay(),started=deferred(),finish=deferred();let records=0
 t.mock.timers.enable({apis:['setTimeout']})
 const pending=createDeclaredJobFeedScraper(profile).run({...r.options,onAudit:async()=>{started.resolve();return finish.promise},onRecords:()=>{records++}})
 await started.promise;t.mock.timers.tick(15001)
 try{await assert.rejects(observe(pending),/audit.*deadline/i)}finally{finish.resolve()}
 await delay(0);assert.equal(records,0)
})
test('the delegated feed retains a factory zero with an explicitly undefined runtime limit and full audit',async()=>{
 const r=replay(),jobs=await createDeclaredJobFeedScraper(profile,{...r.options,maxJobs:0}).run({maxJobs:undefined})
 assert.equal(jobs.length,0);assert.equal(r.audits.length,1);assert.equal(r.records.length,1);assert.equal(r.audits[0].observations.length,fixture.oracle.cymulate.records.length)
})
test('the delegated feed retains a positive factory limit with an explicitly undefined runtime limit',async()=>{
 const r=replay(),jobs=await createDeclaredJobFeedScraper(profile,{...r.options,maxJobs:1}).run({maxJobs:undefined})
 assert.equal(jobs.length,1);assert.equal(r.audits[0].observations.length,fixture.oracle.cymulate.records.length)
})
test('the delegated feed rejects a finite page limit before invoking a failing observation clock',async()=>{
 let clocks=0,reads=0
 await assert.rejects(createDeclaredJobFeedScraper(profile).run({maxPages:1,now:()=>{clocks++;throw Error('secondary feed clock error')},fetchPage:async()=>{reads++;throw Error('page validation must precede reads')}}),/page|inventory.*truncation/i)
 assert.equal(clocks,0);assert.equal(reads,0)
})
test('the delegated feed preserves the exact caller reason when its clock aborts and throws',async()=>{
 const controller=new AbortController(),reason=Symbol('feed-clock');let caught,reads=0
 try{await createDeclaredJobFeedScraper(profile).run({signal:controller.signal,now:()=>{controller.abort(reason);throw Error('secondary feed clock error')},fetchPage:async()=>{reads++;throw Error('clock must precede reads')}})}catch(error){caught=error}
 assert.equal(caught,reason);assert.equal(reads,0)
})
