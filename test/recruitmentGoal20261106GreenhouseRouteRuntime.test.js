import assert from 'node:assert/strict'
import test from 'node:test'
import {createNativeRouteScraper,NATIVE_ROUTE_PROFILES} from '../scraper-support/native-sources/declaredGreenhouseRoutes/nativeCareers.js'
import {fixture,replay} from '../scraper-support/native-sources/declaredGreenhouseRoutes/fixtureReplay.js'
for(const profile of Object.values(NATIVE_ROUTE_PROFILES))test(profile.source+': the own-route zero output retains both detached native observers',async()=>{
 const r=replay();let clocks=0
 const jobs=await createNativeRouteScraper(profile).run({...r.options,maxJobs:0,now:()=>{clocks++;return'2026-11-06T00:00:00Z'}})
 assert.equal(jobs.length,0);assert.equal(clocks,1);assert.equal(r.audits.length,1);assert.equal(r.records.length,1);assert.equal(r.audits[0].observations.length,fixture.oracle[profile.source].records.length)
})
test('the own-route wrapper preserves a factory zero when runtime maxJobs is undefined',async()=>{
 const r=replay(),jobs=await createNativeRouteScraper(NATIVE_ROUTE_PROFILES.pathai,{...r.options,maxJobs:0}).run({maxJobs:undefined})
 assert.equal(jobs.length,0);assert.equal(r.audits[0].observations.length,10);assert.equal(r.records.length,1)
})
test('the own-route wrapper preserves a positive factory limit and the complete original PathAI audit',async()=>{
 const r=replay(),jobs=await createNativeRouteScraper(NATIVE_ROUTE_PROFILES.pathai,{...r.options,maxJobs:1}).run({maxJobs:undefined})
 assert.equal(jobs.length,1);assert.equal(r.audits[0].observations.length,10)
 for(const original of fixture.oracle.pathai.records)assert.deepEqual(r.audits[0].observations.find(j=>j.jobId===original.id).sourceNativeRecord,original.originalNative)
})
test('the own-route wrapper preserves an undefined factory page limit before calling the clock',async()=>{
 let reads=0,clocks=0
 await assert.rejects(createNativeRouteScraper(NATIVE_ROUTE_PROFILES.pathai,{maxPages:1,now:()=>{clocks++;return'2026-11-06T00:00:00Z'},fetchPage:async()=>{reads++;throw Error('lost page cap')}}).run({maxPages:undefined,maxJobs:0}),/page|inventory.*truncation/i)
 assert.equal(reads,0);assert.equal(clocks,0)
})
test('a cancelling own-route observation clock preserves the caller reason',async()=>{
 const controller=new AbortController(),reason={cancel:'route-clock'};let reads=0,caught
 try{await createNativeRouteScraper(NATIVE_ROUTE_PROFILES.pathai).run({signal:controller.signal,now:()=>{controller.abort(reason);throw Error('secondary route clock error')},fetchPage:async()=>{reads++;throw Error('clock must precede reads')}})}catch(error){caught=error}
 assert.equal(caught,reason);assert.equal(reads,0)
})
