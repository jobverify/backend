import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-declared.json.gz',import.meta.url))))
const packets=new Map(current.packets.map(row=>[row.url,row]))
const expected=JSON.parse(fs.readFileSync(new URL('./test-data/current-react-contract-20261111/derived-native-literal-models.json',import.meta.url))).models
for(const row of current.packets){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bodyBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)}
const registered=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='bluebinaries'))
function replay(change=(text)=>text){return{fetchPage:async url=>{const row=packets.get(url);assert.ok(row,'only retained current employer graph '+url);return{url:row.finalURL,status:row.status,contentType:row.contentType,body:change(Buffer.from(row.bodyBase64,'base64').toString('utf8'),url)}}}}
test('new Blue Binaries root and home route retain all nine original observations through registered decoration',async()=>{
 const jobs=await registered().run(replay())
 assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'bluebinaries').observedRecordCount,9)
 assert.deepEqual(jobs.nativeCollectionEvidence.observations.map(row=>row.sourceNativeFields),expected)
 assert.ok(jobs.nativeCollectionEvidence.observations.every(row=>row.nativeModelSourceURL==='https://www.bluebinaries.com/static/js/main.69b436a7.js'))
 assert.ok(jobs.nativeCollectionEvidence.observations.every(row=>row.sourceDetailComplete===false&&row.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('Blue Binaries rejects a changed current program before admitting observations',async()=>{
 await assert.rejects(registered().run(replay((text,url)=>url.endsWith('/main.69b436a7.js')?text+';fetch("https://foreign.example/jobs")':text)),/unreviewed complete declared entry program/)
})
test('Blue Binaries current declared entry cannot move to another origin',async()=>{
 await assert.rejects(registered().run(replay((text,url)=>url==='https://www.bluebinaries.com/'?text.replace('/static/js/main.69b436a7.js','https://foreign.example/static/js/main.69b436a7.js'):text)),/unreviewed complete employer root/)
})
