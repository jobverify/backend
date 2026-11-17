import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
const HOME='https://www.peerrobotics.ai/',COMPANY=HOME+'company',CAREERS='https://careers.peerrobotics.ai/'
const original=url=>fixture.requests.find(row=>row.url===url),body=row=>Buffer.from(row.bodyBase64,'base64').toString()
function replay(edit=(row,text)=>text){const calls=[],counts=new Map();return {calls,options:{fetchPage:async()=>({...original(HOME),body:body(original(HOME)),html:body(original(HOME))}),fetchImpl:async(url,init)=>{const row=original(String(url));assert.ok(row,'Only own declared native path '+url);calls.push(String(url));const count=(counts.get(String(url))??0)+1;counts.set(String(url),count);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');return Object.defineProperty(new Response(edit(row,body(row),count),{status:row.status,headers:row.headers}),'url',{value:row.url})}}}}
test('Peer Robotics follows its actual own company View roles handoff and reconciles complete current Notion shell without inventing vacancy inventory',async()=>{
 const {calls,options}=replay(),jobs=await run(options),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(calls,[HOME,COMPANY,CAREERS,HOME,COMPANY,CAREERS]);assert.equal(jobs.length,0)
 assert.equal(audit.nativeOpening.notion.bootData,null);assert.equal(audit.nativeOpening.notion.requiredRedirectMetadata.pageId,'b30048b0-5440-4c6c-aab1-765de1669686')
 assert.equal(audit.wholeObservedNativeHandoffAndBootstrapClosingReconciled,true);assert.equal(audit.nativeOpening.notion.rawHTML,body(original(CAREERS)))
 assert.equal(readSourceObservationEvidence(jobs,'peerrobotics').recordKind,'hiring-signals');assert.equal(readSourceObservationEvidence(jobs,'peerrobotics').observedRecordCount,1);assert.equal(readSourceObservationEvidence(jobs,'peerrobotics').observedVacancyCount,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.nativeInventoryQualified,false);assert.equal(audit.activeApplyVerified,false)
})
test('Peer Robotics observed native403 is preserved before an unavailable body with no alternate board fallback',async()=>{
 const {calls,options}=replay();let bodyReads=0
 options.fetchImpl=async(url)=>{calls.push(String(url));return {status:403,url:String(url),headers:new Headers({'content-type':'text/html'}),get body(){bodyReads++;return null}}}
 await assert.rejects(run(options),error=>error.httpStatus===403&&error.failureKind==='blocked_or_access_denied'&&error.lifecycleCleanupAllowed===false)
 assert.equal(calls.length,1);assert.ok(bodyReads<=2)
})
test('Peer Robotics rejects closing Notion page binding drift rather than treating an unknown board as empty',async()=>{
 const {options}=replay((row,text,count)=>row.url===CAREERS&&count===2?text.replace('b30048b0-5440-4c6c-aab1-765de1669686','b30048b0-5440-4c6c-aab1-765de1669687'):text)
 await assert.rejects(run(options),/Closing.*native.*changed/i)
})
