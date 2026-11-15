import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {currentOliverDocument,runCurrentOliverWyman} from './currentNative20261115.js'
import {run as registeredRun} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
test('native anonymous session variants preserve original publication context with all raw fields retained',()=>{
 for(const url of [fixture.corporate,fixture.board,...fixture.roles.map(r=>r.url)]){
  const pair=fixture.packets.filter(p=>p.requestedURL===url).map(p=>currentOliverDocument(text(p)))
  assert.equal(pair[0].contextSHA256,pair[1].contextSHA256,url)
  if(pair[0].app)assert.ok(pair[0].sessionParameters.csrfToken&&pair[1].sessionParameters.csrfToken)
 }
})
test('native empty paired banner instance references cannot reject the unchanged corporate delegation',()=>{
 const original=fixture.packets.find(p=>p.requestedURL===fixture.corporate),current=fixture.reviewedCorporateContextVariants[0]
 assert.equal(currentOliverDocument(text(original)).contextSHA256,currentOliverDocument(text(current)).contextSHA256)
})
for(const [name,change]of[
 ['unpaired references',s=>s.replace(/(template__002e__html\$1@)[a-f0-9]{8}/,'$100000001')],
 ['new empty-tag attribute',s=>s.replace('data-sly-unwrap></sly>','data-sly-unwrap data-value="A doctorate is mandatory."></sly>')],
 ['new authored content',s=>s.replace('data-sly-unwrap></sly>','data-sly-unwrap>A doctorate is mandatory.</sly>')],
 ['references moved into active markup',s=>s.replace('<!--\r\n<div class="component-info" data-sly-test="false">','<div class="component-info" data-sly-test="false">')],
])test('inactive banner projection holds '+name,()=>{
 const original=fixture.packets.find(p=>p.requestedURL===fixture.corporate);assert.throws(()=>currentOliverDocument(change(text(original))),/banner/)
})
test('current own native reader preserves two full explicit India roles and independently closes original models',async()=>{
 const counts=new Map(),calls=[]
 const jobs=await runCurrentOliverWyman({requestIntervalMs:0,now:()=>fixture.capturedAt,fetchImpl:async(value,init)=>{
  const url=String(value),i=counts.get(url)||0;counts.set(url,i+1);const p=fixture.packets.filter(p=>p.requestedURL===url)[i]
  assert.ok(p,'Missing genuine native response '+url+' #'+i);assert.equal(init.method,p.request.method);if(init.method==='POST')assert.equal(init.body,p.request.body)
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');calls.push(url)
  const response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 }})
 assert.equal(jobs.length,2);assert.equal(calls.length,10)
 assert.deepEqual(jobs.map(j=>j.jobId),['R_364807','R_364805'])
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.nativeLegalEmployer,'Oliver Wyman Group');assert.equal(job.postingDate,null);assert.equal(job.closingDate,null);assert.ok(job.jobDescription.includes(job.sourceNativeFullCriteria));assert.ok(job.sourceNativeFullCriteria.length>=6279);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false)}
 assert.equal(jobs.nativeCollectionEvidence.independentNativeClosingReconciled,true)
 assert.ok(jobs.every(j=>j.applyUrl==='https://careers.marsh.com/global/en/apply?jobSeqNo='+j.sourceNativeIdentity.jobSeqNo&&j.sourceNativePublishedApplication.originalModelApplyURL.startsWith('https://mmc.wd1.myworkdayjobs.com/')))
})

async function replay(change,options={}){
 const counts=new Map(),mutations=[],calls=[]
 try{
  const jobs=await registeredRun({requestIntervalMs:0,now:()=>fixture.capturedAt,...options,fetchImpl:async(value,init)=>{
   const url=String(value),index=counts.get(url)||0;counts.set(url,index+1);const original=fixture.packets.filter(p=>p.requestedURL===url)[index]
   assert.ok(original,'Missing genuine native response '+url+' #'+index);const p=structuredClone(original);p.body=text(p);const previous=JSON.stringify(p)
   change?.(p,url,index);if(previous!==JSON.stringify(p))mutations.push({url,index});calls.push({url,method:init.method,body:init.body,credentials:init.credentials,redirect:init.redirect,headers:init.headers})
   const response=new Response(p.body,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
  }})
  return{jobs,mutations,calls}
 }catch(error){return{jobs:[],error,mutations,calls}}
}
const ROLE=fixture.roles[0].url
for(const [name,change]of[
 ['foreign native work-country alternative',p=>{p.body=p.body.replace('"country":"India"','"country":"India","workCountries":["India","United States"]')}],
 ['original employer change',p=>{p.body=p.body.replaceAll('Oliver Wyman Group','Unrelated Consulting Group')}],
 ['native requested business change',p=>{p.body=p.body.replace('"business":"Oliver Wyman"','"business":"INNOPAY"')}],
 ['new mandatory qualification outside original description',p=>{p.body=p.body.replace('"postingStatus":"OPEN"','"qualifications":"A doctorate is mandatory.","postingStatus":"OPEN"')}],
 ['native closed status',p=>{p.body=p.body.replace('"postingStatus":"OPEN"','"postingStatus":"CLOSED"')}],
 ['native unpublished state',p=>{p.body=p.body.replace('"displayCareerSite":true','"displayCareerSite":false')}],
 ['native original identifier conflict',p=>{p.body=p.body.replace('"reqId":"R_364807"','"reqId":"R_364805"')}],
 ['whole original qualification text changes',p=>{p.body=p.body.replaceAll('Energy Trading and Risk Management','A doctorate is mandatory')}],
 ['decoded duplicate native country keys',p=>{p.body=p.body.replace('"country":"India"','"countr\\u0079":"United States","country":"India"')}],
 ['new native value-only condition',p=>{p.body=p.body.replace('</body>','<data value="A doctorate is mandatory."></data></body>')}],
 ['unknown role-program mutation',p=>{p.body=p.body.replace('</body>','<script>window.currentRoleClosed=true;</script></body>')}],
 ['current original stylesheet mode changes',p=>{p.body=p.body.replace('rel="stylesheet"','rel="stylesheet" media="print"')}],
 ['native Refresh changes role publisher',p=>{p.headers.refresh='0;url=https://another.example/role'}],
 ['native charset changes interpretation',p=>{p.headers['content-type']='text/html; charset=iso-8859-1'}],
 ['native CSP closes application',p=>{p.headers['content-security-policy']="script-src 'none'; form-action 'none'"}],
 ['native Link gains competing role authority',p=>{p.headers.link='<https://another.example/role>; rel="canonical"'}],
 ['native response becomes an attachment',p=>{p.headers['content-disposition']='attachment; filename="role.bin"'}],
 ['anonymous profile is no longer anonymous',p=>{p.body=p.body.replaceAll("'stranger'","'authenticated'").replaceAll('"stranger"','"authenticated"')}],
 ['anonymous session gains an original criterion',p=>{p.body=p.body.replace(/(phApp.sessionParams = \{)/,'$1"mandatoryQualification":"A doctorate is mandatory.",')}],
])test('holds closing '+name,async()=>{
 const target=name==='anonymous profile is no longer anonymous'?fixture.roles[1].url:ROLE
 const r=await replay((p,url,index)=>{if(url===target&&index===1)change(p)})
 assert.ok(r.mutations.length,'control must actually modify a genuine native response');assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap');assert.equal(r.error?.lifecycleCleanupAllowed,false)
})
test('public native query preserves original JSON method/body and omits credential state',async()=>{
 const r=await replay();assert.equal(r.jobs.length,2);assert.equal(r.calls.length,10)
 const calls=r.calls.filter(c=>c.method==='POST');assert.equal(calls.length,2)
 assert.ok(calls.every(c=>c.url===fixture.query.url&&c.body===fixture.query.body&&c.headers['Content-Type']==='application/json'&&!Object.hasOwn(c.headers,'X-Requested-With')))
 assert.ok(r.calls.every(c=>c.credentials==='omit'&&c.redirect==='manual'))
})
test('native publication representations cannot be in the future even when scalar dates are unresolved',async()=>{
 const r=await replay(undefined,{now:()=> '2026-09-01T00:00:00.000Z'});assert.equal(r.jobs.length,0);assert.match(r.error?.message||'',/publication|future|calendar/)
})
test('caller cancellation is retained before any native read',async()=>{
 const controller=new AbortController(),reason=Error('caller stopped');controller.abort(reason);let reads=0
 await assert.rejects(runCurrentOliverWyman({signal:controller.signal,fetchImpl:async()=>{reads++}}),e=>e===reason);assert.equal(reads,0)
})
test('opaque public response is source-deadline bounded',async()=>{
 const start=performance.now();await assert.rejects(runCurrentOliverWyman({sourceDeadlineMs:30,requestIntervalMs:0,fetchImpl:()=>new Promise(()=>{})}),/deadline/);assert.ok(performance.now()-start<1500)
})
test('intrinsic original byte length rejects a spoofed oversized chunk and releases it once',async()=>{
 const stats={reads:0,cancels:0,releases:0},chunk=new Uint8Array(4000001);Object.defineProperty(chunk,'byteLength',{value:1})
 await assert.rejects(runCurrentOliverWyman({sourceDeadlineMs:100,requestIntervalMs:0,fetchImpl:async url=>({status:200,url:String(url),headers:new Headers(),body:{getReader(){return{read(){stats.reads++;return Promise.resolve({done:false,value:chunk})},cancel(){stats.cancels++},releaseLock(){stats.releases++}}}}})}),/streaming byte bound/)
 assert.deepEqual(stats,{reads:1,cancels:1,releases:1})
})
