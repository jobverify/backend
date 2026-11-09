import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {run} from './script.js'

const gap = error => {
  assert.equal(error.code, 'UNOCOIN_COVERAGE_GAP')
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.inventoryEvidence.listingComplete, false)
  return true
}
test('Unocoin unavailable native inventory raises evidence-bearing gap', async () => {
  await assert.rejects(run({fetchImpl: async () => {throw Error('offline')}}), gap)
})
test('Unocoin aggregate deadline bounds fetch and body stalls', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async url => ({url, status:200, text:() => new Promise(() => {})})]) {
    await assert.rejects(run({fetchImpl, timeoutMs:10}), gap)
  }
})
test('Unocoin propagates exact caller cancellation reason', async () => {
  for (const stage of ['before','fetch','body']) {
    const controller = new AbortController(), reason = {stage}
    if(stage === 'before') controller.abort(reason)
    await assert.rejects(run({signal:controller.signal, fetchImpl:async url => {
      if(stage === 'fetch'){controller.abort(reason);return new Promise(()=>{})}
      return {url,status:200,text:()=>{controller.abort(reason);return new Promise(()=>{})}}
    }}), error => error === reason)
  }
})
test('Unocoin bounds streamed bodies and cancels stalled readers at deadline', async () => {
  for (const oversized of [true,false]) {
    let cancelled = false
    const fetchImpl = async url => ({url,status:200,body:{getReader:()=>({
      read:()=>oversized ? Promise.resolve({done:false,value:new Uint8Array(3000001)}) : new Promise(()=>{}),
      cancel:async()=>{cancelled=true},releaseLock:()=>{},
    })}})
    await assert.rejects(run({fetchImpl,timeoutMs:15}),gap)
    assert.equal(cancelled,true)
  }
})
const load = name => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url))))
const home = load('official-home')
const employer = load('native-employer')
const listings = load('native-jobs')
const worldwide = load('native-worldwide-confirmation').find(r=>r.url.includes('location=Worldwide'))
const receipts=[home,employer,...listings,worldwide]
test('actual corporate capture leads to exact Unoversity handoff and preserves unknown totals on outage',async()=>{
  const seen=[]
  const jobs=await run({fetchImpl:async url=>{
    seen.push(url)
    const row=receipts.find(r=>r.url===url)
    if(row) return {url:row.finalUrl,status:row.status,text:async()=>row.body}
    throw Error('edu endpoint unavailable')
  }})
  assert.deepEqual(jobs,[])
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.firstParty,true);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.status,'discovery-only')
  assert.deepEqual(seen,[...receipts.map(r=>r.url),'https://edu.unocoin.com/'])
})
test('comment, hidden, template and inert corporate handoffs cannot establish recruiting delegation',async()=>{
  for(const wrap of [s=>'<!--'+s+'-->',s=>'<template>'+s+'</template>',s=>'<div hidden>'+s+'</div>',s=>'<div inert>'+s+'</div>',s=>'<div style="content-visibility:hidden">'+s+'</div>']) {
    const body=home.body.replace(/<a\b[^>]*href="https:\/\/edu\.unocoin\.com\/"[^>]*>[\s\S]*?<\/a>/,wrap)
    let requests=0
    await assert.rejects(run({fetchImpl:async url=>{requests++;return {url,status:200,text:async()=>body}}}),error=>{gap(error);assert.match(error.message,/handoff missing/);return true})
    assert.equal(requests,1)
  }
})
test('native employer mismatch, inactive company filter or changed positive inventory raises gap',async()=>{
  for(const mutate of [r=>r.url===employer.url?{...r,body:r.body.replace('urn:li:organization:3621275','urn:li:organization:999')}:r,
    r=>r.url===listings[0].url?{...r,body:r.body.replace('value="3621275"','value="999"')}:r,
    r=>r.url===listings[0].url?{...r,body:r.body.replace('</body>','<div class="job-search-card">New role</div></body>')}:r]) {
    await assert.rejects(run({fetchImpl:async url=>{const row=mutate(receipts.find(r=>r.url===url));return {url:row.finalUrl,status:row.status,text:async()=>row.body}}}),gap)
  }
})
test('captured gzip envelopes and native body SHA256 values match manifest',()=>{
  const manifest=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
  const sha=value=>createHash('sha256').update(value).digest('hex')
  for(const item of manifest.evidence){
    const gz=readFileSync(new URL('./fixtures/'+item.file,import.meta.url)),raw=gunzipSync(gz)
    assert.equal(sha(gz),item.sha256);assert.equal(sha(raw),item.uncompressedSha256)
    const p=JSON.parse(raw),rows=Array.isArray(p)?p:[p]
    for(const r of item.responses){const row=rows.find(x=>x.url===r.url);assert.equal(typeof row.body==='string'?sha(row.body):null,r.bodySHA256)}
  }
})
