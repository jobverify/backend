import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-native20261120.json.gz',import.meta.url))))
export async function replay(options={},mutate=(row)=>row){
 const requests=[],originalFetch=globalThis.fetch
 globalThis.fetch=async(url,init={})=>{
  const row=fixture.responses.find(row=>row.requestedURL===String(url));assert.ok(row,'No unrecorded or guessed network URL: '+String(url))
  requests.push(String(url));const changed=mutate(structuredClone(row),requests.length,init)
  const response=new Response(changed.body,{status:changed.status,headers:changed.headers});Object.defineProperty(response,'url',{value:changed.finalURL});return response
 }
 try{return {jobs:await run(options),requests}}catch(error){return {error,requests}}finally{globalThis.fetch=originalFetch}
}
test('all current original fixture bodies retain their persisted integrity',()=>{
 for(const row of fixture.responses){assert.equal(createHash('sha256').update(row.body).digest('hex'),row.persistedSHA256);assert.equal(Buffer.byteLength(row.body),row.persistedBytes)}
})
test('registered current model retains four literal cards and location/title conflicts without company-zero',async()=>{
 const {jobs,error,requests}=await replay()
 assert.equal(jobs,undefined)
 assert.ok(error?.nativeCollectionEvidence,'typed native hold audit is required')
 const audit=error.nativeCollectionEvidence
 assert.equal(audit.source,'metricstream');assert.equal(audit.observedRecordCount,4);assert.equal(audit.indiaJobs,0)
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.closingReconciled,true)
 assert.equal(audit.records.find(r=>r.title==='Head of Services').hold,'listing_detail_country_conflict')
 assert.equal(audit.records.find(r=>r.title.startsWith('VP Customer')).hold,'listing_detail_title_conflict')
 assert.equal(requests.length,10)
})

test('caller entry abort preserves an exact frozen opaque reason with no read',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:'caller-entry'});caller.abort(reason)
 const {error,requests}=await replay({signal:caller.signal})
 assert.equal(error,reason);assert.equal(requests.length,0)
})
test('body-only callbacks cannot certify current HTTP authority',async()=>{
 const {error,requests}=await replay({fetchText:async()=>'<html>not evidence</html>'})
 assert.match(error?.message??'',/metadata|body-only/i);assert.equal(requests.length,0)
})
test('denial is retained and stops at the first configured read',async()=>{
 const {error,requests}=await replay({},row=>({...row,status:403,body:'<title>Access denied</title>'}))
 assert.equal(error?.status,403);assert.equal(error?.failureKind,'blocked_or_access_denied');assert.equal(requests.length,1)
 assert.equal(error?.nativeCollectionEvidence?.closingReconciled,false)
})
test('foreign final URL never receives trusted source authority',async()=>{
 const {error,requests}=await replay({},row=>({...row,finalURL:'https://unrelated.invalid/careers'}))
 assert.equal(error?.failureKind,'parser_or_contract_error');assert.equal(requests.length,1)
})
test('caller abort during pacing preserves opaque reason and prevents next fetch',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:'during-pacing'})
 const {error,requests}=await replay({signal:caller.signal},row=>{setTimeout(()=>caller.abort(reason),30);return row})
 assert.equal(error,reason);assert.equal(requests.length,1)
})
test('caller cancellation triggered by final reader close retains exact ownership',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:'during-close'})
 const {error,requests}=await replay({signal:caller.signal},(row,n,init)=>{
  init.signal.addEventListener('abort',()=>caller.abort(reason),{once:true})
  return {...row,body:'<title>Unreviewed own source</title>'}
 })
 assert.equal(error,reason);assert.ok(requests.length<=2)
})

test('full native criteria, published date, form fields, and distinct raw cards survive',async()=>{
 const {readCurrentMetricListings,readCurrentMetricDetail}=await import('./currentNative20261120.js')
 const listing=readCurrentMetricListings(fixture.responses[1].body)
 assert.equal(listing.records.length,4);assert.equal(new Set(listing.records.map(r=>r.sourceUrl)).size,3)
 assert.equal(listing.records[3].nativeCountry,'India');assert.equal(listing.records[3].postingDate,'2026-08-21')
 const detail=readCurrentMetricDetail(fixture.responses[2].body,fixture.responses[2].requestedURL)
 assert.equal(detail.nativeCountry,'United Kingdom');assert.ok(detail.criteriaText.includes('BE/ BTech/ MCA/ MTech'))
 assert.equal(detail.fields.find(f=>f.attrs.name==='resume').attrs.accept,'.pdf')
 assert.equal(detail.formRole,'Solution Consultant')
})
test('all raw closing role and form changes remain unreconciled',async()=>{
 const {error}=await replay({},(row,n)=>n===10?{...row,body:row.body.replace('name="experience"','name="different_experience"')}:row)
 assert.equal(error?.nativeCollectionEvidence?.closingReconciled,false)
 assert.equal(error?.nativeCollectionEvidence?.rawGlobalEqual,false)
})
