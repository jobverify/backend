import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url)))).registeredReplay
const first=fixture.firstRole
async function replay(t,change){
 const counts=new Map(),calls=[],mutations=[]
 t.mock.method(globalThis,'fetch',()=>{throw Error('Only current original public Forvis responses are available')})
 const jobs=await run({now:()=>fixture.capturedAt,transport:async url=>{
  const index=counts.get(url)??0;counts.set(url,index+1);calls.push(url)
  const original=fixture.packets.filter(packet=>packet.requestedURL===url)[index]
  assert.ok(original,'No inferred native response: '+url+' #'+index)
  const packet={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString(),bodyComplete:true}
  const before=JSON.stringify(packet);change?.(packet,url,index)
  if(JSON.stringify(packet)!==before)mutations.push(url)
  return{...packet,body:Buffer.from(packet.body)}
 }})
 return{jobs,calls,mutations}
}

test('current registered87 original public responses retain79 complete typed India role models',async t=>{
 const{jobs,calls}=await replay(t)
 assert.equal(jobs.length,fixture.rawJobs);assert.equal(calls.length,fixture.packets.length)
 assert.deepEqual(jobs.map(job=>({url:job.sourceUrl??job.sourceURL??job.link,id:job.jobId,title:job.title})),fixture.expectedRoles)
 for(const job of jobs){
  const facts=job.nativeFacts
  assert.equal(job.country,'India');assert.ok(facts.nativeLocationTerms.every(term=>term.name.endsWith(', India')))
  assert.equal(job.nativeWordPressDescription,facts.nativeWordPressRecord.content.rendered)
  assert.equal(job.nativeWordPressDateGMT,facts.nativeWordPressRecord.date_gmt)
  assert.equal(job.postingDate,facts.nativeWordPressRecord.date_gmt+'Z')
  assert.equal(Date.parse(job.postingDate),Date.parse(facts.nativePostedDate.iso))
  assert.equal(facts.nativeHiringOrganization,null);assert.equal(facts.legalEmployer,null)
  assert.equal(facts.nativeApplicationEntry.jobId,String(facts.nativeWordPressRecord.id))
  assert.equal(facts.nativeApplicationEntry.applicationsOpened,false)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 const evidence=jobs[0].nativeCollectionEvidence
 assert.equal(evidence.observedListingCount,fixture.nativeObservedListingCount)
 assert.equal(evidence.cleanupAllowed,false);assert.equal(evidence.verifiedZeroInventory,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const[name,change,reason]of[
 ['mismatched complete criteria',packet=>{packet.body=packet.body.replace(/(<div\b[^>]*class="[^"]*\bwysiwyg-editor\b[^"]*"[^>]*>)/,'$1<p>Unknown current qualification added only to this page.</p>')},/description mismatch/],
 ['conflicting native work country',packet=>{packet.body=packet.body.replaceAll(first.nativeFacts.nativeVisibleLocationTexts[0],'Another city, Indonesia')},/location conflict/],
 ['changed original publication date',packet=>{packet.body=packet.body.replaceAll(first.nativeFacts.nativeWordPressRecord.date_gmt+'+00:00','2099-01-01T00:00:00+00:00')},/publication identity\/date conflict/],
 ['foreign application identity',packet=>{packet.body=packet.body.replace('data-job-id="'+first.jobId+'"','data-job-id="999999999"')},/application entry identity changed/],
])test('current native role holds '+name+' while preserving unrelated qualified roles',async t=>{
 const result=await replay(t,(packet,url)=>{if(url===first.sourceUrl)change(packet)})
 assert.ok(result.mutations.length>0,'Negative control must change actual original response bytes')
 assert.equal(result.jobs.length,fixture.rawJobs-1)
 assert.ok(!result.jobs.some(job=>job.jobId===first.jobId))
 assert.deepEqual(result.jobs.map(job=>job.jobId),fixture.expectedRoles.filter(role=>role.id!==first.jobId).map(role=>role.id))
 assert.ok(result.jobs[0].nativeCollectionEvidence.failures.some(failure=>reason.test(failure.message??'')))
 assert.equal(readInventoryEvidence(result.jobs).listingComplete,false)
 assert.equal(result.jobs[0].nativeCollectionEvidence.cleanupAllowed,false)
})
