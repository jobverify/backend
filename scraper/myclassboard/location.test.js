import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {buildLocationCountryReferences,mapNative} from './native.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const load=name=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url))))
const records=['fresh-native-comparison','current-corporate-pages','keka-shell','keka-native-board','native-job-details','native-applications-and-client'].flatMap(load)
const replay=change=>run({now:new Date('2026-10-23T18:00:00Z'),fetchImpl:async url=>{
 const record=records.find(r=>r.url===url);assert.ok(record,'Uncaptured request '+url)
 let body=record.body
 if(change&&url.includes('/active/')){const rows=JSON.parse(body);change(rows);body=JSON.stringify(rows)}
 return {status:record.status,url:record.finalUrl,body:new Response(body).body}
}})
test('same-tenant native location ID and exact labels provide an explicit country reference',async()=>{
 const jobs=await replay(),job=jobs.find(j=>j.jobId==='59073')
 assert.ok(job)
 assert.equal(jobs.length,18)
 assert.equal(job.country,'India')
 assert.equal(job.location,'Hyderabad, India')
 assert.equal(job.postingDate,'2025-03-11T11:14:37.63Z')
 assert.equal(job.nativeLocationCountryEvidence[0].locationId,1744)
 assert.equal(job.nativeLocationCountryEvidence[0].countryCode,'IN')
 assert.ok(job.nativeLocationCountryEvidence[0].referenceJobIds.includes('143683'))
 assert.equal(jobs.nativeCollectionEvidence.exclusions.length,3)
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-23T18:00:00Z')}).eligibleJobs.length,4)
 assert.equal(job.lifecycleCleanupAllowed,false)
})
for(const [label,change] of [
 ['unknown ID',l=>l.id=999999],
 ['missing ID',l=>delete l.id],
 ['string ID',l=>l.id='1744'],
 ['different city',l=>l.city='Hyderabad, Canada'],
 ['different office name',l=>l.name='Other Hyderabad Office'],
 ['different state',l=>l.state='Karnataka'],
 ['foreign state',l=>l.state='Florida'],
 ['explicit foreign country',l=>{l.countryCode='US';l.countryName='United States'}],
 ['unrecognized explicit country',l=>{l.countryCode='ZZ';l.countryName='Unverified'}],
])test(label+' cannot borrow country from another native workplace',async()=>{
 const jobs=await replay(rows=>change(rows.find(r=>r.id===59073).jobLocations[0]))
 assert.equal(jobs.some(j=>j.jobId==='59073'),false)
})
test('conflicting native countries for one location ID disable reference recovery',async()=>{
 const jobs=await replay(rows=>{const l=rows.find(r=>r.id===143683).jobLocations[0];l.countryCode='US';l.countryName='United States';l.state='NY'})
 assert.equal(jobs.some(j=>j.jobId==='59073'),false)
})
test('a vacancy without any location never borrows another job location',async()=>{
 const jobs=await replay()
 for(const id of ['142099','141291','141278'])assert.equal(jobs.some(j=>j.jobId===id),false)
})
test('country-reference recovery preserves missing-description eligibility and the original age gate',()=>{
 const rows=JSON.parse(records.find(r=>r.url.includes('/embedjobs/default/active/')).body)
 const locationCountryReferences=buildLocationCountryReferences(rows),row=rows.find(r=>r.id===59073),now=new Date('2026-10-23T18:00:00Z')
 const original=mapNative(row,null,{now,locationCountryReferences})
 assert.equal(original.jobDescription,null)
 assert.equal(original.sourceDetailComplete,false)
 assert.equal(analyzePublishableJobs([original],{now}).filterCounts.old,1)
 const recentVariant=mapNative({...row,publishedOn:'2026-10-22T10:00:00Z'},null,{now,locationCountryReferences})
 assert.equal(analyzePublishableJobs([recentVariant],{now}).eligibleJobs.length,1)
})
