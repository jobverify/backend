import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test, { mock } from 'node:test'
import { run } from './script.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import {publicRole,parsePublicLabels} from './nativeContract.js'
import {parseCurrentPortalMetadata,parseCurrentPublicCities,qualifyCurrentPublicRole} from './currentPublicQualification20261119.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-20261119/native-public-packets.json.gz',import.meta.url)))),packets=new Map(fixture.packets.map(p=>[p.label,p])),LIST='https://gateway.app.hrone.cloud/api/external/public/referral/CareerPosition/Details',CITY='https://gateway.app.hrone.cloud/api/external/public/City/BindDropDown',DETAIL='/referral/JobOpening/Request/Details/'
const nativeRow=JSON.parse(Buffer.from(packets.get('list-page-1').bodyBase64,'base64'))[0]
const replay=transform=>{
 const calls=[],seen=new Map()
 return{calls,fetchImpl:async(url,request={})=>{
  let label
  if(url===LIST)label='list-page-1'
  else if(url===CITY)label='cities'
  else if(url.includes(DETAIL))label='detail'
  else label=fixture.packets.find(p=>p.requestedURL===url)?.label
  assert.ok(label,'Source requested an undeclared native test route')
  const page=structuredClone(packets.get(label)),count=(seen.get(label)??0)+1;seen.set(label,count)
  calls.push({label,url,method:request.method??'GET',body:request.body})
  if(label==='cities')assert.deepEqual(JSON.parse(request.body),JSON.parse(packets.get('cities').requestBody))
  transform?.(page,{label,count,url,request})
  const response=new Response(Buffer.from(page.bodyBase64,'base64'),{status:page.status,headers:page.headers})
  Object.defineProperty(response,'url',{value:page.finalURL})
  return response
 }}
}
const setJSON=(page,change)=>{const data=JSON.parse(Buffer.from(page.bodyBase64,'base64'));change(data);page.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')}

test('a country-qualified job cannot claim an application shell that was never acquired',()=>{
 const decode=label=>JSON.parse(Buffer.from(packets.get(label).bodyBase64,'base64')),u=new URL(packets.get('portal').requestedURL),config=Object.fromEntries(['appId','dc','rqt','cc'].map(key=>[key,u.searchParams.get(key)])),job=publicRole(nativeRow,decode('detail'),parsePublicLabels(Buffer.from(packets.get('labels').bodyBase64,'base64').toString()),{now:'2026-11-19T00:00:00Z'}),context={metadata:parseCurrentPortalMetadata(decode('configuration'),config),cities:parseCurrentPublicCities(decode('cities')),applicationShellSHA256:null}
 const observed=qualifyCurrentPublicRole(job,nativeRow,context,config)
 assert.equal(observed.sourceQualification.qualified,false)
 assert.equal(observed.sourceRoleUrlQualified,false)
 assert.equal(observed.sourceApplicationRouteEvidence,null)
})

test('current literal workplace country and own public URL binding recover the genuine reduced native job with cleanup held',async()=>{
 const io=replay(),network=mock.method(globalThis,'fetch',()=>{throw Error('Uncaptured requests prohibited')})
 try{
  const jobs=await run({fetchImpl:io.fetchImpl,minRequestIntervalMs:0})
  assert.equal(jobs.length,1)
  const job=jobs[0],url=new URL(job.sourceUrl)
  assert.equal(job.jobId,'1962')
  assert.equal(job.requisitionId,'JOB1962')
  assert.equal(job.country,'India')
  assert.equal(job.nativeWorkplaceAlternatives[0].text,'Bhubaneswar')
  assert.equal(job.sourceCountryEvidence.status,'literal-native-city-code-and-country-name')
  assert.equal(job.sourceCountryEvidence.nativeCityRows[0].countryName,'India')
  assert.equal(job.sourceCountryEvidence.nativeCityRows[0].cityCode,'738')
  assert.equal(url.origin,'https://career.hrone.cloud')
  assert.equal(url.pathname,'/apply-job')
  assert.equal(url.searchParams.get('pid'),nativeRow.encryptedPositionId)
  assert.equal(url.searchParams.get('dptc'),nativeRow.departmentCode)
  assert.equal(url.searchParams.get('st'),nativeRow.sourceType)
  assert.equal(job.applyUrl,job.sourceUrl)
  assert.equal(job.sourceRoleUrlQualified,true)
  assert.equal(job.sourceDetailComplete,true)
  assert.ok(job.jobDescription.length>1000)
  assert.equal(job.postingDate,null)
  assert.equal(job.closingDate,null)
  assert.equal(job.backendSubmissionVerified,false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
  assert.equal(jobs.nativeCollectionEvidence.applicationInteractions,0)
  assert.equal(jobs.nativeCollectionEvidence.wholeNativeModelsClosingReconciled,true)
  assert.equal(io.calls.filter(c=>c.label==='cities').length,2)
  assert.equal(io.calls.filter(c=>c.label==='own-application-shell').length,2)
  const assessment=assessSoftFailureAcquisition({source:'annapurnafinance'},jobs)
  assert.equal(assessment.indiaJobs,1)
  assert.equal(assessment.runnerOutcome.success,true)
  assert.equal(assessment.cleanupOptions.replaceExisting,false)
 }finally{network.mock.restore()}
})

for(const kind of ['foreign-country','unknown-city','mixed-workplace','foreign-summary','foreign-application','foreign-employer']){
 test(`native ${kind} stays held and cannot be repaired from city text, employer headquarters or generic portal URL`,async()=>{
  const io=replay((page,{label})=>{
   if(kind==='foreign-country'&&label==='cities')setJSON(page,data=>{data.find(c=>c.cityCode==='738').countryName='United Kingdom'})
   if(kind==='unknown-city'&&label==='cities')setJSON(page,data=>{data.find(c=>c.cityCode==='738').cityCode='999999'})
   if(kind==='mixed-workplace'&&label==='detail')setJSON(page,data=>{data.preferredLocationList.push({id:'999999',text:'London'})})
   if(kind==='foreign-summary'&&label==='list-page-1')setJSON(page,data=>{data[0].preferredLocation='Bhubaneswar, London'})
   if(kind==='foreign-employer'&&label==='detail')setJSON(page,data=>{data.company='A different native employer'})
   if(kind==='foreign-application'&&label==='list-page-1')setJSON(page,data=>{data[0].jobApplicationPath='https://foreign.invalid/apply'})
  })
  const jobs=await run({fetchImpl:io.fetchImpl,minRequestIntervalMs:0})
  assert.equal(jobs.length,0)
  assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,1)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.equal(assessSoftFailureAcquisition({source:'annapurnafinance'},jobs).runnerOutcome.success,false)
 })
}

for(const kind of ['inactive-employer','duplicate-city','closing-country','closing-application-shell','unreviewed-main']){
 test(`native ${kind} rejects acquisition without asserting a zero inventory`,async()=>{
  const io=replay((page,{label,count})=>{
   if(kind==='inactive-employer'&&label==='configuration')setJSON(page,data=>{data.portalDetails[0].isActive=false})
   if(kind==='duplicate-city'&&label==='cities')setJSON(page,data=>{data.push({...data[0]})})
   if(kind==='closing-country'&&label==='cities'&&count===2)setJSON(page,data=>{data.find(c=>c.cityCode==='738').countryName='United Kingdom'})
   if(kind==='closing-application-shell'&&label==='own-application-shell'&&count===2)page.bodyBase64=Buffer.from(Buffer.from(page.bodyBase64,'base64').toString()+'<!-- changed shell -->').toString('base64')
   if(kind==='unreviewed-main'&&label==='main')page.bodyBase64=Buffer.from(Buffer.from(page.bodyBase64,'base64').toString()+';location.href="https://foreign.invalid/"').toString('base64')
  })
  await assert.rejects(run({fetchImpl:io.fetchImpl,minRequestIntervalMs:0}),/changed|inactive|ambiguous|duplicate|country|profile|qualification/i)
 })
}
