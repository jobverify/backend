import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const HOME='https://www.fabhotels.com/',CAREERS=HOME+'careers/'
function replay(change=()=>{}){
 const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url)))),calls=[],seen=new Map()
 return{calls,fetchImpl:async(url,init)=>{
  const o=originals.find(row=>row.requestedUrl===url&&!row.captureName.includes('-fresh'));assert.ok(o,'Undeclared URL '+url);assert.equal(init.method??'GET','GET')
  const nth=(seen.get(url)||0)+1;seen.set(url,nth);calls.push(url)
  const r={...structuredClone(o),body:Buffer.from(o.bodyBase64,'base64').toString()};change(r,url,nth)
  const response=new Response(r.body,{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response
 }}
}
test('current FabHotels contact-only careers input is retained without promoting the mail subject into a vacancy',async t=>{
 const r=replay();t.mock.method(globalThis,'fetch',r.fetchImpl);const jobs=await run({fetchImpl:r.fetchImpl})
 assert.deepEqual(jobs,[]);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readSourceObservationEvidence(jobs,'fabhotels').observedVacancyCount,0)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false);assert.equal(jobs.nativeCollectionEvidence.wholeCareerOwnedModelClosingReconciled,true);assert.equal(jobs.nativeCollectionEvidence.entireDocumentReconciled,false)
 assert.match(jobs.nativeCollectionEvidence.nativeOpeningAuthority.nativeContactURL,/Travel%20Agent%20Sales/)
 assert.equal(jobs.nativeCollectionEvidence.originalResponses.length,4);assert.deepEqual(r.calls,[HOME,CAREERS,HOME,CAREERS])
})
test('a changed current native employer/contact input fails closed',async()=>{
 const {fetchImpl}=replay((r,url)=>{if(url===CAREERS)r.body=r.body.replaceAll('jobs@fabhotels.com','jobs@other.example')})
 await assert.rejects(run({fetchImpl}),/whole.*HTML|native.*contact|employer/i)
})
test('the actual changed non-career hotel metadata cannot become recruitment or whole-document proof',async()=>{
 const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url)))),fresh=originals.find(row=>row.captureName==='fabhotels-careers-fresh.json')
 const {fetchImpl}=replay((r,url,nth)=>{if(url===CAREERS&&nth===2)r.body=Buffer.from(fresh.bodyBase64,'base64').toString()})
 const jobs=await run({fetchImpl});assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nonCareerPublisherDataChanged,true);assert.equal(jobs.nativeCollectionEvidence.entireDocumentReconciled,false);assert.equal(jobs.nativeCollectionEvidence.wholeCareerOwnedModelClosingReconciled,true)
 assert.notEqual(jobs.nativeCollectionEvidence.nativeOpeningAuthority.nativeCareerHTML,jobs.nativeCollectionEvidence.nativeClosingAuthority.nativeCareerHTML)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false)
})
test('closing whole careers input rejects added mandatory criteria or new vacancy markup',async()=>{
 const {fetchImpl}=replay((r,url,nth)=>{if(url===CAREERS&&nth===2)r.body=r.body.replace('</body>','<article>Engineer: mandatory passport</article></body>')})
 await assert.rejects(run({fetchImpl}),/whole.*HTML|opening.*closing/i)
})
test('body-only old role listing cannot re-enable city-to-India inference',async()=>{
 await assert.rejects(run({fetchText:async()=>'<html>FabHotels</html>'}),/original.*metadata|body-only/i)
})
test('caller pre-cancellation takes priority over clock or metadata validation',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,label:'FabHotels caller stopped'});controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,now:'invalid',fetchText:async()=>'<html>FabHotels</html>'}),error=>error===reason)
})
test('an ordinary frozen transport error retains its exact identity',async()=>{
 const reason=Object.freeze(Error('FabHotels frozen native transport error'))
 await assert.rejects(run({fetchImpl:async()=>{throw reason}}),error=>error===reason)
})

for(const mode of ['fulfilled','rejected'])test('frozen opaque caller cancellation survives original native header read '+mode,async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,label:'fabhotels '+mode});let reads=0
 const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
 await assert.rejects(run({signal:controller.signal,fetchImpl:async(url,init)=>{
  reads++;controller.abort(reason);assert.equal(init.signal.aborted,true)
  if(mode==='rejected')throw Object.freeze(Error('Replacement transport error'))
  const row=originals.find(r=>(r.requestedUrl??r.requestedURL)===url);assert.ok(row,'Unbound original '+url)
  const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
 }}),error=>error===reason)
 assert.equal(reads,1)
})
