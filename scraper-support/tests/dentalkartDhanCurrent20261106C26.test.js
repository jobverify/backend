import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as dentalkart from '../../scraper/dentalkart/script.js'
import * as dhan from '../../scraper/dhan/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C26/capture.json.gz',import.meta.url))))
const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/currentNative20261106C26/description-expectations.json',import.meta.url)))
const corporate='https://www.dentalkart.com/careers',board='https://dentalkart.zohorecruit.in/jobs/Careers',dhanURL='https://dhan.co/career/'
const root='https://raise.keka.com/careers/',tenant='7669ff3a-2b35-4442-9bac-9f9ae4b718b3',active=root+'api/embedjobs/default/active/'+tenant
const portalInfo=JSON.parse(fixture.documents[root+'api/organization/default/careerportalinfo'].body),nativeRoles=JSON.parse(fixture.documents[active].body)
const compact=value=>value.replace(/\s/g,''),sha=value=>createHash('sha256').update(value).digest('hex')
const page=url=>{
 const row=fixture.documents[url];assert.ok(row,'Only currently declared captured URLs may be read: '+url)
 return {status:row.status,url:row.finalUrl,headers:row.headers,body:row.body,html:row.body,bodyUnavailable:row.bodyUnavailable===true}
}
test('Dentalkart accepts its current Careers title only with the original legal-employer handoff',()=>{
 assert.equal(dentalkart.hasOfficialCareersShellSignal(fixture.documents[corporate].body),true)
 assert.equal(dentalkart.hasOfficialCareersShellSignal(fixture.documents[corporate].body.replaceAll('dentalkart.zohorecruit.in','unrelated.invalid')),false)
})
test('Dhan accepts the current original Raise handoff without requiring the retired tenant or team-size copy',()=>{
 assert.equal(dhan.hasOfficialCareersPageSignal(fixture.documents[dhanURL].body),true)
 assert.equal(dhan.hasOfficialCareersPageSignal(fixture.documents[dhanURL].body.replaceAll('https://raise.keka.com/careers','https://unrelated.invalid/careers')),false)
})
test('Dhan native IDs remain distinct from formal requisitions and the group employer remains explicit',()=>{
 const record=nativeRoles.find(row=>row.id===146302),job=dhan.normalizeKekaJob(record,{portalInfo})
 assert.ok(job)
 assert.equal(job.requisitionId,null)
 assert.equal(job.company,'Raise holding')
 assert.equal(job.sourceNativeJobId,'146302')
 assert.equal(job.sourceEmployerScope,'corporate-declared-group-board')
 assert.equal(job.sourceExactBrandRoleScopeVerified,false)
 assert.equal(job.postingDate,'2026-11-02T10:07:25.293Z')
 assert.equal(compact(job.jobDescription),expected.dhan['146302'].fullOriginalCriteriaWithoutWhitespace)
 assert.equal(sha(job.sourceDescriptionHTML),expected.dhan['146302'].originalHTMLSHA256)
})
test('Dhan retains the genuine Partner Network role with an empty native worksite list as country unknown',()=>{
 const record=nativeRoles.find(row=>row.id===140755);assert.deepEqual(record.jobLocations,[])
 const job=dhan.normalizeKekaJob(record,{portalInfo});assert.ok(job)
 assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.sourceCountryScopeUnresolved,true)
 assert.equal(compact(job.jobDescription),expected.dhan['140755'].fullOriginalCriteriaWithoutWhitespace)
 assert.deepEqual(job.sourceNativeJobRecord.jobLocations,[])
})
test('Dhan does not promote the genuine NA criteria placeholder into a complete job description',()=>{
 const record=nativeRoles.find(row=>row.id===134733);assert.equal(record.description,'<div>NA</div>')
 const job=dhan.normalizeKekaJob(record,{portalInfo});assert.ok(job)
 assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailComplete,false)
 assert.equal(job.sourceDetailFailureKind,'native-full-criteria-unavailable')
 assert.equal(job.sourceNativeJobRecord.description,'<div>NA</div>')
})
test('Dentalkart current collection preserves ten full active native records and their original date provenance',async()=>{
 const requests=[],jobs=await dentalkart.run({fetchPage:async(url,options)=>{requests.push({url,method:options?.method});return page(url)},now:()=> '2026-11-06T13:00:00.000Z'})
 assert.equal(jobs.length,10)
 assert.deepEqual(requests.map(row=>row.url),[corporate,board,board,corporate]);assert.ok(requests.every(row=>row.method==='GET'))
 for(const job of jobs){
  const want=expected.dentalkart[job.jobId];assert.ok(want)
  assert.equal(compact(job.jobDescription),want.fullOriginalCriteriaWithoutWhitespace)
  assert.equal(sha(job.sourceDescriptionHTML),want.originalHTMLSHA256)
  assert.equal(job.country,'India');assert.equal(job.requisitionId,null);assert.equal(job.postingDate,null);assert.equal(job.nativeDateOpened,want.nativeDateOpened)
  assert.equal(job.applyUrl,board);assert.equal(job.applicationUrlIsGeneric,true);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,27)
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,10)
 assert.equal(jobs.nativeCollectionEvidence.closedOrLockedCount,17)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
})
test('Dhan current collection reads only the declared Raise protocol and retains complete group observations',async()=>{
 const requested=[],jobs=await dhan.run({fetchPage:async(url,options)=>{requested.push({url,method:options?.method});return page(url)},now:()=> '2026-11-06T13:00:00.000Z'})
 assert.equal(jobs.length,30);assert.ok(requested.every(row=>row.method==='GET'))
 assert.equal(requested[0].url,dhanURL)
 assert.equal(requested.some(row=>new URL(row.url).hostname==='dhan.keka.com'),false)
 assert.equal(jobs.filter(job=>job.country==='India').length,29);assert.equal(jobs.filter(job=>job.country===null).length,1)
 assert.equal(jobs.some(job=>job.sourceNativeJobId==='134733'),false)
 for(const job of jobs){
  const want=expected.dhan[job.sourceNativeJobId];assert.ok(want)
  assert.equal(compact(job.jobDescription),want.fullOriginalCriteriaWithoutWhitespace)
  assert.equal(sha(job.sourceDescriptionHTML),want.originalHTMLSHA256)
  assert.equal(job.company,'Raise holding');assert.equal(job.sourceExactBrandRoleScopeVerified,false)
  assert.equal(job.requisitionId,null);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,31)
 assert.equal(jobs.nativeCollectionEvidence.unknownCountryCount,1)
 assert.equal(jobs.nativeCollectionEvidence.incompleteCriteriaCount,1)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
})
test('baseline original Dentalkart hidden-record model retains all27 records before active selection',()=>{
 const records=dentalkart.readPortalInventory(fixture.documents[board].body)
 assert.equal(records.length,27)
 assert.equal(records.filter(row=>row.Publish===true&&row.Is_Locked===false).length,10)
})
