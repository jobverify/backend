import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-closing-20261121.json.gz',import.meta.url))))
const AFFECTED='33d68c1a-31db-4e05-8134-c0d6569f5648',GOA='funnel_id=goa-regional-auditor'
const jsonValue=value=>JSON.parse(JSON.stringify(value))
async function replay(mutate=()=>{},options={}){
 const queues=new Map(),calls=[]
 for(const p of fixture.packets){if(!queues.has(p.requestedURL))queues.set(p.requestedURL,[]);queues.get(p.requestedURL).push(p)}
 const jobs=await run({now:()=>fixture.capturedAt,requestIntervalMs:0,...options,fetchImpl:async(url,init)=>{
  const original=queues.get(url)?.shift();assert.ok(original,'Exact retained declared request: '+url)
  const p=structuredClone(original);mutate(p,url);calls.push(url)
  const response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperties(response,{url:{value:p.url},redirected:{value:false}});return response
 }})
 return {jobs,calls}
}
const editJSON=(p,change)=>{const value=JSON.parse(Buffer.from(p.bodyBase64,'base64').toString('utf8'));change(value);p.bodyBase64=Buffer.from(JSON.stringify(value)).toString('base64')}

test('genuine current CMS closing flag drift holds its own role and retains286 independently reconciled native partials',async()=>{
 const {jobs,calls}=await replay(),audit=jobs.nativeCollectionEvidence
 assert.equal(calls.length,118);assert.equal(jobs.length,286);assert.equal(new Set(jobs.map(j=>j.jobId)).size,286);assert.ok(jobs.every(j=>j.jobId!==AFFECTED))
 assert.equal(audit.nativeObservedRecords,287);assert.equal(audit.qualifiedIndiaRecords,286);assert.equal(audit.fullPublicModelsClosingReconciled,false);assert.equal(audit.qualifiedNativeModelsClosingReconciled,true)
 assert.deepEqual(audit.unreconciledApplicationFormIDs,[AFFECTED]);assert.equal(audit.heldRecords.length,1)
 const held=audit.heldRecords[0];assert.equal(held.nativeID,AFFECTED);assert.equal(held.reason,'native-application-recording-config-changed-at-closing')
 assert.equal(held.nativeForm.model.config.record_applicant,true);assert.equal(held.nativeClosingForm.model.config.record_applicant,false)
 for(const job of jobs){
  assert.equal(job.company,'CMS Info Systems');assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceNativeClosingReconciled,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.deepEqual(jsonValue(job.sourceNativeRecord),jsonValue(audit.opening.rows.find(row=>row.id===job.jobId)))
  assert.equal(job.sourceDescription,audit.opening.forms[job.jobId]?.model?.funnel?.position_description_html||null)
 }
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.lifecycleCleanupAllowed,false)
})

test('stable current CMS application flag keeps all original287 partial observations',async()=>{
 const {jobs}=await replay((p,url)=>{if(p.phase==='closing'&&url.endsWith(GOA))editJSON(p,value=>{value.config.record_applicant=true})})
 assert.equal(jobs.length,287);assert.equal(jobs.nativeCollectionEvidence.fullPublicModelsClosingReconciled,true);assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,0)
})

test('a caller output limit still completes CMS closing and retains the affected role hold',async()=>{
 const {jobs,calls}=await replay(()=>{},{maxJobs:1});assert.equal(jobs.length,1);assert.equal(calls.length,118);assert.equal(jobs.nativeCollectionEvidence.qualifiedIndiaRecords,286);assert.equal(jobs.nativeCollectionEvidence.heldRecords[0].nativeID,AFFECTED)
})
for(const [name,change] of [
 ['other application semantics',value=>{value.config.validate_email=true}],
 ['malformed flag type',value=>{value.config.record_applicant='false'}],
 ['whole original criteria',value=>{value.funnel.position_description_html+='<p>Additional current certification required.</p>'}],
 ['native employer',value=>{value.brand.name='Other employer'}],
 ['native workplace',value=>{value.funnel.address='Toronto, Canada'}],
])test('CMS still rejects closing drift in '+name,async()=>{
 await assert.rejects(replay((p,url)=>{if(p.phase==='closing'&&url.endsWith(GOA))editJSON(p,change)}),/full native public models changed at closing/)
})