import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url)))),SOURCE="electrosteelcastings",HOME="https://www.electrosteel.com/"
const original=url=>fixture.responses.find(r=>r.url===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(){const calls=[],read=async(url,init={})=>{const row=original(url);assert.ok(row,'Only actual native URL '+url);calls.push(url);assert.equal(init.method??'GET','GET');return Object.defineProperty(new Response(body(row),{status:row.status,headers:row.headers}),'url',{value:row.url})};return {calls,read,fetchPage:async()=>({...original(HOME),html:body(original(HOME)),body:body(original(HOME))})}}
test(SOURCE+' current native source acquires genuine recruitment models while vacancies, country and company inventory remain unqualified',async t=>{
 const {calls,read,fetchPage}=replay();t.mock.method(globalThis,'fetch',read)
 const jobs=await run({fetchImpl:read,fetchPage}),audit=jobs.nativeCollectionEvidence,summary=readSourceObservationEvidence(jobs,SOURCE)
 assert.equal(calls.length,8);assert.equal(jobs.length,0);assert.equal(summary.observedRecordCount,5);assert.equal(summary.observedVacancyCount,0);assert.equal(summary.recordKind,"mixed")
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.nativeInventoryQualified,false);assert.equal(audit.activeApplyVerified,false)
 assert.ok(audit.nativeOpening&&audit.nativeClosing)
})
test(SOURCE+' opaque caller pre-abort precedes callback activity, invalid limits and error audit attachment',async t=>{
 const {calls,read,fetchPage}=replay();t.mock.method(globalThis,'fetch',read);const controller=new AbortController(),reason=Object.freeze({owner:SOURCE});controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,maxJobs:0,fetchImpl:read,fetchPage}),error=>error===reason);assert.equal(calls.length,0)
})
