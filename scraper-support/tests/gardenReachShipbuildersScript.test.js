import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {hasOfficialPortalIndexSignal,extractPortalNotices,createGardenReachShipbuildersScraper} from '../../scraper/gardenreachshipbuilders/script.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/gardenreachshipbuilders/test-data/native-20261110.json.gz',import.meta.url))))
const body=n=>Buffer.from(fixture.packets[n-1].bodyBase64,'base64')
const text=n=>body(n).toString('utf8')
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
function replay(mutate=(p,bytes)=>bytes){
 const queues=new Map(fixture.packets.map(p=>[p.requestedURL,[p]])),calls=[]
 return {calls,queues,fetchImpl:async(target,init)=>{
  const packet=queues.get(target)?.shift();assert.ok(packet,'No genuine original occurrence left for '+target)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.bodySHA256)
  calls.push(target)
  const response=new Response(mutate(packet,bytes),{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }}
}

test('Garden Reach Shipbuilders recognizes current genuine native indices as4and11notice observations without inventing job IDs',()=>{
 assert.equal(hasOfficialPortalIndexSignal(text(2),{portalYear:'2026'}),true)
 assert.equal(hasOfficialPortalIndexSignal(text(4),{portalYear:'2025'}),true)
 const current=extractPortalNotices(text(2),{portalIndexUrl:fixture.packets[1].finalURL}),prior=extractPortalNotices(text(4),{portalIndexUrl:fixture.packets[3].finalURL})
 assert.equal(current.length,4);assert.equal(prior.length,11)
 assert.equal(current[0].notificationId,'2026/05(J&OP)');assert.equal(current[0].closingDate,'2026-11-28T00:00:00.000Z')
 assert.equal(prior[0].closingDate,'2026-01-30T00:00:00.000Z')
 assert.ok([...current,...prior].every(n=>n.recordKind==='native-recruitment-notice'&&n.nativeJobId===null&&n.nativeRequisitionId===null&&!n.title.includes('Last date')))
})

test('Garden Reach Shipbuilders genuine five-body run retains one active group notice at PDF capability or individual-role-country hold',async()=>{
 const r=replay()
 await assert.rejects(createGardenReachShipbuildersScraper({asOfDate:'2026-11-10'}).run(r),error=>{
  const n=error.nativeEvidence;assert.equal(n.observedListingCount,1);assert.equal(n.candidateListingRecords[0].notificationId,'2026/05(J&OP)')
  assert.equal(n.candidateListingRecords[0].nativeJobId,null);assert.equal(n.candidateListingRecords[0].nativeRequisitionId,null)
  assert.equal(n.indexNoticeObservations[0].notices.length,4);assert.equal(n.indexNoticeObservations[1].notices.length,11)
  assert.equal(n.transportPackets.length,5);assert.equal(n.retainedResponses.length,5);assert.deepEqual(n.jobs,[])
  for(const packet of n.retainedResponses){const original=fixture.packets.find(p=>p.requestedURL===packet.requestedURL);assert.equal(packet.bodySHA256,original.bodySHA256);assert.equal(packet.rawBodyBase64,original.bodyBase64)}
  for(const key of ['inventoryComplete','sourceScopeComplete','lifecycleCleanupAllowed'])assert.equal(n[key],false)
  assert.equal(n.companyIndiaTotal,null);assert.equal(n.companyGlobalTotal,null)
  if(n.documentObservation){
   assert.equal(n.failures[0].stage,'individual-role-country-contract');assert.equal(n.documentObservation.recordKind,'native-recruitment-document-observation')
   assert.equal(n.documentObservation.rawNoticePDFTextSHA256,fixture.localExtractedPDF.textSHA256)
   for(const key of ['country','nativeJobId','nativeRequisitionId','jobDescription','individualVacancyCount'])assert.equal(n.documentObservation[key],null)
   assert.equal(n.documentObservation.individualRoleRecordsParsed,false);assert.equal(n.documentObservation.sourceDetailComplete,false)
  }else{
   assert.equal(n.failures[0].stage,'native-pdf-extraction');assert.match(error.message,/DOMMatrix is not defined|native|addon|permission/i)
  }
  assert.equal(extractionFailureDetails(error).failureEvidence.observedListingCount,1)
  return true
 })
 assert.deepEqual(r.calls,[fixture.packets[0].requestedURL,fixture.packets[1].requestedURL,fixture.packets[3].requestedURL,fixture.packets[2].requestedURL,fixture.packets[4].requestedURL])
 assert.ok([...r.queues.values()].every(queue=>queue.length===0))
})

test('Garden Reach Shipbuilders future zero-active-notice result is a held observation, never verified empty jobs',async()=>{
 const r=replay()
 await assert.rejects(createGardenReachShipbuildersScraper({asOfDate:'2027-01-01'}).run(r),error=>{
  assert.match(error.message,/active notice set changed/);assert.equal(error.nativeEvidence.observedListingCount,0);assert.equal(error.nativeEvidence.inventoryComplete,false);assert.equal(error.nativeEvidence.lifecycleCleanupAllowed,false);assert.equal(error.nativeEvidence.sourceScopeComplete,false);return true
 });assert.equal(r.calls.length,3)
})

test('Garden Reach Shipbuilders actual native index drift fails closed before any detail/PDF request',async()=>{
 const r=replay((packet,bytes)=>packet.requestedURL===fixture.packets[1].requestedURL?Buffer.from(bytes.toString('utf8').replace('Welcome to Online Application in GRSE - 2026','Unrelated publisher')):bytes)
 await assert.rejects(createGardenReachShipbuildersScraper({asOfDate:'2026-11-10'}).run(r),error=>{
  assert.match(error.message,/portal year publisher changed/);assert.equal(error.nativeEvidence.observedListingCount,null);assert.equal(error.nativeEvidence.inventoryComplete,false);return true
 });assert.equal(r.calls.length,2)
})

test('Garden Reach Shipbuilders text-only listing/PDF callbacks cannot supply current proof or fall through to network',async()=>{
 let calls=0
 await assert.rejects(createGardenReachShipbuildersScraper().run({fetchText:async()=>text(2),fetchDocumentText:async()=>fixture.localExtractedPDF.text,fetchImpl:()=>{calls++;throw Error('Unexpected live request')}}),/unverified legacy text.PDF callbacks/)
 assert.equal(calls,0)
})
