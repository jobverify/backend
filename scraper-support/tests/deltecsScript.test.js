import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as deltecs from '../../scraper/deltecs/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/codewaveDeltecs20261106/capture.json.gz',import.meta.url))))
const read=url=>{assert.ok(fixture.documents[url],'Uncaptured URL '+url);return fixture.documents[url].body}
const role='https://www.dronahq.com/career/legal-executive/'
const fetchPage=async url=>{const page=fixture.documents[url];assert.ok(page);return {status:page.status,url:page.finalUrl,headers:page.headers,body:page.body}}
test('Deltecs helpers bind current employer, native country and published role identity without invented requisitions',()=>{
 assert.equal(deltecs.SOURCE,'deltecs')
 assert.equal(deltecs.COMPANY,'Deltecs')
 assert.equal(deltecs.OFFICIAL_BRAND_NAME,'Deltecs Infotech Pvt Ltd')
 assert.equal(deltecs.PUBLIC_BRAND_NAME,'DronaHQ')
 assert.equal(deltecs.hasOfficialHomepageSignal(read(deltecs.HOMEPAGE_URL)),true)
 const rows=deltecs.extractListings(read(deltecs.CAREERS_URL))
 assert.equal(rows.length,1)
 const job=deltecs.extractJobDetail(read(role),rows[0])
 assert.equal(job.jobId,'35166')
 assert.equal(job.requisitionId,null)
 assert.equal(job.country,'India')
 assert.equal(job.workplaceType,'Hybrid')
 assert.equal(job.employmentType,'Full-time')
 assert.equal(job.experienceRequired,'2 - 3 years')
 assert.ok(job.jobDescription.includes('Bachelor’s degree in Law (LLB).'))
 assert.equal(job.sourceApplicationHandoff.activationVerified,false)
})
test('Deltecs collection reconciles native details, listing and employer after extraction',async()=>{
 const requested=[],date='2026-11-06T10:30:00.000Z'
 const jobs=await deltecs.run({fetchPage:async url=>{requested.push(url);return fetchPage(url)},now:()=>date})
 assert.deepEqual(requested,[deltecs.HOMEPAGE_URL,deltecs.CAREERS_URL,role,role,deltecs.CAREERS_URL,deltecs.HOMEPAGE_URL])
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].scrapedAt,date)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingRecordsMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('Deltecs rejects an unrelated legal employer and mismatched visible role canonical',()=>{
 const home=read(deltecs.HOMEPAGE_URL).replaceAll('Deltecs Infotech Pvt Ltd','Unrelated Company')
 assert.notEqual(home,read(deltecs.HOMEPAGE_URL))
 assert.equal(deltecs.hasOfficialHomepageSignal(home),false)
 const row=deltecs.extractListings(read(deltecs.CAREERS_URL))[0]
 const changed=read(role).replace('<link rel="canonical" href="'+role+'"','<link rel="canonical" href="https://www.dronahq.com/career/other/"')
 assert.notEqual(changed,read(role))
 assert.throws(()=>deltecs.extractJobDetail(changed,row),/Canonical identity changed/)
})
test('Deltecs retains an original listed-role404 as an incomplete source failure instead of skipping it into an apparent inventory',async()=>{
 await assert.rejects(deltecs.run({fetchPage:async url=>url===role
  ?{status:404,url,headers:{'content-type':'text/html'},body:'<html><head><title>Page not found - DronaHQ</title></head><body>Missing current listed role</body></html>'}:fetchPage(url)}),
  error=>error.status===404&&error.lifecycleCleanupAllowed===false)
})
