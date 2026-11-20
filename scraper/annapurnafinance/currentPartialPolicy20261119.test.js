import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {publicRole,parsePublicLabels} from './nativeContract.js'
import {CURRENT_PUBLIC_PROFILE,parseCurrentPortalMetadata,parseCurrentPublicCities,qualifyCurrentPublicRole} from './currentPublicQualification20261119.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const base=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-20261119/native-public-packets.json.gz',import.meta.url))))
const partial=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-20261119/native-public-partial-roles.json.gz',import.meta.url))))
const packets=new Map(base.packets.map(p=>[p.label,p])),decode=packet=>JSON.parse(Buffer.from(packet.bodyBase64,'base64'))
const fullNativeRow=decode(packets.get('list-page-1'))[0]
const portal=new URL(packets.get('portal').requestedURL)
const config=Object.fromEntries(['appId','dc','rqt','cc'].map(key=>[key,portal.searchParams.get(key)]))
const context={metadata:parseCurrentPortalMetadata(decode(packets.get('configuration')),config),cities:parseCurrentPublicCities(decode(packets.get('cities'))),applicationShellSHA256:CURRENT_PUBLIC_PROFILE.portalShell.sha256}
const labels=parsePublicLabels(Buffer.from(packets.get('labels').bodyBase64,'base64').toString())

test('genuine current hidden, attachment and empty criteria roles remain valid explicit partial India records',()=>{
 assert.equal(partial.roles.length,3)
 for(const role of partial.roles){
  const detail=decode(role.detailPacket),job=publicRole(role.row,detail,labels,{now:'2026-11-19T00:00:00Z'})
  assert.equal(job.sourceDetailComplete,false)
  const qualified=qualifyCurrentPublicRole(job,role.row,context,config)
  assert.equal(qualified.sourceQualification.qualified,true,'native role '+role.positionId+' must not be rejected solely for partial criteria')
  assert.equal(qualified.sourceQualification.fullCriteria,false)
  assert.deepEqual(qualified.sourceQualification.reasons,[])
  assert.equal(qualified.country,'India')
  assert.equal(qualified.sourceRoleUrlQualified,true)
  assert.equal(qualified.jobDescription,null)
  assert.deepEqual(qualified.nativePublicJobCriteria,job.nativePublicJobCriteria)
  assert.deepEqual(qualified.nativeCriteriaQualification.reasons,job.nativeCriteriaQualification.reasons)
  assert.equal(qualified.nativePublicJobCriteria.documentFileName,detail.documentFileName)
 }
})

test('a partial criteria flag cannot conceal a foreign native role employer',()=>{
 const role=partial.roles[0],detail={...decode(role.detailPacket),company:'A different employer'}
 const job=publicRole(role.row,detail,labels,{now:'2026-11-19T00:00:00Z'}),qualified=qualifyCurrentPublicRole(job,role.row,context,config)
 assert.equal(qualified.sourceQualification.qualified,false)
 assert.ok(qualified.sourceQualification.reasons.includes('native-own-role-employer-unqualified'))
})

test('normal acquisition and standard policy preserve three genuine partial jobs beside a full job and reconcile original metadata',async()=>{
 const calls=[]
 const fetchImpl=async(url,request={})=>{
  let packet
  if(url.endsWith('/referral/CareerPosition/Details')){
   packet=structuredClone(packets.get('list-page-1'))
   // Explicit reduced fixture: each literal row comes from its retained full
   // original public listing page, with matching whole own detail packets.
   packet.bodyBase64=Buffer.from(JSON.stringify([fullNativeRow,...partial.roles.map(role=>role.row)])).toString('base64')
  }else if(url.includes('/referral/JobOpening/Request/Details/')){
   const original=partial.roles.find(role=>role.detailPacket.requestedUrl===url)
   packet=original?.detailPacket??base.packets.find(p=>p.label==='detail'&&p.requestedURL===url)
  }else packet=base.packets.find(p=>p.requestedURL===url)
  assert.ok(packet,'Unbound original native URL')
  calls.push({url,method:request.method??'GET'})
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL??packet.url})
  return response
 }
 const jobs=await run({fetchImpl,minRequestIntervalMs:0})
 assert.equal(jobs.length,4)
 assert.ok(jobs.every(job=>job.country==='India'))
 assert.equal(jobs.filter(job=>job.sourceDetailComplete===false).length,3)
 assert.equal(jobs.nativeCollectionEvidence.qualifiedIndiaFullCriteriaRecords,1)
 assert.equal(jobs.nativeCollectionEvidence.qualifiedIndiaPartialCriteriaRecords,3)
 assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,0)
 assert.equal(jobs.nativeCollectionEvidence.wholeNativeModelsClosingReconciled,true)
 assert.equal(calls.filter(call=>call.url.includes('/JobOpening/Request/Details/')).length,8)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition({source:'annapurnafinance'},jobs)
 assert.equal(assessment.runnerOutcome.success,true)
 assert.equal(assessment.indiaJobs,4)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})
