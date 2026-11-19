import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import baselines from './native.scope.json' with {type:'json'}
import {verifyGoogleSitesPublisher} from './publisherChain.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261119/current-declared.json.gz',import.meta.url))))
const replay=(change=(text)=>text)=>{
 const calls=[]
 return {calls,request:async url=>{
  calls.push(url)
  const packet=fixture.packets.find(row=>row.url===url)
  assert.ok(packet,'only actual declared publisher resources '+url)
  return change(packet.text,url)
 }}
}

test('Kidvento current finite Google Sites tuple binds the same visible employer-owned Keka embed',async()=>{
 const io=replay(),publisher=await verifyGoogleSitesPublisher(io.request,baselines.$publisher)
 assert.equal(publisher.nativeShell,'https://kidvento.keka.com/careers')
 assert.equal(publisher.websiteJavaScriptExecuted,false)
 assert.equal(io.calls.length,4)
})

test('Kidvento current handoff rejects unreviewed controller, base and bridge whole bodies',async()=>{
 for(const part of ['/m=view','/m=N0NZx','intermediate-frame-minified.html']){
  const io=replay((text,url)=>url.endsWith(part)?text+';unreviewedEmployerOverride()':text)
  await assert.rejects(verifyGoogleSitesPublisher(io.request,baselines.$publisher),/bytes changed|bridge program changed/)
 }
})

test('Kidvento current typed controller must be executable classic code and point to its own visible employer',async()=>{
 for(const edit of [
  text=>text.replace('id="base-js"','id="base-js" nomodule'),
  text=>text.replace('id="base-js"','id="base-js" type="application/json"'),
  text=>text.replace('id="base-js"','id="base-js" type="module"'),
  text=>text.replaceAll('data-url="https://kidvento.keka.com/careers"','data-url="https://foreign.keka.com/careers"'),
  text=>text.replace('class="w536ob"','class="w536ob" hidden'),
 ]){
  const io=replay((text,url)=>url==='https://www.kidvento.com/careers'?edit(text):text)
  await assert.rejects(verifyGoogleSitesPublisher(io.request,baselines.$publisher),/controller client changed|embed missing/)
 }
})
