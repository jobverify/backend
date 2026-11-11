import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {HOME,extractJobCards} from '../scraper/cyraac/nativeRole.js'

// Actual historical collection bodies. Their original transport headers were
// unavailable, so replay only the explicit text hook; never invent Responses.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/cyraac-historical-collection-20261111.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/cyraac-current-header-20261111.json.gz',import.meta.url))))
const ownURL='https://cyraacs.com/job-description-technical-architect/'
const provider=getScraperCatalog().find(row=>row.source==='cyraac')
const registered=()=>buildScrapers().find(row=>row.name==='cyraac')
const replay=(failureAt=-1)=>{
 const calls=[]
 return {calls,fetchText:async url=>{
  const index=calls.length,packet=fixture.packets[index]
  assert.ok(packet,'Replay cannot read beyond the actual historical transaction')
  assert.equal(url,packet.requestedURL)
  assert.equal(packet.finalURL,null);assert.equal(packet.headers,null)
  assert.equal(createHash('sha256').update(packet.bodyText).digest('hex'),packet.bodySHA256)
  calls.push({url,phase:packet.phase})
  if(index===failureAt)throw Object.assign(Error('Explicit simulated historical replay transport failure'),{abortRetries:true})
  return packet.bodyText
 }}
}
const run=async(t,failureAt=-1)=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('Offline registered replay must not access the network'))
 assert.equal(fixture.fullCollectionTransaction,true)
 assert.equal(fixture.packets.length,30)
 assert.equal(registered().provider.source,'cyraac')
 const r=replay(failureAt)
 const jobs=await registered().run({fetchText:r.fetchText,minIntervalMs:0,now:fixture.collectionClock})
 return {...r,jobs}
}

// Explicitly simulated four-read protocol: derive a single-card index from
// the current actual index, then simulate its missing closing. The own-role
// packets and their headers are genuine. This is not current collection proof.
const simulated=async(t,{failureAt=-1,unsafeIndexAt=-1}={})=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('Offline registered control cannot access the network'))
 assert.equal(current.fullCollectionTransaction,false)
 let index=current.packets[0].bodyText
 for(const url of new Set(extractJobCards(index).map(row=>row.sourceUrl).filter(url=>url!==ownURL)))index=index.split(url).join(HOME)
 assert.equal(extractJobCards(index).length,1)
 const sequence=[{...current.packets[0],bodyText:index},current.packets[1],current.packets[2],{...current.packets[0],bodyText:index}]
 const calls=[]
 const fetchImpl=async(url,init)=>{
  const number=calls.length,packet=sequence[number]
  assert.ok(packet,'No additional simulated request is allowed')
  assert.equal(url,packet.requestedURL)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  calls.push({url,simulatedIndex:number===0||number===3})
  if(number===failureAt)throw Object.assign(Error('Explicit simulated closing transport failure'),{abortRetries:true})
  const headers=new Headers(packet.headerEntries??packet.headers)
  if(number===unsafeIndexAt)headers.set('refresh','0;url=https://unrelated-employer.example/careers')
  const response=new Response(packet.bodyText,{status:packet.status,headers})
  Object.defineProperty(response,'url',{value:url})
  return response
 }
 const jobs=await registered().run({fetchImpl,minIntervalMs:0,now:current.packets[2].completedAt})
 return {jobs,calls}
}

test('registered historical CYRAAC text replay withholds header India without original HTTP metadata and retains its evidence',async t=>{
 const {jobs,calls}=await run(t)
 assert.equal(calls.length,30)
 assert.equal(jobs.length,13)
 assert.equal(jobs.some(job=>job.country==='India'),false)
 assert.equal(jobs.filter(job=>job.country===null).length,13)
 assert.ok(jobs.every(job=>job.nativeRoleClosingReconciled===true))
 assert.equal(jobs[0].sourceNativeCollectionAudit.responses.length,30)
 assert.ok(jobs[0].sourceNativeCollectionAudit.responses.every(row=>row.httpMetadataVerified===false&&row.status===null))
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory.status,'coverage-gap')
 assert.equal(inventory.firstParty,true)
 assert.equal(inventory.listingComplete,false)
 assert.equal(inventory.indiaFacetCount,null)
 const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows.find(row=>row.id==='job-description-technical-architect')
 assert.ok(held,'Withheld transport-unknown country evidence must remain in the native audit')
 assert.equal(held.opening.rawHTML,fixture.packets.find(row=>row.phase==='opening-role'&&row.requestedURL===ownURL).bodyText)
 assert.equal(held.closing.rawHTML,fixture.packets.find(row=>row.phase==='closing-role'&&row.requestedURL===ownURL).bodyText)
})

test('simulated current-header registered CYRAAC cycle preserves India criteria and native unknowns after all closing reads',async t=>{
 const {jobs,calls}=await simulated(t),job=jobs.find(row=>row.country==='India')
 assert.equal(calls.length,4);assert.equal(jobs.length,1)
 assert.equal(job.nativeRoleClosingReconciled,true)
 assert.deepEqual(job.nativeSourceRecord,job.nativeClosingRecord)
 const opening=current.packets[1],closing=current.packets[2]
 const normalized=normalizeScrapedJob(job,provider)
 assert.equal(job.sourceRawNativeHTML,opening.bodyText)
 assert.equal(job.sourceClosingRawNativeHTML,closing.bodyText)
 assert.equal(job.sourceDescription,job.nativeSourceRecord.ownRoleText)
 assert.ok(job.sourceDescription.includes('Java'))
 assert.equal(normalized.sourceDescription,job.sourceDescription)
 assert.equal(normalized.sourceRawNativeHTML,opening.bodyText)
 assert.equal(normalized.sourceClosingRawNativeHTML,closing.bodyText)
 assert.equal(normalized.country,'India')
 assert.deepEqual(normalized.countryEvidence,job.countryEvidence)
 assert.equal(normalized.nativeSourceRecord.ownHeaderCountry.originalText,'Bangalor/ India/Full-time')
 assert.equal(job.city,null)
 assert.equal(job.postingDate,null)
 assert.equal(normalized.employerPostedAt,null)
 assert.equal(normalized.sourcePublicationDateUnavailable,true)
 assert.equal(normalized.sourceRemoteStatusUnresolved,true)
 assert.equal(normalized.remoteStatus,null)
 assert.equal(normalized.legalEmployer,null)
 assert.equal(normalized.nativeHiringOrganization,null)
 assert.equal(normalized.sourceDetailComplete,false)
 assert.equal(normalized.sourceDetailStatus,'partial')
 assert.equal(normalized.sourceScopeComplete,false)
 assert.equal(normalized.lifecycleCleanupAllowed,false)
 assert.equal(normalized.applicationVisited,false)
 assert.equal(normalized.activeApplyVerified,false)
})

test('simulated registered CYRAAC withholds India when the final listing closing request fails',async t=>{
 const {jobs,calls}=await simulated(t,{failureAt:3})
 assert.equal(calls.length,4)
 assert.equal(jobs.length,0)
 assert.equal(jobs.some(job=>job.country==='India'),false)
 assert.equal(jobs.some(job=>job.nativeSourceRecord?.ownHeaderCountry),false)
 assert.ok(jobs.every(job=>job.nativeRoleClosingReconciled===false))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('simulated registered CYRAAC withholds India if the own closing request fails',async t=>{
 const {jobs,calls}=await simulated(t,{failureAt:2})
 assert.equal(calls.length,3)
 assert.equal(jobs.length,0)
 assert.equal(jobs.some(job=>job.country==='India'),false)
 assert.equal(jobs.some(job=>job.nativeSourceRecord?.ownHeaderCountry),false)
 assert.ok(jobs.every(job=>job.nativeRoleClosingReconciled===false))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const unsafeIndexAt of [0,3])test('simulated registered CYRAAC withholds India with unsafe '+(unsafeIndexAt===0?'opening':'closing')+' index headers',async t=>{
 const {jobs,calls}=await simulated(t,{unsafeIndexAt})
 assert.equal(calls.length,4)
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
