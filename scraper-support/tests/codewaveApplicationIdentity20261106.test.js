import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as codewave from '../../scraper/codewavetechnologies/script.js'
import {generateFingerprint} from '../utils/applicationIdentity.js'
// Pure identity logic only; the persistence, runner and database paths are not
// imported or called. All source reads are original saved responses.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/codewaveDeltecs20261106/capture.json.gz',import.meta.url))))
const current='https://codewave.com/careers'
const native=()=>codewave.extractOpeningCards(fixture.documents[current].body).filter(row=>row.country==='India')
test('Codewave shared native application entry preserves12 distinct India role fingerprints without invented role URLs',()=>{
 const rows=native();assert.equal(rows.length,12)
 assert.ok(rows.every(row=>row.sourceUrl===current&&row.applyUrl==='https://codewave.com/apply'))
 assert.equal(new Set(rows.map(generateFingerprint)).size,12)
})
test('A one-role Codewave output limit still preserves native role identity on its shared application URL',async()=>{
 const jobs=await codewave.run({maxJobs:1,now:()=> '2026-11-06T10:30:00.000Z',fetchPage:async url=>{
  const page=fixture.documents[url];assert.ok(page,'Only original saved URLs may be read');return {status:page.status,url:page.finalUrl,headers:page.headers,body:page.body,bodyUnavailable:page.bodyUnavailable}
 }})
 assert.equal(jobs.length,1)
 const other=native().find(row=>row.city===jobs[0].city&&row.jobId!==jobs[0].jobId)
 assert.ok(other,'The fixture must include distinct native roles at the same city')
 assert.notEqual(generateFingerprint(jobs[0]),generateFingerprint(other))
})
