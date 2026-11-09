import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../../scraper/dentalkart/script.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/dentalkart-public-20261103.json.gz',import.meta.url))))
test('Dentalkart earlier original public captures retain their complete hashes',()=>{
 for(const row of capture.responses)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
})
test('Dentalkart earlier API cohort is historical evidence rather than a current company total',()=>{
 const row=capture.responses.find(row=>row.url.includes('/recruit/v2/public/Job_Openings'));assert.ok(row)
 const records=JSON.parse(row.body).data;assert.equal(records.length,31);assert.equal(records.filter(row=>row.Publish===true&&row.Is_Locked===false).length,18)
 assert.equal(source.VERIFIED_AT,null)
})
test('Dentalkart earlier body-only callback cannot certify original HTTP metadata',async()=>{
 await assert.rejects(()=>source.run({fetchPage:async url=>{const row=capture.responses.find(row=>row.url===url);assert.ok(row);return {status:row.status,url:row.finalUrl,html:row.body}}}),/original native entity/)
})
