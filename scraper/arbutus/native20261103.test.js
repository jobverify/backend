import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, CAREER_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const records = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))))
const replay = transform => ({ fetchText: async url => {
  const row=records.find(row=>row.url===url);assert.ok(row,url)
  return transform ? transform(url,row.body) : row.body
} })

test('current corporate delegation and full native Paylocity array establish an actual empty declared board at closing', async()=>{
  const jobs=await run(replay()),evidence=readInventoryEvidence(jobs)
  assert.equal(jobs.length,0);assert.ok(evidence)
  assert.equal(evidence.status,'verified-empty');assert.equal(evidence.reportedTotal,0)
  assert.equal(evidence.indiaFacetCount,0);assert.equal(evidence.listingComplete,true)
  assert.match(evidence.reason,/closing/)
})

test('Arbutus refuses missing native inventory and another employer identity', async()=>{
  for(const change of [body=>body.replace('"Jobs":[]','"Unrelated":[]'),body=>body.replace('"ModuleTitle":"Arbutus Biopharma Inc "','"ModuleTitle":"Another Employer"')])
    await assert.rejects(run(replay((url,body)=>url===CAREER_PAGE_URL?change(body):body)),/native|employer|identity/i)
})

test('Arbutus does not certify zero after its native closing array gains a role', async()=>{
  let reads=0
  await assert.rejects(run(replay((url,body)=>url===CAREER_PAGE_URL&&++reads===2?body.replace('"Jobs":[]','"Jobs":[{"JobId":999,"JobTitle":"New role"}]'):body)),/closing|inventory/i)
})

test('Arbutus cancellation settles a corporate fetch override that ignores its signal', async()=>{
  const controller=new AbortController(),reason=Error('stop Arbutus')
  await assert.rejects(run({signal:controller.signal,fetchText:()=>{controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason)
})
