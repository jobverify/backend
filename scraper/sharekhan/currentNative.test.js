import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
function replay(change=()=>{}){
 const calls=[],seen=new Map()
 return{calls,fetchImpl:async(url,init)=>{
  const o=originals.find(row=>row.requestedUrl===url);assert.ok(o,'Unbound URL '+url);assert.equal(init.method??'GET','GET')
  const nth=(seen.get(url)||0)+1;seen.set(url,nth);calls.push(url)
  const r={...structuredClone(o),body:Buffer.from(o.bodyBase64,'base64').toString()};change(r,url,nth)
  const response=new Response(r.body,{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response
 }}
}
test('current original employer model yields explicit held sharekhan observations without inferred India eligibility',async t=>{
 const transport=replay();t.mock.method(globalThis,'fetch',transport.fetchImpl)
 const jobs=await run({fetchImpl:transport.fetchImpl})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const observation=readSourceObservationEvidence(jobs,'sharekhan');assert.equal(observation.observedVacancyCount,0)
 assert.equal(observation.sourceScopeComplete,false);assert.equal(observation.companyGlobalTotal,null);assert.equal(observation.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.wholeCareerOwnedModelClosingReconciled,true)
 assert.ok(transport.calls.length>=4)
})

test('frozen opaque pre-abort precedes callbacks and caps without native acquisition',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,source:'sharekhan'});controller.abort(reason);let reads=0
 await assert.rejects(run({signal:controller.signal,maxJobs:1,fetchText:async()=>{reads++},fetchImpl:async()=>{reads++}}),error=>error===reason);assert.equal(reads,0)
})
for(const mode of ['fulfilled','rejected'])test('frozen opaque caller abort survives original native header '+mode,async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,source:'sharekhan',mode});let reads=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:async(url,init)=>{
  reads++;controller.abort(reason);assert.equal(init.signal.aborted,true)
  if(mode==='rejected')throw Object.freeze(Error('Replacement error'))
  const row=originals.find(row=>row.requestedUrl===url);assert.ok(row)
  const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
 }}),error=>error===reason);assert.equal(reads,1)
})
test('ordinary frozen transport failures retain exact identity',async()=>{
 const reason=Object.freeze(Error('sharekhan frozen transport failure'))
 await assert.rejects(run({fetchImpl:async()=>{throw reason}}),error=>error===reason)
})
test('original native denial cannot become an empty inventory receipt',async()=>{
 const {fetchImpl}=replay(row=>{row.status=403;row.body='<html>Cloudflare challenge</html>'})
 await assert.rejects(run({fetchImpl}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied')
})
test('body-only callbacks cannot establish current original HTTP evidence',async()=>{
 await assert.rejects(run({fetchText:async()=>'<html>Careers</html>'}),/original.*metadata|body-only/i)
})

test('Research Analyst template copy with an empty native job ID remains a general hiring signal',async()=>{
 const {fetchImpl}=replay(),jobs=await run({fetchImpl}),summary=readSourceObservationEvidence(jobs,'sharekhan')
 assert.equal(summary.recordKind,'hiring-signals');assert.equal(summary.observedRecordCount,1);assert.equal(summary.observedVacancyCount,0)
 const row=jobs.nativeCollectionEvidence.observations[0];assert.deepEqual(row.nativeBannerTitles,['Research Analyst']);assert.equal(row.nativeApplicationJobID,'');assert.equal(row.nativeApplicationRoleLabel,'Lead Page CTA')
})
test('a new native table cannot be relabelled as the reviewed table-absent source',async()=>{
 const {fetchImpl}=replay((row,url)=>{if(url==='https://www.sharekhan.com/careers')row.body=row.body.replace('</body>','<table id="tblCurrentJobList"><tr><td>Engineer</td></tr></table></body>')})
 await assert.rejects(run({fetchImpl}),/unreviewed native vacancy model/i)
})
test('closing-only general application criteria mutation is rejected',async()=>{
 const {fetchImpl}=replay((row,url,nth)=>{if(url.endsWith('/careers/job-details')&&nth===2){assert.ok(row.body.includes('Tracking the assigned sector'));row.body=row.body.replace('Tracking the assigned sector','New mandatory criterion. Tracking the assigned sector')}})
 await assert.rejects(run({fetchImpl}),/opening.*closing.*criteria changed/i)
})
