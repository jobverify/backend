import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {runCurrentDigiledge as run} from './currentNative20261117.js'

const HOME="https://digiledge.in/"
const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
function original(url){
 const row=originals.find(r=>r.requestedUrl===url);assert.ok(row,'Unbound original '+url)
 const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
}
test('frozen opaque pre-cancellation precedes unsupported callbacks and caps without native reads',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,label:'digiledge pre-abort'});controller.abort(reason);let reads=0
 await assert.rejects(run({signal:controller.signal,maxJobs:1,fetchText:async()=>{reads++},fetchImpl:async()=>{reads++}}),error=>error===reason)
 assert.equal(reads,0)
})
for(const mode of ['fulfilled','rejected'])test('frozen opaque caller cancellation survives original native header read '+mode,async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,label:'digiledge '+mode});let reads=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:async(url,init)=>{
  reads++;assert.equal(url,HOME);controller.abort(reason);assert.equal(init.signal.aborted,true)
  if(mode==='rejected')throw Object.freeze(Error('Replacement transport error'))
  return original(url)
 }}),error=>error===reason)
 assert.equal(reads,1)
})
test('ordinary frozen native transport failures retain exact identity',async()=>{
 const reason=Object.freeze(Error('digiledge ordinary frozen transport error'))
 await assert.rejects(run({fetchImpl:async()=>{throw reason}}),error=>error===reason)
})
