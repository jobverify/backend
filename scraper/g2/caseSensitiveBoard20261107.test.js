import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/hard-failures-20261107.json.gz',import.meta.url))))
const api=packets.find(p=>p.url.startsWith('https://api.')),payload=JSON.parse(Buffer.from(api.bodyBase64,'base64'))
test('registered G2 uses the exact case-sensitive employer-bound native board identity',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='g2'),calls=[]
 const jobs=await createCatalogScraper(provider).run({fetchJson:async url=>{calls.push(url);return structuredClone(payload)}})
 assert.deepEqual(calls,[api.url]);assert.ok(jobs.length>0);assert.equal(provider.boardToken,'G2')
 assert.ok(jobs.every(j=>j.applyUrl.startsWith('https://jobs.ashbyhq.com/G2/')&&j.sourceDescription?.length>100))
 assert.equal(jobs.filter(j=>j.country==='India').length,3)
 assert.equal(jobs.filter(j=>j.country===null).length,16)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,48)
})
test('matching board token still rejects foreign employer and another role application identity',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='g2')
 for(const replace of ['https://jobs.ashbyhq.com/Foreign/','https://jobs.ashbyhq.com/G2/unrelated/']){
  const changed=structuredClone(payload);changed.jobs[0].jobUrl=replace+changed.jobs[0].id
  await assert.rejects(createCatalogScraper(provider).run({fetchJson:async()=>changed}),/foreign board or role identity/)
 }
})
