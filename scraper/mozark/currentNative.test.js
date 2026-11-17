import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url)))),HOME='https://www.mozark.ai/',PROGRAM=HOME+'site/assets/index-COF7qz_J.js',ABOUT=HOME+'about'
const original=url=>fixture.responses.find(r=>r.url===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
test('Mozark current actual shell, whole native client and declared About target retain unknown company inventory',async()=>{
 const calls=[],jobs=await run({fetchPage:async()=>({...original(HOME),html:body(original(HOME))}),fetchImpl:async(url,init)=>{const r=original(url);assert.ok(r);calls.push(url);assert.equal(init.method,'GET');return Object.defineProperty(new Response(body(r),{status:r.status,headers:r.headers}),'url',{value:r.url})}}),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(calls,[HOME,PROGRAM,ABOUT,HOME,PROGRAM,ABOUT]);assert.equal(jobs.length,0);assert.equal(audit.observedVacancyCount,0);assert.equal(audit.nativeInventoryQualified,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.wholeObservedCorporateAndClientModelClosingReconciled,true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(audit.nativeOpening.program.sha256,'838544485d7664c0761470a9da098e12a5d14197d24e4eb5b6184640ce440984')
})
test('Mozark current native403 retains the observed HTTP denial instead of probing old missing routes',async()=>{
 let calls=0
 await assert.rejects(run({fetchPage:async()=>({...original(HOME),html:body(original(HOME))}),fetchImpl:async url=>{calls++;return Object.defineProperty(new Response('denied',{status:403,headers:{'content-type':'text/html'}}),'url',{value:url})}}),error=>error.httpStatus===403&&error.failureKind==='blocked_or_access_denied')
 assert.equal(calls,1)
})
