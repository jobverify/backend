import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import run from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261117.json.gz',import.meta.url))))
test('current corporate original still advertises its native account but does not supply the reviewed visibility stylesheet',()=>{
 const packet=fixture.responses[0],bytes=Buffer.from(packet.bodyBase64,'base64'),doc=readNativeDocument(bytes.toString('utf8'))
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
 assert.equal(packet.status,200);assert.equal(packet.finalURL,'https://www.trimble.com/en/careers')
 assert.equal(doc.nodes(n=>n.tag==='style').length,0)
 assert.equal(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='https://trimblecareers.trimble.com/jobs').length,2)
})
test('current default native reader retains the corporate visibility hold before any account or detail acquisition',async()=>{
 const reads=[];await assert.rejects(run({now:'2026-11-16T21:25:00.000Z',fetchImpl:async url=>{
  reads.push(url);assert.equal(url,'https://www.trimble.com/en/careers')
  const p=fixture.responses[0],response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalURL});return response
 }}),/corporate responsive stylesheet\/handoff contract changed/)
 assert.equal(reads.length,1)
})
test('independently observed current native pages have coherent182unique raw IDs without resolving corporate authority or role criteria',()=>{
 const {pages,rows,queue}=fixture.nativePages
 assert.equal(pages.length,19);assert.equal(rows.length,182);assert.equal(new Set(rows.map(r=>r.requisitionID)).size,182)
 assert.ok(pages.every(p=>p.total===182&&Object.keys(p.params.filter).length===0));assert.deepEqual(queue,[])
 assert.ok(rows.some(r=>r.locations.some(l=>l.country==='India'&&l.countryAbbr==='IN')))
})
