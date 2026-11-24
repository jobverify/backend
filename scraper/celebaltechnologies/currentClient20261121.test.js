import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readCurrentCelebalApi} from './currentPublicApi.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-client-20261121.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(packet=>[packet.url,packet]))
const client=fixture.packets.find(packet=>packet.url.includes('%5Bid%5D-'))
const body=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
const DONE=Object.freeze({stage:'next-native-read-after-complete-current-client'})
async function replay(t,edit=(text)=>text){
 t.mock.method(globalThis,'fetch',()=>{throw Error('No live network in client regression')})
 let clientRead=false,error;const calls=[]
 try{await readCurrentCelebalApi({html:body(packets.get('https://celebaltech.com/careers')),now:()=>fixture.capturedAt,normalizeRole:()=>assert.fail('No role admission is tested before subsequent native detail reads'),readText:async url=>{
  calls.push(url);if(clientRead)throw DONE
  const packet=packets.get(url);assert.ok(packet,'Only exact current declarations may be read: '+url)
  if(url===client.url)clientRead=true
  return edit(body(packet),url)
 }})}catch(caught){error=caught}
 return{error,calls}
}
test('current complete Celebal detail client reaches the subsequent native read without fallback roles',async t=>{
 for(const packet of fixture.packets)assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.sha256)
 const result=await replay(t);assert.equal(result.error,DONE);assert.ok(result.calls.includes(client.url))
})
test('current Celebal declaration never authorizes changed complete program bytes',async t=>{
 const result=await replay(t,(text,url)=>url===client.url?text+'\n/* unreviewed renderer */':text)
 assert.ok(result.calls.includes(client.url));assert.match(result.error?.message??'',/declared client program contract changed/)
})
for(const[name,field]of[['country','country'],['employer','hiringOrganization']])test('current client keeps unknown '+name+' API authority held',async t=>{
 const result=await replay(t,(text,url)=>{if(url.endsWith('/getAllJobs')){const value=JSON.parse(text);value.data[0][field]='Unreviewed authority';return JSON.stringify(value)}return text})
 assert.match(result.error?.message??'',/native field contract changed/);assert.ok(!result.calls.includes(client.url))
})
test('current Celebal detail build remains bound to its publisher deployment',async t=>{
 const result=await replay(t,(text,url)=>url.includes('/careers/')&&!url.endsWith('.js')?text.replaceAll('Emx9ZjepRDGEvA1KTrQhp','UnreviewedDeployment'):text)
 assert.match(result.error?.message??'',/native detail client handoff changed/);assert.ok(!result.calls.includes(client.url))
})
