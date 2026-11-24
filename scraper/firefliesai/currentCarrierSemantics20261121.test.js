import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import http from 'node:http'
import https from 'node:https'
import {syncBuiltinESMExports} from 'node:module'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'

// Existing Nov20 packet, not a new acquisition. The underlying result path in
// its metadata is not locally available; no fresh/current provenance is inferred.
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-default-20261120.json.gz',import.meta.url))))
const originals=packet.responses.map((row,index)=>({...row,index,body:Buffer.from(row.bodyBase64,'base64').toString('utf8')}))
const nativeRows=JSON.parse(originals[3].body).data.oatsExternalJobPostings.jobPostings
const india=nativeRows.filter(row=>row.locations.some(location=>location.isoCountry==='IND'))
const target=india[0],other=india[1]
assert.equal(india.length,2,'fixture oracle only; no runtime cohort admission pin')
const targetURL='https://jobs.gem.com/fireflies/'+target.extId
const carrier=row=>/^https:\/\/jobs\.gem\.com\/fireflies\/[^/]+(?:\/application)?$/.test(row.requestedURL)
const targetCarrier=row=>row.requestedURL===targetURL||row.requestedURL===targetURL+'/application'
const targetDetail=row=>row.method==='POST'&&JSON.parse(row.requestBody).operationName==='ExternalJobPosting'&&JSON.parse(row.requestBody).variables.extId===target.extId
const descriptions=(body,edit)=>{
 let count=0
 const changed=body.replace(/(<meta\b[^>]*(?:name|property)="(?:description|og:description|twitter:description)"[^>]*\bcontent=")([^"]*)("[^>]*>)/g,
  (_match,start,value,end)=>{count++;return start+edit(value)+end})
 assert.equal(count,3,'all three actual role-owned metadata description carriers')
 return changed
}
function replay(t,edit=body=>body){
 let clock=0,fences=0
 const protocolErrors=[],calls=[],queues=new Map()
 const deny=()=>{fences++;throw Error('Unexpected live request in retained Fireflies semantic test')}
 for(const [owner,name]of [[globalThis,'fetch'],[http,'request'],[http,'get'],[https,'request'],[https,'get']])t.mock.method(owner,name,deny)
 syncBuiltinESMExports()
 t.mock.method(performance,'now',()=>clock)
 t.after(()=>{t.mock.restoreAll();syncBuiltinESMExports();assert.equal(fences,0,'all five network fences');assert.deepEqual(protocolErrors,[])})
 for(const row of originals){
  const key=JSON.stringify([row.method,row.requestedURL,row.requestBody??null])
  if(!queues.has(key))queues.set(key,[])
  queues.get(key).push(row)
 }
 return{calls,options:{now:()=>packet.completedAt,fetchImpl:async(url,init)=>{
  try{
   const row=queues.get(JSON.stringify([init.method,url,init.body??null]))?.shift()
   assert(row,'exact saved method/URL/body response required')
   assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
   if(init.method==='POST')assert(!/\bmutation\b/.test(JSON.parse(init.body).query))
   const body=edit(row.body,row),headers=new Headers(row.headers)
   headers.set('content-length',String(Buffer.byteLength(body)))
   calls.push({index:row.index,url,method:init.method});clock+=500
   return Object.defineProperty(new Response(body,{status:row.status,headers}),'url',{value:row.finalURL})
  }catch(error){protocolErrors.push({name:error.name,message:error.message});throw error}
 }}}
}
const retained=(jobs,expectedIDs)=>{
 assert.deepEqual(jobs.map(row=>row.jobId).sort(),expectedIDs.slice().sort())
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
 assert(jobs.every(row=>row.country==='India'&&row.activationVerified===false&&row.sourceRenderedCriteriaComplete===false&&row.lifecycleCleanupAllowed===false))
}

test('Fireflies actual native theme-colour change preserves the unchanged historical role facts',async t=>{
 const io=replay(t,(body,row)=>carrier(row)?body.replace('name="theme-color" content="#0D61FF"','name="theme-color" content="#123456"'):body)
 retained(await run(io.options),india.map(row=>row.extId));assert.equal(io.calls.length,20)
})
test('Fireflies closing-only cosmetic metadata change preserves the native paired cohort',async t=>{
 const io=replay(t,(body,row)=>row.index>=10&&carrier(row)?body.replace('name="theme-color" content="#0D61FF"','name="theme-color" content="#123456"'):body)
 retained(await run(io.options),india.map(row=>row.extId));assert.equal(io.calls.length,20)
})
test('Fireflies unrelated head metadata does not become a role authority gate',async t=>{
 const io=replay(t,(body,row)=>carrier(row)?body.replace('</head>','<meta name="x-display-note" content="coherent presentation">\n</head>'):body)
 retained(await run(io.options),india.map(row=>row.extId));assert.equal(io.calls.length,20)
})
test('Fireflies coherent whitespace in all own description metadata keeps full native criteria',async t=>{
 const io=replay(t,(body,row)=>carrier(row)?descriptions(body,value=>value.replace(/\s+/g,'  ')):body)
 retained(await run(io.options),india.map(row=>row.extId));assert.equal(io.calls.length,20)
})
test('Fireflies added role-owned metadata requirement holds only that affected role',async t=>{
 const io=replay(t,(body,row)=>targetCarrier(row)?descriptions(body,value=>value+' Additional mandatory licence is required for this role.'):body)
 retained(await run(io.options),[other.extId]);assert.equal(io.calls.length,20)
})
test('Fireflies another native public title holds only its affected role',async t=>{
 const io=replay(t,(body,row)=>targetCarrier(row)?body.replaceAll(target.title,'Other Employer Role'):body)
 retained(await run(io.options),[other.extId]);assert.equal(io.calls.length,20)
})
test('Fireflies foreign own-role metadata URL holds only its affected role',async t=>{
 const io=replay(t,(body,row)=>targetCarrier(row)?body.replaceAll(targetURL,'https://other-employer.example/role'):body)
 retained(await run(io.options),[other.extId]);assert.equal(io.calls.length,20)
})
test('Fireflies closing-only native metadata criteria conflict preserves an unrelated role',async t=>{
 const io=replay(t,(body,row)=>row.index>=10&&targetCarrier(row)?descriptions(body,value=>value+' Additional mandatory licence is required for this role.'):body)
 retained(await run(io.options),[other.extId]);assert.equal(io.calls.length,20)
})
test('Fireflies unknown native API requirement field remains an explicit contract hold',async t=>{
 const io=replay(t,(body,row)=>{if(!targetDetail(row))return body;const model=JSON.parse(body);model.data.oatsExternalJobPosting.futureRequirement='Unknown mandatory condition';return JSON.stringify(model)})
 await assert.rejects(run(io.options),/unqualified native posting fields/)
})
test('Fireflies native hidden application remains held before HTML interpretation',async t=>{
 const io=replay(t,(body,row)=>{if(!targetDetail(row))return body;const model=JSON.parse(body);model.data.oatsExternalJobPosting.isApplicationFormHidden=true;return JSON.stringify(model)})
 await assert.rejects(run(io.options),/native application availability differs/)
})
test('Fireflies earliest native publication cannot be renewed into a future observation',async t=>{
 const io=replay(t,(body,row)=>{if(!targetDetail(row))return body;const model=JSON.parse(body);model.data.oatsExternalJobPosting.firstPublishedTsSec=Math.floor(Date.parse(packet.completedAt)/1000)+3600;return JSON.stringify(model)})
 await assert.rejects(run(io.options),/native publication timestamp unqualified/)
})

// Exact independent required-input payload; all prior eleven controls remain
// byte-identical in the dated parent. Other forms are bounded semantic neighbors.
const independentRequiredApplication='<form id="independent-native-application-condition"><input type="text" name="securityClearance" required aria-label="Mandatory role security clearance qualification"></form>'
const applicationConditionControls=[
 {name:'exact independent required input holds its own role',html:independentRequiredApplication,hold:true},
 {name:'closing-only required input holds its own role',html:independentRequiredApplication,closingOnly:true,hold:true},
 {name:'required native select remains unmodelled',html:'<form><select name="securityClearance" required aria-label="Mandatory role security clearance qualification"><option value=""></option></select></form>',hold:true},
 {name:'required native textarea remains unmodelled',html:'<form><textarea name="securityClearance" required aria-label="Mandatory role security clearance qualification"></textarea></form>',hold:true},
 {name:'inert template controls supply no application condition',html:'<template>'+independentRequiredApplication+'</template>',hold:false},
 {name:'hidden state and display button supply no candidate requirement',html:'<form data-presentation="native-display"><input type="hidden" name="requestToken" value="retained-display" required><button type="button" aria-label="Show display details"></button></form>',hold:false},
]
for(const control of applicationConditionControls)test('Fireflies application-condition '+control.name,async t=>{
 let changes=0
 const io=replay(t,(body,row)=>{
  if(row.requestedURL!==targetURL+'/application'||control.closingOnly&&row.index<10)return body
  assert(body.includes('</body>'),'actual native application body carrier')
  changes++;return body.replace('</body>',control.html+'\n</body>')
 })
 const jobs=await run(io.options)
 retained(jobs,control.hold?[other.extId]:india.map(row=>row.extId))
 assert.equal(io.calls.length,20);assert.equal(changes,control.closingOnly?1:2)
 if(control.hold){assert.equal(jobs.nativeCollectionEvidence.unqualifiedPublicCarrierRoleCount,1);assert.equal(jobs.nativeCollectionEvidence.publicCarrierHolds[0].extId,target.extId)}
})
