import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createAstronicsScraper,HOMEPAGE_URL,SOURCE,COMPANY} from '../../scraper/astronics/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const rows=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/astronics/test-data/native-20261103.json.gz',import.meta.url))))
globalThis.fetch=async()=>{throw Error('OFFLINE legacy contract network tripwire')}
const replay=mutate=>{const calls=[];return{calls,fetchPage:async url=>{calls.push(url);const packet=structuredClone(rows.findLast(row=>row.requestedUrl===url));assert.ok(packet,'published native URL '+url);mutate?.(packet,url);return packet}}}
test('Astronics original source now follows its current Test Systems public careers channels',async()=>{
 const mock=replay(),jobs=await createAstronicsScraper().run(mock)
 assert.equal(SOURCE,'astronics');assert.equal(COMPANY,'Astronics Test Systems')
 assert.equal(HOMEPAGE_URL,'https://www.astronics.com/test-systems')
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,94)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.ok(!mock.calls.some(url=>url.includes('diagnosys.com')||url.includes('appone')))
})
test('Astronics institutional India text never supplies a role workplace country',async()=>{
 const mock=replay((packet,url)=>{if(url===HOMEPAGE_URL)packet.html=packet.html.replace('</body>','<p>Astronics Test Systems Bangalore, India office</p></body>')})
 const jobs=await createAstronicsScraper().run(mock)
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('Astronics missing current Test Systems continuity does not trigger a legacy-board retry',async()=>{
 const mock=replay((packet,url)=>{if(url===HOMEPAGE_URL){const before=packet.html;packet.html=packet.html.replaceAll('Diagnosys','Unbound historical publisher');assert.notEqual(packet.html,before)}})
 await assert.rejects(createAstronicsScraper().run(mock),/Test Systems|bridge|identity/i)
 assert.equal(mock.calls.length,1)
})
