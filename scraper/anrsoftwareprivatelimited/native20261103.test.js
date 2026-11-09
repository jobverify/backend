import test from 'node:test'
import assert from 'node:assert/strict'
import {run,CAREERS_URL} from './script.js'
import {nativeFixture} from '../alkemlaboratories/nativeFixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
globalThis.fetch=async()=>{throw Error('OFFLINE native fixture network tripwire')}
const fixture=nativeFixture(import.meta.url),replay=options=>run({fetchText:async url=>fixture.get(url),...options})
test('ANR resolves public criteria reveal for seven enabled role cards while preserving all47 and missing country/native identity',async()=>{
 let audit;const jobs=await replay({onAudit:a=>{audit=a}});assert.equal(jobs.length,0);assert.equal(audit.observations.length,47);assert.equal(audit.activePublicRoleCount,7)
 const writer=audit.observations.find(r=>r.title==='Content Writer');assert.equal(writer.publicCriteriaComplete,true);assert.match(writer.publicCriteriaText,/Eligibility:/);assert.match(writer.publicCriteriaText,/SEO/);assert.match(writer.publicCriteriaText,/Job Description:/);assert.doesNotMatch(writer.publicCriteriaText,/No vacancy/)
 assert.equal(writer.country,null);assert.equal(writer.jobId,null);assert.equal(writer.sourceDetailComplete,false);assert.equal(audit.closingReconciled,true)
 assert.equal(audit.observations.filter(r=>r.status==='native-closed').length,34);assert.equal(audit.observations.filter(r=>r.status==='unresolved').length,6);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readSourceObservationEvidence(jobs,'anrsoftwareprivatelimited')?.observedRecordCount,47);assert.equal(readSourceObservationEvidence(jobs,'anrsoftwareprivatelimited')?.observedVacancyCount,7)
})
test('ANR source stylesheet changes withhold public reveal qualification',async()=>{
 let audit;await replay({fetchText:async url=>fixture.get(url)+(url.includes('/style.css?')?'\n.description-text{display:none!important}':''),onAudit:a=>{audit=a}});assert.equal(audit.renderingVerified,false);assert.ok(audit.observations.every(r=>r.publicCriteriaComplete===false));assert.equal(audit.activePublicRoleCount,null)
})
test('ANR hidden/commented criteria stay raw observations and cannot become complete public criteria',async()=>{
 let audit;await replay({fetchText:async url=>url===CAREERS_URL?fixture.get(url).replace('class="current-opening"','class="current-opening" hidden'):fixture.get(url),onAudit:a=>{audit=a}});assert.equal(audit.observations[0].publicCriteriaComplete,false);assert.equal(audit.observations[0].sourceVisibilityVerified,false)
})
test('ANR awaiting observer preserves rejection and bounds opaque caller cancellation',async()=>{
 const reason={observer:'failure'};let calls=0;await assert.rejects(replay({onAudit:async()=>{calls++;throw reason}}),e=>e===reason);assert.equal(calls,1)
 const controller=new AbortController();await assert.rejects(Promise.race([replay({signal:controller.signal,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}}),new Promise((_,reject)=>setTimeout(()=>reject(Error('test abort did not settle')),200))]),e=>e===reason)
})
test('ANR caller abort bounds an ignoring reader with exact reason',async()=>{const controller=new AbortController(),reason={reader:'aborted'},operation=run({signal:controller.signal,fetchText:()=>new Promise(()=>{})});setTimeout(()=>controller.abort(reason),10);await assert.rejects(Promise.race([operation,new Promise((_,reject)=>setTimeout(()=>reject(Error('test abort did not settle')),200))]),e=>e===reason)})
test('ANR public criteria decode original HTML text leaves once without losing literal examples or punctuation',async()=>{
 let audit;await replay({fetchText:async url=>url===CAREERS_URL?fixture.get(url).replace('<div class="full-explaination">','<div class="full-explaination"><p>Keep literal &amp;lt;criteria&amp;gt; and &ndash; &rsquo; &micro;F.</p>'):fixture.get(url),onAudit:a=>{audit=a}})
 const writer=audit.observations[0];assert.equal(writer.publicCriteriaComplete,true);assert.match(writer.publicCriteriaText,/literal &lt;criteria&gt; and – ’ µF/);assert.doesNotMatch(writer.publicCriteriaText,/<criteria>/)
})
