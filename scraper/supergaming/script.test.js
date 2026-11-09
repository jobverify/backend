import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { run } from './script.js'

const captured = JSON.parse(readFileSync(new URL('./fixtures/careers-response.json',import.meta.url)))
const response = (body=captured.body) => async url => {if(url!=='https://www.supergaming.com/careers')throw Error('Native feed unavailable');return Object.defineProperty(new Response(body),'url',{value:url})}

test('SuperGaming current email recruiting surface is unknown inventory, never verified zero',async()=>{
  await assert.rejects(run({fetchImpl:response()}),error=>{
    assert.equal(error.code,'SUPERGAMING_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.reportedTotal,null)
    assert.equal(error.inventoryEvidence.indiaFacetCount,null)
    assert.equal(error.inventoryEvidence.listingComplete,false)
    assert.equal(error.inventoryEvidence.pagesFetched,1)
    return true
  })
})
test('SuperGaming upstream failure is not an empty inventory',async()=>{
  await assert.rejects(run({fetchImpl:async()=>{throw Error('network unavailable')}}),/network unavailable/)
})
test('SuperGaming preserves caller cancellation before any fetch',async()=>{
  const controller=new AbortController(),reason=Error('cancelled');controller.abort(reason)
  await assert.rejects(run({signal:controller.signal,fetchImpl:()=>assert.fail('must not fetch')}),error=>error===reason)
})
test('SuperGaming bounds fetch and body dependencies ignoring their signal',async()=>{
  for(const fetchImpl of [()=>new Promise(()=>{}),async url=>Object.defineProperty(new Response(new ReadableStream({pull(){return new Promise(()=>{})}})),'url',{value:url})])
    await assert.rejects(run({fetchImpl,timeoutMs:15}),/deadline/)
})
test('SuperGaming unknown response cannot certify zero',async()=>{
  await assert.rejects(run({fetchImpl:response('<title>Maintenance</title>')}),error=>error.code==='SUPERGAMING_COVERAGE_GAP'&&error.inventoryEvidence.reportedTotal===null)
})
test('SuperGaming caller abort interrupts a noncooperative fetch',async()=>{
  const controller=new AbortController(),reason=Error('stop now')
  const pending=run({signal:controller.signal,fetchImpl:()=>new Promise(()=>{})})
  controller.abort(reason)
  await assert.rejects(pending,error=>error===reason)
})
test('SuperGaming cannot attach recruiting contact from hidden markup',async()=>{
  const body='<title>Careers \u2014 SuperGaming</title><div style="content-visibility:hidden"><a href="mailto:careers@supergaming.com">Want in?</a></div>'
  await assert.rejects(run({fetchImpl:response(body)}),error=>error.code==='SUPERGAMING_COVERAGE_GAP'&&error.inventoryEvidence.reportedTotal===null&&error.inventoryEvidence.firstParty===false)
})
test('SuperGaming rejects native redirects before trusting their content',async()=>{
  await assert.rejects(run({fetchImpl:async()=>({status:200,url:'https://another.example/careers',text:()=>assert.fail('must not read redirected body')})}),error=>error.code==='SUPERGAMING_COVERAGE_GAP'&&error.inventoryEvidence.reportedTotal===null)
})
