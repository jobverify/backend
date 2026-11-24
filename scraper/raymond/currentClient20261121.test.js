import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const bytes=fs.readFileSync(new URL('./test-data/current-client-20261121.json.gz',import.meta.url))
const fixture=JSON.parse(gunzipSync(bytes)),manifest=JSON.parse(fs.readFileSync(new URL('./test-data/current-client-20261121-manifest.json',import.meta.url)))
const legacy=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261110.json.gz',import.meta.url))))
const origin='https://raymondcareers.peoplestrong.com',sha=value=>createHash('sha256').update(value).digest('hex')
const replay=(change=()=>{},{old=false}={})=>{
 const replacements=new Map(fixture.rows.map(row=>[row.requestedURL,row]))
 const rows=old?structuredClone(legacy):structuredClone([...legacy.filter(row=>!replacements.has(row.requestedURL)),...fixture.rows])
 change(rows);let listing=0;const calls=[]
 const options={now:()=>legacy.at(-1).at,fetchImpl:async(url,init)=>{
  calls.push({url,method:init.method,body:init.body})
  const matches=rows.filter(row=>row.requestedURL===url),row=url.includes('/jobs/v1?')?matches[listing++]:matches[0]
  assert.ok(row,'Undeclared composite replay read '+url)
  assert.equal(init.method,row.method||'GET');assert.equal(init.body,row.requestBody??undefined)
  assert.equal(init.credentials,'omit')
  const response=new Response(row.body,{status:row.status,headers:{'Content-Type':row.contentType}})
  Object.defineProperty(response,'url',{value:row.finalURL});return response
 }}
 return {options,calls}
}
const find=(rows,suffix)=>{const row=rows.find(r=>r.requestedURL.endsWith(suffix));assert.ok(row,suffix);return row}
const noNative=calls=>assert.equal(calls.filter(r=>r.url.includes('/api/')).length,0)

test('current client fixture retains twelve complete original byte/hash/authority receipts without native count claims',()=>{
 assert.equal(sha(bytes),manifest.sha256);assert.equal(fixture.rows.length,12);assert.equal(fixture.nativeCurrentCounts,null)
 for(const row of fixture.rows){assert.equal(sha(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes);assert.equal(row.bodyOriginalUnmodified,true);assert.deepEqual(row.bodyRedactions,[])}
})

test('reviewed current client reaches dated original native models with every original criterion and date preserved',async()=>{
 const old=replay(()=>{},{old:true}),current=replay(),before=await run(old.options),after=await run(current.options)
 assert.equal(before.length,5);assert.equal(after.length,5)
 assert.deepEqual(after.map(j=>j.nativeSourceRecord),before.map(j=>j.nativeSourceRecord))
 for(const [i,job]of after.entries()){
  for(const key of ['title','company','country','jobId','sourceUrl','applyUrl','postingDate','closingDate','minimumQualification','jobDescription','requiredSkills'])assert.deepEqual(job[key],before[i][key],key)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(extractionDetailHealth(after).nativeCollections[0].parsedDetails,5)
 assert.equal(readInventoryEvidence(after).lifecycleCleanupAllowed,false)
 for(const row of fixture.rows)assert.ok(current.calls.some(c=>c.url===row.requestedURL),'Unverified selected current original '+row.requestedURL)
})

for(const [name,suffix,edit]of[
 ['main comment','main-OBU6H7ZJ.js',s=>s+'\n/* unknown executable deployment */'],
 ['core detail path with stale comment','chunk-P66I7TEB.js',s=>s.replace('"job/"+t+"/v2?part="+r+"&isReqId="+o','"other/"+t+"/v2?part="+r+"&isReqId="+o')+'/*"job/"+t+"/v2?part="+r+"&isReqId="+o*/'],
 ['role render authority','chunk-QOT5H7Z2.js',s=>s.replace('getJobSecuritywithEntity(this.requisition.entityID)','getJobSecuritywithEntity("999")')],
 ['transport checksum','chunk-5O7NHF3E.js',s=>s.replace('iterations:ye','iterations:1')],
 ['CAM upload action','chunk-BH3DVTPY.js',s=>s.replace('upload/cam','upload/other')],
 ['carousel selection','chunk-GXVQSF7C.js',s=>s+'\nconst country="Canada";'],
 ['preview visibility','chunk-IBMO7ROQ.js',s=>s.replace('height:70vh','display:none;height:70vh')],
 ['sanitizer authority','chunk-B2MJ73ZP.js',s=>s.replace('i.version="3.4.18"','i.version="unreviewed"')],
 ['classic programme','scripts-FBG5OBPV.js',s=>s+'\nwindow.publicHiringClosed=true;'],
])test('rejects changed complete current '+name+' before native API reads',async()=>{
 const {options,calls}=replay(rows=>{const row=find(rows,suffix),changed=edit(row.body);assert.notEqual(changed,row.body);row.body=changed})
 await assert.rejects(run(options));noNative(calls)
})

for(const [name,edit]of[
 ['closing authority',s=>s.replace('</body>','<p>Applications for every advertised position are now closed.</p></body>')],
 ['country authority',s=>s.replace('</body>','<p>All advertised positions require Canadian residency.</p></body>')],
 ['employer authority',s=>s.replace('</body>','<p>All positions are employed by Another Employer Limited.</p></body>')],
 ['inline criteria CSS',s=>s.replace('</head>','<style>.job-description{display:none}</style></head>')],
 ['stylesheet target',s=>s.replace('assets/css/styles_v2.css','assets/css/unknown.css')],
 ['inactive classic declaration',s=>s.replace('src="scripts-FBG5OBPV.js" defer','type="application/json" src="scripts-FBG5OBPV.js" defer')],
 ['additional actor',s=>s.replace('</body>','<script src="unknown.js"></script></body>')],
 ['loader authority',s=>s.replace('&ns=1&cb=','&ns=2&cb=')],
])test('rejects changed current portal '+name+' before native API reads',async()=>{
 const {options,calls}=replay(rows=>{const row=find(rows,'/job/joblist'),changed=edit(row.body);assert.notEqual(changed,row.body);row.body=changed})
 await assert.rejects(run(options));noNative(calls)
})

test('only the one original numeric public loader cache-buster may vary',async()=>{
 const {options}=replay(rows=>{const row=find(rows,'/job/joblist'),changed=row.body.replace('&ns=1&cb=680481163','&ns=1&cb=1234567890123');assert.notEqual(changed,row.body);row.body=changed})
 assert.equal((await run(options)).length,5)
})

test('rejects different current main URL and commented stale import declarations',async()=>{
 const a=replay(rows=>{const portal=find(rows,'/job/joblist');portal.body=portal.body.replaceAll('main-OBU6H7ZJ.js','main-UNKNOWN.js');const main=find(rows,'main-OBU6H7ZJ.js');main.requestedURL=origin+'/main-UNKNOWN.js';main.finalURL=main.requestedURL})
 await assert.rejects(run(a.options));noNative(a.calls)
 const b=replay(rows=>{const main=find(rows,'main-OBU6H7ZJ.js');main.body=main.body.replaceAll('./chunk-QOT5H7Z2.js','https://foreign.example/chunk-QOT5H7Z2.js')+'/*"./chunk-QOT5H7Z2.js"*/'})
 await assert.rejects(run(b.options));noNative(b.calls)
})

test('retains current caller abort, source deadline, request and asset publisher bounds',async()=>{
 const controller=new AbortController(),reason=Error('Current Raymond caller cancellation');controller.abort(reason)
 const a=replay();await assert.rejects(run({...a.options,signal:controller.signal}),e=>e===reason);assert.equal(a.calls.length,0)
 await assert.rejects(run({...replay().options,sourceTimeoutMs:20,fetchImpl:()=>new Promise(()=>{})}))
 const b=replay();await assert.rejects(run({...b.options,maxRequests:4}));assert.equal(b.calls.length,4);noNative(b.calls)
 for(const change of [{status:403},{contentType:'text/html'},{finalURL:'https://foreign.example/client.js'}]){
  const c=replay(rows=>Object.assign(find(rows,'scripts-FBG5OBPV.js'),change));await assert.rejects(run(c.options));noNative(c.calls)
 }
})

test('current client admission retains country, native criteria, publication and closing inventory holds',async()=>{
 for(const [field,value]of [['locationHierarchyComplete','Canada>Ontario>Toronto>Toronto'],['jobDescription','<template>hidden-only</template>'],['CandidatePortalStartDate','2099-01-01 00:00:00.0']]){
  const {options}=replay(rows=>{const row=rows.find(r=>r.requestedURL.includes('/cp/job/')),body=JSON.parse(row.body);body.response[field]=value;row.body=JSON.stringify(body)})
  assert.equal((await run(options)).length,4,field)
 }
 const closing=replay(rows=>{const row=rows.filter(r=>r.requestedURL.includes('/jobs/v1?')).at(-1),body=JSON.parse(row.body);body.response[0].jobTitle='Changed closing native row';row.body=JSON.stringify(body)})
 await assert.rejects(run(closing.options))
})
