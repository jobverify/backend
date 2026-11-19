import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {collectLandmarkPeopleStrong,buildPeopleStrongDetailUrl,buildPeopleStrongOrgUrl} from './peopleStrongNative.js'

const deployment=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261119/current-deployment.json.gz',import.meta.url))))
const legacy=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261114/current-native.json.gz',import.meta.url))))
const origin='https://careers-landmarkgroupindia.peoplestrong.com',base=origin+'/api/cp/rest/altone/cp/'
const MAIN=origin+'/main-OBU6H7ZJ.js',SERVICE=origin+'/chunk-P66I7TEB.js',DETAIL=origin+'/chunk-QOT5H7Z2.js',LIST=base+'jobs/v1?offset=0&limit=45',SAMPLE='LAMG/-C-MC-L/1910307'

// New actual client bytes are paired with the independently retained old job
// dataset solely to test protocol admission and retained mapping guards. This
// synthetic pairing is never evidence of today's vacancy counts.
function replay(change=(body)=>body){
 const calls=[],seen=new Map()
 const read=async(url,options={})=>{
  const method=options.method??'GET',key=method+' '+url,count=(seen.get(key)??0)+1;seen.set(key,count);calls.push({url,method,body:options.body})
  const rows=deployment.responses.filter(row=>row.requestedUrl===url&&row.method===method)
  const prior=legacy.responses.filter(row=>row.requestedUrl===url&&row.method===method)
  const row=(rows.length?rows:prior)[Math.min(count-1,(rows.length?rows:prior).length-1)]
  assert.ok(row,'Uncaptured test route '+key);assert.equal(options.body??null,row.requestBody)
  return change(rows.length?row.body:legacy.entities[row.sha256],url,count,options)
 }
 return{calls,run:()=>collectLandmarkPeopleStrong({read,delegation:{otherScopes:[origin+'/home']},now:legacy.capturedAt})}
}
const mutateJSON=(body,change)=>{const payload=JSON.parse(body);change(payload);return JSON.stringify(payload)}

test('November19 declared client retains23complete legacy India records and all existing scope holds',async()=>{
 const io=replay(),result=await io.run()
 assert.equal(result.jobs.length,23);assert.equal(result.rawCount,45);assert.equal(result.complete,false)
 assert.equal(result.report.fullNativeDetails,45);assert.equal(result.report.unknownCountryCount,21);assert.equal(result.report.partialDetailIds.length,3)
 assert.equal(result.report.closingMatches,true);assert.equal(result.report.closingClientMatches,true)
 assert.equal(result.report.cleanupAllowed,false);assert.equal(result.report.verifiedZeroInventory,false)
 assert.equal(result.report.nativeClient.main,'main-OBU6H7ZJ.js')
 for(const job of result.jobs){assert.equal(job.country,'India');assert.equal(job.nativeRequisitionStatus,'OPEN');assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.applyUrl,origin+'/job/detail/'+job.jobId.replaceAll('/','_').replaceAll('&','@'))}
})

test('current fixture stores complete public scripts with verified original hashes',()=>{
 assert.equal(deployment.responses.length,10)
 for(const row of deployment.responses)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
})

for(const[name,url]of[['main',MAIN],['service',SERVICE],['detail',DETAIL]])test('new tuple rejects altered '+name+' before any native job query',async()=>{
 const io=replay((body,current)=>current===url?body+';void 0':body)
 await assert.rejects(io.run(),/protocol|profile|client|deployment/)
 assert.equal(io.calls.some(call=>call.url===LIST),false)
})

test('new tuple rejects altered page size despite all endpoint markers remaining present',async()=>{
 const io=replay((body,url)=>url===SERVICE?body.replace('ay=45,','ay=46,'):body)
 await assert.rejects(io.run(),/protocol|profile|deployment/);assert.equal(io.calls.some(call=>call.url===LIST),false)
})

test('appending a legacy marker cannot bypass new whole-program admission',async()=>{
 const io=replay((body,url)=>url===SERVICE?body+';/*this.offset=0,this.limit=45*/':body)
 await assert.rejects(io.run(),/protocol|profile|deployment/);assert.equal(io.calls.some(call=>call.url===LIST),false)
})

test('new deployment rejects a prior detail bundle swapped into the new declaration',async()=>{
 const previous=legacy.entities[legacy.responses.find(row=>row.requestedUrl===origin+'/chunk-MP77JDEN.js').sha256]
 const io=replay((body,url)=>url===DETAIL?previous:body)
 await assert.rejects(io.run(),/protocol|profile|deployment/);assert.equal(io.calls.some(call=>call.url===LIST),false)
})

for(const[name,change]of[
 ['inert',body=>body.replace(/<script\b[^>]*src="main-OBU6H7ZJ\.js"[^>]*><\/script>/,'<template>$&</template>')],
 ['duplicate',body=>body.replace('</body>','<script src="main-OBU6H7ZJ.js" type="module"></script></body>')],
 ['non-JavaScript',body=>body.replace('src="main-OBU6H7ZJ.js" type="module"','src="main-OBU6H7ZJ.js" type="application/json"')],
 ['nomodule',body=>body.replace('src="main-OBU6H7ZJ.js"','nomodule src="main-OBU6H7ZJ.js"')],
 ['event handler',body=>body.replace('src="main-OBU6H7ZJ.js"','onload="foreignProgram()" src="main-OBU6H7ZJ.js"')],
])test('new deployment rejects '+name+' main activation',async()=>{
 const io=replay((body,url)=>url===origin+'/home'?change(body):body)
 await assert.rejects(io.run(),/main|declaration|client|protocol|profile/);assert.equal(io.calls.some(call=>call.url===LIST),false)
})

test('current client never bypasses delegated employer identity',async()=>{
 const io=replay((body,url)=>url===base+'urlinfo'?mutateJSON(body,p=>{p.response.url='other.peoplestrong.com'}):body)
 await assert.rejects(io.run(),/employer identity/);assert.equal(io.calls.some(call=>call.url===LIST),false)
})

test('current client retains role-bound country conflicts',async()=>{
 const io=replay((body,url)=>url===buildPeopleStrongOrgUrl(SAMPLE)?mutateJSON(body,p=>{p.response.workSiteHierarchy.push({orgUnitType:'Country',orgUnitName:'Pakistan'})}):body)
 const result=await io.run();assert.equal(result.jobs.length,22);assert.equal(result.jobs.some(row=>row.jobId===SAMPLE),false);assert.equal(result.report.unknownCountryCount,22)
 assert.ok(result.report.roles.find(row=>row.jobId===SAMPLE).nativeWorksiteHierarchy.some(row=>row.orgUnitName==='Pakistan'))
 assert.equal(result.complete,false);assert.equal(result.report.cleanupAllowed,false)
})

test('current client excludes a full-criteria rendering conflict and retains authored content',async()=>{
 const io=replay((body,url)=>url===buildPeopleStrongDetailUrl(SAMPLE)?mutateJSON(body,p=>{p.response.jobDescription+='<style>.required{display:none}</style><p class="required">Mandatory clearance</p>'}):body)
 const result=await io.run();assert.equal(result.jobs.length,22);assert.equal(result.jobs.some(row=>row.jobId===SAMPLE),false)
 assert.ok(result.report.partialDetailIds.includes(SAMPLE))
 assert.match(result.report.roles.find(row=>row.jobId===SAMPLE).nativePublicFields.jobDescription,/Mandatory clearance/)
 assert.equal(result.complete,false);assert.equal(result.report.cleanupAllowed,false)
})

test('changed new client at closing rejects opening-only records',async()=>{
 const io=replay((body,url,count)=>url===MAIN&&count===2?body+';void 0':body)
 await assert.rejects(io.run(),/protocol|profile|client|deployment|closing/)
})

test('changed native child inventory at closing rejects opening-only records',async()=>{
 const io=replay((body,url,count)=>url===LIST&&count===2?mutateJSON(body,p=>{p.response[0].jobTitle+=' closing drift'}):body)
 await assert.rejects(io.run(),/closing.*inventory|closing.*changed/i)
})
