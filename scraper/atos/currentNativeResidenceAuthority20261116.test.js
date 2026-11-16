import './currentNativeAuthority20261116.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {replayCurrentAtos} from './currentNative20261115.test.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const target=fixture.passes[0].rows[0].url
const insert=(packet,url,text)=>{
 if(url!==target)return
 const marker='<span class="jobdescription">';assert.equal(packet.body.split(marker).length-1,1)
 packet.body=packet.body.replace(marker,marker+'<p>'+text+'</p>')
}
for(const sentence of[
 'Applicants must live in United States.',
 'Your appointment is with Acme Corporation.',
 'Your contract is with Acme Corporation.',
 'Applicants must reside in the United States.',
 'Applicants must live in the United States.',
 'Your appointment will be issued by Acme Corporation.',
 'Your contract will be issued by Acme Corporation.',
 'You will work in New York, United States.',
 'Your primary place of work is New York, United States.',
 'Important: Applications close on 1 November 2026.',
 'Please note: Apply before 1 November 2026.',
 'Candidates may apply no later than 1 November 2026.',
 'The position is United States based.',
 'Resumes must be received by 1 November 2026.',
 'All curricula vitae should reach us by 1 November 2026.',
 'Cover letters are due before 1 November 2026.',
 'CVs must be received by 1 November 2026.',
 'Permanent residence is required in the United States.',
 'Your residence shall be in the United States.',
 'The appointee must be a resident of the United States.',
 'Employees are required to reside in the United States.',
 'This role may be performed only while living in the United States.',
 'Please note: the appointment, if offered, will be issued by Acme Corporation.',
 'Contract: Acme Corporation.',
 'The contractual entity is Acme Corporation.',
 'Your service agreement is with Acme Corporation.',
])test('v7 authority subject requires full native clause review: '+sentence,async()=>{
 const result=await replayCurrentAtos((packet,url)=>insert(packet,url,sentence))
 assert.ok(result.mutations.length>0,'actual retained own criterion changed')
 if(!result.error){const published=result.jobs.find(job=>job.sourceUrl===target);assert.ok(published);for(const text of[published.sourceNativeFullCriteria,published.sourceDescription,published.sourceNativeClosingRecord.criteria])assert.ok(text.includes(sentence),'genuine RED must preserve the full changed clause on both reads')}
 assert.ok(result.error,'unreviewed whole authority subject must hold')
 assert.equal(result.error.failureKind,'coverage_gap');assert.equal(result.jobs.length,0);assert.equal(result.error.sourceScopeComplete,false);assert.equal(result.error.lifecycleCleanupAllowed,false)
})

for(const sentence of[
 'Applicants must hold an additional cryptography doctorate before applying.',
 'Experience operating live observability dashboards and streaming services is required.',
 'Experience with consumer-driven contract testing and typed API schemas is required.',
 'Build and validate service contracts across distributed systems.',
 'Experience developing an appointment scheduling system is required.',
])test('v7 complete ordinary technical qualification remains dynamic: '+sentence,async()=>{
 const result=await replayCurrentAtos((packet,url)=>insert(packet,url,sentence))
 assert.ifError(result.error);assert.equal(result.jobs.length,25);assert.equal(result.calls.length,68);assert.equal(result.mutations.length,2)
 const published=result.jobs.find(job=>job.sourceUrl===target);assert.ok(published)
 for(const text of[published.sourceNativeFullCriteria,published.sourceDescription,published.sourceNativeClosingRecord.criteria])assert.ok(text.includes(sentence))
 assert.equal(published.sourceDetailComplete,true);assert.equal(published.sourceScopeComplete,false);assert.equal(published.lifecycleCleanupAllowed,false)
})

test('v7 residence and appointment subjects bind the complete containing formatted clause',async()=>{
 for(const fragment of[
  'Our policy requires applicants to <strong>live</strong> in the United States.',
  'Please note: <strong>your appointment</strong> will be issued by Acme Corporation.',
 ]){
  const result=await replayCurrentAtos((packet,url)=>insert(packet,url,fragment))
  assert.ok(result.mutations.length>0);assert.ok(result.error);assert.equal(result.error.failureKind,'coverage_gap');assert.equal(result.jobs.length,0)
 }
})

test('v7 closing-only additional ordinary qualification still fails full closing reconciliation',async()=>{
 const sentence='Applicants must hold an additional current cryptography doctorate before applying.'
 const result=await replayCurrentAtos((packet,url,index)=>{if(index===1)insert(packet,url,sentence)})
 assert.ok(result.mutations.length>0);assert.ok(result.error);assert.equal(result.error.failureKind,'coverage_gap');assert.equal(result.jobs.length,0)
})
