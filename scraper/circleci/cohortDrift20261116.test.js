import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {runCurrentCircleCi} from './currentReader.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/deployment-20261116.json.gz',import.meta.url))))
const packets=new Map(fixture.responses.map(p=>[p.url,p]))
const replay=async change=>{
 let audit
 const reads=[],seen=new Map()
 const jobs=await runCurrentCircleCi({now:'2026-11-16T17:45:00Z',fetchResponse:async url=>{
  const packet=packets.get(url);assert.ok(packet,'Only retained publisher-declared requests are admitted: '+url)
  const n=(seen.get(url)||0)+1;seen.set(url,n);reads.push(url)
  const original=Buffer.from(packet.bodyBase64,'base64'),body=change?.({url,n,text:original.toString()})
  return{status:packet.status,finalURL:packet.finalUrl,headers:packet.headers,contentType:packet.headers['content-type'],bytes:body===undefined?original:Buffer.from(body)}
 },onAudit:value=>{audit=value}})
 return{jobs,audit,reads}
}

test('CircleCI retains all15 native models when equally sized corporate and native cohorts have different identities',async()=>{
 const {jobs,audit,reads}=await replay()
 assert.equal(jobs.length,0)
 assert.equal(audit.records.length,15)
 assert.equal(audit.originalResponses.length,62)
 assert.equal(audit.wholeNativeModelsClosingReconciled,true)
 assert.deepEqual(audit.opening.corporateOnlyRoles.map(r=>r.id),['8608742002'])
 assert.deepEqual(audit.opening.nativeOnlyPostingIds,['8932689002'])
 assert.equal(jobs.nativeCollectionEvidence.corporateNativeCountAgreement,true)
 assert.equal(jobs.nativeCollectionEvidence.corporateNativeIdentityAgreement,false)
 assert.deepEqual(jobs.nativeCollectionEvidence.corporateOnlyPostingIds,['8608742002'])
 assert.ok(!audit.records.some(r=>r.jobId==='8608742002'))
 const nativeOnly=audit.records.find(r=>r.jobId==='8932689002')
 assert.equal(nativeOnly.nativeSourceRecord.nativeRoleBinding.identityQualified,false)
 assert.equal(nativeOnly.nativeVacancyQualified,false)
 assert.equal(nativeOnly.country,null)
 assert.equal(nativeOnly.sourceDetailComplete,false)
 assert.ok(!reads.some(url=>url.includes('/8608742002')))
 assert.equal(readSourceObservationEvidence(jobs,'circleci').observedRecordCount,15)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.match(readInventoryEvidence(jobs).reason,/corporate-native-identity-disagreement/)
})

test('CircleCI still rejects a closing change to an unmatched corporate posting without assigning it a removed status',async()=>{
 await assert.rejects(replay(({url,n,text})=>url==='https://circleci.com/careers/jobs/'&&n===2?text.replace('Strategic Sales Manager','Changed unresolved posting'):undefined),/closing whole corporate\/native\/role\/detail models changed/)
})

test('CircleCI cohort disagreement cannot suppress a closing native required-question change',async()=>{
 await assert.rejects(replay(({url,n,text})=>{
  if(!url.includes('/jobs/8801094002?questions=true')||n!==2)return
  const detail=JSON.parse(text)
  detail.questions.push({label:'New required native criterion',required:true,fields:[{name:'question_new_criterion',type:'input_text'}]})
  return JSON.stringify(detail)
 }),/closing whole corporate\/native\/role\/detail models changed/)
})
