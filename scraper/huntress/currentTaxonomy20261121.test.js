import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {CORPORATE,BOARD,API,nativeBoard,nativeAPI} from './currentProgrammeData.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-taxonomy-20261121.json.gz',import.meta.url))))
const raw=packet=>Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
for(const packet of fixture.packets){assert.equal(packet.bodyOriginalUnmodified,true);assert.equal(sha(Buffer.from(packet.bodyBase64,'base64')),packet.bodySHA256)}
const originalAPI=JSON.parse(raw(fixture.packets.find(p=>p.requestedURL===API)))
const replay=(change=()=>{})=>{
 const calls=[],visits=new Map()
 const run=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='huntress')).run({sourceTimeoutMs:30000,requestTimeoutMs:5000,requestIntervalMs:0,fetchImpl:async value=>{
  const url=String(value),visit=(visits.get(url)??0)+1;visits.set(url,visit);calls.push(url)
  const original=fixture.packets.find(p=>p.requestedURL===url);assert.ok(original,'Only the retained declared current URLs')
  const packet={...original,headers:{...original.headers},body:raw(original)};change(packet,url,visit)
  return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }})
 return {run,calls}
}

test('current original50-role model and rendered taxonomy reconcile every full API record without changing publication fields',()=>{
 const board=nativeBoard(raw(fixture.packets.find(p=>p.requestedURL===BOARD)),fixture.capturedAt)
 const api=nativeAPI(raw(fixture.packets.find(p=>p.requestedURL===API)),board,fixture.capturedAt)
 assert.equal(board.posts.length,50);assert.deepEqual(api.value,originalAPI)
 const added=api.value.jobs.find(job=>job.id===8206934003)
 assert.equal(added.title,'Procurement Specialist');assert.equal(added.location.name,'United States of America')
 assert.equal(added.first_published,'2026-11-20T15:09:55-05:00')
 assert.equal(sha(added.content),'6e3a85111f75f66aafb7e990f5f2c76884828e9ab66e8c5b39319e89f923751b')
})

test('registered current50-role replay closes the full programme and exact primary payload with company and cleanup held',async()=>{
 const r=replay(),jobs=await r.run(),audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(inventory.status,'complete-inventory');assert.equal(inventory.reportedTotal,50)
 assert.equal(inventory.listingComplete,true);assert.equal(inventory.indiaFacetCount,0);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.deepEqual(audit.nativePayload,originalAPI);assert.deepEqual(audit.priorNativeObservation.nativePayload,originalAPI)
 assert.equal(audit.priorNativePayloadReconciled,true);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalScopeQualified,false)
 assert.equal(audit.ownRolePagesAcquired,false);assert.equal(audit.applicationScreeningAcquired,false)
 assert.equal(r.calls.length,10)
})

test('current taxonomy profile does not admit an applied department filter',async()=>{
 const r=replay((p,url)=>{if(url===BOARD){assert.ok(p.body.includes('"departmentIds":[]'));p.body=p.body.replace('"departmentIds":[]','"departmentIds":[4006494003]')}})
 await assert.rejects(r.run(),/scope|filter|config|employer model/)
})

test('current taxonomy model cannot borrow a changed rendered employer or department heading',async()=>{
 const r=replay((p,url)=>{if(url===BOARD){const before=p.body;p.body=p.body.replace('>Accounting</h3>','>Foreign employer hiring</h3>');assert.notEqual(p.body,before)}})
 await assert.rejects(r.run(),/programme|carrier|control|criterion/)
})

test('current taxonomy still requires the exact paired native security policy',async()=>{
 const r=replay((p,url)=>{if(url===BOARD)p.headers['content-security-policy']="default-src 'none'"})
 await assert.rejects(r.run(),/scope|filter|security|profile|deployment|employer model/)
})

test('current taxonomy never promotes an unclosed changed full API criterion to complete inventory',async()=>{
 const r=replay((p,url,visit)=>{if(url===API&&visit===4){const payload=JSON.parse(p.body);payload.jobs[0].content+='&lt;p&gt;New mandatory qualification.&lt;/p&gt;';p.body=JSON.stringify(payload)}})
 await assert.rejects(r.run(),/Closing whole native API payload changed/)
})
