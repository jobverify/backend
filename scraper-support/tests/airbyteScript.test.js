import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

globalThis.fetch=()=>{throw new Error('OFFLINE GLOBAL FETCH TRIPWIRE')}
const airbyte=await import('../../scraper/airbyte/script.js')
const {readInventoryEvidence}=await import('../utils/inventoryEvidence.js')
const root=new URL('../../scraper/airbyte/fixtures/',import.meta.url)
const manifest=JSON.parse(readFileSync(new URL('raw-manifest.json',root)))
const bodies=new Map(manifest.map(r=>[r.url,readFileSync(new URL(r.bodyPath,root),'utf8')]))
const options=(transform=(url,body)=>body)=>{
  const get=async url=>{assert.ok(bodies.has(url),'Expected retained native route: '+url);return transform(url,bodies.get(url))}
  return {fetchText:get,fetchJson:async url=>JSON.parse(await get(url))}
}

test('Airbyte source resolves current corporate and Ashby native routes',()=>{
  assert.equal(airbyte.SOURCE,'airbyte');assert.equal(airbyte.COMPANY,'Airbyte')
  assert.equal(airbyte.CAREERS_PAGE_URL,'https://airbyte.com/company/careers')
  assert.equal(airbyte.ASHBY_PUBLIC_BOARD_URL,'https://jobs.ashbyhq.com/airbyte')
  assert.equal(airbyte.ASHBY_JOB_BOARD_URL,'https://api.ashbyhq.com/posting-api/job-board/airbyte')
})
test('Airbyte zero India result requires every retained native role and closing evidence',async()=>{
  let audit
  const jobs=await airbyte.createAirbyteScraper({now:()=> '2026-10-27T10:00:00.000Z'}).run({...options(),onNativeAudit:x=>{audit=x}})
  assert.deepEqual(jobs,[]);assert.equal(audit.fullDetailCount,13);assert.equal(audit.closingFullDetailCount,13)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(readInventoryEvidence(jobs).reportedTotal,13)
})
test('Airbyte rejects changed corporate employer, board employer and malformed native payload',async()=>{
  await assert.rejects(airbyte.run(options((url,body)=>url===airbyte.CAREERS_PAGE_URL?'<html><h1>Other employer</h1></html>':body)),/corporate-employer/)
  await assert.rejects(airbyte.run(options((url,body)=>url===airbyte.ASHBY_PUBLIC_BOARD_URL?body.replace('"name":"Airbyte"','"name":"Other employer"'):body)),/native-board-employer/)
  await assert.rejects(airbyte.run(options((url,body)=>url===airbyte.ASHBY_JOB_BOARD_URL?'{}':body)),/invalid-or-truncated-native-feed/)
})
test('Airbyte never certifies an empty result when a native detail is unavailable',async()=>{
  const jobs=await airbyte.run(options((url,body)=>{
    if(url===airbyte.ASHBY_PUBLIC_BOARD_URL+'/efe55756-f28b-4030-b9a0-539f6c8ed8ff')throw new Error('Synthetic unavailable public native detail')
    return body
  }))
  assert.deepEqual(jobs,[]);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
