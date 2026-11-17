import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url)))),HOME='https://archiesonline.com/',ABOUT=HOME+'pages/about'
const original=url=>fixture.responses.find(r=>r.url===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
test('Archies current actual storefront and declared About models are retained without guesses or a company-zero claim',async()=>{
 const calls=[],jobs=await run({fetchPage:async()=>({...original(HOME),html:body(original(HOME))}),fetchImpl:async(url,init)=>{const r=original(url);assert.ok(r);calls.push(url);assert.equal(init.method,'GET');return Object.defineProperty(new Response(body(r),{status:r.status,headers:r.headers}),'url',{value:r.url})}}),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(calls,[HOME,ABOUT,HOME,ABOUT]);assert.equal(jobs.length,0);assert.equal(audit.observedVacancyCount,0);assert.equal(audit.nativeInventoryQualified,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.wholeObservedCorporateModelClosingReconciled,true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.ok(audit.nativeOpening.wholeOriginalHomeHTML.length>1000000)
})
test('Archies current native403 retains the observed HTTP denial before body qualification and makes no guessed route request',async()=>{
 let calls=0
 await assert.rejects(run({fetchPage:async()=>({...original(HOME),html:body(original(HOME))}),fetchImpl:async url=>{calls++;return Object.defineProperty(new Response('denied',{status:403,headers:{'content-type':'text/html'}}),'url',{value:url})}}),error=>error.httpStatus===403&&error.failureKind==='blocked_or_access_denied')
 assert.equal(calls,1)
})

for (const [label, model] of [
 ['direct', {'@type':'JobPosting', title:'New native role'}],
 ['graph', {'@context':'https://schema.org','@graph':[{'@type':'JobPosting', title:'New native role'}]}],
 ['array type', [{'@type':['Thing','https://schema.org/JobPosting'], title:'New native role'}]],
]) test(`Archies ${label} structured role requires native review instead of zero vacancy observations`,async()=>{
 const home=body(original(HOME)).replace('</head>',`<script type="application/ld+json">${JSON.stringify(model)}</script></head>`)
 await assert.rejects(run({fetchPage:async()=>({...original(HOME),html:body(original(HOME))}),fetchImpl:async url=>{
  const r=original(url)
  return Object.defineProperty(new Response(url===HOME?home:body(r),{status:r.status,headers:r.headers}),'url',{value:r.url})
 }}),error=>/structured JobPosting.*review/i.test(error.message)&&error.lifecycleCleanupAllowed!==true)
})
