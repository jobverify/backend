import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import run from './script.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-20261125.json.gz',import.meta.url))))
const OFFICIAL='https://www.trimble.com/en/careers',BOARD='https://trimblecareers.trimble.com/jobs'
const replay=edit=>{
 const calls=[],boundary=new Error('current reviewed corporate handoff reached native board')
 const fetchImpl=async url=>{
  calls.push(url)
  if(url===BOARD)throw boundary
  assert.equal(url,OFFICIAL)
  const packet=fixture.response
  const response=new Response(edit?.(packet.body)??packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url});return response
 }
 return{calls,boundary,fetchImpl}
}

test('Trimble November 25 observed font deployment retains the reviewed desktop Search jobs handoff',async()=>{
 const io=replay()
 await assert.rejects(run({now:fixture.capturedOn,fetchImpl:io.fetchImpl}),error=>error===io.boundary)
 assert.deepEqual(io.calls,[OFFICIAL,BOARD])
})

for(const [label,edit] of [
 ['changed desktop visibility',html=>html.replace('.xl\\:flex{display:flex}', '.xl\\:flex{display:none}')],
 ['unreviewed stylesheet bytes',html=>html.replace('.hidden{display:none}', '.hidden{display:none} ')],
 ['extra wrapper hiding',html=>html.replace('<div class="hidden xl:flex flex-shrink-0 mr-[21px]">','<div hidden class="hidden xl:flex flex-shrink-0 mr-[21px]">')],
 ['different declared public board',html=>html.replaceAll(BOARD,'https://other.invalid/jobs')],
])test('Trimble November 25 rejects '+label+' before native requests',async()=>{
 const io=replay(edit)
 await assert.rejects(run({now:fixture.capturedOn,fetchImpl:io.fetchImpl}),/stylesheet\/handoff contract changed|Search jobs handoff missing/)
 assert.deepEqual(io.calls,[OFFICIAL])
})
