import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,extractVisibleListings,extractJobDetail} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261117/current-native.json.gz',import.meta.url)))),text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
const careers=fixture.responses.find(p=>p.requestedURL==='https://bfwindia.com/careers/')
test('current native listing observation retains authored Thally without inventing a country suffix',()=>{
 const rows=extractVisibleListings(text(careers));assert.equal(rows.length,5)
 assert.ok(rows.every(r=>r.location==='Thally'&&r.city==='Thally'))
})
test('current404 failure audit preserves all native summary locations and cleanup hold without guessed India',async()=>{
 for(const p of fixture.responses)assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.bodySHA256)
 await assert.rejects(run({fetchPage:async url=>{const p=fixture.responses.find(p=>p.requestedURL===url);assert.ok(p);return{url:p.finalURL,status:p.status,html:text(p)}}}),error=>{
  assert.equal(error.code,'BFW_NATIVE_DETAIL_HTTP404');assert.equal(error.status,404)
  assert.equal(error.recruitmentObservations.selectedListings.length,5)
  assert.ok(error.recruitmentObservations.selectedListings.every(r=>r.location==='Thally'))
  assert.equal(error.recruitmentObservations.companyIndiaZeroProven,false);assert.equal(error.lifecycleCleanupAllowed,false);return true
 })
})
test('legacy metadata-only detail cannot manufacture India from a bare native city if its URL becomes available',()=>{
 const listing={title:'Unqualified metadata example',location:'Bengaluru',city:'Bengaluru',sourceUrl:'https://bfwindia.com/careers/head-of-quality/'}
 const sample='<title>Unqualified metadata example - Bharat Fritz Werner (BFW) India</title><main>Apply for this position<form class="elementor-form"><input type="file">Apply now</form></main>',observation=extractJobDetail(sample,listing)
 assert.equal(observation.country,null);assert.equal(observation.sourceCountryScopeUnresolved,true)
 assert.equal(observation.sourceDetailComplete,false);assert.equal(observation.lifecycleCleanupAllowed,false)
})
