import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as source from '../../scraper/sapphiresoftwaresolutionsindia/script.js'
import {readCurrentSapphireListing} from '../../scraper/sapphiresoftwaresolutionsindia/currentNative20261117.js'
import {LIST,CLIENT,CAREERS} from '../../scraper/sapphiresoftwaresolutionsindia/nativeReader20261117.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/sapphiresoftwaresolutionsindia/fixtures/current-native-20261117.json.gz',import.meta.url))))
const original=url=>fixture.responses.find(row=>row.requestedUrl===url),payload=()=>JSON.parse(Buffer.from(original(LIST).bodyBase64,'base64'))
function replay(change=(_url,row)=>row){const calls=[],counts=new Map();return {calls,read:async(url,init)=>{
 calls.push({url,method:init.method,bodyPresent:init.body!==undefined});assert.equal(init.method,url===LIST?'POST':'GET');assert.equal(init.body,undefined)
 const row=structuredClone(original(url));assert.ok(row,'Undeclared source request '+url);const count=(counts.get(url)??0)+1;counts.set(url,count)
 const body=change(url,Buffer.from(row.bodyBase64,'base64').toString('utf8'),count)
 const response=new Response(body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl});return response
}}}
test('Sapphire source identity stays exact and historical city summaries remain unqualified',()=>{
 assert.equal(source.SOURCE,'sapphiresoftwaresolutionsindia');assert.equal(source.COMPANY,'Sapphire Software Solutions (India)');assert.equal(source.CAREERS_URL,CAREERS)
 const [record]=source.extractJobs('<section class="opening"><h2>Historical role</h2><p>Ahmedabad</p></section>')
 assert.equal(record.city,'Ahmedabad');assert.equal(record.location,'Ahmedabad');assert.equal(record.country,null);assert.equal(record.sourceCountryScopeUnresolved,true);assert.equal(record.sourceDetailComplete,false);assert.equal(record.jobDescription,null);assert.equal(record.lifecycleCleanupAllowed,false)
})
test('Sapphire actual native POST cohort retains all four DTOs and holds country, own criteria, active flags and company inventory',async()=>{
 const transport=replay(),jobs=await source.run({fetchImpl:transport.read}),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,source.SOURCE).observedVacancyCount,4)
 assert.deepEqual(audit.observations.map(row=>row.nativeRecord),payload().vacancyList)
 assert.ok(audit.observations.every(row=>row.country===null&&row.nativeRecord.location===null&&row.nativeRecord.isActive===false&&row.nativeActiveFlagInterpreted===false&&row.fullOwnRoleCriteriaQualified===false&&row.publicApplicationEligibilityQualified===false))
 assert.equal(audit.detailFailure.status,403);assert.equal(audit.detailFailure.accessChallenge,true);assert.equal(audit.wholeObservedNativeCohortClosingReconciled,true)
 assert.equal(audit.observations.filter(row=>row.holdReasons.includes('own-detail-route-publisher-access-denied')).length,1)
 assert.ok(transport.calls.filter(row=>row.method==='POST').every(row=>row.bodyPresent===false));assert.equal(transport.calls.filter(row=>row.url.includes('/jobs/')).length,1)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 const assessment=assessSoftFailureAcquisition({source:source.SOURCE,companyName:source.COMPANY},jobs)
 assert.equal(assessment.runnerOutcome.rawRecords,4);assert.equal(assessment.indiaJobs,0);assert.equal(assessment.runnerOutcome.failureKind,'coverage_gap');assert.equal(assessment.runnerOutcome.success,false)
})
test('Sapphire current body-only callbacks cannot qualify metadata-only jobs or start acquisition',async()=>{
 let calls=0
 await assert.rejects(source.run({fetchText:async()=>{calls++;return 'careers'}}),/Original HTTP metadata/);assert.equal(calls,0)
})
test('Sapphire actual current employer title changes fail before native API access',async()=>{
 const transport=replay((url,body)=>url===CAREERS?body.replace('Career at Sapphire Software Solutions','Career at Other Employer'):body)
 await assert.rejects(source.run({fetchImpl:transport.read}),/employer careers identity/);assert.equal(transport.calls.length,1)
})
test('Sapphire complete reviewed client cannot silently acquire a changed vacancy endpoint',async()=>{
 const transport=replay((url,body)=>url===CLIENT?body.replace('/Website/getvacancylist','/Website/otherlist'):body)
 await assert.rejects(source.run({fetchImpl:transport.read}),/Whole current native careers client changed/);assert.equal(transport.calls.some(row=>row.url===LIST),false)
})
test('Sapphire full closing input rejects changed retained native eligibility fields even with no qualified India jobs',async()=>{
 const transport=replay((url,body,count)=>{if(url!==LIST||count!==2)return body;const input=JSON.parse(body);input.vacancyList[0].desiredSkillSet='Changed authored skill';return JSON.stringify(input)})
 await assert.rejects(source.run({fetchImpl:transport.read}),/Closing whole native vacancy input/)
})
test('Sapphire listing binds exact publisher role IDs, native titles and own application URLs',()=>{
 for(const change of [row=>{row.applyURL='non-developer-hiring?position=OtherRole&vno=2'},row=>{row.applyURL='https://foreign.example/jobs/2'},row=>{row.vacancyId=999},row=>{row.position='Another employer title'}]){
  const input=payload();change(input.vacancyList[0]);assert.throws(()=>readCurrentSapphireListing(JSON.stringify(input)),/native own role|native vacancy/i)
 }
 const duplicate=payload();duplicate.vacancyList.push(duplicate.vacancyList[0]);assert.throws(()=>readCurrentSapphireListing(JSON.stringify(duplicate)),/Native vacancy identity/)
})
test('Sapphire native role cohort remains dynamic without frozen vacancy IDs or a four-row cap',()=>{
 const input=payload(),record=structuredClone(input.vacancyList[0]);record.vacancyId=12345;record.position='New Native Role';record.applyURL='non-developer-hiring?position=NewNativeRole&vno=12345';input.vacancyList.push(record)
 assert.equal(readCurrentSapphireListing(JSON.stringify(input)).rows.length,5)
})
test('Sapphire empty current native cohort remains unknown company inventory with cleanup forbidden',async()=>{
 const transport=replay((url,body)=>{if(url!==LIST)return body;const input=JSON.parse(body);input.vacancyList=[];return JSON.stringify(input)}),jobs=await source.run({fetchImpl:transport.read})
 assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,source.SOURCE).observedVacancyCount,0);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const mode of ['pre-abort','fulfilled','rejected'])test('Sapphire frozen opaque '+mode+' preserves exact caller reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,mode});let calls=0
 if(mode==='pre-abort')controller.abort(reason)
 await assert.rejects(source.run({signal:controller.signal,fetchImpl:async()=>{calls++;controller.abort(reason);if(mode==='rejected')throw Object.freeze(Error('replacement'));const row=original(CAREERS);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl});return response}}),error=>error===reason)
 assert.equal(calls,mode==='pre-abort'?0:1)
})
