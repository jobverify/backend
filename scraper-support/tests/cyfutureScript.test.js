import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as cyfuture from '../../scraper/cyfuture/script.js'
import {equivalent} from '../../scraper/cyfuture/nativeModels.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/cyfuture-native-quality.json.gz',import.meta.url))))
const index=packets[0],role=packets.find(q=>q.requestedURL.includes('/146/'))
test('Cyfuture reconciles native email padding and rotated public encodings without accepting a changed contact',()=>{
 const first={attrs:{href:'/cdn-cgi/l/email-protection#016041632f626e6c21'}}
 const rotated={attrs:{href:'/cdn-cgi/l/email-protection#026342602c616d6f22'}}
 assert.equal(equivalent(first,rotated),true)
 assert.equal(equivalent(first,{attrs:{href:'/cdn-cgi/l/email-protection#026642602c616d6f22'}}),false)
 assert.throws(()=>equivalent(first,{attrs:{href:'/cdn-cgi/l/email-protection#026342'}}),/invalid public email encoding/)
})
test('Cyfuture native current tabs retain all declared locations and keep unproven country unknown',()=>{
 assert.equal(cyfuture.hasCurrentOpportunitiesSignal(index.bodyText),true)
 assert.equal(cyfuture.hasCurrentOpportunitiesSignal('<template>'+index.bodyText+'</template>'),false)
 assert.deepEqual(cyfuture.extractLocationTabs(index.bodyText).map(t=>t.label),['Noida','Mumbai','Bangalore','Jaipur','UK','Kolkata','Chennai'])
 const rows=cyfuture.extractCurrentOpportunities(index.bodyText);assert.equal(rows.length,10)
 assert.ok(rows.every(r=>r.country===null&&r.requisitionId===null&&r.city===null&&r.location===null))
})
test('Cyfuture current detail helpers preserve full criteria and do not inherit caller geography',()=>{
 const job=cyfuture.extractJobDetail(role.bodyText,{jobId:'146',sourceUrl:role.requestedURL,country:'India'})
 assert.equal(job.country,null);assert.equal(job.requisitionId,null);assert.equal(job.legalEmployer,null)
 assert.ok(job.sourceDescription.includes('years\u2019 of relevant experience'));assert.match(job.sourceDescription,/Recruiter Details/)
 assert.throws(()=>cyfuture.extractJobDetail(role.bodyText,{jobId:'143',sourceUrl:role.requestedURL}),/role ID conflict/)
})
test('Cyfuture preserves bare-ID page titles for both current Customer Care roles',()=>{
 const rows=cyfuture.extractCurrentOpportunities(index.bodyText)
 for(const id of ['94','93']){const row=rows.find(r=>r.jobId===id),packet=packets.find(q=>q.requestedURL===row.sourceUrl)
  assert.equal(cyfuture.hasJobDetailSignal(packet.bodyText),true)
  const job=cyfuture.extractJobDetail(packet.bodyText,row);assert.equal(job.jobId,id);assert.equal(job.title,row.title)}
})
test('Cyfuture factory defaults and run options reach paired native collection without cleanup authority',async()=>{
 const calls=[],jobs=await cyfuture.createCyfutureScraper({minIntervalMs:0,now:()=> '2026-11-05T14:00:00.000Z',fetchImpl:async url=>{
  const q=packets.find(q=>q.requestedURL===url);assert.ok(q,'Uncaptured URL');calls.push(url)
  const r=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r
 }}).run({now:()=> '2026-11-05T15:00:00.000Z'})
 assert.equal(jobs.length,10);assert.equal(calls.length,24)
 assert.ok(jobs.every(j=>j.scrapedAt==='2026-11-05T15:00:00.000Z'&&j.sourceDetailComplete===true))
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
})
