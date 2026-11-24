import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import {syncBuiltinESMExports} from 'node:module'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createPurplleScraper} from './script.js'

const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/origin-boundary-originals-20261121.json.gz',import.meta.url))))
const employer='https://www.linkedin.com/company/purplle-com/'
const corporate='https://www.purplle.com/careers'
const post=packet.responses[2].requestedUrl
for(const row of packet.responses){
 const bytes=Buffer.from(row.bodyBase64,'base64')
 assert.equal(bytes.length,row.bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256)
}

async function replay(change){
 const saved={fetch:globalThis.fetch,hr:http.request,hg:http.get,sr:https.request,sg:https.get}
 const network=[],calls=[],queues=new Map()
 const stop=()=>{network.push('unretained-network');throw Error('Offline origin-boundary test forbids network')}
 for(const row of packet.responses){if(!queues.has(row.requestedUrl))queues.set(row.requestedUrl,[]);queues.get(row.requestedUrl).push(row)}
 let jobs=null,error=null
 try{
  globalThis.fetch=stop;http.request=http.get=https.request=https.get=stop;syncBuiltinESMExports()
  const fetchImpl=async(input,init={})=>{
   const url=String(input);calls.push(url)
   const row=queues.get(url)?.shift()
   assert(row,'No genuine original for '+url)
   assert.equal(init.method??'GET','GET');assert.equal(init.body,undefined)
   const current=change({...row}),response=new Response(Buffer.from(current.bodyBase64,'base64'),{status:current.status,headers:current.headers})
   Object.defineProperty(response,'url',{value:current.url})
   return response
  }
  try{jobs=await createPurplleScraper({fetchImpl,now:'2026-11-19T03:35:44.937Z',requestIntervalMs:0}).run()}catch(cause){error=cause}
 }finally{
  globalThis.fetch=saved.fetch;http.request=saved.hr;http.get=saved.hg;https.request=saved.sr;https.get=saved.sg;syncBuiltinESMExports()
 }
 assert.equal(network.length,0)
 return{jobs,error,calls}
}

for(const status of [403,429])test('Purplle stops after exact employer HTTP'+status+' without another request to the refused origin',async()=>{
 // HTTP403 is the genuine original. HTTP429 is an explicitly simulated
 // status-only counterfactual; neither case creates a new current observation.
 const result=await replay(row=>row.requestedUrl===employer?{...row,status}:row)
 assert.deepEqual(result.calls,[corporate,employer])
 assert.equal(result.jobs,null)
 assert.equal(result.error?.code,'PURPLLE_COVERAGE_GAP')
 assert.equal(result.error?.status,status)
 assert.equal(result.error?.requestUrl,employer)
 assert.equal(result.error?.abortRetries,true)
 assert.equal(result.error?.retainedResponses.length,2)
 assert.equal(result.error?.retainedResponses[1].bodyUnread,true)
})

test('an explicit corporate HTTP247 counterfactual retains the independent declared-channel attempt and original outage classification',async()=>{
 // This corporate status is simulated. All subsequent bodies remain actual
 // historical originals; their changed programme still produces a HOLD.
 const result=await replay(row=>row.requestedUrl===corporate?{...row,status:247}:row)
 assert.equal(result.jobs,null)
 assert.equal(result.calls[0],corporate)
 assert.equal(result.calls[1],post)
 assert.equal(result.calls.includes(employer),false)
 assert.equal(result.error?.status,247)
 assert.equal(result.error?.failureKind,'upstream_unavailable')
 assert.equal(result.error?.upstreamOutage,true)
 assert.equal(typeof result.error?.independentRecoveryFailure?.message,'string')
})
