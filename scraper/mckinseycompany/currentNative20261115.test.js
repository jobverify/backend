import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,buildSearchApiUrl,extractIndiaCityPairs} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native20261115.json.gz',import.meta.url))))
const originalProgram=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/program20261110.json.gz',import.meta.url))))
const groups=new Map()
for(const packet of fixture.packets){
 const bytes=Buffer.from(packet.rawBodyBase64,'base64')
 assert.equal(bytes.length,packet.bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
 if(!groups.has(packet.url))groups.set(packet.url,[])
 groups.get(packet.url).push(packet)
}
const current=JSON.parse(Buffer.from(groups.get(buildSearchApiUrl())[0].rawBodyBase64,'base64'))
const india=current.docs.filter(record=>extractIndiaCityPairs(record).length)
// Only the total is reduced as a labelled synthetic page-envelope control.
// Every native role, criterion and location alternative remains the actual
// entire dated first-page model; this is no whole-company inventory proof.
function replay(mutate=()=>{}){
 const seen=new Map(),requests=[]
 const read=async(url,{signal}={})=>{
  signal?.throwIfAborted()
  const index=seen.get(url)||0;seen.set(url,index+1);requests.push(url)
  const packet=groups.get(url)?.[index]
  assert.ok(packet,'actual current entity is retained for '+url+' #'+index)
  const body=Buffer.from(packet.rawBodyBase64,'base64').toString()
  if(!url.startsWith('https://gateway.mckinsey.com/'))return body
  const value=JSON.parse(body);value.numFound=value.docs.length
  mutate(value,index)
  return value
 }
 return{requests,run:()=>run({fetchText:read,fetchJson:read,now:()=>fixture.capturedAt})}
}

test('current authored localized McKinsey application route preserves its exact native identity, full models, criteria and alternatives',async()=>{
 const reader=replay(),jobs=await reader.run()
 assert.equal(jobs.length,india.length);assert.equal(jobs.length,5)
 for(const job of jobs){
  const native=india.find(record=>record.jobID===job.jobId)
  assert.equal(job.applyUrl,native.jobApplyURL);assert.equal(job.sourceUrl,native.jobApplyURL)
  assert.deepEqual(job.sourceNativeRecord,native)
  assert.deepEqual(job.sourceNativeLocationAlternatives,native.cities.map((city,index)=>({city,country:native.countries[index]})))
  assert.deepEqual(job.locations,native.cities.map((city,index)=>city+', '+native.countries[index]))
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  for(const [field,value]of Object.entries(native))if(/^(?:jobSalaryBenefits|compensationRange(?:Canada|Italy)?)$/.test(field)){
   assert.deepEqual(job.sourceSupplementalNativeCriteria[field],value)
   for(const text of Array.isArray(value)?value:[value])assert.ok(job.jobDescription.includes(text))
  }
 }
 assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,20)
 assert.equal(jobs.nativeCollectionEvidence.closingNativeRaw.length,20)
 assert.equal(jobs.nativeCollectionEvidence.entireNativeModelsClosingMatched,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(reader.requests.length,6)
})

test('current declared whole McKinsey career program is byte-identical to the independently reviewed program',()=>{
 const bytes=Buffer.from(originalProgram.rawBodyBase64,'base64')
 assert.equal(createHash('sha256').update(bytes).digest('hex'),originalProgram.bodySHA256)
 for(const receipt of fixture.currentCareerProgramReceipts){
  assert.equal(receipt.status,200);assert.equal(receipt.bytes,bytes.length)
  assert.equal(receipt.sha256,originalProgram.bodySHA256)
 }
 assert.ok(bytes.toString().includes('return n.jobApplyURL'))
})

for(const [name,url]of [
 ['cross-role ID','https://mckinsey.avature.net/en_US/careers/ApplicationMethods?folderId=999999'],
 ['unknown locale','https://mckinsey.avature.net/en_GB/careers/ApplicationMethods?folderId=112639'],
 ['foreign host','https://different-employer.avature.net/en_US/careers/ApplicationMethods?folderId=112639'],
 ['duplicate identity','https://mckinsey.avature.net/en_US/careers/ApplicationMethods?folderId=112639&folderId=112639'],
 ['extra query scope','https://mckinsey.avature.net/en_US/careers/ApplicationMethods?folderId=112639&employer=other'],
])test('current localized native route rejects '+name,async()=>{
 const reader=replay(payload=>{payload.docs.find(record=>record.jobID==='112639').jobApplyURL=url})
 await assert.rejects(reader.run(),/identity|application|requisition/)
})

for(const [name,mutate]of [
 ['supplemental compensation',record=>{record.compensationRange='$1 - $2'}],
 ['supplemental salary and benefits',record=>{record.jobSalaryBenefits='Changed authored benefits'}],
 ['a foreign location alternative',record=>{record.cities[0]='Changed foreign worksite'}],
 ['an extra native criterion',record=>{record.additionalNativeCriteria='A newly changed closing criterion'}],
])test('closing '+name+' cannot hide behind stable primary duties',async()=>{
 const reader=replay((payload,index)=>{if(index===1)mutate(payload.docs.find(record=>record.jobID==='14918'))})
 await assert.rejects(reader.run(),/closing|changed|criteria/)
})
