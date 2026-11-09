import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {nativeFixture} from '../alkemlaboratories/nativeFixture.js'
const current=nativeFixture(import.meta.url),reader=body=>async url=>url===CAREERS_URL?body:current.get(url)
globalThis.fetch=async()=>{throw Error('OFFLINE ANR retained source tripwire')}
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/retained-http-20261029.json.gz',import.meta.url))))
const bytes=Buffer.from(fixture.bodyBase64,'base64'),html=bytes.toString('utf8')
assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.receipt.sha256)
const replay=async(body=html)=>{const audits=[];const jobs=await run({fetchText:reader(body),onAudit:a=>audits.push(a)});return{jobs,audit:audits.at(-1)}}

test('actual contradictory page retains47 card criteria observations and unresolved inventory instead of zero proof',async()=>{
 const {jobs,audit}=await replay();assert.equal(jobs.length,0)
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
 assert.equal(audit.originalCareersHTML,html);assert.equal(audit.observations.length,47);assert.equal(audit.applicationForms.length,2)
 for(const row of audit.observations){assert.ok(Object.hasOwn(row,'country'));assert.equal(row.country,null);assert.equal(row.jobId,null);assert.equal(row.sourceDetailComplete,false)}
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.authoritativeSourceTotal,null)
})
test('ContentWriter owns exact openings controls full eligibility and JD without hidden branch establishing closure',async()=>{
 const {audit}=await replay();const row=audit.observations[0]
 assert.equal(row.title,'Content Writer');assert.equal(row.openingCountText,'02 openings');assert.match(row.categoryText,/Full-time \(WFO\)/);assert.match(row.categoryText,/3 to 5 Years/)
 assert.equal(row.applyControls[0].attrs.id,'apply_3');assert.equal(row.applyControls[0].disabled,false)
 assert.ok(row.descriptionBranches.some(b=>b.attrs.class==='description-text hide'&&b.text.includes('No vacancy')))
 assert.ok(row.descriptionBranches.some(b=>b.text.includes('Eligibility:')&&b.text.includes('SEO')&&b.text.includes('Job Description:')))
 assert.equal(row.status,'native-active-public-control');assert.equal(row.country,null);assert.equal(row.publicCriteriaComplete,true);assert.doesNotMatch(row.publicCriteriaText,/No vacancy/)
})
test('duplicate native IDs retained as collisions not invented IDs or discarded cards',async()=>{
 const {audit}=await replay();assert.ok(audit.nativeIdCollisions.some(c=>c.id==='apply_3'&&c.occurrences>2));assert.equal(audit.observations.filter(r=>r.applyControls.some(c=>c.attrs.id==='apply_3')).length>2,true)
 assert.ok(audit.observations.some(r=>r.title==='Java Intern'&&r.applyControls.some(c=>c.disabled)));assert.ok(audit.observations.every(r=>r.applyUrl===null))
})
for(const change of ['negated','hidden','disabled','mixed-country'])test('counterfactual '+change+' retains raw uncertainty without publishing unknown roles',async()=>{
 let body=html
 if(change==='negated')body=body.replaceAll('No vacancy for this position now. Visit again!','Not true: No vacancy for this position now. Visit again!')
 if(change==='hidden')body=body.replace('class="current-opening"','class="current-opening" hidden')
 if(change==='disabled')body=body.replace('id="apply_3"','disabled id="apply_3"')
 if(change==='mixed-country')body=body.replace('Content Writer</h2>','Content Writer</h2><p>Headquarters in India; audience India and US</p>')
 const {jobs,audit}=await replay(body);assert.equal(jobs.length,0);assert.equal(audit.originalCareersHTML,body);assert.equal(audit.observations.length,47);assert.ok(audit.observations.every(r=>r.country===null&&r.jobId===null&&!r.sourceDetailComplete));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 if(change==='negated')assert.ok(audit.observations.every(r=>r.status!=='native-closed'))
 if(change==='hidden')assert.equal(audit.observations[0].publicCriteriaComplete,false)
 if(change==='disabled')assert.equal(audit.observations[0].publicApplicationControlEnabled,false)
})
test('removing all no-vacancy tokens cannot manufacture empty proof or prevent positive raw criteria recovery',async()=>{const {audit,jobs}=await replay(html.replaceAll('No vacancy for this position now. Visit again!',''));assert.equal(audit.observations.length,47);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')})
test('pre-aborted caller performs no transport',async()=>{const c=new AbortController(),reason=Error('Stop');c.abort(reason);let calls=0;await assert.rejects(run({signal:c.signal,fetchText:async()=>{calls++;return html}}),e=>e===reason);assert.equal(calls,0)})
test('transport abort reason propagates before audit',async()=>{const c=new AbortController(),reason=Error('Stop after body');let audits=0;await assert.rejects(run({signal:c.signal,fetchText:async(url,init)=>{assert.equal(init.signal.aborted,false);c.abort(reason);assert.equal(init.signal.reason,reason);return html},onAudit:()=>audits++}),e=>e===reason);assert.equal(audits,0)})
test('audit abort and callback failures cannot become successful empty results',async()=>{const c=new AbortController(),reason=Error('Stop audit');await assert.rejects(run({signal:c.signal,fetchText:reader(html),onAudit:()=>c.abort(reason)}),e=>e===reason);await assert.rejects(run({fetchText:reader(html),onAudit:()=>{throw reason}}),e=>e===reason)})
test('transport failure propagates unchanged without a successful empty result',async()=>{const reason=Error('unavailable');await assert.rejects(run({fetchText:async()=>{throw reason}}),e=>e===reason)})
