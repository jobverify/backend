import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'

const rows=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const replay=(edit=row=>row)=>async url=>{
 const saved=rows.find(r=>r.url===url)
 assert.ok(saved,'Uncaptured '+url)
 const row=edit(structuredClone(saved)),response=new Response(row.body,{status:row.status})
 Object.defineProperty(response,'url',{value:row.finalUrl});return response
}
const now=()=> '2026-10-31T07:15:00.000Z'
const target='4482277591'
test('current native simple onsite Apply retains the exact bound Policybazaar role as partial inventory',async()=>{
 const jobs=await run({fetchImpl:replay(),now})
 const role=jobs.find(j=>j.jobId===target)
 assert.ok(role);assert.equal(role.activeApplyVerified,true)
 assert.equal(role.title,'International Sales Executive')
 assert.equal(role.country,'India');assert.equal(role.sourceDetailComplete,true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('the native simple onsite format applies to another otherwise valid role without a role exception',async()=>{
 const jobs=await run({fetchImpl:replay(r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replaceAll('public_jobs_apply-link-onsite','public_jobs_apply-link-simple_onsite');return r}),now})
 assert.ok(jobs.find(j=>j.jobId==='4430667875')?.activeApplyVerified)
 assert.ok(jobs.find(j=>j.jobId===target)?.activeApplyVerified)
})
for(const markup of ['<strong>Responsibilities Requirements Qualifications Experience Skills Benefits</strong>','<h2>Responsibilities and requirements for the successful applicant in this role</h2>'])test('native heading-only descriptions stay partial: '+markup,async()=>{
 const jobs=await run({fetchImpl:replay(r=>{if(r.url.includes('-'+target)){const d=document(r.body),node=d.nodes(n=>d.hasClass(n,'show-more-less-html__markup'))[0];r.body=r.body.replace(d.inner(node),markup)}return r}),now})
 const job=jobs.find(j=>j.jobId===target);assert.ok(job);assert.equal(job.sourceDetailComplete,false);assert.equal(job.jobDescription,null)
})
for(const [name,edit]of[
 ['unknown Apply program',html=>html.replaceAll('public_jobs_apply-link-simple_onsite','public_jobs_apply-link-unreviewed')],
 ['disabled Apply',html=>html.replaceAll('<button','<button disabled')],
 ['hidden Apply',html=>html.replaceAll('<button','<button hidden')],
 ['inert Apply',html=>html.replaceAll('<button','<button inert')],
 ['changed sign-in role',html=>html.replaceAll('4482277591%3F','4482277592%3F')],
 ['different employer',html=>html.replaceAll('topcard__org-name-link','unbound__org-name-link')],
])test('simple onsite Apply cannot qualify '+name,async()=>{
 await assert.rejects(run({fetchImpl:replay(r=>{if(r.url.includes('-'+target))r.body=edit(r.body);return r}),now}),{code:'POLICYBAZAAR_COVERAGE_GAP'})
})
