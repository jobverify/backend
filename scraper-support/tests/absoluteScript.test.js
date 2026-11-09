import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import zlib from 'node:zlib'
globalThis.fetch=async()=>{throw new Error('ABSOLUTE_OFFLINE_NETWORK_TRIPWIRE')}
const absolute=await import('../../scraper/absolute/script.js')
const {readInventoryEvidence}=await import('../utils/inventoryEvidence.js')
const manifest=JSON.parse(fs.readFileSync(new URL('../../scraper/absolute/fixtures/native-manifest.json',import.meta.url)))
const saved=new Map(manifest.responses.map(r=>[r.requestedUrl,zlib.gunzipSync(fs.readFileSync(new URL(`../../scraper/absolute/fixtures/${r.fixture}`,import.meta.url))).toString()]))
test('Absolute current corporate binding and all global table listings are recognized',()=>{
  assert.equal(absolute.hasOfficialHomepageSignal(saved.get(absolute.HOMEPAGE_URL)),true)
  assert.equal(absolute.hasOfficialCareersSignal(saved.get(absolute.CAREERS_URL)),true)
  assert.equal(absolute.extractJobBoardUrl(saved.get(absolute.CAREERS_URL)),absolute.JOB_BOARD_URL)
  const rows=absolute.extractJobBoardListings(saved.get(absolute.JOB_BOARD_URL))
  assert.equal(rows.length,19)
  assert.equal(rows[0].jobId,'ogAUAfw4')
  assert.ok(rows.every(r=>r.requisitionId===null))
})
test('Absolute direct factory and exported run retain injected transports and evidence',async()=>{
  const options={fetchPage:async url=>{assert.ok(saved.has(url));return saved.get(url)},now:()=> '2026-10-27T11:00:00.000Z'}
  for(const jobs of [await absolute.createAbsoluteScraper(options).run(options),await absolute.run(options)]){
    assert.equal(jobs.length,0)
    assert.equal(readInventoryEvidence(jobs).reportedTotal,19)
    assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  }
})
test('Absolute default transport uses bounded normal public GET and stops first denial',async()=>{
  const previous=globalThis.fetch
  let count=0
  globalThis.fetch=async(url,options)=>{count++;assert.equal(url,absolute.CAREERS_URL);assert.equal(options.method,'GET');assert.ok(options.signal);return new Response('Access denied',{status:403})}
  try{await assert.rejects(absolute.run(),/403/);assert.equal(count,1)}finally{globalThis.fetch=previous}
})
test('Absolute fails closed when corporate binding changes or a bot gate appears',async()=>{
  await assert.rejects(absolute.run({fetchPage:async()=>'<title>Careers | Unrelated</title>'}),/careers handoff/i)
  await assert.rejects(absolute.run({fetchPage:async()=>'<title>Just a moment</title>'}),/bot gate/i)
})
