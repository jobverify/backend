import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const rows=['fresh-official-pages.json','native-employer.json','native-jobs.json'].flatMap(f=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+f+'.gz',import.meta.url)))))
const replay=(edit=r=>r)=>async url=>{const row=rows.find(r=>r.url===url);assert.ok(row,'uncaptured '+url);const r=edit({...row}),response=new Response(r.body,{status:r.status});Object.defineProperty(response,'url',{value:r.finalUrl});return response}
const now=()=> '2026-10-23T13:00:00Z'
const options={fetchImpl:replay(),now}
test('official job-update handoff recovers six exact InCred employer India roles',async()=>{
 const jobs=await run(options);assert.equal(jobs.length,6)
 assert.deepEqual(jobs.map(j=>[j.jobId,j.postingDate]),[['4466103462','2026-10-14'],['4478423718','2026-10-14'],['4481660379','2026-10-23'],['4475785487','2026-10-08'],['4477511585','2026-10-12'],['4477990899','2026-10-13']])
 assert.ok(jobs.every(j=>j.company==='InCred'&&j.source==='incred'&&j.country==='India'&&j.activeApplyVerified&&j.sourceDetailComplete));assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,6)
 const e=readInventoryEvidence(jobs);assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.firstParty,true)
})
test('missing native descriptions remain eligible and partial',async()=>{
 const jobs=await run({...options,fetchImpl:replay(r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replaceAll('class="show-more-less-html__markup','hidden class="show-more-less-html__markup');return r})});assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.sourceDescription===null&&!j.sourceDetailComplete));assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,6)
})
test('new primary dates, expiry and country evidence cannot be ignored',async()=>{
 for(const carrier of ['<time datetime="2025-01-01">First published2025</time>','<span hidden itemprop="addressCountry">France</span>','<meta property="validThrough" content="2020-01-01">'])await assert.rejects(run({...options,fetchImpl:replay(r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replace('</h1>','</h1>'+carrier);return r})}),{code:'INCRED_COVERAGE_GAP'})
})
test('corporate job handoff and native employer cannot be replaced with group siblings',async()=>{
 for(const edit of [r=>{if(r.url.includes('Career-Page'))r.body=r.body.replaceAll('https://www.linkedin.com/company/incredfinancialservices/','https://www.linkedin.com/company/incred-money/');return r},r=>{if(r.url.includes('/company/'))r.body=r.body.replaceAll('urn:li:organization:13183871','urn:li:organization:7');return r}])await assert.rejects(run({...options,fetchImpl:replay(edit)}),{code:'INCRED_COVERAGE_GAP'})
})

test('actual compressed capture packets and response bodies match SHA manifest',()=>{
 const m=JSON.parse(readFileSync(new URL('./fixtures/manifest.json',import.meta.url))),sha=b=>createHash('sha256').update(b).digest('hex')
 for(const f of m.files){const raw=readFileSync(new URL('./fixtures/'+f.file,import.meta.url));assert.equal(sha(raw),f.sha256);assert.equal(sha(gunzipSync(raw)),f.uncompressedSHA256)}
 for(const c of m.captures){const raw=readFileSync(new URL('./fixtures/'+c.file,import.meta.url));if(c.fileSha256)assert.equal(sha(raw),c.fileSha256);const data=JSON.parse(c.file.endsWith('.gz')?gunzipSync(raw):raw),items=Array.isArray(data)?data:[data],r=items.find(r=>r.url===c.url);assert.ok(r);assert.equal(sha(r.body),c.bodySha256);assert.equal(r.finalUrl,c.finalUrl);assert.equal(r.status,c.status)}
 for(const c of m.supportingObservations)if(c.fileSha256)assert.equal(sha(readFileSync(new URL('./fixtures/'+c.file,import.meta.url))),c.fileSha256)
})
