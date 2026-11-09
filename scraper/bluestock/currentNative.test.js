import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from '../alohatechnology/nativeFixture.js'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=nativeFixture(import.meta.url),timeout=v=>new Promise(r=>setTimeout(()=>r(v),80))
test('promoted roles and generic categories retain honest current original evidence and closing reconciliation',async()=>{
 const reports=[],jobs=await run({fetchText:fixture.get,fetchPage:fixture.fetchPage,onAudit:r=>reports.push(r)})
 assert.equal(reports.length,1);assert.equal(reports[0].closingReconciled,true);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 const observation=readSourceObservationEvidence(jobs,'bluestock');assert.equal(observation.observedRecordCount,5);assert.equal(observation.observedVacancyCount,2)
 assert.ok(jobs.every(j=>j.country===null&&j.requisitionId===null&&j.jobDescription===null));assert.equal(reports[0].identityConflictCount,1)
})
test('native partial observers cannot hang after caller abort',async()=>{
 const c=new AbortController(),reason={abort:'bluestock-observer'},p=run({fetchText:fixture.get,fetchPage:fixture.fetchPage,signal:c.signal,onAudit:()=>{c.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([p.then(()=>null,e=>e),timeout('hung')]),reason)
})
