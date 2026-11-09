import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as velan from '../../scraper/velaninfoservices/script.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/velan-native-quality.json.gz',import.meta.url))))
const careers=packets[0],index=packets[1],first=packets[3]
test('Velan current canonical publisher and actual native groups require active first-party markup',()=>{
 assert.equal(velan.SOURCE,'velaninfoservices');assert.equal(velan.COMPANY,'Velan Info Services')
 assert.equal(velan.OVERVIEW_URL,'https://www.velaninfo.com/careers');assert.equal(velan.JOBS_URL,'https://www.velaninfo.com/jobs');assert.equal(velan.VERIFIED_ON,'2026-11-05')
 assert.equal(velan.hasOfficialCareersSignal(careers.bodyText),true);assert.equal(velan.hasOfficialJobsSignal(index.bodyText),true)
 assert.equal(velan.hasOfficialCareersSignal('<template>'+careers.bodyText+'</template>'),false)
 assert.equal(velan.hasOfficialJobsSignal('<template>'+index.bodyText+'</template>'),false)
})
test('Velan listing helpers preserve public IDs, calendar labels and position counts while geography and full criteria remain unqualified',()=>{
 const rows=velan.extractJobs(index.bodyText);assert.equal(rows.length,12);assert.equal(rows.reduce((n,r)=>n+r.numberOfOpenings,0),22)
 assert.equal(rows[0].jobId,'102026-62053');assert.equal(rows[0].postingDate,'2026-10-15');assert.equal(rows[0].sourcePostingDateLabel,'15-10-2026')
 assert.ok(rows.every(r=>r.country===null&&r.city===null&&r.location===null&&r.requisitionId===null&&r.employmentType===null&&r.sourceDetailComplete===false))
 assert.ok(rows.every(r=>r.sourceUrl.includes('/jobs/')&&r.jobDescription===null&&r.nativeListingSummary))
})
test('Velan full own detail helpers retain criteria and cannot inherit caller-supplied country',()=>{
 const row=velan.extractJobs(index.bodyText)[0].nativeSourceRecord.listing
 const job=velan.extractJobDetail(first.bodyText,{...row,country:'India',city:'Coimbatore'})
 assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.requisitionId,null);assert.equal(job.legalEmployer,null)
 assert.ok(job.sourceDescription.includes('Bachelor’s degree in accounting'));assert.match(job.sourceDescription,/Familiarity with AI tools/)
 assert.equal(job.sourceNativeCriteriaContainerRetained,true);assert.equal(job.sourceDetailComplete,false)
 assert.throws(()=>velan.extractJobDetail(first.bodyText,{...row,jobId:'102026-62050'}),/identity conflict/)
})
test('Velan factory defaults and run overrides reach all paired reads and preserve exact caller clock',async()=>{
 const calls=[],fetchImpl=async url=>{const q=packets.find(q=>q.requestedURL===url);assert.ok(q,'Uncaptured native URL');calls.push(url)
  const response=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response}
 const jobs=await velan.createVelanInfoServicesScraper({fetchImpl:()=>assert.fail('Run transport override required'),minIntervalMs:0,now:()=> '2026-11-05T17:00:00.000Z'})
  .run({fetchImpl,maxJobs:1,now:()=> '2026-11-05T18:00:00.000Z'})
 assert.equal(jobs.length,1);assert.equal(calls.length,30);assert.equal(jobs[0].scrapedAt,'2026-11-05T18:00:00.000Z');assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
