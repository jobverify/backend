import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createAcciojobScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const responses=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url)))).responses
function transport(change){const calls=[];return{calls,fetchImpl:async(url,options)=>{calls.push(url);const entry=responses[url];assert.ok(entry,'Only reviewed anonymous public URLs');assert.equal(createHash('sha256').update(entry.body).digest('hex'),entry.sha256);const body=change?.(url,entry.body)??entry.body;const r=new Response(body,{status:entry.status,headers:{'content-type':entry.contentType}});Object.defineProperty(r,'url',{value:entry.finalUrl});return r}}}
test('Accio classifies third-party placement products separately and fully reconciles the actual employee Keka board',async()=>{
 const t=transport(),result=await createAcciojobScraper().collect(t);assert.equal(result.jobs.length,0);assert.equal(result.nativeEmployeeBoard.reportedTotal,0);assert.equal(result.nativeEmployeeBoard.listingComplete,true);assert.equal(result.nativeEmployeeBoard.status,'verified-empty');assert.equal(result.studentPlacementProduct.classification,'third-party-student-placement-product');assert.match(result.studentPlacementProduct.visibleText,/Hiring Partners/);assert.ok(!t.calls.some(url=>url.startsWith('https://placement.')));assert.equal(result.sourceScopeComplete,false);assert.equal(result.lifecycleCleanupAllowed,false)
 assert.equal(result.ownHiringSignals.length,1);assert.match(result.ownHiringSignals[0].visibleText,/Roles & Eligibility/);assert.match(result.ownHiringSignals[0].visibleText,/50k/);assert.equal(result.ownHiringSignals[0].workCountry,null);assert.equal(result.ownHiringSignals[0].vacancyCount,null);assert.equal(readInventoryEvidence(result.jobs).reportedTotal,null);assert.match(readInventoryEvidence(result.jobs).reason,/mentor/)
})
test('Accio does not impose marketing content, student job product hashes or private-product login as employee-board prerequisites',async()=>{
 const t=transport((url,body)=>url==='https://acciojob.com/'?body.replace('Launch Your Tech Career','Explore Your Tech Career'):url==='https://acciojob.com/jobs'?body.replace('millions of graduates','many graduates'):body);const result=await createAcciojobScraper().collect(t);assert.equal(result.nativeEmployeeBoard.listingComplete,true);assert.ok(!result.scopeGaps.some(reason=>reason.includes('changed-active')))
})
test('Accio retains real new employer channels instead of declaring broad absence',async()=>{
 const t=transport((url,body)=>url==='https://acciojob.com/'?body.replace('</body>','<a href="https://jobs.ashbyhq.com/acciojob">Employee engineering openings</a></body>'):body);const result=await createAcciojobScraper().collect(t);assert.equal(result.nativeEmployeeBoard.listingComplete,true);assert.ok(result.scopeGaps.some(reason=>reason.includes('additional-employer-channel')));assert.equal(readInventoryEvidence(result.jobs).listingComplete,false)
})
test('Accio requires the active Careers label and exact employer Keka handoff; comments and scripts do not bind',async()=>{
 for(const change of[body=>body.replaceAll('href="https://acciojob.keka.com/careers"','href="https://unrelated.keka.com/careers"'),body=>body.replaceAll('>Careers<','>Student Placement<')]){const t=transport((url,body)=>url==='https://acciojob.com/'?change(body):body);await assert.rejects(createAcciojobScraper().run(t),/handoff|binding/i);assert.deepEqual(t.calls,['https://acciojob.com/'])}
})
test('Accio bounds abort-ignoring transport/body and preserves caller abort reason',async()=>{
 await assert.rejects(createAcciojobScraper().run({timeoutMs:30,fetchImpl:()=>new Promise(()=>{})}),/deadline|budget|time/i)
 await assert.rejects(createAcciojobScraper().run({timeoutMs:30,fetchImpl:async()=>({status:200,url:'https://acciojob.com/',headers:{get:()=>null},text:()=>new Promise(()=>{})})}),/deadline|budget|time/i)
 const c=new AbortController(),reason=Error('cancel');c.abort(reason);await assert.rejects(createAcciojobScraper().run({signal:c.signal,fetchImpl:()=>assert.fail()}),e=>e===reason)
})
test('Accio awaits rejected and abort-ignoring audit observers without unhandled rejections',async()=>{
 const reason=Error('observer failed'),rejected=Promise.reject(reason);rejected.catch(()=>{});await assert.rejects(createAcciojobScraper().run({...transport(),onAudit:()=>rejected}),e=>e===reason)
 await assert.rejects(createAcciojobScraper().run({...transport(),timeoutMs:3000,onAudit:()=>new Promise(()=>{})}),/deadline|budget|time/i)
})
test('Accio accepts maxJobs zero as unbounded after both full native reconciliations',async()=>{
 const result=await createAcciojobScraper().collect({...transport(),maxJobs:0});assert.equal(result.nativeEmployeeBoard.listingComplete,true);assert.equal(result.nativeRoles.length,0)
})
