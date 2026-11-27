import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import baselines from './native.scope.json' with {type:'json'}
import {verifyGoogleSitesPublisher} from './publisherChain.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/current-declared.json.gz',import.meta.url))))
const official='https://www.kidvento.com/careers'
function replay(edit=(text)=>text){const calls=[];return{calls,request:async url=>{calls.push(url);const p=fixture.packets.find(p=>p.url===url);assert.ok(p,'Only genuine current publisher declarations: '+url);const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256);return edit(bytes.toString(),url)}}}
test('Kidvento current exact publisher tuple binds its own visible Keka employer without executing programs',async()=>{
 const io=replay(),result=await verifyGoogleSitesPublisher(io.request,baselines.$publisher)
 assert.equal(result.nativeShell,'https://kidvento.keka.com/careers');assert.equal(result.websiteJavaScriptExecuted,false);assert.equal(io.calls.length,4)
 assert.equal(result.controllerSha256,'eea5288944119485a6006f98d3356229832c1ca1bb3f4b2b16415b6f0d0e863a')
})
for(const suffix of ['/m=view','/m=N0NZx','intermediate-frame-minified.html'])test('Kidvento current publisher rejects changed whole '+suffix,async()=>{
 const io=replay((text,url)=>url.endsWith(suffix)?text+';unreviewedEmployerOverride()':text)
 await assert.rejects(verifyGoogleSitesPublisher(io.request,baselines.$publisher),/controller bytes changed|bridge program changed/)
})
for(const[label,edit]of[
 ['foreign employer',s=>s.replaceAll('data-url="https://kidvento.keka.com/careers"','data-url="https://foreign.keka.com/careers"')],
 ['hidden own employer embed',s=>s.replace('data-url="https://kidvento.keka.com/careers"','hidden data-url="https://kidvento.keka.com/careers"')],
 ['data-only client',s=>s.replace('id="base-js"','id="base-js" type="application/json"')],
 ['module client',s=>s.replace('id="base-js"','id="base-js" type="module"')],
 ['inactive client',s=>s.replace('id="base-js"','id="base-js" nomodule')],
 ['changed callback',s=>s.replace('function gapiLoaded() {','function gapiLoaded() {unreviewedEmployerOverride();')],
])test('Kidvento current tuple rejects '+label,async()=>{
 const io=replay((text,url)=>url===official?edit(text):text)
 await assert.rejects(verifyGoogleSitesPublisher(io.request,baselines.$publisher))
})
test('Kidvento current publisher preserves an opaque caller cancellation failure',async()=>{
 const reason=Object.freeze({cancel:'current-publisher-read'}),io=replay();let reads=0
 await assert.rejects(verifyGoogleSitesPublisher(async url=>{if(++reads===2)throw reason;return io.request(url)},baselines.$publisher),error=>error===reason)
})
