import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const replay=(change=()=>{})=>{
 const seen=[],counts=new Map()
 return{seen,fetchPage:async(url,init)=>{
  seen.push({url,...init});const at=counts.get(url)||0;counts.set(url,at+1)
  const p=structuredClone(original.packets.filter(r=>r.url===url&&(r.method||'GET')===init.method)[at]);assert.ok(p,url+' #'+at)
  const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256)
  p.body=bytes.toString();change(p,at)
  return{url:p.finalUrl,status:p.status,headers:p.headers,body:p.body}
 }}
}
test('all 71 current group roles retain their typed sibling companies and cannot certify a target-employer zero',async()=>{
 const f=replay();let report,records
 const jobs=await run({...f,onRecords:r=>{records=r},onReport:r=>{report=r},now:'2026-11-19T03:50:00Z'})
 assert.equal(jobs.length,0);assert.equal(report.reportedNativeTotal,71);assert.equal(report.observedNativeRecords,71)
 assert.deepEqual(report.pages,[{offset:0,rows:45},{offset:45,rows:26},{offset:90,rows:0}])
 assert.equal(report.fullNativeDetails,71);assert.equal(report.renderedFullDetails,64)
 assert.equal(report.nativeInventoryComplete,true);assert.equal(report.closingMatches,true);assert.equal(report.failures.length,0)
 assert.equal(report.targetEmployerCount,0);assert.equal(report.excludedEmployerCount,71);assert.equal(report.verifiedZeroInventory,false)
 assert.equal(records.filter(r=>r.company==='Mangal Industries Limited').length,70)
 assert.equal(records.filter(r=>r.company==='Amara Raja Power Systems Limited').length,1)
 assert.ok(records.every(r=>r.company===r.nativeRoleCompany&&!r.targetEmployer&&r.sourceNativeOriginalModels.detail.requisitionCode===r.jobId))
 assert.equal(report.roles.every(r=>r.company===r.nativeRoleCompany),true)
 assert.equal(report.sourceScopeComplete,false);assert.equal(report.sourceListingComplete,false)
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.lifecycleCleanupAllowed,false)
 const a=assessSoftFailureAcquisition({source:'amararajaenergymobility'},jobs)
 assert.equal(a.runnerOutcome.success,false);assert.equal(a.runnerOutcome.failureKind,'coverage_gap');assert.equal(a.cleanupOptions.replaceExisting,false)
 assert.equal(f.seen.length,161)
})
test('typed company conflicting with the original posting is withheld rather than relabelled',async()=>{
 const f=replay(p=>{if(p.url.includes('job/organizationDetails?jobCode=P-8427')){const d=JSON.parse(p.body);d.response.orgUnitHierarchy.find(r=>r.orgUnitType==='Company Name').orgUnitName='Amara Raja Energy & Mobility Limited';p.body=JSON.stringify(d)}})
 let report
 const jobs=await run({...f,onReport:r=>{report=r}})
 assert.equal(jobs.length,0);assert.equal(report.targetEmployerCount,0);assert.equal(report.failures.length,1)
 assert.equal(report.nativeInventoryComplete,false);assert.match(report.failures[0].reason,/company conflict/)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('changed closing page never creates a company zero proof',async()=>{
 const f=replay((p,at)=>{if(at===1&&p.url.endsWith('jobs/v1?offset=0&limit=45')){const d=JSON.parse(p.body);d.response[0].jobTitle+=' changed';p.body=JSON.stringify(d)}})
 let report
 const jobs=await run({...f,onReport:r=>{report=r}})
 assert.equal(jobs.length,0);assert.equal(report.closingMatches,false);assert.equal(report.nativeInventoryComplete,false);assert.equal(report.verifiedZeroInventory,false)
 assert.equal(jobs.lifecycleCleanupAllowed,false)
})
