import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {currentDsmCriteria} from './nativeCriteria20261121.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-published-roles-20261121.json.gz',import.meta.url))))
const sha=s=>createHash('sha256').update(s).digest('hex')
async function replay(mutate=(p,b)=>b){
 let at=0
 const jobs=await run({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const p=f.packets[at++];assert.ok(p);assert.equal(url,p.requestedURL);assert.equal(init.method,p.method);assert.equal(init.body,undefined)
  const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(sha(bytes),p.persistedSHA256)
  return Object.defineProperty(new Response(mutate(p,bytes),{status:p.status,headers:p.headers}),'url',{value:p.finalURL})
 }})
 assert.equal(at,52);return jobs
}
test('current52 original-derived role models qualify nine complete India roles with company scope held',async()=>{
 const jobs=await replay();assert.equal(jobs.length,9)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,10)
 assert.equal(jobs.nativeCollectionEvidence.observations.filter(o=>o.qualified).length,9)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 for(const job of jobs){
  assert.equal(job.sourceNativeCountry,null);assert.equal(job.country,'India');assert.equal(job.activeApplyVerified,false)
  const original=jobs.nativeCollectionEvidence.observations.find(o=>o.nativeId===job.nativeId)
  assert.equal(sha(JSON.stringify(job.sourceDescriptionChannels.nativeSupplementalContent)),sha(JSON.stringify(original.detail.data.positionExtraDetails)))
 }
 const held=jobs.nativeCollectionEvidence.observations.filter(o=>!o.qualified)
 assert.equal(held.length,1);assert.equal(held[0].nativeId,'562949978745923')
 assert.deepEqual(held[0].holdReasons,['whole-authored-native-and-own-published-criteria-differ'])
})
test('current52 newly authored video restriction holds its own role while other independently qualified roles survive',async()=>{
 const jobs=await replay((p,b)=>{
  if(!p.requestedURL.includes('position_id=562949978264545&'))return b
  const m=JSON.parse(b);m.data.positionExtraDetails.videos[1].description+=' Applicants must hold a licence.'
  return Buffer.from(JSON.stringify(m))
 })
 assert.equal(jobs.length,8)
 const held=jobs.nativeCollectionEvidence.observations.find(o=>o.nativeId==='562949978264545')
 assert.equal(held.qualified,false);assert.ok(held.holdReasons.includes('native-supplemental-criteria-unreconciled'))
 assert.ok(held.detail.data.positionExtraDetails.videos[1].description.endsWith('Applicants must hold a licence.'))
})
test('actual unmatched authored schema dashes are retained without an invented HTML horizontal rule conversion',()=>{
 const packet=f.packets.find(p=>p.requestedURL.includes('position_id=562949978745923&')),detail=JSON.parse(Buffer.from(packet.bodyBase64,'base64')).data
 const published=f.publishedCriteriaMismatch
 assert.equal(/<hr\b/i.test(detail.jobDescription),false)
 assert.match(published,/---\s*$/)
 assert.notEqual(sha(currentDsmCriteria(detail.jobDescription,true)),sha(currentDsmCriteria(published,false)))
})
