import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createByjusScraper} from './script.js'
test('BYJUS reads only current declared hiring routes and retains broken categories and public campaign criteria without fake zero',async()=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url)))),reads=[];let audit
 await assert.rejects(createByjusScraper().run({fetchPage:async url=>{reads.push(url);const r=fixture.responses.find(r=>r.url===url);assert.ok(r,'Captured declared public hiring URL');return{status:r.status,url:r.finalURL,html:r.body,headers:r.headers}},onAudit:value=>{audit=value}}),error=>error.failureKind==='source_inventory_unavailable'&&error.inventoryEvidence.reportedTotal===null)
 assert.equal(audit.advertisedCategories.length,13);assert.equal(audit.publicHiringObservations.length,2);assert.ok(audit.publicHiringObservations.some(row=>row.publicCriteria.includes('4 LPA')));assert.ok(audit.publicHiringObservations.some(row=>row.countryScope==='India'));assert.equal(audit.nativeInventoryComplete,false)
 assert.ok(reads.every(url=>!['/chemistry/','/questions/','/maths/','/free-ias-prep/','/sitemap'].some(path=>url.includes(path))))
})
