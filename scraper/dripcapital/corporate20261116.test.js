import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {replayNative} from './fixtures/nativeReplay20261114.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-20261116.json.gz',import.meta.url)))).packets[0]
async function replay(change=raw=>raw){
 const fixture=replayNative({mutate:({url})=>url===current.requestedURL?change(Buffer.from(current.bodyBase64,'base64')):undefined})
 return run({fetchImpl:fixture.fetchImpl})
}
test('November16 exact Drip corporate deployment preserves four native India roles and all scope holds',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,4)
 assert.deepEqual(jobs.map(j=>j.sourceJobId),['fk0znmm','fk0zlaf','fk0zldg','fk0pfc9'])
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.lifecycleCleanupAllowed===false&&j.postingDate===null))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const[name,before,after]of[
 ['changed employer','Drip Capital','Other Company'],
 ['changed native handoff','https://dripcapital.recruiterbox.com/#content','https://foreign.recruiterbox.com/#content'],
 ['new program','</head>','<script>window.unreviewed=true</script></head>'],
])test('November16 Drip rejects '+name,async()=>{
 await assert.rejects(replay(raw=>Buffer.from(raw.toString('utf8').replace(before,after))),/Unreviewed complete corporate entity/)
})
