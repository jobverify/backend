import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,FIRST_PARTY_ROOT_URL} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-contract-20261120.json.gz',import.meta.url))))
const packet=fixture.packets[0],html=Buffer.from(packet.bodyBase64,'base64').toString()
test('TaxBuddy current own page preserves employer observation while absent active recruiting delegation remains held',async()=>{
 let reads=0
 await assert.rejects(run({fetchImpl:async url=>{reads++;assert.equal(url,FIRST_PARTY_ROOT_URL);return Object.defineProperty(new Response(html,{status:200}),'url',{value:url})}}),error=>{
  assert.equal(error.code,'TAXBUDDY_COVERAGE_GAP')
  assert.equal(error.inventoryEvidence.firstParty,true)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.linkedEmployerEvidence,null)
  assert.ok(/active recruiting delegation/.test(error.message),'precise current source hold')
  return true
 })
 assert.equal(reads,1)
})
