import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {extractSearchResults,run,CAREER_PAGE_URL} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url)))),original=fixture.requests[0],body=Buffer.from(original.bodyBase64,'base64').toString('utf8')
const response=text=>{const result=new Response(text,{status:original.status,headers:original.headers});Object.defineProperty(result,'url',{value:original.url});return result}
const escaped=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const serialize=node=>typeof node==='string'?escaped(node):'<'+node.tag+Object.entries(node.attrs).map(([name,value])=>' '+name+'="'+escaped(value)+'"').join('')+'>'+node.children.map(serialize).join('')+'</'+node.tag+'>'
const appendCard=card=>{assert.ok(body.includes('</main>'));return body.replace('</main>',card+'</main>')}
test('ACSIA actual active source has16 distinct own accordion card observations with full criteria and no inferred country, remote status or role IDs',()=>{
 const rows=extractSearchResults(body)
 assert.equal(rows.length,16);assert.equal(new Set(rows.map(row=>row.title)).size,16)
 assert.equal(rows[0].title,'Android AOSP Integration');assert.equal(rows[0].location,'Bangalore');assert.equal(rows[0].experienceRequired,'6–10 Years')
 assert.equal(rows.at(-1).title,'Financial Specialist')
 assert.ok(rows.every(row=>row.country===null&&row.remoteStatus===null&&row.jobId===null&&row.requisitionId===null&&row.nativeContent&&row.jobDescription.length>100))
 assert.match(rows.find(row=>row.title==='AUTOSAR Architect').jobDescription,/Notice Period : 30- 45 days/)
 assert.equal(rows.find(row=>row.title==='Software Developer Lead').location,'Trivandrum or Remote')
 assert.ok(rows.every(row=>row.applyUrl===CAREER_PAGE_URL+'#apply-form'&&row.fullOwnRoleCriteriaQualified===true&&row.publicApplicationEligibilityQualified===false))
})
test('ACSIA current registered source reconciles full native cards, shared intake, program declarations and closing while raw country and company inventory remain unknown',async t=>{
 let calls=0
 const read=async(url,init)=>{calls++;assert.equal(url,CAREER_PAGE_URL);assert.equal(init.method??'GET','GET');return response(body)}
 t.mock.method(globalThis,'fetch',read)
 const jobs=await run({fetchImpl:read,maxJobs:1}),audit=jobs.nativeCollectionEvidence
 assert.equal(calls,2);assert.equal(jobs.length,1);assert.equal(audit.observations.length,16);assert.equal(audit.wholeObservedNativeCareerModelClosingReconciled,true)
 assert.equal(audit.nativeOpening.applicationForm.attrs.id,'brxe-xwjkny');assert.equal(audit.nativeOpening.nativeApplicationFields.length,14)
 assert.ok(audit.nativeOpening.programDeclarations.length>0&&audit.nativeOpening.stylesheetDeclarations.length>0)
 assert.equal(readSourceObservationEvidence(jobs,'acsia').observedVacancyCount,16);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 const assessment=assessSoftFailureAcquisition({source:'acsia',companyName:'Acsia Technologies'},jobs)
 assert.equal(assessment.runnerOutcome.rawRecords,16);assert.equal(assessment.indiaJobs,1);assert.equal(assessment.runnerOutcome.success,true)
})
test('ACSIA genuine native403 remains a held denial with no browser bypass or fabricated empty result',async t=>{
 let calls=0,browsers=0
 const read=async()=>{calls++;const result=new Response('denied',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(result,'url',{value:CAREER_PAGE_URL});return result}
 t.mock.method(globalThis,'fetch',read)
 await assert.rejects(run({fetchImpl:read,fetchBrowserText:async()=>{browsers++;assert.fail('Publisher denial must not use browser bypass')}}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied'&&error.lifecycleCleanupAllowed===false)
 assert.equal(calls,1);assert.equal(browsers,0)
})
test('ACSIA duplicate ambiguous native cards cannot inflate canonical vacancy observations',()=>{
 const duplicate=serialize(extractSearchResults(body)[0].wholeNativeCard)
 assert.throws(()=>extractSearchResults(appendCard(duplicate)),/Duplicate|ambiguous/i)
})
test('ACSIA current literal cohort remains dynamic without a sixteen-row cap or frozen role titles',()=>{
 const additional=serialize(extractSearchResults(body)[0].wholeNativeCard).replace('Android AOSP Integration','New Native Role')
 const rows=extractSearchResults(appendCard(additional));assert.equal(rows.length,17);assert.equal(rows.at(-1).title,'New Native Role');assert.equal(rows.at(-1).country,null)
})
