import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import run from './script.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-20261119.json.gz',import.meta.url))))
const OFFICIAL='https://www.trimble.com/en/careers',BOARD='https://trimblecareers.trimble.com/jobs'
const replay=edit=>{
 const calls=[],boundary=new Error('reviewed current corporate handoff reached native board')
 const fetchImpl=async url=>{
  calls.push(url)
  if(url===BOARD)throw boundary
  assert.equal(url,OFFICIAL)
  const packet=fixture.response,body=Buffer.from(packet.bodyBase64,'base64').toString()
  const response=new Response(edit?.(body)??body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url});return response
 }
 return{calls,boundary,fetchImpl}
}

test('Trimble November 19 exact whole responsive stylesheet qualifies its desktop native Search jobs handoff',async()=>{
 const io=replay()
 await assert.rejects(run({now:fixture.capturedAt,fetchImpl:io.fetchImpl}),error=>error===io.boundary)
 assert.deepEqual(io.calls,[OFFICIAL,BOARD])
})

for(const [label,edit] of [
 ['changed whole stylesheet',html=>html.replace('.hidden{display:none}','.hidden{display:block}')],
 ['extra hidden wrapper instruction',html=>html.replace('<div class="hidden xl:flex flex-shrink-0 mr-[21px]">','<div style="display:none" class="hidden xl:flex flex-shrink-0 mr-[21px]">')],
 ['foreign declared job account',html=>html.replaceAll('https://trimblecareers.trimble.com/jobs','https://other.invalid/jobs')],
])test('Trimble November 19 still rejects '+label+' before native acquisition',async()=>{
 const io=replay(edit)
 await assert.rejects(run({now:fixture.capturedAt,fetchImpl:io.fetchImpl}),/stylesheet\/handoff contract changed|Search jobs handoff missing/)
 assert.deepEqual(io.calls,[OFFICIAL])
})
