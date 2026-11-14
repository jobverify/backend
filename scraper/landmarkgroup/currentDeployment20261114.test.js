import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {buildPeopleStrongDetailUrl,buildPeopleStrongOrgUrl} from './peopleStrongNative.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261114/current-native.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='landmarkgroup')
const origin='https://careers-landmarkgroupindia.peoplestrong.com',base=origin+'/api/cp/rest/altone/cp/'
const MAIN=origin+'/main-C3ULYLPR.js',SERVICE=origin+'/chunk-IFMVPRQ7.js',DETAIL=origin+'/chunk-MP77JDEN.js'
const SAMPLE='LAMG/-C-MC-L/1910307',LIST=base+'jobs/v1?offset=0&limit=45'
const run=options=>createCatalogScraper(provider).run(options)
function replay(change=page=>page){
 const calls=[],seen=new Map()
 return {calls,options:{now:()=>fixture.capturedAt,fetchPage:async(url,options={})=>{
  const method=options.method??'GET',key=method+' '+url,count=(seen.get(key)??0)+1
  seen.set(key,count);calls.push({url,method,body:options.body})
  const rows=fixture.responses.filter(row=>row.requestedUrl===url&&row.method===method)
  assert.ok(rows.length,'Uncaptured native route '+key)
  const row=rows[Math.min(count-1,rows.length-1)]
  assert.equal(options.body??null,row.requestBody)
  // Offline closing controls reuse captured corporate/Oracle/program bytes.
  // Separate live evidence fetches current opening and closing responses.
  return change({status:row.status,url:row.url,body:fixture.entities[row.sha256]},url,count,options)
 }}}
}
const mutateJSON=(page,change)=>{const value=JSON.parse(page.body);change(value);return {...page,body:JSON.stringify(value)}}

test('actual current Oracle and PeopleStrong response bytes retain their original hashes',()=>{
 for(const [sha,body]of Object.entries(fixture.entities))assert.equal(createHash('sha256').update(body).digest('hex'),sha)
 const service=fixture.entities[fixture.responses.find(r=>r.requestedUrl===SERVICE).sha256]
 assert.ok(service.includes('bG=[15,30,45],ay=45,'))
 assert.ok(service.includes('this.offset=0,this.limit=ay,this.totalRecords=-1'))
 assert.equal(service.includes('this.offset=0,this.limit=45'),false)
})

test('registered current deployment returns only23complete India roles with every child/count hold visible',async()=>{
 const io=replay(),jobs=await run(io.options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,23)
 assert.equal(audit.source,'landmarkgroup');assert.equal(audit.oracle.observedCount,642);assert.equal(audit.oracle.reportedTotal,643)
 assert.equal(audit.oracle.countMatches,false);assert.equal(audit.oracle.complete,false);assert.equal(audit.oracle.indiaListed,0)
 assert.equal(audit.otherScopeReport.reportedTotal,45);assert.equal(audit.otherScopeReport.observedCount,45)
 assert.equal(audit.otherScopeReport.fullNativeDetails,45);assert.equal(audit.otherScopeReport.unknownCountryCount,21)
 assert.equal(audit.otherScopeReport.partialDetailIds.length,3);assert.equal(audit.otherScopeReport.closingMatches,true)
 assert.equal(audit.observedRecordCount,687);assert.equal(audit.observedVacancyCount,687)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 for(const job of jobs){
  assert.equal(job.country,'India');assert.equal(job.sourceCountryEvidence.inference,true)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.nativeRequisitionStatus,'OPEN');assert.equal(job.nativeCountryCompanyTotal,undefined)
  const native=JSON.parse(fixture.entities[fixture.responses.find(r=>r.requestedUrl===buildPeopleStrongDetailUrl(job.jobId)).sha256]).response
  assert.deepEqual(job.nativePublicFields.jobDescription,native.jobDescription)
  for(const field of['qualifications','certifications','languages'])assert.deepEqual(job.nativePublicFields[field],native[field]??[])
  assert.deepEqual(job.nativeSkills,native.skills??[])
  assert.ok(job.sourceDescription.length>100)
 }
 assert.ok(jobs.some(row=>row.jobId===SAMPLE))
 assert.equal(jobs.some(row=>row.jobId==='LAMG/SAM/1890919'),false)
})

for(const [name,url]of[['main',MAIN],['service',SERVICE],['detail renderer',DETAIL]])test('factored pagination requires exact whole '+name+' program bytes',async()=>{
 const io=replay((page,current)=>current===url?{...page,body:page.body+';void 0'}:page)
 await assert.rejects(run(io.options),/protocol|profile|client|deployment/)
 assert.equal(io.calls.some(row=>row.url===LIST),false)
})

for(const [name,change]of[
 ['inert',body=>body.replace(/<script\b[^>]*src="main-C3ULYLPR\.js"[^>]*><\/script>/,'<template>$&</template>')],
 ['duplicate',body=>body.replace('</body>','<script src="main-C3ULYLPR.js" type="module"></script></body>')],
 ['non-JavaScript',body=>body.replace('src="main-C3ULYLPR.js" type="module"','src="main-C3ULYLPR.js" type="application/json"')],
 ['nomodule',body=>body.replace('src="main-C3ULYLPR.js"','nomodule src="main-C3ULYLPR.js"')],
 ['event handler',body=>body.replace('src="main-C3ULYLPR.js"','onload="foreignProgram()" src="main-C3ULYLPR.js"')],
])test('current child declaration rejects '+name+' activation',async()=>{
 const io=replay((page,url)=>url===origin+'/home'?{...page,body:change(page.body)}:page)
 await assert.rejects(run(io.options),/main|declaration|client|protocol|profile/)
 assert.equal(io.calls.some(row=>row.url===LIST),false)
})

test('known-looking endpoint markers never admit a changed default page size',async()=>{
 const io=replay((page,url)=>url===SERVICE?{...page,body:page.body.replace('bG=[15,30,45],ay=45,','bG=[15,30,45],ay=46,')}:page)
 await assert.rejects(run(io.options),/protocol|profile|deployment/)
})

test('a legacy page-size marker cannot bypass the exact current deployment tuple',async()=>{
 const io=replay((page,url)=>url===SERVICE?{...page,body:page.body+';/*this.offset=0,this.limit=45*/'}:page)
 await assert.rejects(run(io.options),/protocol|profile|deployment/)
 assert.equal(io.calls.some(row=>row.url===LIST),false)
})

test('a current child employer mismatch remains a failed source and never disappears from the union',async()=>{
 const io=replay((page,url)=>url===base+'urlinfo'?mutateJSON(page,v=>{v.response.url='other.peoplestrong.com'}):page)
 await assert.rejects(run(io.options),/employer identity/)
})

test('contradictory role-bound country keeps the raw hierarchy and excludes only that India candidate',async()=>{
 const io=replay((page,url)=>url===buildPeopleStrongOrgUrl(SAMPLE)?mutateJSON(page,v=>{v.response.workSiteHierarchy.push({orgUnitType:'Country',orgUnitName:'Pakistan'})}):page)
 const jobs=await run(io.options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,22);assert.equal(jobs.some(j=>j.jobId===SAMPLE),false)
 assert.equal(audit.otherScopeReport.unknownCountryCount,22)
 assert.ok(audit.otherScopeReport.roles.find(r=>r.jobId===SAMPLE).nativeWorksiteHierarchy.some(r=>r.orgUnitName==='Pakistan'))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('unhandled full public criteria stay excluded with raw authored criteria retained',async()=>{
 const io=replay((page,url)=>url===buildPeopleStrongDetailUrl(SAMPLE)?mutateJSON(page,v=>{v.response.jobDescription+='<style>.hidden{display&#58;none}</style><p class="hidden">Mandatory hidden clearance</p>'}):page)
 const jobs=await run(io.options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,22);assert.equal(jobs.some(j=>j.jobId===SAMPLE),false)
 assert.ok(audit.otherScopeReport.partialDetailIds.includes(SAMPLE))
 assert.match(audit.otherScopeReport.roles.find(r=>r.jobId===SAMPLE).nativePublicFields.jobDescription,/Mandatory hidden clearance/)
})

test('changed native child closing identity rejects opening-only roles',async()=>{
 const io=replay((page,url,count)=>url===LIST&&count===2?mutateJSON(page,v=>{v.response[0].jobTitle+=' changed at closing'}):page)
 await assert.rejects(run(io.options),/closing.*inventory|closing.*changed/i)
})

test('changed child client at closing rejects opening-only roles',async()=>{
 const io=replay((page,url,count)=>url===MAIN&&count===2?{...page,body:page.body+';void 0'}:page)
 await assert.rejects(run(io.options),/closing|protocol|profile|deployment/)
})

test('a nonempty terminal child page cannot certify the child inventory',async()=>{
 const io=replay((page,url)=>url===base+'jobs/v1?offset=45&limit=45'?mutateJSON(page,v=>{v.response=[{jobCode:'NATIVE-EXTRA'}]}):page)
 await assert.rejects(run(io.options),/terminal/)
})

test('an empty or sampled result retains observations and never certifies company India absence',async()=>{
 const io=replay(),jobs=await run({...io.options,maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,687)
 assert.equal(jobs.nativeCollectionEvidence.limited,true);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('cancellation before I/O preserves the original caller reason',async()=>{
 const controller=new AbortController(),reason=Symbol('caller');controller.abort(reason)
 const io=replay();await assert.rejects(run({...io.options,signal:controller.signal}),error=>error===reason)
 assert.equal(io.calls.length,0)
})

test('cancellation during the child detail prevents later requests and preserves the exact reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'opaque'})
 const io=replay((page,url)=>{if(url===buildPeopleStrongDetailUrl(SAMPLE))controller.abort(reason);return page})
 await assert.rejects(run({...io.options,signal:controller.signal}),error=>error===reason)
 assert.equal(io.calls.at(-1).url,buildPeopleStrongDetailUrl(SAMPLE))
})
