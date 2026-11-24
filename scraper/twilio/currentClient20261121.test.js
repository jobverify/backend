import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {encodeHTML,decodeHTML} from 'entities'
import {selectCurrentTwilioContract} from './currentNative20261115.js'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-client-20261121.json.gz',import.meta.url))))
const board=fixture.packets.find(packet=>packet.url==='https://jobs.twilio.com/careers')
const entry=fixture.packets.find(packet=>packet.url.includes('/pcsxPwa.'))
const page=body=>({url:board.url,status:board.status,html:body})
const html=Buffer.from(board.bodyBase64,'base64').toString()
function carrier(body,id,change){
 const original=body.match(new RegExp('<code\\b[^>]*\\bid="'+id+'"[^>]*>[\\s\\S]*?<\\/code>'))?.[0];assert.ok(original)
 const raw=original.match(/>([\s\S]*)<\/code>/)[1],value=JSON.parse(decodeHTML(raw));change(value)
 return body.replace(original,original.replace(raw,encodeHTML(JSON.stringify(value))))
}
test('current original Twilio renderer declaration keeps the reviewed native account and role renderer',()=>{
 for(const packet of fixture.packets)assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.sha256)
 const {descriptor}=selectCurrentTwilioContract(page(html),{source:'twilio'})
 assert.equal(descriptor.entryURL,entry.url);assert.equal(descriptor.domain,'twilio.com')
 assert.equal(descriptor.roleRendererURL,'https://jobs.twilio.com/gen/js/12480.6ba506c902de6e73.js')
})
for(const[name,edit]of[
 ['foreign native account',body=>carrier(body,'pcsx-data',value=>{value.domain='another.example'})],
 ['foreign branding account',body=>carrier(body,'branding-data',value=>{value.domain='another.example'})],
 ['unreviewed country authority',body=>carrier(body,'pcsx-data',value=>{value.configs.mandatoryResidency='Canada'})],
 ['unreviewed public mode',body=>carrier(body,'pcsx-data',value=>{value.themeBuilderUser={id:'unreviewed'}})],
 ['unknown renderer declaration',body=>body.replace('pcsxPwa.068e7dc3d3bb906d.js','pcsxPwa.ffffffffffffffff.js')],
 ['nomodule renderer mode',body=>body.replace('defer src="/gen/js/pcsxPwa.068e7dc3d3bb906d.js"','defer nomodule src="/gen/js/pcsxPwa.068e7dc3d3bb906d.js"')],
])test('current Twilio client still holds '+name,()=>{
 const changed=edit(html);assert.notEqual(changed,html)
 assert.throws(()=>selectCurrentTwilioContract(page(changed),{source:'twilio'}),/Twilio native PCSx/)
})
test('registered current entry is allowed only with its complete reviewed bytes',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('No live network in native client test')});const calls=[]
 let error
 try{await run({requestIntervalMs:0,fetchImpl:async value=>{
  const url=String(value);calls.push(url);const packet=fixture.packets.find(packet=>packet.url===url);assert.ok(packet,url)
  const body=Buffer.from(packet.bodyBase64,'base64').toString()+(url===entry.url?'\n/* unreviewed current entry */':'')
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }})}catch(caught){error=caught}
 assert.ok(calls.includes(entry.url),'The newly declared exact entry must reach whole-byte validation')
 assert.match(error?.message??'',/Twilio/);assert.equal(error.lifecycleCleanupAllowed,false)
 assert.ok(!calls.some(url=>url.includes('/api/pcsx/')))
})
