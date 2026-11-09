import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{SOURCE,COMPANY,CAREERS_URL,run}from'../../scraper/airasiaindia/script.js'
import{readInventoryEvidence}from'../utils/inventoryEvidence.js'
const pages=new Map(JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/airasiaindia/test-data/native-20261103.json.gz',import.meta.url)))).map(row=>[row.requestedUrl,row]))
test('historical AirAsia India uses the current corporate-declared AIX brand without confusing Air India',async()=>{
 let audit
 const jobs=await run({fetchPage:async url=>structuredClone(pages.get(url)),onAudit:value=>{audit=value}})
 assert.equal(SOURCE,'airasiaindia');assert.equal(COMPANY,'Air India Express');assert.equal(CAREERS_URL,'https://www.airindiaexpress.com/careers')
 assert.equal(jobs.length,0);assert.equal(audit.nativeBrand,'aix');assert.equal(audit.sourceCompanyWideScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('current AIX native board denial is not an empty historical-brand success',async()=>{
 await assert.rejects(run({fetchPage:async url=>{
  const page=structuredClone(pages.get(url));if(url==='https://careers.airindia.com/aix')page.status=403;return page
 }}),/HTTP status/)
})
