import assert from 'node:assert/strict'
import test from 'node:test'
import {attachInventoryEvidence,mapJobsWithInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'

const withAudit=(jobs,audit)=>Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:audit})
const emptyProof={status:'verified-empty',surface:'https://example.com/careers',firstParty:true,
 listingComplete:true,pagesFetched:1,reportedTotal:0,indiaFacetCount:0,verifiedAt:'2026-11-17T00:00:00.000Z'}

test('an explicit own native audit cleanup hold protects an empty source result',()=>{
 const jobs=withAudit([],{lifecycleCleanupAllowed:false,observedNativeRecords:14})
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('native cleanup holds survive empty wrapper mapping and complete inventory labels',()=>{
 const jobs=attachInventoryEvidence(withAudit([],{lifecycleCleanupAllowed:false}),emptyProof)
 const mapped=mapJobsWithInventoryEvidence(jobs,job=>({...job}))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(sourceLifecycleCleanupForbidden(mapped),true)
 assert.equal(mapped.nativeCollectionEvidence,jobs.nativeCollectionEvidence)
})

test('native audit metadata cannot grant cleanup over an explicit inventory hold',()=>{
 const jobs=attachInventoryEvidence(withAudit([],{lifecycleCleanupAllowed:true}),{...emptyProof,lifecycleCleanupAllowed:false})
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('native audit metadata accessors never execute during cleanup checks',()=>{
 let calls=0
 const jobs=[]
 Object.defineProperty(jobs,'nativeCollectionEvidence',{get(){calls++;throw Error('Do not read audit accessor')}})
 assert.equal(sourceLifecycleCleanupForbidden(jobs),false)
 const audit={}
 Object.defineProperty(audit,'lifecycleCleanupAllowed',{get(){calls++;throw Error('Do not read hold accessor')}})
 assert.equal(sourceLifecycleCleanupForbidden(withAudit([],audit)),false)
 assert.equal(calls,0)
})

test('inherited, malformed and nonboolean audit fields do not create authority',()=>{
 for(const audit of [null,[],false,'false',{lifecycleCleanupAllowed:0},{lifecycleCleanupAllowed:'false'},
  Object.create({lifecycleCleanupAllowed:false})]){
  assert.equal(sourceLifecycleCleanupForbidden(withAudit([],audit)),false)
 }
 const inherited=Object.create(Array.prototype)
 Object.defineProperty(inherited,'nativeCollectionEvidence',{value:{lifecycleCleanupAllowed:false}})
 const jobs=[];Object.setPrototypeOf(jobs,inherited)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),false)
})
