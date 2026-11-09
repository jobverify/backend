import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from '../alohatechnology/nativeFixture.js'
import {extractOpenJobs,run,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=nativeFixture(import.meta.url),timeout=v=>new Promise(r=>setTimeout(()=>r(v),80))
test('current table says remote but never supplies India or formal requisition evidence',()=>{
 const rows=extractOpenJobs(fixture.get(CAREERS_URL));assert.equal(rows.length,3);assert.ok(rows.every(r=>r.country===null&&r.jobId===null&&r.requisitionId===null&&r.location==='Remote'))
})
test('native detail handoffs distinguish mentorship, broken details and a real full job with native title conflict',async()=>{
 const reports=[],jobs=await run({fetchText:fixture.get,fetchPage:fixture.fetchPage,onAudit:r=>reports.push(r)})
 assert.equal(reports.length,1);assert.equal(reports[0].closingReconciled,true);assert.equal(reports[0].observations.length,11)
 assert.equal(reports[0].programHandoffs.length,1);assert.equal(reports[0].fullNativeRoleDetails.length,1);assert.equal(reports[0].fullNativeRoleDetails[0].nativeJobId,'09261')
 assert.ok(reports[0].fullNativeRoleDetails[0].originalCriteriaText.includes('No Monthly fixed salary'));assert.equal(reports[0].identityConflictCount,1)
 assert.ok(jobs.every(j=>j.country===null&&j.requisitionId===null));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('reader abort is bounded and preserves its opaque reason',async()=>{
 const c=new AbortController(),reason={abort:'bws-reader'},p=run({signal:c.signal,fetchText:()=>{c.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([p.then(()=>null,e=>e),timeout('hung')]),reason)
})
