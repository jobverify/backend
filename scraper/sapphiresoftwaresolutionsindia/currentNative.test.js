import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
test('Sapphire current declared bodyless POST retains four genuine countryless records and exact own detail denial without guessed India jobs',async t=>{
 const calls=[],read=async(url,init)=>{calls.push({url,method:init.method??'GET',bodyPresent:init.body!==undefined});const row=fixture.responses.find(row=>row.requestedUrl===url);assert.ok(row,'Undeclared source request '+url);assert.equal(init.method??'GET',row.method);assert.equal(init.body,undefined);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl});return response}
 t.mock.method(globalThis,'fetch',read)
 const jobs=await run({fetchImpl:read})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readSourceObservationEvidence(jobs,'sapphiresoftwaresolutionsindia').observedVacancyCount,4)
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.observations.length,4);assert.equal(audit.wholeObservedNativeCohortClosingReconciled,true)
 assert.ok(audit.observations.every(row=>row.country===null&&row.fullOwnRoleCriteriaQualified===false&&row.nativeRecord.location===null))
 assert.equal(audit.detailFailure.status,403);assert.equal(audit.detailFailure.failureKind,'blocked_or_access_denied')
 assert.equal(calls.filter(row=>row.method==='POST').length,2);assert.equal(calls.length,5)
 const denied=calls.findIndex(row=>new URL(row.url).pathname.startsWith('/jobs/'))
 assert.ok(denied>=0);assert.ok(calls.slice(denied+1).every(row=>new URL(row.url).hostname!=='www.sapphiresolutions.net'))
 assert.equal(audit.corporateClosingReconciled,false);assert.equal(audit.recruitmentProgrammeClosingReconciled,false)
 assert.ok(audit.originalResponses.filter(row=>row.method==='POST').every(row=>row.requestBodyPresent===false))
})
