import assert from 'node:assert/strict'
import test from 'node:test'
import {extractionDetailHealth} from '../utils/extractionDetailHealth.js'
const source='compact-reference-fixture'
const full=hash=>({source,candidateDetails:3,jobs:[{id:'one'},{id:'two'},{id:'three'}],exclusions:[],failures:[],observedListingCount:8,
 observedIndiaListingCount:3,nonIndiaListingCount:5,listingPaginationComplete:true,closingInventoryMatches:true,sourceScopeComplete:false,
 retainedResponses:[{url:'https://example.invalid/jobs',bodySHA256:hash,requestedAt:'2026-10-23T12:00:00.000Z',completedAt:'2026-10-23T12:00:01.000Z'}]})
function compact(value){const{jobs,exclusions,retainedResponses,...rest}=value;return{...rest,extractedDetailJobs:3,excludedDetailJobs:0,firstExtractedJobID:'one',fullBatchEvidenceOnFirstExtractedJob:true,retainedResponsesOnFirstExtractedJob:true,retainedResponseCount:retainedResponses.length}}
const inspect=values=>extractionDetailHealth(values.map(nativeCollectionEvidence=>({source,sourceDetailComplete:true,sourceListingComplete:true,jobDescription:'Complete original employer role description',nativeCollectionEvidence})))
test('explicit compact references resolve to one full native batch independent of job order',()=>{
 const value=full('a'.repeat(64)),reference=compact(value)
 for(const values of [[value,reference,reference],[reference,value,reference]]){
  const result=inspect(values);assert.equal(result.nativeCollections.length,1);assert.equal(result.complete,true)
  assert.deepEqual(result.nativeCollections[0].nativeListingCountryCounts,{observedIndiaRows:3,excludedNonIndiaRows:5,reconciled:true})
 }
})
test('distinct full batches remain distinct and ambiguous or absent compact targets cannot establish complete health',()=>{
 const first=full('a'.repeat(64)),second=full('b'.repeat(64)),reference=compact(first)
 const ambiguous=inspect([first,second,reference]);assert.equal(ambiguous.nativeCollections.length,3)
 assert.equal(ambiguous.complete,false);assert.equal(ambiguous.nativeCollections[2].nativeEvidenceReferenceAmbiguous,true)
 const missing=inspect([reference]);assert.equal(missing.nativeCollections.length,1);assert.equal(missing.complete,false)
 assert.equal(missing.nativeCollections[0].nativeEvidenceReferenceMissing,true)
 const mismatch=inspect([first,{...reference,retainedResponseCount:2}]);assert.equal(mismatch.nativeCollections.length,2)
 assert.equal(mismatch.complete,false)
})
