import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
globalThis.fetch=async()=>{throw new Error('OFFLINE_GLOBAL_FETCH_TRIPWIRE')}
const loadModule=()=>import('../../scraper/acuvatesoftware/script.js')
const loadCareers=async()=>gunzipSync(await fs.readFile(new URL('../../scraper/acuvatesoftware/fixtures/careers-20261027.gz',import.meta.url))).toString('utf8')

test('Acuvate Software helpers read current role sections without fabricating country or native requisition IDs',async()=>{
 const acuvate=await loadModule(),html=await loadCareers()
 assert.equal(acuvate.SOURCE,'acuvatesoftware');assert.equal(acuvate.COMPANY,'Acuvate Software')
 assert.equal(acuvate.CAREERS_URL,'https://acuvate.com/careers/');assert.equal(acuvate.APPLY_URL,'https://acuvate.com/careers/#fill_the_form');assert.equal(acuvate.VERIFIED_ON,'2026-10-27')
 assert.equal(acuvate.hasOfficialCareersSignal(html),true)
 assert.equal(acuvate.hasOfficialCareersSignal('<html><title>Culture &amp; Careers | Acuvate</title><h2>Open Opportunities at Acuvate</h2><section class="role-card"><h3>Project Manager</h3></section></html>'),false)
 const jobs=acuvate.extractJobs(html,{revealContract:true})
 assert.equal(jobs.length,5)
 for(const job of jobs){assert.equal(job.country,null);assert.equal(job.nativeCountry,null);assert.equal(job.jobId,null);assert.equal(job.requisitionId,null);assert.equal(job.remoteStatus,null);assert.equal(job.legalEmployer,null);assert.ok(job.sourceDescription.length>900);assert.match(job.sourceUrl,/#elementor-tab-content-/)}
})
test('Acuvate Software constructor applies output cap after closing all native roles',async()=>{
 const acuvate=await loadModule(),requests=[]
 const row=id=>`<section class="elementor-inner-section" data-job-id="${id}"><h3>Engineer ${id}</h3><div class="panel-location">Location: Hyderabad, India</div><div class="elementor-tab-title" id="t-${id}" role="button" data-tab="1" aria-controls="c-${id}">Click here to know more</div><div id="c-${id}" class="elementor-tab-content" data-tab="1" aria-labelledby="t-${id}"><p>Responsibilities: Build and maintain production software. Qualifications: Engineering degree and software development experience.</p></div><a href="#fill_the_form">Apply Now</a></section>`
 const html=`<html><title>Culture &amp; Careers | Acuvate</title><h2>Open Opportunities at Acuvate</h2><section id="jobs">${row('a')}${row('b')}${row('c')}</section><div id="fill_the_form">Application</div></html>`
 const jobs=await acuvate.createAcuvateSoftwareScraper({maxJobs:2}).run({fetchPage:async url=>{requests.push(url);return{url,status:200,body:url===acuvate.CAREERS_URL?html:'<title>Acuvate</title><a href="https://acuvate.com/careers/">Careers</a>'}}})
 assert.deepEqual(requests,[acuvate.CAREERS_URL,'https://acuvate.com/',acuvate.CAREERS_URL,'https://acuvate.com/'])
 assert.equal(jobs.length,2);assert.equal(jobs[0].source,'acuvatesoftware');assert.equal(jobs[0].link,acuvate.APPLY_URL);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].sourceCleanupEligible,false);assert.match(jobs[0].scrapedAt,/^\d{4}-\d{2}-\d{2}T/)
})
test('Acuvate Software run fails closed before other routes when the native careers surface drifts',async()=>{
 const acuvate=await loadModule();let calls=0
 await assert.rejects(acuvate.createAcuvateSoftwareScraper().run({fetchPage:async url=>{calls++;return{url,status:200,body:'<html><body><h1>Unexpected</h1></body></html>'}}}),/verified acuvate software careers surface/i)
 assert.equal(calls,1)
})