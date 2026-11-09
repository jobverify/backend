import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/qandle/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

test('exact CSV company name Qandle is covered by its first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nQandle\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Qandle', 'qandle', 'Qandle']],
  )
})


const load = name => JSON.parse(gunzipSync(readFileSync(new URL('../scraper/qandle/fixtures/' + name + '.json.gz', import.meta.url))))
const receipts = ['official-home','navigation-client','navigation-responses','employer-board','native-portal-responses','native-default-detail'].flatMap(load)
const replay = (mutate = r => r) => async url => {
 const found=receipts.find(r=>r.url===url); assert.ok(found, 'Unexpected source request '+url)
 const r=mutate({...found}); return {ok:r.status===200,url:r.finalUrl,status:r.status,text:async()=>r.body}
}
const gap = e => {assert.equal(e.code,'QANDLE_COVERAGE_GAP');assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.inventoryEvidence.reportedTotal,null);return true}
test('Qandle corporate header binds native portal and generic resume pool is excluded without Wellfound dependency',async()=>{
 const jobs=await run({fetchImpl:replay()});assert.deepEqual(jobs,[])
 const e=readInventoryEvidence(jobs);assert.equal(e.status,'discovery-only');assert.equal(e.firstParty,true);assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null)
 assert.match(e.reason,/talent.pool/)
})
test('Qandle native positive inventory drift, malformed default response and changed generic detail fail closed',async()=>{
 for(const path of ['open-jobs','default-job','job-details/5f7b24f139473e585f0a38f7']) await assert.rejects(run({fetchImpl:replay(r=>r.url.endsWith(path)?{...r,body:'{}'}:r)}),gap)
})
test('Qandle transport failures and hidden corporate careers link cannot certify zero',async()=>{
 for(const mutate of [r=>({...r,status:403}),r=>r.url.endsWith('header.html')?{...r,body:'<template>'+r.body+'</template>'}:r]) await assert.rejects(run({fetchImpl:replay(mutate)}),gap)
})
test('Qandle aggregate deadline covers fetch and body stalls',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})]) await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)
})
test('Qandle exact caller abort reason propagates before and during fetch/body',async()=>{
 for(const stage of ['before','fetch','body']){const c=new AbortController(),reason={stage};if(stage==='before')c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{if(stage==='fetch'){c.abort(reason);return new Promise(()=>{})}return {url,status:200,text:()=>{c.abort(reason);return new Promise(()=>{})}}}}),e=>e===reason)}
})
test('Qandle captured raw gzip and body hashes match original receipts',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../scraper/qandle/fixtures/capture-manifest.json',import.meta.url)))
 const sha=value=>createHash('sha256').update(value).digest('hex')
 for(const e of manifest.evidence){const gz=readFileSync(new URL('../scraper/qandle/fixtures/'+e.file,import.meta.url)),raw=gunzipSync(gz);assert.equal(sha(gz),e.sha256);assert.equal(sha(raw),e.uncompressedSha256);const p=JSON.parse(raw);for(const r of e.responses){const row=(Array.isArray(p)?p:[p]).find(x=>x.url===r.url);assert.equal(sha(row.body),r.bodySHA256)}}
})
