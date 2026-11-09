import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const packet=name=>{const file=new URL(`./fixtures/${name}.json`,import.meta.url);return JSON.parse(fs.existsSync(file)?fs.readFileSync(file):gunzipSync(fs.readFileSync(new URL(file.href+'.gz'))))}
const rows=['fresh-corporate-confirmation','fresh-india-detail-pages'].flatMap(packet)
const replay=(edit=r=>r,calls=[])=>async url=>{calls.push(url);const saved=rows.find(r=>r.url===url);assert.ok(saved,'Uncaptured '+url);const r=edit({...saved}),response=new Response(r.body,{status:r.status});Object.defineProperty(response,'url',{value:r.finalUrl});return response}
const now=()=> '2026-10-23T17:00:00Z'
test('Policybazaar recovers independently validated India details and stops on the captured429',async()=>{
 const calls=[],jobs=await run({fetchImpl:replay(undefined,calls),now})
 assert.deepEqual(jobs.map(j=>[j.jobId,j.postingDate]),[['4430667875','2026-07-13'],['4451237087','2026-09-15']])
 assert.ok(jobs.every(j=>j.company==='Policybazaar'&&j.source==='policybazaar'&&j.country==='India'&&j.activeApplyVerified&&j.sourceDetailComplete))
 assert.equal(calls.length,6);assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,0)
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.stopReason,'native-details-HTTP429')
})
test('missing employer descriptions stay null without changing original posting dates',async()=>{
 const jobs=await run({fetchImpl:replay(r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replaceAll('class="show-more-less-html__markup','hidden class="show-more-less-html__markup');return r}),now})
 assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.sourceDescription===null&&!j.sourceDetailComplete));assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,0)
})
test('otherwise eligible individual roles can lack descriptions',async()=>{
 const jobs=await run({fetchImpl:replay(r=>{if(r.url.includes('/jobs/search/'))r.body=r.body.replaceAll('datetime="2026-07-13"','datetime="2026-10-22"').replaceAll('datetime="2026-09-15"','datetime="2026-10-22"');if(r.url.includes('/jobs/view/'))r.body=r.body.replaceAll('class="show-more-less-html__markup','hidden class="show-more-less-html__markup');return r}),now})
 assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.sourceDescription===null));assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,2)
})
test('new country, publication, expiry and JobPosting carriers require reconciliation',async()=>{
 for(const carrier of ['<span hidden itemprop="addressCountry">France</span>','<meta name="country" content="US">','<span hidden data-country="US"></span>','<time datetime="2025-01-01">First posted2025</time>','<meta property="validThrough" content="2020-01-01">','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2025-01-01"}</script>'])await assert.rejects(run({fetchImpl:replay(r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replace('</h1>','</h1>'+carrier);return r}),now}),{code:'POLICYBAZAAR_COVERAGE_GAP'})
})
test('native employer scope and official identity cannot be swapped',async()=>{
 for(const edit of [r=>{if(r.url.includes('/careers/'))r.body=r.body.replaceAll('https://www.linkedin.com/company/policybazaar/','https://www.linkedin.com/company/other/');return r},r=>{if(r.url.includes('/company/'))r.body=r.body.replaceAll('urn:li:organization:303524','urn:li:organization:8');return r},r=>{if(r.url.includes('/jobs/search/'))r.body=r.body.replaceAll('checked','unchecked');return r}])await assert.rejects(run({fetchImpl:replay(edit),now}),{code:'POLICYBAZAAR_COVERAGE_GAP'})
})
test('closed or inert Apply controls cannot authorize a vacancy',async()=>{
 for(const edit of [r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replaceAll('<button','<button disabled');return r},r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replace('</h1>','</h1><p>No longer accepting applications</p>');return r}])await assert.rejects(run({fetchImpl:replay(edit),now}),{code:'POLICYBAZAAR_COVERAGE_GAP'})
})
test('unknown, contradictory and foreign work countries are not promoted from an India search',async()=>{
 for(const location of ['Vishakhapatnam Metropolitan Area','Vishakhapatnam, Canada, India','Vishakhapatnam, Florida, India'])await assert.rejects(run({fetchImpl:replay(r=>{r.body=r.body.replaceAll('Vishakhapatnam, Andhra Pradesh, India',location).replaceAll('Gurugram, Haryana, India',location);return r}),now}),{code:'POLICYBAZAAR_COVERAGE_GAP'})
})
test('impossible calendar posting dates cannot be replaced with the collection date',async()=>{
 await assert.rejects(run({fetchImpl:replay(r=>{if(r.url.includes('/jobs/search/'))r.body=r.body.replaceAll('datetime="2026-07-13"','datetime="2026-02-30"');return r}),now}),{code:'POLICYBAZAAR_COVERAGE_GAP'})
})
