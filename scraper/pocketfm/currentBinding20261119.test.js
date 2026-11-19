import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {verifyPocketClientBinding} from './currentClientBinding.js'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-binding-20261119.json.gz',import.meta.url))))
const profile=JSON.parse(readFileSync(new URL('./reviewedBinding20261119.json',import.meta.url)))
const packets=new Map(capture.packets.map(packet=>{
 const bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(bytes.length,packet.bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
 return[packet.requestedUrl,bytes.toString('utf8')]
}))
const HOME='https://pocketfm.com/'
const verify=(edit=(_url,body)=>body)=>verifyPocketClientBinding(edit(HOME,packets.get(HOME)),async url=>{
 assert.ok(packets.has(url),'Only declared original current public programs '+url)
 return edit(url,packets.get(url))
})

test('Pocket FM current 19-response imported workflow recovers qualified India criteria with configured board completeness only',async t=>{
 const workflow=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
 let index=0
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const packet=workflow.responses[index++]
  assert.ok(packet,'No undeclared native reads')
  assert.equal(String(url),packet.requestedURL)
  assert.equal(init.method??'GET','GET')
  assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
  return Object.defineProperty(new Response(bytes,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 })
 const jobs=await run()
 assert.equal(index,19)
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceScopeComplete===false))
 const assessed=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='pocketfm'),jobs)
 assert.equal(assessed.eligibleJobs,1)
 assert.equal(assessed.runnerOutcome.success,true)
 assert.equal(readSourceObservationEvidence(jobs,'pocketfm').observedRecordCount,12)
 assert.equal(readSourceObservationEvidence(jobs,'pocketfm').sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.deepEqual(jobs.nativeCollectionEvidence.failures,[])
})

test('Pocket FM current exact whole compiler tuple binds its unchanged native footer with company scope held',async()=>{
 const result=await verify()
 assert.equal(result.parentURL,profile.parent.url)
 assert.equal(result.childURL,profile.footer.url)
 assert.equal(result.footerProgramSHA256,profile.footer.programSHA256)
 assert.equal(result.browserEquivalenceComplete,false)
 assert.equal(result.sourceScopeComplete,false)
})

for(const mode of ['parent-program','footer-program','tenant','loader-target','parent-location','debug-metadata'])test('Pocket FM current exact tuple rejects '+mode,async()=>{
 await assert.rejects(verify((url,body)=>{
  if(mode==='parent-program'&&url===profile.parent.url)return body+';globalThis.unreviewed=true'
  if(mode==='footer-program'&&url===profile.footer.url)return body+';globalThis.unreviewed=true'
  if(mode==='tenant'&&url===profile.footer.url)return body.replaceAll('https://jobs.lever.co/pocketfm','https://jobs.lever.co/other-employer')
  if(mode==='loader-target'&&url===profile.parent.url)return body.replace('t(516114)','t(999999)')
  if(mode==='parent-location'&&url===HOME)return body.replaceAll('3flf9090qt7wy.js','unreviewed-parent.js')
  if(mode==='debug-metadata'&&url===profile.parent.url)return body.replace('e7128d6e-4ee6-4fe0-f2f4-c960a78519e3','11111111-1111-4111-8111-111111111111')
  return body
 }),/binding|program|original|current/i)
})
