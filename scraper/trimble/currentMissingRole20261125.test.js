import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import run from './script.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-opening-20261125.json.gz',import.meta.url))))
const missing=fixture.responses.at(-1)
assert.equal(missing.status,404)

const replay=edit=>{
 let reads=0
 const boundary=new Error('Reviewed missing role held; next native role admitted')
 return{boundary,get reads(){return reads},fetchImpl:async url=>{
  const packet=fixture.responses[reads++]
  if(!packet)throw boundary
  assert.equal(url,packet.requestedUrl)
  const row=reads===fixture.responses.length?(edit?.(packet)??packet):packet
  return Object.defineProperty(new Response(row.body,{status:row.status,headers:row.headers}),'url',{value:row.url})
 }}
}

test('current counted listing keeps a genuine native role404 held and proceeds to another listed role',async()=>{
 const io=replay()
 await assert.rejects(run({now:fixture.capturedAt,fetchImpl:io.fetchImpl}),error=>error===io.boundary)
 assert.equal(io.reads,28)
})

for(const [label,edit] of [
 ['unreviewed native error page',p=>({...p,body:p.body.replace('<h1 class="text-large text-[#353a40]">404</h1>','<h1>Access denied</h1>')})],
 ['redirected missing role',p=>({...p,url:p.url+'/other'})],
 ['actual access denial',p=>({...p,status:403})],
 ['explicit access challenge header',p=>({...p,headers:{...p.headers,'cf-mitigated':'challenge'}})],
])test('current missing-role handling rejects '+label+' without admitting more reads',async()=>{
 const io=replay(edit)
 await assert.rejects(run({now:fixture.capturedAt,fetchImpl:io.fetchImpl}),/public response identity\/status changed/)
 assert.equal(io.reads,27)
})
