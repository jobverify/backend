import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,hasOfficialMowitoSignal,hasPublicJobBoardSignal} from './script.js'
const captures=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
const HOME='https://www.mowito.ai/',BOARD='https://www.linkedin.com/company/mowito/jobs/?viewAsMember=true'
function replay(change=()=>{}){
 const originals=captures(),calls=[]
 return {calls,fetchImpl:async(url,init)=>{
  assert.equal(init.method??'GET','GET');const o=originals.find(r=>r.requestedUrl===url);assert.ok(o,'Undeclared URL '+url);calls.push(url)
  const r={...structuredClone(o),body:Buffer.from(o.bodyBase64,'base64').toString()};change(r,url)
  const response=new Response(r.body,{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response
 }}
}
test('the current 90-day robot product-pilot Apply now script is not a vacancy',()=>{
 const home=Buffer.from(captures()[0].bodyBase64,'base64').toString()
 assert.equal(hasOfficialMowitoSignal(home),true);assert.equal(hasPublicJobBoardSignal(home),false)
 assert.equal(hasPublicJobBoardSignal('<html><body>Current openings <a href="https://jobs.lever.co/mowito/role">Engineer</a></body></html>'),true)
})
test('the exact active employer-declared Careers link reports its original public HTTP403 challenge',async t=>{
 const transport=replay();t.mock.method(globalThis,'fetch',transport.fetchImpl)
 await assert.rejects(run({fetchImpl:transport.fetchImpl}),error=>{
  assert.equal(error.status,403);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.lifecycleCleanupAllowed,false)
  assert.match(error.message,/Mowito|mowito/);assert.match(error.message,/LinkedIn|linkedin/)
  const e=error.recruitmentObservations;assert.equal(e.sourceScopeComplete,false);assert.equal(e.companyGlobalTotal,null);assert.equal(e.companyIndiaTotal,null)
  assert.equal(e.originalResponses.length,2);assert.equal(e.originalResponses[1].bodyBytes,5887);assert.match(e.originalResponses[1].bodyBase64,/^[A-Za-z0-9+/]+=*$/)
  assert.equal(Object.hasOwn(e,'observedVacancyCount'),false);return true
 })
 assert.deepEqual(transport.calls,[HOME,BOARD])
})
test('a different employer handoff or a hidden Careers link cannot bind the current board',async()=>{
 for(const mutate of [r=>r.body=r.body.replaceAll('/company/mowito/jobs/','/company/other/jobs/'),r=>r.body=r.body.replace('href="https://www.linkedin.com/company/mowito/jobs/','hidden href="https://www.linkedin.com/company/mowito/jobs/')]){
  const transport=replay((r,url)=>{if(url===HOME)mutate(r)})
  await assert.rejects(run({fetchImpl:transport.fetchImpl}),/employer|handoff|authority|whole.*HTML/i)
  assert.deepEqual(transport.calls,[HOME])
 }
})
test('a newly accessible board is held for record/criteria review rather than assumed empty',async()=>{
 const transport=replay((r,url)=>{if(url===BOARD){r.status=200;r.body='<html><title>Mowito Jobs</title><body>Engineer - Bengaluru</body></html>'}})
 await assert.rejects(run({fetchImpl:transport.fetchImpl}),error=>error.lifecycleCleanupAllowed===false&&/unreviewed|not.*qualified|inventory.*unknown/i.test(error.message))
})
test('a body-only callback cannot obscure the board HTTP blocker',async()=>{
 await assert.rejects(run({fetchText:async()=>'<html>Mowito</html>'}),/original.*metadata|body-only/i)
})
