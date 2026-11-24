import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261120.json.gz',import.meta.url))))
test('current Accion country-untyped empty result carries an explicit lifecycle hold through registered decoration',async()=>{
 let audit;const counts=new Map(),calls=[]
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source==='accionlabs')).run({
  fetchPage:async url=>{const index=counts.get(url)??0,rows=fixture.responses.filter(row=>row.url===url),row=rows[index];assert.ok(row,'exact captured route '+url);counts.set(url,index+1);calls.push(row.ordinal);assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256);return{ok:row.status===200,status:row.status,url:row.finalURL,finalUrl:row.finalURL,text:row.body}},
  onAudit:async value=>{audit=value},
 })
 assert.equal(jobs.length,0);assert.deepEqual(calls,[1,2,3,4,5,6])
 assert.equal(audit.nativeRecords.length,1);assert.equal(audit.nativeRecords[0].country,null)
 assert.equal(audit.nativeRecords[0].location,'Bridgeville, PA 15017');assert.equal(audit.nativeRecords[0].sourceDetailComplete,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(audit.lifecycleCleanupAllowed,false)
})
