import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readDaloopaListing} from './nativeData20261115.js'
import {run} from './script.js'
import {createDaloopaReplay,withDaloopaReplayClock} from './fixtures/replayNativeData20261115.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-listing-20261127.json.gz',import.meta.url))))
const packet=fixture.packet
const page=(body=packet.body)=>({label:'listing',url:packet.requestedUrl,method:packet.method,requestBody:packet.requestBody,bytes:Buffer.from(body),text:body})

test('current complete native listing retains a zero position count without inventing vacancy or country authority',()=>{
 assert.equal(packet.status,200)
 assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
 const listing=readDaloopaListing(page())
 assert.deepEqual(listing,JSON.parse(packet.body))
 assert.equal(listing.reqDetailsBOList.length,10)
 const zero=listing.reqDetailsBOList.find(row=>row.reqId===11)
 assert.equal(zero.totalPositions,0)
 assert.equal(zero.countryCode,null)
 assert.equal(zero.location,'Noida')
 assert.deepEqual(zero.locationList,[])
 assert.equal(zero.sourceScopeComplete,undefined)
 assert.equal(zero.activeApplyVerified,undefined)
})

for(const value of [-1,0.5,'0',null,Number.MAX_SAFE_INTEGER+1])test('position metadata still rejects invalid nonnegative integer '+JSON.stringify(value),()=>{
 const listing=JSON.parse(packet.body)
 listing.reqDetailsBOList.find(row=>row.reqId===11).totalPositions=value
 assert.throws(()=>readDaloopaListing(page(JSON.stringify(listing))),error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&/numeric experience\/band\/count/.test(error.message))
})

test('zero count cannot hide a changed native availability control',()=>{
 const listing=JSON.parse(packet.body)
 listing.reqDetailsBOList.find(row=>row.reqId===11).statusId=0
 assert.throws(()=>readDaloopaListing(page(JSON.stringify(listing))),error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&/control\/availability/.test(error.message))
})

test('a positive position count still requires the reviewed native workplace model',()=>{
 const listing=JSON.parse(packet.body)
 listing.reqDetailsBOList.find(row=>row.reqId===11).totalPositions=1
 assert.throws(()=>readDaloopaListing(page(JSON.stringify(listing))),error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&/worksite model/.test(error.message))
})

test('zero position records cannot become qualified India candidates even with explicit India criteria',async()=>{
 const io=createDaloopaReplay((bytes,item)=>{
  if(item.label!=='listing')return bytes
  const listing=JSON.parse(bytes)
  for(const row of listing.reqDetailsBOList)row.totalPositions=0
  return Buffer.from(JSON.stringify(listing))
 })
 await withDaloopaReplayClock(()=>assert.rejects(run({fetchImpl:io.fetchImpl}),error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&/No qualified current IndiaRemote native candidates/.test(error.message)))
 assert.equal(io.calls.length,3)
})
