import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261118.json.gz',import.meta.url))))
const NOW='2026-11-18T19:30:00.000Z'
const replay=async(mutate=()=>{})=>{
 const packets=structuredClone(captured);mutate(packets)
 const rows=JSON.parse(packets[5].body)
 const expected=[...packets.slice(0,8).map(packet=>packet.url),...rows.map(row=>row.link),...packets.slice(5,8).map(packet=>packet.url)]
 let index=0
 const jobs=await run({now:NOW,fetch:async(url,init)=>{
  // Closing feeds repeat the original captured envelopes as replay controls;
  // this fixture does not claim a live opening/closing observation.
  assert.equal(url,expected[index++]);assert.equal(init.method,'GET')
  const packet=packets.find(row=>row.url===url)
  return {status:packet.status,url:packet.finalURL,headers:new Headers(packet.headers),text:async()=>packet.body}
 }})
 assert.equal(index,expected.length)
 return jobs
}

test('Crest exact USA and Remote taxonomy entries cannot erase its six validated India posts',async()=>{
 const jobs=await replay()
 assert.deepEqual(jobs.map(job=>job.jobId),['49517','42494','47155','45907','43841','42442'])
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceScopeComplete===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,8)
 assert.deepEqual(jobs.nativeCollectionEvidence.excludedForeignRecords.map(job=>[job.jobId,job.country,job.nativeLocation]),[
  ['54783','United States','California, USA'],['54777','United States','Central U.S. – Remote'],
 ])
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Crest rejects changed country taxonomy identity rather than inheriting India',async()=>{
 await assert.rejects(replay(packets=>{
  const rows=JSON.parse(packets[6].body);rows.find(row=>row.id===15).name='India'
  packets[6].body=JSON.stringify(rows)
 }),/Unknown or conflicting native office/)
})

test('Crest keeps unknown offices and mixed-country role assignments unqualified',async()=>{
 await assert.rejects(replay(packets=>{
  const rows=JSON.parse(packets[6].body);rows.push({id:999,name:'Remote India',slug:'remote-india'})
  packets[6].body=JSON.stringify(rows);packets[6].headers['x-wp-total']='5'
 }),/Unknown or conflicting native office/)
 await assert.rejects(replay(packets=>{
  const rows=JSON.parse(packets[5].body);rows[0].job_location=[13,15]
  packets[5].body=JSON.stringify(rows)
 }),/country|office|taxonomy/i)
})

test('Crest continues validating foreign own-role application identity',async()=>{
 await assert.rejects(replay(packets=>{
  packets[8].body=packets[8].body.replace('name="_wpcf7_container_post" value="54783"','name="_wpcf7_container_post" value="99999"')
 }),/application|form/i)
})

test('Crest reviewed foreign SEO titles do not authorize edited role or URL identities',async()=>{
 await assert.rejects(replay(packets=>{
  packets[8].body=packets[8].body.replace('content="Solutions Consultant – IT Security | California"','content="Unrelated role"')
 }),/title\/URL mismatch/)
 await assert.rejects(replay(packets=>{
  const rows=JSON.parse(packets[5].body);rows[0].title.rendered='Unrelated role'
  packets[5].body=JSON.stringify(rows)
 }),/title\/URL mismatch/)
})

test('Crest foreign-only observations never certify an authoritative India zero',async()=>{
 const jobs=await replay(packets=>{
  const rows=JSON.parse(packets[5].body).slice(0,2)
  packets[5].body=JSON.stringify(rows);packets[5].headers['x-wp-total']='2'
 })
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,2)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
