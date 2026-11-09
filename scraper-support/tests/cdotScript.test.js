import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as cdot from '../../scraper/cdot/script.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/cdot-native-quality.json.gz',import.meta.url))))
test('extractOpenings preserves C-DOT application dates and local identities without invented country or requisitions',()=>{
 const html=packets[0].bodyText
 assert.equal(cdot.hasCurrentOpeningsSignal(html),true)
 assert.equal(cdot.hasCurrentOpeningsSignal('<template>'+html+'</template>'),false)
 const [job]=cdot.extractOpenings(html)
 assert.equal(job.title,'Young Professionals - Product Engineering & Sustenance.');assert.equal(job.jobId,'cdot-28')
 for(const key of ['requisitionId','country','city','location','postingDate','jobDescription','nativeCanonicalRoleURL'])assert.equal(job[key],null,key)
 assert.equal(job.nativeApplicationAdvertisementID,'28');assert.equal(job.sourceApplicationOpeningLabel,'07-10-2026 09:00:00')
 assert.equal(job.applicationOpeningDate,'2026-10-07');assert.equal(job.closingDate,'2026-11-08');assert.equal(job.applicationDateTimezone,null)
 assert.equal(job.applyUrl,'https://cdotrecruitment.cdot.in/cdotrecruitmentportal/college_home.jsp?adv_id=28')
 assert.equal(job.sourceUrl,packets[1].requestedURL);assert.equal(job.applicationUrlIsGeneric,true)
})
test('C-DOT run decorates paired whole native records without granting complete scope or cleanup',async()=>{
 const requested=[]
 const jobs=await cdot.createCdotScraper({minIntervalMs:0,now:()=> '2026-11-05T12:30:00.000Z',fetchImpl:async url=>{
  const q=packets.find(p=>p.requestedURL===url);assert.ok(q,'Unexpected C-DOT URL');requested.push(url)
  const response=new Response(q.bodyBase64?Buffer.from(q.bodyBase64,'base64'):q.bodyText,{status:q.status,headers:q.headers})
  Object.defineProperty(response,'url',{value:q.finalURL});return response
 }}).run()
 assert.deepEqual(requested,[packets[0].requestedURL,packets[1].requestedURL,packets[0].requestedURL,packets[1].requestedURL])
 assert.equal(jobs.length,1);assert.equal(jobs[0].source,'cdot');assert.equal(jobs[0].link,jobs[0].applyUrl)
 assert.equal(jobs[0].scrapedAt,'2026-11-05T12:30:00.000Z');assert.equal(jobs[0].nativeRoleClosingReconciled,true)
 assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
