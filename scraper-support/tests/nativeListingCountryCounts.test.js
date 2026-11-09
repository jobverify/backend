import assert from 'node:assert/strict'
import test from 'node:test'
import {extractionDetailHealth} from '../utils/extractionDetailHealth.js'
function collection(extra={}){return{source:'country-count-fixture',candidateDetails:3,jobs:[{id:'one'},{id:'two'},{id:'three'}],exclusions:[],failures:[],observedListingCount:8,listingPaginationComplete:true,closingInventoryMatches:true,sourceScopeComplete:false,...extra}}
const inspect=value=>extractionDetailHealth([{source:'country-count-fixture',jobDescription:'Employer-authored native role content',sourceDetailComplete:true,nativeCollectionEvidence:value}]).nativeCollections[0]
test('explicit native India and nonIndia listing counts survive compact detail-health projection',()=>{
 const value=collection({observedIndiaListingCount:3,nonIndiaListingCount:5}),full=inspect(value)
 assert.deepEqual(full.nativeListingCountryCounts,{observedIndiaRows:3,excludedNonIndiaRows:5,reconciled:true})
 const {jobs,exclusions,failures,...compact}=value
 const copy=inspect({...compact,extractedDetailJobs:3,excludedDetailJobs:0,failures:[]})
 assert.deepEqual(copy.nativeListingCountryCounts,full.nativeListingCountryCounts)
})
test('historical absent native country counts stay absent and invalid or partial counts remain unknown',()=>{
 assert.equal(Object.hasOwn(inspect(collection()),'nativeListingCountryCounts'),false)
 assert.deepEqual(inspect(collection({observedIndiaListingCount:3})).nativeListingCountryCounts,{observedIndiaRows:3,excludedNonIndiaRows:null,reconciled:null})
 assert.deepEqual(inspect(collection({observedIndiaListingCount:'3',nonIndiaListingCount:5})).nativeListingCountryCounts,{observedIndiaRows:null,excludedNonIndiaRows:5,reconciled:null})
 assert.deepEqual(inspect(collection({observedIndiaListingCount:3,nonIndiaListingCount:4})).nativeListingCountryCounts,{observedIndiaRows:3,excludedNonIndiaRows:4,reconciled:false})
})
