import assert from 'node:assert/strict'
import test from 'node:test'
import {buildScrapers,createCatalogScraper} from '../providers/index.js'
import {pacingProvider,pacingPayload} from './apiPortalPacing20261031.fixture.js'

const authorized=()=>buildScrapers().find(row=>row.name==='atkinsrealis')
const empty={jobs:[],meta:{totalCount:0}}
const response=(status,payload,{header,cancel=()=>{},read=()=>{}}={})=>({
 ok:status>=200&&status<300,status,headers:new Headers(header?[header]:[]),bodyUsed:false,
 body:{cancel},json:async()=>{read();return payload},
})
const blocked=(error,status)=>{
 assert.equal(error.status,status);assert.equal(error.httpStatus,status)
 assert.equal(error.accessChallenge,true);assert.equal(error.abortRetries,true)
 assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.lifecycleCleanupAllowed,false)
 return true
}

for(const header of ['cf-mitigated','x-amzn-waf-action'])test('registered generic API stops HTTP200 '+header+' before JSON and disposes its body',async t=>{
 let calls=0,reads=0,cancelled=0
 t.mock.method(globalThis,'fetch',async url=>{calls++;return response(200,pacingPayload(url),{
  header:[header,'challenge'],read:()=>reads++,cancel:()=>cancelled++,
 })})
 await assert.rejects(createCatalogScraper(pacingProvider(undefined,{detail:false})).run(),error=>blocked(error,200))
 assert.equal(calls,1);assert.equal(reads,0);assert.equal(cancelled,1)
})

for(const [stage,status,header] of [
 ['token',200,'cf-mitigated'],['token',403,'x-amzn-waf-action'],
 ['listing',200,'x-amzn-waf-action'],['listing',403,'cf-mitigated'],
 ['refresh-token',200,'cf-mitigated'],['refresh-listing',200,'x-amzn-waf-action'],
])test('registered authorized API stops '+stage+' HTTP'+status+' challenge before JSON or another refresh',async t=>{
 let tokens=0,listings=0,challengeReads=0,cancelled=0
 t.mock.method(globalThis,'fetch',async url=>{
  const token=String(url).endsWith('/token'),visit=token?++tokens:++listings
  const target=stage==='token'?token&&visit===1:stage==='listing'?!token&&visit===1
   :stage==='refresh-token'?token&&visit===2:!token&&visit===2
  if(target)return response(status,token?{token:'controlled-token'}:empty,{
   header:[header,'challenge'],read:()=>challengeReads++,cancel:()=>cancelled++,
  })
  if(stage.startsWith('refresh-')&&!token&&visit===1)return response(403,{})
  return response(200,token?{token:'controlled-token'}:empty)
 })
 await assert.rejects(authorized().run(),error=>blocked(error,status))
 assert.equal(challengeReads,0);assert.equal(cancelled,1)
 assert.equal(tokens,stage.startsWith('refresh-')?2:1)
 assert.equal(listings,stage==='token'?0:stage==='refresh-listing'?2:1)
})

test('registered generic API nonchallenge header retains the complete controlled JSON and request contract',async t=>{
 const provider=pacingProvider(undefined,{detail:false});let reads=0,cancelled=0
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.equal(init.method,'GET')
  return response(200,pacingPayload(url),{header:['cf-mitigated','not-a-challenge'],read:()=>reads++,cancel:()=>cancelled++})
 })
 const jobs=await createCatalogScraper(provider).run()
 assert.deepEqual(jobs.map(row=>row.jobId),['one','two','three']);assert.equal(reads,1);assert.equal(cancelled,0)
})

test('registered authorized API nonchallenge headers preserve one ordinary403 token refresh',async t=>{
 let tokens=0,listings=0
 t.mock.method(globalThis,'fetch',async url=>{
  if(String(url).endsWith('/token')){tokens++;return response(200,{token:'controlled-token'},{header:['cf-mitigated','none']})}
  listings++;return response(listings===1?403:200,listings===1?{}:empty,{header:['x-amzn-waf-action','none']})
 })
 assert.deepEqual(await authorized().run(),[]);assert.equal(tokens,2);assert.equal(listings,2)
})

test('registered API caller null cancellation during challenged-body cleanup retains the exact reason',async t=>{
 const controller=new AbortController();let reads=0,cancelled=0
 t.mock.method(globalThis,'fetch',async()=>response(200,empty,{
  header:['cf-mitigated','challenge'],read:()=>reads++,cancel:()=>{cancelled++;controller.abort(null)},
 }))
 let returned,error,settled=false
 try{returned=await createCatalogScraper(pacingProvider(undefined,{detail:false})).run({signal:controller.signal})}
 catch(caught){error=caught;settled=true}
 assert.equal(returned,undefined);assert.equal(settled,true);assert.equal(error,null)
 assert.equal(reads,0);assert.equal(cancelled,1)
})

test('registered API a stalled challenge-body cancellation is bounded and preserves the typed primary error',async t=>{
 let reads=0,cancelled=0
 t.mock.method(globalThis,'fetch',async()=>response(200,empty,{
  header:['x-amzn-waf-action','challenge'],read:()=>reads++,cancel:()=>{cancelled++;return new Promise(()=>{})},
 }))
 await assert.rejects(createCatalogScraper(pacingProvider(undefined,{detail:false})).run(),error=>blocked(error,200))
 assert.equal(reads,0);assert.equal(cancelled,1)
})

test('registered API local request deadline during challenge cleanup retains the already observed primary failure',async t=>{
 const timeout=AbortSignal.timeout.bind(AbortSignal)
 t.mock.method(AbortSignal,'timeout',ms=>timeout(ms===20000?10:ms))
 let reads=0,cancelled=0
 t.mock.method(globalThis,'fetch',async()=>response(403,{}, {
  header:['cf-mitigated','challenge'],read:()=>reads++,
  cancel:()=>{cancelled++;return new Promise(resolve=>setTimeout(resolve,30))},
 }))
 await assert.rejects(createCatalogScraper(pacingProvider(undefined,{detail:false})).run(),error=>blocked(error,403))
 assert.equal(reads,0);assert.equal(cancelled,1)
})
