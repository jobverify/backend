import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {inspectCareers,runNative,CAREERS} from './native20261111.js'
const fixture=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))))
const first=fixture('hard-rupeek-current-20261116.json.gz').packets[0]
const alternatives=fixture('rupeek-current-canonical-originals.json.gz').packets
const text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
for(const p of [first,...alternatives])test('current original publisher metadata remains held: '+p.requestedURL,()=>{
 const raw=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(raw).digest('hex'),p.sha256)
 const doc=readNativeDocument(text(p));assert.equal(doc.nodes(n=>n.tag==='title').length,0)
 assert.equal(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').length,0)
 assert.throws(()=>inspectCareers(text(p)),/unique active publisher title required/)
})
test('current own Careers handoff is explicit but its SEO configuration is still inert data',()=>{
 const d=readNativeDocument(text(first));assert.ok(d.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers?city=undefined').some(n=>d.text(n)==='Careers'))
 const query=text(alternatives[1]);assert.ok(query.includes('Join our team | Rupeek | Careers'))
 assert.throws(()=>inspectCareers(query),/publisher title/)
})
test('default current source fails before details and keeps original evidence instead of reporting empty inventory',async()=>{
 let reads=0
 await assert.rejects(runNative({fetchImpl:async url=>{reads++;assert.equal(url,CAREERS);const r=new Response(Buffer.from(first.bodyBase64,'base64'),{status:200,headers:first.headers});Object.defineProperty(r,'url',{value:url});return r}}),e=>{
  assert.match(e.message,/publisher title/);assert.equal(e.abortRetries,true)
  assert.equal(e.nativeEvidence.inventoryComplete,false);assert.equal(e.nativeEvidence.lifecycleCleanupAllowed,false)
  assert.equal(e.nativeEvidence.jobs,null);assert.equal(e.nativeEvidence.transportPackets[0].bodySHA256,first.sha256);return true
 })
 assert.equal(reads,1)
})
