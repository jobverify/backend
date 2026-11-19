import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const replay=(change=(_row,body)=>body)=>{
 let index=0
 return {reads:()=>index,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const row=fixture.responses[index++]
  assert.ok(row,'Only the genuine opening/closing native requests are admitted')
  assert.equal(url,row.requestedURL)
  assert.equal(init.method,row.method)
  assert.equal(init.redirect,'manual')
  assert.equal(init.credentials,'omit')
  if(row.requestBody)assert.deepEqual(JSON.parse(init.body),row.requestBody)
  for(const[key,value]of Object.entries(row.requestHeaders??{}))assert.equal(new Headers(init.headers).get(key),value)
  const body=change(row,Buffer.from(row.bodyBase64,'base64').toString('utf8'),index)
  return Object.defineProperty(new Response(row.status===302?null:body,{status:row.status,headers:row.headers}),'url',{value:row.url})
 }}}
}

test('current exact HROne rebuild acquires both original models while preserving the separate Artisan employer and unknown Sula inventory',async()=>{
 const io=replay()
 await assert.rejects(run(io.options),error=>{
  assert.equal(error.failureKind,'source_inventory_unavailable')
  const n=error.nativeCollectionEvidence
  assert.equal(n.nativeOpeningModel.fullPortalDTO.portalDetails[0].companyName,'Artisan Spirits Pvt Ltd')
  assert.equal(n.nativeOpeningModel.fullPortalDTO.portalDetails[0].websiteName,'SULA VINEYARDS LIMITED')
  assert.deepEqual(n.nativeOpeningModel.fullNativeQueriedRows,[])
  assert.deepEqual(n.nativeClosingModel.fullNativeQueriedRows,[])
  assert.equal(n.sourceEmployerMatchesNativeLegalEmployer,false)
  assert.equal(n.companyIndiaTotal,null)
  assert.equal(n.companyGlobalTotal,null)
  assert.equal(n.observedVacancyCount,null)
  assert.equal(n.verifiedEmpty,false)
  assert.equal(n.sourceScopeComplete,false)
  assert.equal(n.lifecycleCleanupAllowed,false)
  assert.equal(n.applicationSubmitted,false)
  assert.ok(n.nativeOpeningModel.reviewedNativePrograms.some(x=>x.url.endsWith('/main.94af3b54956e0a0b.js')&&x.sha256==='60bf15917810d50a81a99d915d0eababf3e887b1aff5aa70e5f46af3a03d3427'))
  return true
 })
 assert.equal(io.reads(),18)
})

test('a changed byte in the reviewed rebuilt main or native route remains a contract failure',async()=>{
 for(const suffix of ['/main.94af3b54956e0a0b.js','/1020.5da02bbdf228dacf.js']){
  const io=replay((row,body)=>row.requestedURL.endsWith(suffix)?body+'\nwindow.unreviewedNativeEmployer=true;':body)
  await assert.rejects(run(io.options),error=>error.failureKind==='parser_or_contract_error')
  assert.ok(io.reads()<18)
 }
})

test('an unreviewed main filename and closing native route change cannot inherit the finite rebuild review',async()=>{
 const unknown=replay((row,body)=>row.requestedURL.includes('/career-portal?')?body.replace('main.94af3b54956e0a0b.js','main.unreviewed.js'):body)
 await assert.rejects(run(unknown.options),error=>error.failureKind==='parser_or_contract_error')
 assert.equal(unknown.reads(),3)
 const closing=replay((row,body,index)=>index>9&&row.requestedURL.endsWith('/1020.5da02bbdf228dacf.js')?body+'\nwindow.changedClosingRoute=true;':body)
 await assert.rejects(run(closing.options),error=>error.failureKind==='parser_or_contract_error')
 assert.ok(closing.reads()>9&&closing.reads()<18)
})
