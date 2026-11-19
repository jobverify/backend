import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runCurrentNous} from './nativeCurrent.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261119/program-review.json.gz',import.meta.url))))
const MAIN='https://www.artizent.com/assets/index-BDap2ywQ.js'
const OPENINGS='https://www.artizent.com/insights/careers/openings'
const replay=(edit=()=>{})=>{
 const calls=[],boundary=new Error('native country-unknown role boundary')
 const fetchImpl=async url=>{
  calls.push(url)
  const packet=fixture.responses.find(r=>(r.requestedUrl??r.url)===url)
  if(!packet){assert.ok(url.startsWith(OPENINGS+'/'),'Only the declared native role boundary is intercepted');throw boundary}
  const row={...packet,body:Buffer.from(packet.bodyBase64,'base64').toString()};edit(row)
  const response=new Response(row.body,{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.finalURL});return response
 }
 return{calls,boundary,fetchImpl}
}

test('Nous November 19 exact current HTML and whole client graph admit the fourteen raw roles without assigning country',async()=>{
 const io=replay()
 await assert.rejects(runCurrentNous({now:fixture.capturedAt,fetchImpl:io.fetchImpl}),error=>{
  assert.ok(error===io.boundary,error.message)
  const rows=error.recruitmentObservations.observations
  assert.equal(rows.length,14)
  assert.ok(rows.every(row=>row.country===null&&row.legalHiringOrganization===null&&row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false))
  return true
 })
 assert.ok(io.calls.includes(MAIN))
 assert.ok(io.calls.includes('https://www.artizent.com/assets/JobOpenings-DZw962NJ.js'))
 assert.ok(io.calls.includes('https://www.artizent.com/assets/JobDetail-KzxvAHQP.js'))
})

test('Nous November 19 edited whole native programs cannot qualify the literal role inventory',async()=>{
 for(const target of [MAIN,'https://www.artizent.com/assets/JobDetail-KzxvAHQP.js']){
  const io=replay(row=>{if((row.requestedUrl??row.url)===target)row.body+=';globalThis.unreviewed=true'})
  await assert.rejects(runCurrentNous({now:fixture.capturedAt,fetchImpl:io.fetchImpl}),/publisher client program changed/)
  assert.equal(io.calls.some(url=>url.startsWith(OPENINGS+'/')),false)
 }
})

test('Nous November 19 an extra retained HTML program still prevents source qualification',async()=>{
 const io=replay(row=>{if((row.requestedUrl??row.url)==='https://www.artizent.com/')row.body=row.body.replace('</head>','<script src="/unreviewed.js"></script></head>')})
 await assert.rejects(runCurrentNous({now:fixture.capturedAt,fetchImpl:io.fetchImpl}),/program declarations changed/)
 assert.equal(io.calls.length,1)
})
