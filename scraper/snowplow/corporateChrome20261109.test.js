import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/corporate-chrome-20261109.json.gz',import.meta.url))))
const archived=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261106-evening.json.gz',import.meta.url))))
const current=capture.packet,corporate='https://snowplow.io/careers',board='https://snowplow.careers.hibob.com/'
const source=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='snowplow'))
assert.equal(sha(current.body),current.sha256)
const response=body=>({status:current.status,url:current.finalUrl,contentType:current.contentType,body})

test('current three marketing edits admit the unchanged raw corporate response while a subsequent native HTTP denial remains held',async()=>{
 const calls=[]
 await assert.rejects(source().run({fetchPage:async url=>{
  calls.push(url)
  if(url===corporate)return response(current.body)
  assert.equal(url,board)
  return{status:403,url,contentType:'text/html',body:'Denied'}
 }}),error=>{
  assert.equal(error.code,'SNOWPLOW_HTTP_ERROR')
  assert.equal(error.status,403)
  assert.equal(error.nativeEvidence.retainedNativeResponses[0].response.body,current.body)
  assert.equal(error.nativeEvidence.corporateDOMEquivalences.length,1)
  assert.equal(error.nativeEvidence.corporateDOMEquivalences[0].originalBodySha256,current.sha256)
  assert.equal(error.nativeEvidence.corporateDOMEquivalences[0].reviewedBodySha256,sha(archived.packets.find(p=>p.requestUrl===corporate).body))
  assert.equal(error.nativeEvidence.corporateDOMEquivalences[0].evidence.snapshotSha256,sha(fs.readFileSync(new URL('./test-data/corporate-chrome-20261109.json.gz',import.meta.url))))
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  return true
 })
 assert.deepEqual(calls,[corporate,board])
})

test('DERIVED unreviewed HiBob runtime filename remains held with unknown inventory and no native API admission',async()=>{
 const native=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/unreviewed-board-20261109.json.gz',import.meta.url))))
 assert.equal(sha(native.packet.response.body),native.bodySHA256)
 const changed={...native.packet.response,body:native.packet.response.body.replace('runtime.f4b99bac6c49fcce.js','runtime.0000000000000000.js')}
 assert.notEqual(changed.body,native.packet.response.body)
 const calls=[]
 await assert.rejects(source().run({fetchPage:async url=>{
  calls.push(url)
  if(url===corporate)return response(current.body)
  assert.equal(url,board)
  return changed
 }}),error=>{
  assert.equal(error.code,'SNOWPLOW_NATIVE_INCOMPLETE')
  assert.equal(error.cause.code,'SNOWPLOW_NATIVE_UNREVIEWED')
  assert.equal(error.cause.requestUrl,board)
  assert.equal(error.nativeEvidence.nativeInventoryCount,null)
  assert.equal(error.nativeEvidence.sourceScopeComplete,false)
  assert.equal(error.nativeEvidence.cleanupAllowed,false)
  assert.equal(error.nativeEvidence.corporateDOMEquivalences.length,1)
  assert.equal(error.retainedNativeResponses[1].response.body,changed.body)
  assert.equal(error.inventoryEvidence.status,'coverage-gap')
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:error.inventoryEvidence}),{replaceExisting:false})
  return true
 })
 assert.deepEqual(calls,[corporate,board])
})

test('DERIVED current corporate plus archived native replay retains the known corporate mismatch and never certifies live or empty inventory',async()=>{
 let audit
 const jobs=await source().run({onAudit:value=>{audit=value},fetchPage:async url=>{
  if(url===corporate)return response(current.body)
  const packet=archived.packets.find(p=>p.requestUrl===url)
  assert.ok(packet,'Only captured native endpoints: '+url)
  assert.equal(sha(packet.body),packet.sha256)
  return{status:packet.status,url:packet.url,contentType:packet.contentType,body:packet.body}
 }})
 const evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeInventoryCount,11)
 assert.equal(audit.detailProofs.length,11)
 assert.ok(audit.detailProofs.every(p=>p.rawOpening&&p.rawClosing))
 assert.match(audit.gaps.join(';'),/corporate\/native inventory identity mismatch/)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.cleanupAllowed,false)
 assert.equal(audit.corporateDOMEquivalences.length,3)
 assert.ok(audit.receipts.filter(p=>p.url===corporate).every(p=>p.response.body===current.body))
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.notEqual(evidence.status,'verified-empty')
 assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
})

const adobe='<a href="/comparisons/snowplow-vs-adobe" class="footer1_link">vs. Adobe</a>'
for(const[label,mutate]of[
 ['extra hiding style',s=>s.replace('</head>','<style>#rlist{display:none}</style></head>')],
 ['new active program',s=>s.replace('</body>','<script src="https://unknown.example/jobs.js"></script></body>')],
 ['changed program activation',s=>s.replace('<script','<script type="text/plain"')],
 ['extra active hiring channel',s=>s.replace('</body>','<a href="https://jobs.lever.co/other">India careers</a></body>')],
 ['extra inert hiring channel',s=>s.replace('</body>','<template><a href="https://jobs.lever.co/other">India careers</a></template></body>')],
 ['extra criteria carrier',s=>s.replace('</body>','<script type="application/json">{"mandatoryQualification":true}</script></body>')],
 ['extra form control',s=>s.replace('</body>','<form action="/careers/apply"><button>Apply</button></form></body>')],
 ['extra frame',s=>s.replace('</body>','<iframe src="https://unknown.example/jobs"></iframe></body>')],
 ['modified corporate card count',s=>s.replace(/(<ul\b[^>]*\bid="rlist"[^>]*>)/,'$1<li data-role="extra">Unreviewed role</li>')],
 ['modified corporate country metadata',s=>s.replace(/data-l="[^"]*"/,'data-l="India"')],
 ['changed comparison link identity',s=>s.replace(adobe,adobe.replace('/comparisons/snowplow-vs-adobe','/careers/extra-jobs'))],
 ['changed comparison link activation',s=>s.replace(adobe,adobe.replace('class="footer1_link"','class="footer1_link" onclick="apply()"'))],
 ['comparison anchor moved outside its exact footer siblings',s=>s.replace(adobe,'').replace('</body>',adobe+'</body>')],
 ['duplicate marketing marker',s=>s.replace('</body>','<div class="pm-label pm-next">Real-time &amp; agentic</div></body>')],
 ['only a subset of observed marketing changes',s=>s.replace('Real-Time &amp; Agentic','Real-Time')],
])test('exact corporate equivalence rejects '+label+' before native board admission',async()=>{
 const changed=mutate(current.body),calls=[]
 assert.ok(changed!==current.body,'Mutation must change the original body')
 await assert.rejects(source().run({fetchPage:async url=>{calls.push(url);assert.equal(url,corporate);return response(changed)}}),error=>error.code==='SNOWPLOW_NATIVE_INCOMPLETE'&&error.cause?.code==='SNOWPLOW_NATIVE_UNREVIEWED')
 assert.deepEqual(calls,[corporate])
})

test('reviewed corporate marketing equivalence preserves request bounds and opaque cancellation',async()=>{
 const calls=[]
 await assert.rejects(source().run({maxRequests:1,fetchPage:async url=>{calls.push(url);return response(current.body)}}),error=>error.code==='SNOWPLOW_REQUEST_BUDGET')
 assert.deepEqual(calls,[corporate])
 const controller=new AbortController(),reason=Object.freeze({caller:'Snowplow marketing guard'})
 await assert.rejects(source().run({signal:controller.signal,fetchPage:async()=>{controller.abort(reason);return response(current.body)}}),error=>error===reason)
})
