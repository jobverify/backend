import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createSupabaseScraper,CAREERS_PAGE_URL,ASHBY_JOB_BOARD_URL} from './script.js'

// These are two original 2026-10-29 responses, replayed offline. There is no
// second historical inventory, current HTTP response or positive India fixture.
const retained=()=>{
  const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-http-20261029.json.gz',import.meta.url))))
  const body=url=>Buffer.from(fixture.responses[url].bodyBase64,'base64').toString('utf8')
  return {fixture,html:body(CAREERS_PAGE_URL),payload:JSON.parse(body(ASHBY_JOB_BOARD_URL))}
}
const options=(record,extra={})=>({
  fetchText:async url=>{assert.equal(url,CAREERS_PAGE_URL);return record.html},
  fetchJson:async url=>{assert.equal(url,ASHBY_JOB_BOARD_URL);return record.payload},
  ...extra,
})

test('registered Supabase preserves all 64 actual native roles and full criteria before country selection',async()=>{
  const record=retained(),audits=[]
  const provider=getScraperCatalog().find(row=>row.source==='supabase')
  assert.equal(provider.adapter,'script')
  const jobs=await createCatalogScraper(provider).run(options(record,{onAudit:audit=>audits.push(audit)}))
  assert.equal(jobs.length,0)
  assert.equal(audits.length,1)
  const audit=audits[0]
  assert.equal(audit.observedNativeBoardCount,64)
  assert.deepEqual(audit.originalNativePayload,record.payload)
  assert.deepEqual(audit.nativeRecords,record.payload.jobs)
  assert.notEqual(audit.nativeRecords,record.payload.jobs)
  assert.ok(audit.nativeRecords.every(role=>role.descriptionHtml&&role.descriptionPlain))
  assert.deepEqual(audit.nativeRecords.flatMap(role=>role.secondaryLocations),record.payload.jobs.flatMap(role=>role.secondaryLocations))
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.equal(audit.authoritativeSourceTotal,null)
  assert.equal(audit.authoritativeIndiaFacetCount,null)
  assert.match(audit.strongestEngineEvidence.reason,/native-location-scope-unresolved/)
  assert.equal(audit.currentLiveQualification,false)
  assert.equal(audit.noClosingCaptureClaimed,true)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.match(evidence.reason,/supabase-source-scope-unresolved/)
})

for(const [name,change,reason] of [
  ['a duplicate actual native identity',payload=>payload.jobs.push(structuredClone(payload.jobs[0])),/repeated native identity|duplicate native identity/],
  ['an unsupported native schema',payload=>{payload.apiVersion='2'},/unsupported native schema/],
  ['a foreign native posting account',payload=>{payload.jobs[0].jobUrl=payload.jobs[0].jobUrl.replace('/supabase/','/different-account/')},/foreign board or role identity/],
  ['a non-string native country',payload=>{payload.jobs[0].address={postalAddress:{addressCountry:[]}}},/non-string native location/],
  ['a failed envelope containing otherwise real records',payload=>{payload.success=false},/Failed ashby inventory envelope/],
]){
  test('Supabase rejects '+name+' instead of turning it into an unexplained empty result',async()=>{
    const record=retained();change(record.payload)
    await assert.rejects(createSupabaseScraper().run(options(record)),reason)
  })
}

test('Supabase cancellation during audit cannot resolve as a partial or empty inventory',async()=>{
  const record=retained(),controller=new AbortController()
  await assert.rejects(createSupabaseScraper().run(options(record,{
    signal:controller.signal,onAudit:()=>controller.abort(),
  })),{name:'AbortError'})
})

test('Supabase rejects negative output limits before requesting source data',async()=>{
  await assert.rejects(async()=>createSupabaseScraper({maxJobs:-1}).run({
    fetchText:async()=>assert.fail('invalid limit must fail before transport'),
    fetchJson:async()=>assert.fail('invalid limit must fail before transport'),
  }),/invalid Supabase output limit/i)
})
