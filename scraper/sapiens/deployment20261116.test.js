import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readSapiensBoard,readSapiensLanding,runCurrentSapiensData} from './nativeData20261115.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/deployment-20261116.json.gz',import.meta.url))))
const packet=capture.responses[0],bytes=Buffer.from(packet.bodyBase64,'base64')
const page={label:'board',url:packet.url,method:'GET',requestBody:null,bytes,text:bytes.toString('utf8')}

test('Sapiens Nov16 complete native deployment shell remains data-only without granting rendered role authority',()=>{
 assert.equal(readSapiensBoard(page).roleSSRQualified,false)
 const id='00000000-0000-4000-8000-000000000001'
 const landing=readSapiensLanding({...page,label:'landing-'+id,url:page.url+'jobs/'+id},id)
 assert.equal(landing.roleSSRQualified,false)
 assert.equal(landing.canonicalQualified,false)
})

test('Sapiens a new own declared asset revision remains only generic shell evidence',()=>{
 const text=page.text.replace('main.e982b7319a1ce329.js','main.0000000000000000.js')
 assert.notEqual(text,page.text)
 assert.equal(readSapiensBoard({...page,text,bytes:Buffer.from(text)}).roleSSRQualified,false)
})

test('Sapiens Nov16 current original14-response run retains both distinct India native criteria and intake records',async()=>{
 let next=0
 const jobs=await runCurrentSapiensData({now:()=>capture.capturedAt,fetchImpl:async(url,init)=>{
  const packet=capture.responses[next++]
  assert.equal(url,packet.url)
  assert.equal(init.method,'GET')
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
 }})
 assert.equal(next,14)
 assert.deepEqual(jobs.map(row=>row.jobId),['2fa03470-341d-4257-8051-43c29899c4b1','34f3410f-595b-483d-bbdf-ba86636e071b'])
 assert.ok(jobs.every(row=>row.country==='India'&&row.sourceDetailComplete&&row.nativeRoleClosingReconciled&&row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false&&row.applyUrl===null))
 assert.equal(jobs.nativeCollectionEvidence.allSevenWholeCurrentBodiesClosed,true)
})
