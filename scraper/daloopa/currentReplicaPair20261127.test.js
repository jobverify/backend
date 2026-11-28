import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readDaloopaDetail,runCurrentDaloopaData} from './nativeData20261115.js'
import {createDaloopaReplay,withDaloopaReplayClock} from './fixtures/replayNativeData20261115.js'

const load=name=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name,import.meta.url))))
const pair=load('current-replica-pair-20261127.json.gz').packets
const listing=JSON.parse(load('current-listing-20261127.json.gz').packet.body)
const row=listing.reqDetailsBOList.find(value=>value.reqId===45)
const versions=pair.map(packet=>JSON.parse(packet.body).v)

test('genuine current replica responses preserve identical full native data and retain both tokens',()=>{
 const results=pair.map(packet=>{
  assert.equal(packet.status,200)
  assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
  return readDaloopaDetail({label:'detail-45',url:packet.requestedUrl,method:packet.method,requestBody:packet.requestBody,bytes:Buffer.from(packet.body),text:packet.body},45,row)
 })
 assert.deepEqual(versions,['d17-zx-20261125094135','d17-qc-20261125094104'])
 assert.notEqual(results[0].rawVersionToken,results[1].rawVersionToken)
 assert.equal(results[0].rawDataJSON,results[1].rawDataJSON)
 assert.equal(results[0].replicaNeutralBodyBase64,results[1].replicaNeutralBodyBase64)
})

// These replays apply only the two genuinely observed tokens to older complete
// records. They are synthetic supported-data cases, not a combined live capture.
function replay(change){return createDaloopaReplay((bytes,packet)=>{
 if(!packet.label.startsWith('detail-'))return bytes
 const index=packet.phase==='opening'?0:1
 const original=bytes.toString('utf8')
 let body=original.replace(/"v":"[^"]+"/,'"v":'+JSON.stringify(versions[index]))
 assert.notEqual(body,original,'replica mutation must reach the original token')
 if(change)body=change(body,packet)
 return Buffer.from(body)
})}

test('current observed replica pair can close only identical complete native records',async()=>{
 const io=replay()
 const jobs=await withDaloopaReplayClock(()=>runCurrentDaloopaData({fetchImpl:io.fetchImpl}))
 assert.equal(io.calls.length,14)
 assert.deepEqual(jobs.map(job=>job.jobId),['46','45'])
 for(const job of jobs){
  assert.equal(job.nativeOriginalEnvelope.v,versions[0])
  assert.equal(job.nativeClosingOriginalEnvelope.v,versions[1])
  assert.equal(job.nativeRawDataSHA256,job.nativeClosingRawDataSHA256)
  assert.deepEqual(job.nativeDetailData,job.nativeClosingDetailData)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
})

for(const [name,change] of [
 ['changed complete native counters',body=>{const changed=body.replace(/("activeApplicationCount"\s*:\s*)(\d+)/,(_match,prefix,value)=>prefix+(Number(value)+1));assert.notEqual(changed,body);return changed}],
 ['a token from a different reviewed pair',body=>body.replace(versions[1],'d17-wq-20261103052123')],
 ['an unreviewed replica token',body=>body.replace(versions[1],'d17-unreviewed-current')],
])test('current replica tolerance still rejects '+name,async()=>{
 const io=replay((body,packet)=>packet.phase==='closing'?change(body):body)
 await withDaloopaReplayClock(()=>assert.rejects(runCurrentDaloopaData({fetchImpl:io.fetchImpl}),error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&error.lifecycleCleanupAllowed===false))
 assert.equal(io.calls.length,11)
})
