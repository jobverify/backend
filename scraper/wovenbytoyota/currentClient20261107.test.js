import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const client=capture.packets.find(row=>row.body.includes('https://api.lever.co/v0/postings/'))
const options=(change=(url,body)=>body)=>({
 fetchPage:async url=>{
  const row=capture.packets.find(row=>row.requestUrl===url)
  if(!row||url.startsWith('https://api.lever.co/'))throw Error('Unretained unrelated client resource')
  return {status:row.status,url:row.url,html:change(url,row.body)}
 },
 fetchJson:async url=>{
  const row=capture.packets.find(row=>row.requestUrl===url)
  assert.ok(row,'Only retained complete native pagination: '+url)
  return JSON.parse(row.body)
 },
})
test('Woven follows its current declared reviewed client and reconciles the full unfiltered native board',async()=>{
 const jobs=await run(options())
 const proof=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0)
 assert.equal(proof.reportedTotal,141)
 assert.equal(proof.indiaFacetCount,0)
 assert.equal(proof.listingComplete,true)
})
test('Woven refuses changed native tenant code in the current client',async()=>{
 await assert.rejects(run(options((url,body)=>url===client.requestUrl?body.replaceAll('postings/woven-by-toyota','postings/other-employer'):body)),/binding/i)
})
