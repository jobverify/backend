import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createAurobindoPharmaScraper} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url))))
test('current Aurobindo declared404handoff remains unknown inventory without guessing a host-root board',async()=>{
 const reads=[];let audit
 await assert.rejects(createAurobindoPharmaScraper().run({fetchPage:async url=>{reads.push(url);const r=fixture.responses.find(r=>r.url===url);assert.ok(r,'Captured declared source URL');return{status:r.status,url:r.finalURL,html:r.body,headers:r.headers}},onAudit:async value=>{audit=value}}),error=>error.status===404&&error.softFailure===true&&error.abortRetries===true&&error.inventoryEvidence.reportedTotal===null)
 assert.deepEqual(reads,['https://www.aurobindo.com/careers','https://aurobindo.talentrecruit.com/Search/']);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.nativeInventoryComplete,false)
})
