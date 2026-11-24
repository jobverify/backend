import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {run as runPrimary,CAREERS_URL,API} from './currentNative20261121.js'

const SOURCE='huntress',COUNT=49,PROGRAMME_READS=6
// Original current corporate/board/API bodies; unlike current-api's corporate
// derivative, this fixture retains the original anonymous experiment bytes.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-deployment-20261121.json.gz',import.meta.url))))
const packets=fixture.packets
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
for(const packet of packets){assert.equal(packet.bodyOriginalUnmodified,true);assert.equal(sha(Buffer.from(packet.bodyBase64,'base64')),packet.sha256)}
const originalAPI=JSON.parse(Buffer.from(packets.find(p=>p.requestedURL===API).bodyBase64,'base64'))
const registered=options=>createCatalogScraper(getScraperCatalog().find(p=>p.source===SOURCE)).run(options)
const replay=(change=()=>{})=>{
 const calls=[],counts=new Map()
 return {calls,fetchImpl:async value=>{
  const url=String(value),visit=(counts.get(url)??0)+1;counts.set(url,visit);calls.push(url)
  const original=packets.find(p=>p.requestedURL===url&&p.kind!=='page2')
  assert.ok(original,'Only retained declared programme responses: '+url)
  const packet={...original,headers:{...original.headers},body:Buffer.from(original.bodyBase64,'base64').toString('utf8')}
  change(packet,url,visit,calls.length)
  return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url??packet.finalURL})
 }}
}
const options=r=>({fetchImpl:r.fetchImpl,sourceTimeoutMs:30000,requestTimeoutMs:5000,requestIntervalMs:0})

test('registered zero bridges the complete original primary payload to the independently closed finite programme',async()=>{
 const r=replay(),jobs=await registered(options(r)),audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(inventory.status,'complete-inventory');assert.equal(inventory.reportedTotal,COUNT)
 assert.equal(inventory.indiaFacetCount,0);assert.equal(inventory.listingComplete,true);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(audit.priorNativePayloadReconciled,true);assert.deepEqual(audit.priorNativeObservation.nativePayload,originalAPI)
 assert.deepEqual(audit.nativePayload,originalAPI);assert.equal(audit.programmeRequestCount,PROGRAMME_READS)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalScopeQualified,false)
 assert.equal(audit.ownRolePagesAcquired,false);assert.equal(audit.ownRoleSchemaAcquired,false);assert.equal(audit.applicationScreeningAcquired,false)
 assert.equal(audit.legalRegistryIdentityVerified,false);assert.equal(audit.totalPublicRequests,null)
 assert.equal(r.calls.length,4+PROGRAMME_READS)
})

test('primary runtime cannot accept new corporate hiring criteria behind an unchanged title and tenant',async()=>{
 const r=replay((packet,url)=>{if(url===CAREERS_URL)packet.body=packet.body.replace('</body>','<p>All positions now require an additional certification.</p></body>')})
 await assert.rejects(runPrimary(options(r)),/corporate|programme|authority/i)
 assert.equal(r.calls.length,1,'Corporate authority is checked before any native observation is qualified')
})

test('primary closing corporate authority cannot discard changed conditions while retaining both raw observations',async()=>{
 const r=replay((packet,url,visit)=>{if(url===CAREERS_URL&&visit===2)packet.body=packet.body.replace('</body>','<p>Applicants must now reside in India.</p></body>')})
 await assert.rejects(runPrimary(options(r)),error=>{
  assert.equal(error.recruitmentObservations.wholeNativeRoleModelsClosingReconciled,false)
  assert.ok(error.recruitmentObservations.nativeClosing.corporateResponse.body.includes('Applicants must now reside in India.'))
  return /corporate|programme|authority/i.test(error.message)
 })
 assert.equal(r.calls.length,3)
})

test('registered bridge rejects a criterion present in both primary reads but absent from the later programme',async()=>{
 const r=replay((packet,url,visit)=>{if(url===API&&visit<=2){const value=JSON.parse(packet.body);value.jobs[0].content+='&lt;p&gt;Additional certification is mandatory.&lt;/p&gt;';packet.body=JSON.stringify(value)}})
 await assert.rejects(registered(options(r)),error=>{
  assert.match(error.message,/Earlier native criteria, identities or countries changed/)
  assert.equal(error.nativeCollectionEvidence.priorNativePayloadReconciled,false)
  assert.ok(error.nativeCollectionEvidence.priorNativeObservation.nativePayload.jobs[0].content.includes('Additional certification is mandatory.'))
  assert.deepEqual(error.nativeCollectionEvidence.nativePayload,originalAPI);return true
 })
 assert.equal(r.calls.length,4+PROGRAMME_READS)
})

test('registered zero remains held when the independently acquired native programme has unreviewed security',async()=>{
 const r=replay((packet,url)=>{if(url!==CAREERS_URL&&url!==API)packet.headers['content-security-policy']="default-src 'none'"})
 await assert.rejects(registered(options(r)),/security|profile|deployment/i)
 assert.ok(r.calls.length>4)
})

test('registered programme path preserves an exact opaque caller cancellation after the primary has returned',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'registered-programme-boundary'})
 const r=replay((_packet,_url,_visit,ordinal)=>{if(ordinal===5)controller.abort(reason)})
 await assert.rejects(registered({...options(r),signal:controller.signal}),error=>error===reason)
 assert.equal(r.calls.length,5)
})

test('default registered rejection preserves source authority without a generic alternate acquisition',async t=>{
 const r=replay((packet,url)=>{if(url===CAREERS_URL)packet.body=packet.body.replace('</body>','<p>Applicants must now reside in India.</p></body>')})
 t.mock.method(globalThis,'fetch',r.fetchImpl)
 await assert.rejects(registered({sourceTimeoutMs:15000,requestTimeoutMs:5000,requestIntervalMs:0}),error=>error.code==='HUNTRESS_PROGRAMME_HOLD')
 assert.equal(r.calls.length,1,'Default registration must preserve the qualified reader\'s rejection contract')
})
