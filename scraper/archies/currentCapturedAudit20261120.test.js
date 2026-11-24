import fs from'node:fs'
import assert from'node:assert/strict'
import test from'node:test'
import {gunzipSync}from'node:zlib'
import {createHash}from'node:crypto'
import {run}from'./script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden}from'../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-safe-cohort-20261120.json.gz',import.meta.url))))
test('actual current Archies observed cohort retains every full safe document once in models within the original12MiB audit ceiling',async()=>{
 const seen=new Map(),calls=[]
 const jobs=await run({fetchImpl:async url=>{const n=seen.get(url)??0,rows=fixture.responses.filter(r=>r.requestedURL===url),row=rows[n];assert.ok(row,'only actual current own routes');seen.set(url,n+1);calls.push(url);assert.equal(createHash('sha256').update(row.body).digest('hex'),row.persistedSHA256);return Object.defineProperty(new Response(row.body,{status:row.status,headers:{'content-type':'text/html'}}),'url',{value:row.finalURL})}})
 const audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(calls.length,4);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.ok(Buffer.byteLength(JSON.stringify(audit))<=12*1024*1024)
 assert.equal(audit.nativeOpening.wholeOriginalHomeHTML,fixture.responses[0].body)
 assert.equal(audit.nativeOpening.wholeOriginalAboutHTML,fixture.responses[1].body)
 assert.equal(audit.nativeClosing.wholeOriginalHomeHTML,fixture.responses[2].body)
 assert.equal(audit.nativeClosing.wholeOriginalAboutHTML,fixture.responses[3].body)
 assert.equal(audit.nativeOpening.home.wholeOriginalHTML,undefined)
 assert.equal(audit.nativeOpening.about.wholeOriginalHTML,undefined)
 assert.equal(audit.originalResponses.length,4)
 assert.equal(audit.wholeObservedCorporateModelClosingReconciled,true)
 assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.storefrontATSStudioIsRecruitingATS,false)
})
