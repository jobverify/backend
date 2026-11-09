import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from './nativeFixture.js'
import {extractCareerJobs,run,CAREERS_PAGE_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=nativeFixture(import.meta.url),CLIENT='https://www.alohatechnology.com/assets/shared.js',timeout=v=>new Promise(r=>setTimeout(()=>r(v),80))
test('actual role boundaries retain exactly the native profile criteria without footer or fabricated identity/application prose',()=>{
 const jobs=extractCareerJobs(fixture.get(CAREERS_PAGE_URL))
 assert.equal(jobs.length,6);assert.deepEqual(jobs.map(j=>j.requiredSkills.length),[3,3,3,3,3,2]);assert.ok(jobs.every(j=>j.jobId===null&&j.requisitionId===null&&j.country===null&&j.location===null))
 assert.ok(jobs.every(j=>!j.jobDescription.includes('Apply by emailing')));assert.ok(!jobs.at(-1).jobDescription.includes(':root'))
})
test('current native public scroll/click reveal preserves all criteria and reconciles the closing cohort',async()=>{
 const reports=[],jobs=await run({fetchText:fixture.get,fetchPage:fixture.fetchPage,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,6);assert.equal(reports.length,1);assert.equal(reports[0].closingReconciled,true);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.ok(jobs.every(j=>j.sourceDetailComplete===false&&j.fullNativeCriteriaAvailable===true));assert.ok(jobs.every(j=>j.remoteStatus===null&&j.requisitionId===null))
})
test('an inactive click reveal or clipped role body cannot silently publish complete criteria',async()=>{
 const jobs=await run({fetchText:fixture.get,fetchPage:async u=>{const r=await fixture.fetchPage(u);if(u===CAREERS_PAGE_URL)r.body=r.body.replace('.role-body{max-height:0;','.role-body{height:1px;max-height:0;');return r}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('unrelated private contact copy does not gate unchanged public criteria',async()=>{
 const jobs=await run({fetchText:fixture.get,fetchPage:async u=>{const r=await fixture.fetchPage(u);if(u===CLIENT){const before=r.body;r.body=r.body.replace('https://www.alohatechnology.com/phpSendMailv1.php','https://www.alohatechnology.com/updated-contact-handler.php');assert.notEqual(r.body,before)}return r}})
 assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.fullNativeCriteriaAvailable===true&&j.sourceDetailComplete===false))
})
test('source cancellation races an ignoring audit callback with the exact reason',async()=>{
 const c=new AbortController(),reason={abort:'aloha-observer'},p=run({fetchText:fixture.get,fetchPage:fixture.fetchPage,signal:c.signal,onAudit:()=>{c.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([p.then(()=>null,e=>e),timeout('hung')]),reason)
})
for(const[name,code]of [['reassigned native reveal','initReveals = () => {};'],['shadowed observer constructor','const IntersectionObserver = class { observe() {} };']])test(name+' cannot qualify invisible native criteria',async()=>{
 const reports=[],jobs=await run({fetchPage:async url=>{const r=await fixture.fetchPage(url);if(url===CLIENT)r.body=r.body.replace('initReveals();',code+'\ninitReveals();');return r},onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.equal(reports[0].criteriaVisibilityQualified,false)
 assert.equal(reports[0].observations.length,6);assert.ok(reports[0].observations.every(r=>r.nativeCriteriaHtml&&r.originalNativeRoleHtml))
})
test('an unrelated private function may use local binding names without changing public disclosure',async()=>{
 const jobs=await run({fetchPage:async url=>{const r=await fixture.fetchPage(url);if(url===CLIENT)r.body+='\nfunction privateContactWidget(){const IntersectionObserver=class {};let initReveals=null;return IntersectionObserver;}';return r}})
 assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.fullNativeCriteriaAvailable&&j.sourceDetailComplete===false))
})
test('a startup-called helper cannot disable the public native reveal indirectly',async()=>{
 const reports=[],jobs=await run({fetchPage:async url=>{const r=await fixture.fetchPage(url);if(url===CLIENT)r.body=r.body.replace('initReveals();','function disablePublicReveal(){ initReveals = () => {}; } disablePublicReveal(); initReveals();');return r},onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.equal(reports[0].criteriaVisibilityQualified,false);assert.equal(reports[0].observations.length,6)
})
test('an uncalled private function with a possible global write does not gate the native public reveal',async()=>{
 const jobs=await run({fetchPage:async url=>{const r=await fixture.fetchPage(url);if(url===CLIENT)r.body+='\nfunction unusedPrivateRevealOverride(){ initReveals = () => {}; }';return r}})
 assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.fullNativeCriteriaAvailable&&j.sourceDetailComplete===false))
})
