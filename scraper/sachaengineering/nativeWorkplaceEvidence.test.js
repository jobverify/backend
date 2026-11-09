import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const replay=(edit=()=>{},calls=[])=>async url=>{calls.push(url);const r=structuredClone(packets.find(p=>p.url===url));assert.ok(r,'Uncaptured '+url);edit(r);return r.body}
const apiEdit=(r,edit)=>{if(r.url.includes('api.bell.careers')){const p=JSON.parse(r.body);edit(p);r.body=JSON.stringify(p)}}
const runReplay=(edit,calls)=>{const read=replay(edit,calls);return run({fetchText:read,fetchBellCompanyApiPage:read,now:()=> '2026-10-31T08:00:00Z'})}
test('current Bell source retains136 roles and actual job-summary workplaces without INR country inference',async()=>{
 const jobs=await runReplay()
 assert.equal(jobs.length,136)
 const process=jobs.find(j=>j.jobId==='sachaengineering-486'),gcp=jobs.find(j=>j.jobId==='sachaengineering-447')
 assert.equal(process.location,'Pune');assert.equal(process.country,null)
 assert.equal(gcp.location,'Chennai');assert.equal(gcp.country,null)
 const unlocated=jobs.find(j=>j.jobId==='sachaengineering-550')
 assert.equal(unlocated.location,null);assert.equal(unlocated.country,null);assert.equal(unlocated.nativeLocationEvidence.currency,'INR')
 assert.equal(unlocated.nativePublicationDateRaw,'2026-10-30T18:13:43.520945Z')
 assert.equal(jobs.find(j=>j.jobId==='sachaengineering-19').country,'India')
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);assert.equal(jobs.nativeCollectionEvidence.nativeObservedRecordCount,136)
})
test('role-owned explicit foreign workplace wins over salary currency without erasing native text',async()=>{
 const jobs=await runReplay(r=>apiEdit(r,p=>{const j=p.results.job_posts.find(j=>j.post_id===486);if(j)j.description=j.description.replace(/Pune/g,'Toronto, Canada')}))
 const job=jobs.find(j=>j.jobId==='sachaengineering-486');assert.equal(job.country,'Canada');assert.equal(job.location,'Toronto, Canada');assert.ok(job.jobDescription.includes('Toronto, Canada'))
})
test('hybrid environment, industry and customer travel do not become geographic locations',async()=>{
 const jobs=await runReplay()
 for(const id of [507,429,398,73])assert.equal(jobs.find(j=>j.jobId==='sachaengineering-'+id).location,null)
})
test('contradictory typed and role-summary workplaces fail closed',async()=>{
 await assert.rejects(runReplay(r=>apiEdit(r,p=>{const j=p.results.job_posts.find(j=>j.post_id===486);if(j)j.location='Bangalore, India'})))
})
test('duplicate native roles cannot silently certify the inventory',async()=>{
 await assert.rejects(runReplay(r=>apiEdit(r,p=>{if(r.url.endsWith('/sacha/'))p.results.job_posts.push(p.results.job_posts[0])})))
})
test('pagination cannot send a native collection to an unrelated origin',async()=>{
 const calls=[]
 await assert.rejects(runReplay(r=>apiEdit(r,p=>{p.next='https://unrelated.example/roles'}),calls))
 assert.ok(calls.every(url=>!url.includes('unrelated.example')))
})
test('additional actual role-title prefixes, named teams and candidate workplace clauses retain exact native labels',async()=>{
 const jobs=await runReplay()
 for(const id of [421,410,341,340,260,164,163,162,127]){
  const job=jobs.find(j=>j.jobId==='sachaengineering-'+id)
  assert.equal(job.location,'Chennai','native workplace for '+id);assert.equal(job.country,null)
 }
})
test('actual labeled workplace headers and explicit remote India eligibility are parsed without currency proof',async()=>{
 const jobs=await runReplay()
 for(const id of [257,83]){const job=jobs.find(j=>j.jobId==='sachaengineering-'+id);assert.equal(job.location,'Chennai');assert.equal(job.country,null)}
 for(const id of [338,354]){const job=jobs.find(j=>j.jobId==='sachaengineering-'+id);assert.equal(job.country,'India');assert.equal(job.city,null);assert.ok(job.location)}
})
test('native office codes, client scope and a conflicting advertised role remain unresolved instead of guessed geography',async()=>{
 const jobs=await runReplay()
 for(const id of [17,18,113,414]){const job=jobs.find(j=>j.jobId==='sachaengineering-'+id);assert.equal(job.location,null);assert.equal(job.country,null);assert.ok(job.nativeLocationEvidence.roleWorkplaceEvidence?.rawLabel)}
})
test('a corporate contact Location label in job boilerplate is not a role workplace',async()=>{
 const jobs=await runReplay(r=>apiEdit(r,p=>{const job=p.results.job_posts.find(j=>j.post_id===550);if(job)job.description+=' Corporate contact Location: New Delhi, India'}))
 const job=jobs.find(j=>j.jobId==='sachaengineering-550');assert.equal(job.location,null);assert.equal(job.country,null)
})
