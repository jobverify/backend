import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const bytes=fs.readFileSync(new URL('./test-data/native-20261110.json.gz',import.meta.url)),packets=JSON.parse(gunzipSync(bytes)),manifest=JSON.parse(fs.readFileSync(new URL('./test-data/manifest.json',import.meta.url)))
const sha=b=>createHash('sha256').update(b).digest('hex')
const replay=(mutate=()=>{})=>{const rows=structuredClone(packets);mutate(rows);const byURL=new Map(rows.map(r=>[r.requestedURL,r]));return {now:()=>packets[0].at,fetchText:async url=>{const r=byURL.get(url);assert.ok(r,'Unexpected corporate read '+url);return r.body},fetchJson:async url=>{const r=byURL.get(url);assert.ok(r,'Unexpected native read '+url);return JSON.parse(r.body)}}}
test('complete current Gate native fixtures retain dated response bytes and SHA',()=>{
 assert.equal(packets.length,97);assert.equal(sha(bytes),manifest.sha256)
 for(const r of packets){assert.equal(sha(r.body),r.sha256);assert.ok(Date.parse(r.at));assert.equal(r.method,'GET')}
})
test('all91 native Remote labels remain country-unresolved and excluded from India publication',async()=>{
 const jobs=await run(replay());assert.equal(jobs.length,91)
 assert.ok(jobs.every(j=>j.country===null&&j.location==='Remote'&&j.remoteStatus==='Remote'&&j.sourceCountryScopeUnresolved===true))
 assert.ok(jobs.every(j=>getValidIndiaCityForJob(j)===null))
 const analysis=analyzePublishableJobs(jobs);assert.equal(analysis.indiaJobs.length,0);assert.equal(analysis.eligibleJobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'gate').observedVacancyCount,91)
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.firstParty,false);assert.equal(inventory.indiaFacetCount,null);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
})
test('retains exact native role identity and full criteria while country scope is held',async()=>{
 const jobs=await run(replay())
 assert.equal(sha(JSON.stringify(jobs.map(j=>[j.jobId,j.title,j.sourceUrl,j.jobDescription]))),manifest.baselineRoleContentSHA256)
 for(const job of jobs){const native=JSON.parse(packets.find(r=>r.requestedURL.includes('/position_detail?position_id='+job.jobId+'&')).body).data
  assert.equal(job.sourceUrl,'https://www.gate.com/careers/jobs/'+native.slug)
 }
})
test('global site code and global-team prose do not become worldwide employment eligibility',async()=>{
 const jobs=await run(replay())
 const globalRole=jobs.find(j=>j.jobId==='819');assert.match(globalRole.jobDescription,/global teams/)
 assert.equal(globalRole.sourceCountryScopeUnresolved,true);assert.equal(getValidIndiaCityForJob(globalRole),null)
})
test('non-India location metadata cannot enter India through the Remote work setting',async()=>{
 const jobs=await run(replay(rows=>{for(const r of rows.filter(r=>r.requestedURL.includes('/positions?')||r.requestedURL.includes('/position_detail?'))){const p=JSON.parse(r.body);for(const row of p.data.list||[p.data])row.location='Toronto, Canada';r.body=JSON.stringify(p)}}))
 assert.equal(jobs.length,91);assert.ok(jobs.every(j=>j.sourceCountryScopeUnresolved===true));assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,0)
})
