import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from './script.js'
const rows=['official-pages','linkedin-pages','webbtree-pages','webbtree-company-client','webbtree-api'].flatMap(name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url)))))
test('Lido actual receipt cannot certify company emptiness from repurposed corporate domain',async()=>{
 await assert.rejects(run({fetchImpl:async (url,request)=>{const row=rows.find(r=>r.url===url);assert.ok(row);if(row.requestHeaders)assert.equal(request.headers.customurl,row.requestHeaders.customurl);if(row.requestBody){assert.equal(request.method,'POST');assert.deepEqual(JSON.parse(request.body),row.requestBody)}const r=new Response(row.body,{status:row.status});Object.defineProperty(r,'url',{value:row.finalUrl});return r}}),error=>{
  assert.equal(error.code,'LIDOLEARNING_COVERAGE_GAP')
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.retainedResponses[0].body,rows[0].body)
  assert.equal(error.retainedResponses.length,8)
  assert.equal(error.nativeCollectionEvidence.nativeEmployerId,'14625914')
  assert.deepEqual(error.nativeCollectionEvidence.webbtreeAPIObservations.map(o=>o.status),[401,401])
  assert.deepEqual(error.retainedResponses.filter(r=>r.status===401).map(r=>r.body),['{"message":"Incorrect client"}','{"message":"Incorrect client"}'])
  assert.deepEqual(error.nativeCollectionEvidence.observations.map(o=>o.location),['India','Worldwide'])
  return true
 })
})

test('Lido manifests verify compressed captures and actual response metadata',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 const hash=value=>createHash('sha256').update(value).digest('hex')
 for(const file of manifest.files){const bytes=fs.readFileSync(new URL('./fixtures/'+file.file,import.meta.url));assert.equal(hash(bytes),file.sha256);assert.equal(hash(gunzipSync(bytes)),file.uncompressedSHA256)}
 for(const row of manifest.responses){const records=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+row.file,import.meta.url))));const actual=records.find(r=>r.url===row.url);assert.ok(actual);assert.equal(actual.status??null,row.status);assert.equal(actual.finalUrl??null,row.finalUrl);assert.equal(typeof actual.body==='string'?hash(actual.body):null,row.bodySHA256)}
})

test('Lido native scope, employer identity and new role metadata drift stay coverage gaps',async()=>{
 const mutations=[
  row=>row.body.replaceAll('urn:li:organization:14625914','urn:li:organization:1'),
  row=>row.body.replaceAll('checked','unchecked'),
  row=>row.url.includes('/jobs/search/')?row.body.replace('</body>','<div class="job-search-card">Opening</div></body>'):row.body,
  ...['<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23","addressCountry":"IN"}</script>','<time datetime="2026-10-23">Today</time>','<meta itemprop="validThrough" content="2026-11-01">'].map(markup=>row=>row.url.includes('/jobs/search/')?row.body.replace('</body>',markup+'</body>'):row.body),
 ]
 for(const mutate of mutations)await assert.rejects(run({fetchImpl:async url=>{const row=rows.find(r=>r.url===url);assert.ok(row);const r=new Response(mutate(row),{status:row.status});Object.defineProperty(r,'url',{value:row.finalUrl});return r}}),error=>error.code==='LIDOLEARNING_COVERAGE_GAP'&&error.nativeCollectionEvidence===undefined)
})
