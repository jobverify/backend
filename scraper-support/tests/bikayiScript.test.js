import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{SOURCE,COMPANY,CAREERS_URL,run}from'../../scraper/bikayi/script.js'
import{readInventoryEvidence}from'../utils/inventoryEvidence.js'
const pages=new Map(JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/bikayi/test-data/native-20261103.json.gz',import.meta.url)))).map(row=>[row.requestedUrl,row]))
test('historical Bikayi uses the public current BIK brand and retains all native country gaps',async()=>{
 let audit
 const jobs=await run({fetchPage:async url=>structuredClone(pages.get(url)),onAudit:value=>{audit=value}})
 assert.equal(SOURCE,'bikayi');assert.equal(COMPANY,'BIK');assert.equal(CAREERS_URL,'https://bik.ai/careers')
 assert.equal(jobs.length,4);assert.equal(audit.observedListingCount,12);assert.equal(audit.unknownCountryListingCount,8)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('BIK declared public API denial propagates and is never a successful empty inventory',async()=>{
 await assert.rejects(run({fetchPage:async url=>{
  const page=structuredClone(pages.get(url));if(url.includes('/careers/api/embedjobs/'))page.status=403;return page
 }}),/HTTP status/)
})
