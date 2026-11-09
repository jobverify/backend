import test from 'node:test'
import assert from 'node:assert/strict'
import {run,JOBS_PAGE_URL} from './script.js'
import {nativeFixture} from '../alkemlaboratories/nativeFixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
globalThis.fetch=async()=>{throw Error('OFFLINE native fixture network tripwire')}
const fixture=nativeFixture(import.meta.url),post='https://amura.ai/jobs/2023/10/04/growth-is-addictive/'
const replay=options=>run({fetchText:async url=>fixture.get(url),...options})
test('Amura retains complete current public career editorial and leaves real vacancy inventory unknown',async()=>{
 let audit;const jobs=await replay({onAudit:a=>{audit=a}});assert.equal(jobs.length,0);assert.equal(audit.observations.length,1);assert.equal(audit.observations[0].url,post)
 assert.match(audit.observations[0].fullPublicText,/At Amura, you must earn your crown/);assert.equal(audit.observations[0].vacancy,null)
 assert.equal(audit.closingMatches,true);const e=readInventoryEvidence(jobs);assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null)
 assert.equal(readSourceObservationEvidence(jobs,'amurahealth')?.observedRecordCount,1)
})
test('a renamed editorial post is retained without a hardcoded current title list',async()=>{
 let audit;const jobs=await replay({fetchText:async url=>fixture.get(url).replaceAll('Growth is addictive','Building a healthier world'),onAudit:a=>{audit=a}});assert.equal(jobs.length,0);assert.equal(audit.observations[0].title,'Building a healthier world');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Amura visible structured role is a gap rather than a blog empty result',async()=>{
 let audit;await assert.rejects(replay({fetchText:async url=>fixture.get(url)+(url===JOBS_PAGE_URL?'<script type="application/ld+json">{"@type":"JobPosting","title":"Doctor"}</script>':''),onAudit:a=>{audit=a}}),/role|vacan|collector/i);assert.equal(audit.inventoryEvidence.listingComplete,false)
})
test('Amura awaits observer rejection exactly once',async()=>{let calls=0;const reason={observer:'failure'};await assert.rejects(replay({onAudit:async()=>{calls++;throw reason}}),e=>e===reason);assert.equal(calls,1)})
for(const stage of ['reader','observer'])test('Amura caller abort bounds ignoring '+stage,async()=>{
 const controller=new AbortController(),reason={stage};const operation=replay({signal:controller.signal,...(stage==='reader'?{fetchText:()=>new Promise(()=>{})}:{onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})})
 if(stage==='reader')setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(Promise.race([operation,new Promise((_,reject)=>setTimeout(()=>reject(Error('test abort did not settle')),200))]),e=>e===reason)
})
