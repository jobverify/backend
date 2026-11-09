import test from 'node:test'
import assert from 'node:assert/strict'
import * as scraper from './script.js'
import {fixtureFetch} from './fixtureReplay.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const replay=fixtureFetch
const htmlHeaders=new Headers({'content-type':'text/html'})

test('EaseMyTrip stops and cancels an oversized streaming response before EOF',async()=>{
 let cancelled=false,pulls=0
 const body=new ReadableStream({pull(c){pulls++;if(pulls<=7)c.enqueue(new Uint8Array(1000000))},cancel(){cancelled=true}})
 await assert.rejects(scraper.run({timeoutMs:100,fetchImpl:async url=>({status:200,url,headers:htmlHeaders,body,text:()=>new Response(body).text()})}),e=>e.code==='EASEMYTRIP_COVERAGE_GAP'&&/bound/.test(e.message))
 assert.equal(cancelled,true)
 assert.ok(pulls<=7,'must stop reading as soon as byte bound is exceeded')
})

test('EaseMyTrip cancels unread bodies when HTTP validation fails',async()=>{
 let cancelled=false
 const body=new ReadableStream({cancel(){cancelled=true}})
 await assert.rejects(scraper.run({fetchImpl:async url=>({status:503,url,body,text:()=>new Response(body).text()})}),{code:'EASEMYTRIP_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})

test('EaseMyTrip caller abort cancels a stalled stream and preserves the reason',async()=>{
 const controller=new AbortController(),reason=Error('caller stopped'),received=Promise.withResolvers()
 let cancelled=false
 const body=new ReadableStream({pull(){received.resolve()},cancel(){cancelled=true}},{highWaterMark:0})
 const pending=scraper.run({signal:controller.signal,fetchImpl:async url=>({status:200,url,headers:htmlHeaders,body,text:()=>new Response(body).text()})})
 await received.promise;controller.abort(reason)
 await assert.rejects(pending,e=>e===reason)
 assert.equal(cancelled,true)
})

test('EaseMyTrip aggregate deadline cancels a stalled streaming body',async()=>{
 let cancelled=false
 const body=new ReadableStream({cancel(){cancelled=true}})
 await assert.rejects(scraper.run({timeoutMs:20,fetchImpl:async url=>({status:200,url,headers:htmlHeaders,body,text:()=>new Response(body).text()})}),e=>e.code==='EASEMYTRIP_COVERAGE_GAP'&&/deadline/.test(e.message))
 assert.equal(cancelled,true)
})

test('EaseMyTrip enforces elapsed deadline when synchronous work starves abort timers',async()=>{
 const captured=replay()
 await assert.rejects(scraper.inspectInventory({timeoutMs:10,fetchImpl:async url=>{
  const until=performance.now()+30
  while(performance.now()<until){}
  return captured(url)
 }}),e=>e.code==='EASEMYTRIP_COVERAGE_GAP'&&/deadline/.test(e.message))
})
test('EaseMyTrip retains all twelve observations and qualifies ten exact owned India worksites without company completeness',async()=>{
 const jobs=await scraper.run({fetchImpl:replay(),minIntervalMs:0})
 assert.equal(jobs.length,10)
 assert.equal(readInventoryEvidence(jobs)?.status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 const inspected=await scraper.inspectInventory({fetchImpl:replay(),minIntervalMs:0})
 assert.equal(inspected.roles.length,12)
 assert.equal(inspected.roles[0].title,'Senior Frontend Engineer')
 assert.equal(inspected.roles[0].location,'Gurugram')
 assert.equal(inspected.roles[0].country,'India')
 assert.equal(inspected.roles.filter(r=>r.country===null).length,2)
 assert.ok(inspected.roles.every(r=>r.description.length>100&&r.postingDate===null))
})
test('EaseMyTrip unavailable upstream is never empty',async()=>{
 await assert.rejects(scraper.run({fetchImpl:async()=>{throw Error('offline')}}),{code:'EASEMYTRIP_COVERAGE_GAP'})
})
test('EaseMyTrip preserves exact cancellation even when transport ignores it',async()=>{
 const c=new AbortController(),reason=Error('stop'),pending=scraper.run({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});c.abort(reason)
 await assert.rejects(pending,e=>e===reason)
})
test('EaseMyTrip cancels a response arriving after an ignored transport abort',async()=>{
 const controller=new AbortController(),reason=Error('stop transport'),arrival=Promise.withResolvers()
 let cancelled=false
 const body=new ReadableStream({cancel(){cancelled=true}})
 const pending=scraper.run({signal:controller.signal,fetchImpl:()=>arrival.promise})
 controller.abort(reason)
 await assert.rejects(pending,e=>e===reason)
 arrival.resolve({status:200,url:scraper.HOME_URL,body,text:()=>new Response(body).text()})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancelled,true)
})
test('EaseMyTrip never executes client data expressions',async()=>{
 await assert.rejects(scraper.run({fetchImpl:replay(r=>{if(r.url===scraper.CAREERS_URL)r.body=r.body.replace("const ROLES = [","const ROLES = [ (()=>{throw Error('executed')})(),");return r})}),{code:'EASEMYTRIP_COVERAGE_GAP'})
})
test('EaseMyTrip hidden native client is not public role evidence',async()=>{
 await assert.rejects(scraper.run({fetchImpl:replay(r=>{if(r.url===scraper.CAREERS_URL){const start=r.body.lastIndexOf('<script',r.body.indexOf('const ROLES'));r.body=r.body.slice(0,start)+r.body.slice(start).replace('<script','<script hidden')}return r})}),{code:'EASEMYTRIP_COVERAGE_GAP'})
})
test('EaseMyTrip rejects a changed declared application destination without requesting the form',async()=>{
 await assert.rejects(scraper.run({minIntervalMs:0,fetchImpl:replay(r=>{if(r.url===scraper.CAREERS_URL)r.body=r.body.replaceAll(scraper.APPLICATION_URL,'https://other.example/form');return r})}),{code:'EASEMYTRIP_COVERAGE_GAP'})
})
test('EaseMyTrip empty native descriptions remain inspectable in the failed-source audit and cannot qualify',async()=>{
 await assert.rejects(scraper.inspectInventory({minIntervalMs:0,fetchImpl:replay(r=>{if(r.url===scraper.CAREERS_URL){r.body=r.body.replace(/about:'[^'\r\n]*'/g,"about:null").replace(/resp:\[[^\]\r\n]*\]/g,'resp:[]').replace(/profile:\[[^\]\r\n]*\]/g,'profile:[]')}return r})}),e=>e.code==='EASEMYTRIP_COVERAGE_GAP'&&e.recruitmentObservations.heldNativeRows.length===12)
})


