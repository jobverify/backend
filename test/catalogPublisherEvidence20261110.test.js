import assert from 'node:assert/strict'
import test from 'node:test'
import {extractionFailureDetails} from '../scripts/catalogExtractionFailureEvidence.js'

const summarize = observations => extractionFailureDetails(Object.assign(new Error('Current verified recruitment inventory is unavailable'), {
  softFailure: true, failureKind: 'coverage_gap', recruitmentObservations: observations,
}))

test('publisher evidence count coexists with an earlier unqualified-page warning', () => {
  const result = summarize({source:'fixture',nativeRecords:0,requestCount:2,
    unresolved:['current-corporate-publisher-identity-unqualified','current-native-recruitment-contract-not-discovered'],
    corporateIdentityEvidence:[{url:'https://example.test/about',publisherNames:['Example Corporation']}],
    boards:[],nativeInventoryReads:[],receipts:[{status:200},{status:200}],failures:[]})
  assert.equal(result.recruitmentFailureEvidence.corporateIdentityEvidenceCount,1)
  assert.deepEqual(result.recruitmentFailureEvidence.unresolvedKinds,[
    'current-corporate-publisher-identity-unqualified','current-native-recruitment-contract-not-discovered'])
  assert.equal(result.failureKind,'coverage_gap')
  assert.equal(result.recruitmentFailureEvidence.observedNativeRecords,0)
  assert.equal(result.recruitmentFailureEvidence.inventoryComplete,false)
  assert.equal(result.recruitmentFailureEvidence.lifecycleCleanupAllowed,false)
  assert.equal(result.recruitmentFailureEvidence.firstParty,null)
  assert.doesNotMatch(JSON.stringify(result),/example\.test|Example Corporation|publisherNames|rawJobs|indiaJobs|eligibleJobs/)
})

test('absent and malformed publisher evidence remains unknown rather than zero', () => {
  for(const value of [undefined,null,3,'publisher',{},()=>[]]){
    assert.equal(summarize({corporateIdentityEvidence:value}).recruitmentFailureEvidence.corporateIdentityEvidenceCount,null)
  }
  assert.equal(summarize({}).recruitmentFailureEvidence.corporateIdentityEvidenceCount,null)
  assert.equal(summarize({corporateIdentityEvidence:[]}).recruitmentFailureEvidence.corporateIdentityEvidenceCount,0)
})

test('publisher count is bounded and cannot invoke source accessors or inspect private records', () => {
  let accessed=0
  const observations={}
  Object.defineProperty(observations,'corporateIdentityEvidence',{get(){accessed++;throw Error('getter')}})
  assert.equal(summarize(observations).recruitmentFailureEvidence.corporateIdentityEvidenceCount,null)
  const list=new Array(2)
  for(const key of ['0','1'])Object.defineProperty(list,key,{get(){accessed++;throw Error('private record getter')}})
  list[Symbol.iterator]=()=>{accessed++;throw Error('iterator')}
  assert.equal(summarize({corporateIdentityEvidence:list}).recruitmentFailureEvidence.corporateIdentityEvidenceCount,2)
  const overCap=new Array(1000001)
  assert.equal(summarize({corporateIdentityEvidence:overCap}).recruitmentFailureEvidence.corporateIdentityEvidenceCount,null)
  const hostile=new Proxy([], {getOwnPropertyDescriptor(){accessed++;throw Error('denied')}})
  assert.equal(summarize({corporateIdentityEvidence:hostile}).recruitmentFailureEvidence.corporateIdentityEvidenceCount,null)
  assert.equal(accessed,1)
})
