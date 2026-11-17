import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {verifyPocketClientBinding} from './currentClientBinding.js'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-binding-20261117.json.gz',import.meta.url))))
const profile=JSON.parse(readFileSync(new URL('./reviewedBinding20261117.json',import.meta.url)))
const packets=new Map(fixture.packets.map(packet=>{
 const bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(bytes.length,packet.bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
 return[packet.requestedUrl,bytes.toString('utf8')]
}))
const HOME='https://pocketfm.com/'
const verify=(edit=(_url,body)=>body)=>verifyPocketClientBinding(edit(HOME,packets.get(HOME)),async url=>{
 assert.ok(packets.has(url),'Only original declared current public programs '+url)
 return edit(url,packets.get(url))
})

test('Pocket FM binds the exact current original parent and complete native careers footer with browser scope held',async()=>{
 const result=await verify()
 assert.equal(result.parentURL,profile.parent.url)
 assert.equal(result.childURL,profile.footer.url)
 assert.equal(result.footerProgramSHA256,profile.footer.programSHA256)
 assert.equal(result.browserEquivalenceComplete,false)
 assert.equal(result.sourceScopeComplete,false)
})

for(const mode of ['parent-program','footer-program','tenant','loader-target','parent-location'])test('Pocket FM current finite binding rejects '+mode,async()=>{
 await assert.rejects(verify((url,body)=>{
  if(mode==='parent-program'&&url===profile.parent.url)return body+';globalThis.unreviewed=true'
  if(mode==='footer-program'&&url===profile.footer.url)return body+';globalThis.unreviewed=true'
  if(mode==='tenant'&&url===profile.footer.url)return body.replaceAll('https://jobs.lever.co/pocketfm','https://jobs.lever.co/other-employer')
  if(mode==='loader-target'&&url===profile.parent.url)return body.replace('t(516114)','t(999999)')
  if(mode==='parent-location'&&url===HOME)return body.replaceAll('3q0o4sc327_v9.js','unreviewed-parent.js')
  return body
 }),/binding|program|original|current/i)
})

test('Pocket FM exact current tuple also rejects normalized-away debug metadata changes',async()=>{
 await assert.rejects(verify((url,body)=>url===profile.parent.url
  ?body.replaceAll('3c586a10-9716-1190-486a-c4ba4c9ad2b4','11111111-1111-4111-8111-111111111111'):body),/unreviewed parent program/)
})

test('Pocket FM current19 original responses retain two complete India roles and all native scope holds',async t=>{
 const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
 let index=0
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const packet=capture.requests[index++]
  assert.ok(packet,'No uncaptured native request')
  assert.equal(String(url),packet.requestedURL)
  assert.equal(init.method??'GET','GET')
  assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  return Object.defineProperty(new Response(bytes,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 })
 const jobs=await run()
 assert.equal(index,19)
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceScopeComplete===false))
 assert.ok(jobs.every(job=>job.jobDescription.includes('artificial intelligence')))
 const nativeInventory=JSON.parse(Buffer.from(capture.requests.find(packet=>packet.requestedURL.startsWith('https://api.lever.co/')).bodyBase64,'base64').toString('utf8'))
 assert.equal(nativeInventory.length,13)
 assert.equal(readSourceObservationEvidence(jobs,'pocketfm').observedRecordCount,nativeInventory.length)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.deepEqual(jobs.nativeCollectionEvidence.failures,[])
})
