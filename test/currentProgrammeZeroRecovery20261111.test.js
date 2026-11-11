import test from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {runWithCurrentProgrammeZero} from '../scraper-support/utils/currentProgrammeZeroRecovery.js'
import {attachInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

// Boundary doubles exercise only bridge coordination. They make no transport,
// native-parser, currentness or source-recovery claim.
const observed=value=>{
  const jobs=[]
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'bridge-control',nativePayload:{criteria:value},
    sourceScopeComplete:false,companyGlobalScopeQualified:false,requests:6},configurable:true})
  return attachInventoryEvidence(jobs,{status:'complete-inventory',surface:'https://example.test/jobs',
    firstParty:true,listingComplete:true,lifecycleCleanupAllowed:false,pagesFetched:6,reportedTotal:1,
    indiaFacetCount:0,verifiedAt:new Date().toISOString(),reason:'Component boundary double, not source evidence'})
}
const configuration=(runProgramme)=>({source:'bridge-control',runPrimary:async()=>observed('original'),runProgramme})

test('an observer never sees qualified source-zero before earlier native criteria reconcile',async()=>{
  const observedAudits=[]
  await assert.rejects(runWithCurrentProgrammeZero({onAudit:a=>observedAudits.push(a)},configuration(async options=>{
    const jobs=observed('changed')
    if(options.onAudit)await options.onAudit(structuredClone(jobs.nativeCollectionEvidence))
    return jobs
  })),e=>e.softFailure===true&&e.failureKind==='coverage_gap')
  assert.equal(observedAudits.length,0)
})

test('a successful observer receives reconciled bridge evidence without being able to rewrite retained criteria',async()=>{
  let seen
  const jobs=await runWithCurrentProgrammeZero({onAudit:a=>{seen=structuredClone(a);a.nativePayload.criteria='observer mutation'}},configuration(async options=>{
    const result=observed('original')
    if(options.onAudit)await options.onAudit(structuredClone(result.nativeCollectionEvidence))
    return result
  }))
  assert.equal(seen.priorNativePayloadReconciled,true)
  assert.equal(seen.priorNativeObservation.nativePayload.criteria,'original')
  assert.equal(jobs.nativeCollectionEvidence.nativePayload.criteria,'original')
})

test('the shared source deadline cancels primary acquisition before the native closing transaction starts',async()=>{
  let startedNative=false
  await assert.rejects(runWithCurrentProgrammeZero({sourceTimeoutMs:10},{source:'bridge-control',runPrimary:async options=>{
    await delay(100,undefined,{signal:options.signal});return observed('original')
  },runProgramme:async()=>{startedNative=true;return observed('original')}}),e=>e.name==='AbortError'||e.name==='TimeoutError')
  assert.equal(startedNative,false)
})

test('an uncooperative audit observer cannot outlive the shared source deadline',async()=>{
  let entered=false
  const operation=runWithCurrentProgrammeZero({sourceTimeoutMs:15,onAudit:()=>{entered=true;return new Promise(()=>{})}},
    configuration(async()=>observed('original')))
  const outcome=await Promise.race([operation.then(()=> 'returned',e=>e.name==='TimeoutError'||e.name==='AbortError'?'aborted':e),
    delay(150).then(()=> 'still-pending')])
  assert.equal(entered,true)
  assert.equal(outcome,'aborted')
})

test('an injected primary reader that ignores cancellation cannot outlive the source deadline',async()=>{
  let entered=false,nativeStarted=false
  const operation=runWithCurrentProgrammeZero({sourceTimeoutMs:15},{source:'bridge-control',
    runPrimary:async()=>{entered=true;return new Promise(()=>{})},
    runProgramme:async()=>{nativeStarted=true;return observed('original')}})
  const outcome=await Promise.race([operation.then(()=> 'returned',e=>e.name==='TimeoutError'||e.name==='AbortError'?'aborted':e),
    delay(150).then(()=> 'still-pending')])
  assert.equal(entered,true)
  assert.equal(outcome,'aborted')
  assert.equal(nativeStarted,false)
})

test('a synchronous primary result cannot escape an elapsed deadline by starving the abort timer',async()=>{
  await assert.rejects(runWithCurrentProgrammeZero({sourceTimeoutMs:1},{source:'bridge-control',runPrimary:async()=>{
    const until=performance.now()+20
    while(performance.now()<until){ /* A real CPU-bound parser keeps this event-loop turn active. */ }
    return[{jobId:'native-positive-control',source:'bridge-control',location:'Bengaluru, India'}]
  },runProgramme:async()=>assert.fail('Expired positive processing cannot start a new programme')}),e=>e.name==='TimeoutError'||e.name==='AbortError')
})
