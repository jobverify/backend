import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {hydrateTurboHireJobs} from './turboHireDetails.js'
import {readInventoryEvidence} from './inventoryEvidence.js'

const captured=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/britannia/test-data/native-employer-20261128.json.gz',import.meta.url))))
const originalListing=JSON.parse(captured.listing.body)
const aliasDetail=JSON.parse(captured.details[2].body)
const ordinaryDetail=JSON.parse(captured.details[0].body)
const orgId='c143932d-0df7-4856-9dc5-0a9f1ca26dc5'
const employer='Britannia Industries'
const origin='https://britannia.turbohire.co'
const replay=async({source='britannia',detail=aliasDetail,validateNativeEmployerAlias,mutate=value=>value,mutateListing=value=>value}={})=>{
 const payload=mutateListing(structuredClone(originalListing)),record=payload.Result.find(row=>row.JobId===detail.JobId)
 const nativeDetail=mutate(structuredClone(detail)),reads=[]
 const job={jobId:record.JobId,title:record.JobTitle,company:record.OrgDetails.OrgName,sourceUrl:origin+'/job/publicjobs/'+record.JobIdObfuscated}
 const result=await hydrateTurboHireJobs({source,orgId,employer,origin,apiBaseUrl:'https://thapi-stage2.azurewebsites.net',boardUrl:origin+'/careerpage/'+orgId,
  payload,jobs:[job],retainNativeProof:true,now:()=>captured.observedAt,
  validateNativeEmployerAlias,listingUrl:captured.listing.url,listingRequest:{method:'POST',body:'{}'},
  fetchJson:async url=>{reads.push(url);if(url===captured.listing.url)return structuredClone(payload);assert.equal(url,'https://thapi-stage2.azurewebsites.net/api/publicjobs/'+record.JobId+'?fieldVisibility=CareerPage');return nativeDetail},
  verifyPublisher:async()=>{},
 })
 return{result,reads,nativeDetail,payload}
}

test('shared TurboHire hydration accepts an explicitly validated same-organization legal alias without rewriting raw names',async()=>{
 const seen=[]
 const {result,nativeDetail}=await replay({validateNativeEmployerAlias:(detail,listing)=>{seen.push({detail,listing});return detail.OrgDetails.OrgName==='Britannia Industries Limited'}})
 assert.equal(seen.length,1)
 assert.equal(result.length,1)
 assert.equal(result[0].sourceDetailComplete,true)
 assert.equal(result[0].company,employer)
 assert.equal(result[0].nativeSourceRecord.nativeListing.OrgDetails.OrgName,employer)
 assert.equal(result[0].nativeSourceRecord.nativeDetail.OrgDetails.OrgName,'Britannia Industries Limited')
 assert.equal(nativeDetail.OrgDetails.OrgName,'Britannia Industries Limited')
 assert.equal(readInventoryEvidence(result).listingComplete,false)
 assert.equal(result[0].lifecycleCleanupAllowed,false)
})

for(const source of ['britannia','idfy','navi','trumindssoftwaresystems']){
 test(source+' default shared hydrator keeps exact employer-name rejection',async()=>{
  await assert.rejects(replay({source}),/detail role, title or employer contradicts the listing/)
 })
 test(source+' default shared hydrator retains matching employer identity and raw records',async()=>{
  const {result}=await replay({source,detail:ordinaryDetail})
  assert.equal(result.length,1)
  assert.equal(result[0].nativeSourceRecord.nativeDetail.OrgDetails.OrgName,employer)
  assert.equal(result[0].nativeEmployerBinding.legalEmployer,null)
 })
}

for(const [name,mutate] of [
 ['organization ID',d=>{d.OrgDetails.OrgID='00000000-0000-0000-0000-000000000000';return d}],
 ['native role ID',d=>{d.JobId='00000000-0000-0000-0000-000000000000';return d}],
 ['public application identity',d=>{d.JobIdObfuscated='replaced-native-application';return d}],
 ['title',d=>{d.JobTitle+=' replaced';return d}],
 ['native job code',d=>{d.JobCode+=' replaced';return d}],
])test('optional employer alias cannot bypass existing '+name+' checks',async()=>{
 let calls=0
 await assert.rejects(replay({mutate,validateNativeEmployerAlias:()=>{calls++;return true}}),/detail role, title or employer contradicts the listing/)
 assert.equal(calls,0,'the alias validator only runs after all native identity fields bind')
})

for(const result of [false,'true',Promise.resolve(true)])test('optional employer alias requires literal true: '+String(result),async()=>{
 await assert.rejects(replay({validateNativeEmployerAlias:()=>result}),/detail role, title or employer contradicts the listing/)
})

test('optional alias validator is unused when the existing exact employer check succeeds',async()=>{
 const {result}=await replay({detail:ordinaryDetail,validateNativeEmployerAlias:()=>{throw Error('unexpected alias callback')}})
 assert.equal(result.length,1)
})

test('optional alias validator cannot alter the retained native data through its input copies',async()=>{
 const {result,nativeDetail}=await replay({validateNativeEmployerAlias:(detail,listing)=>{
  detail.OrgDetails.OrgName='Rewritten employer';detail.Location='[]';listing.OrgDetails.OrgName='Rewritten listing';return true
 }})
 assert.equal(nativeDetail.OrgDetails.OrgName,'Britannia Industries Limited')
 assert.equal(result[0].nativeSourceRecord.nativeListing.OrgDetails.OrgName,employer)
 assert.equal(result[0].nativeSourceRecord.nativeDetail.OrgDetails.OrgName,'Britannia Industries Limited')
 assert.equal(result[0].country,'India')
})

test('optional alias validator cannot relax the exact opening-listing employer check',async()=>{
 let calls=0
 await assert.rejects(replay({validateNativeEmployerAlias:()=>{calls++;return true},mutateListing:payload=>{
  payload.Result.find(row=>row.JobId===aliasDetail.JobId).OrgDetails.OrgName='Britannia Industries Limited';return payload
 }}),/listing employer does not match/)
 assert.equal(calls,0)
})
