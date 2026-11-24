import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {selectReviewedCandidateClient} from '../darwinbox/reviewedCandidateClient.js'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-client-20261121.json.gz',import.meta.url))))
const review=JSON.parse(fs.readFileSync(new URL('./reviewedNativeScope.json',import.meta.url),'utf8'))
const source=fixture.source,origin='https://redhealth.darwinbox.in'
const client=fixture.packets.find(packet=>packet.url===origin+'/ms/candidatev2/main.aad4e9f12624d60f.js')
const shell=fixture.packets.find(packet=>packet.url.startsWith(origin)&&packet.headers['content-type']?.startsWith('text/html'))
const body=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
async function replay(t,edit){
 t.mock.method(globalThis,'fetch',()=>assert.fail('No live network in native client regression'))
 const calls=[];let error
 try{await run({fetchImpl:async value=>{
  const url=String(value);calls.push(url);const packet=fixture.packets.find(row=>row.url===url);assert.ok(packet,'Only exact current original URLs may be read: '+url)
  return Object.defineProperty(new Response(edit(body(packet),url),{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }})}catch(caught){error=caught}
 return{calls,error}
}
test(source+' current original declaration selects only the reviewed complete client and native shell',()=>{
 for(const packet of fixture.packets)assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.sha256)
 assert.ok(body(shell).includes('main.aad4e9f12624d60f.js'))
 const release=selectReviewedCandidateClient({source,origin,review},[client.url])
 assert.ok(release);assert.equal(release.clientUrl,client.url);assert.equal(release.clientSha256,client.sha256);assert.equal(release.rendererSha256,shell.sha256)
})
test(source+' current client declaration never admits altered complete programme bytes',async t=>{
 const{calls,error}=await replay(t,(text,url)=>url===client.url?text+'\n/* unreviewed current client */':text)
 assert.ok(calls.includes(client.url));assert.match(error?.message??'',/reviewed public API client changed/)
 assert.ok(!calls.some(url=>url.includes('/ms/candidateapi/')))
})
for(const[name,edit,reason]of[
 ['foreign candidate base',text=>text.replace('href="/ms/candidatev2/"','href="https://foreign.invalid/ms/candidatev2/"'),/candidate base identity changed/],
 ['unknown active client',text=>text.replace('main.aad4e9f12624d60f.js','main.ffffffffffffffff.js'),/active candidate client changed/],
])test(source+' current declaration keeps '+name+' held before native API reads',async t=>{
 const{calls,error}=await replay(t,(text,url)=>{if(url.startsWith(origin)&&url!==client.url){const changed=edit(text);assert.notEqual(changed,text);return changed}return text})
 assert.match(error?.message??'',reason);assert.ok(!calls.includes(client.url));assert.ok(!calls.some(url=>url.includes('/ms/candidateapi/')))
})
test(source+' retains the original fully pinned source-specific client release',()=>{
 const original={clientUrl:origin+'/ms/candidatev2/main.71bd301266b6050c.js',clientSha256:'6f5467fb999e4b8e32b93895fd9719614f682d32c414ae96676889ccbbbf3e8a',rendererSha256:'2280857a4dc8b6cd2f901e6555bd22eee6dd8eb7063a62bdb5427b7d570b4ea7'}
 const release=selectReviewedCandidateClient({source,origin,review},[original.clientUrl]);assert.ok(release,'Adding a current deployment must retain the exact previously reviewed own client')
 assert.deepEqual({clientUrl:release.clientUrl,clientSha256:release.clientSha256,rendererSha256:release.rendererSha256},original)
})