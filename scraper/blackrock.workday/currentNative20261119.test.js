import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parseCurrentIndex,parseCurrentRole,runCurrentNative} from './currentNative20261119.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
const pages=new Map(fixture.records.map(r=>[r.requestedUrl,r]))
const body=url=>Buffer.from(pages.get(url).bodyBase64,'base64').toString()
const listings=()=>parseCurrentIndex(body(fixture.indexURL))
const india=()=>listings().find(r=>r.sourceUrl.includes('/gurgaon/'))
const mutate=(html,change)=>html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(_,a,s,b)=>{const m=JSON.parse(s);change(m);return a+JSON.stringify(m)+b})
const response=(url,html=body(url),status=200)=>{const r=new Response(html,{status,headers:pages.get(url).headers});Object.defineProperty(r,'url',{value:url});return r}
test('BlackRock native first page retains ten own identities and three typed India vacancies',()=>{
 const rows=listings();assert.equal(rows.length,10)
 const facts=rows.map(r=>parseCurrentRole(body(r.sourceUrl),r,fixture.observedAt))
 assert.equal(facts.filter(r=>r.country==='India').length,3)
 for(const row of facts.filter(r=>r.country==='India')){assert.equal(row.nativeEmployerDisplayName,'BlackRock');assert.match(row.applyUrl,/blackrock\.wd1\.myworkdayjobs\.com/);assert.equal(row.sourceScopeComplete,false)}
})
test('BlackRock foreign employer, country contradiction, wrong application ID and expired role stay held',()=>{
 const row=india(),html=body(row.sourceUrl)
 for(const change of [m=>{m.hiringOrganization.name='Other'},m=>{m.jobLocation.push({'@type':'Place',address:{addressCountry:'Canada'}})},m=>{m.validThrough='2020-01-01'},m=>{m.status='Closed'}])assert.throws(()=>parseCurrentRole(mutate(html,change),row,fixture.observedAt))
 assert.throws(()=>parseCurrentRole(html.replaceAll('_R267053/apply','_R000001/apply'),row,fixture.observedAt))
})
test('BlackRock basic current identities survive missing descriptions only as explicit partial records',()=>{
 const row=india(),fact=parseCurrentRole(mutate(body(row.sourceUrl),m=>{m.description=''}),row,fixture.observedAt)
 assert.equal(fact.country,'India');assert.equal(fact.sourceDetailComplete,false);assert.equal(fact.sourceDescription,null)
})
test('BlackRock original GET replay succeeds under current publication policy with company cleanup held',async()=>{
 const jobs=await runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>response(url)})
 assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(assessSoftFailureAcquisition({source:'blackrock',companyName:'BlackRock',adapter:'script',countryFilter:'India'},jobs).runnerOutcome.success,true)
})
test('BlackRock changed closing role and closing HTTP503 cannot report a stable publication',async()=>{
 for(const status of [200,503]){const calls=new Map();await assert.rejects(runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>{const n=(calls.get(url)??0)+1;calls.set(url,n);return url===india().sourceUrl&&n===2?response(url,body(url).replaceAll('About this Role','Changed criteria'),status):response(url)}}))}
})
test('BlackRock preserves opaque caller cancellation before and during original headers',async()=>{
 const c=new AbortController(),reason={source:'blackrock'};c.abort(reason)
 await assert.rejects(runCurrentNative({signal:c.signal}),e=>e===reason)
 const p=new AbortController(),task=runCurrentNative({signal:p.signal,fetchImpl:()=>new Promise(()=>{})});setTimeout(()=>p.abort(reason),10);await assert.rejects(task,e=>e===reason)
})
test('BlackRock authored custom start/end facets retain date ambiguity without rewriting own publication',()=>{
 const row=india(),fact=parseCurrentRole(body(row.sourceUrl),row,fixture.observedAt)
 assert.equal(fact.postingDate,'2026-11-19');assert.equal(fact.sourceNativePublicationDateConflict,true)
 assert.equal(fact.sourceNativeCustomDateFacets.length,2)
 assert.ok(fact.sourceNativeCustomDateFacets.every(r=>r.original&&r.semanticsUnresolved===true))
})
test('BlackRock clearly past custom end facets hold the affected native role',async()=>{
 const row=india(),expired=body(row.sourceUrl).replaceAll('Posting_End_Date-31-12-2026','Posting_End_Date-01-01-2020')
 assert.throws(()=>parseCurrentRole(expired,row,fixture.observedAt))
 const jobs=await runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>response(url,url===row.sourceUrl?expired:body(url))})
 assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.requisitionId!=='R267053'))
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRows.length,1)
})
