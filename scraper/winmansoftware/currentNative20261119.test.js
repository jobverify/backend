import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test,{mock} from 'node:test'
import {run} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const replay=(change=()=>{})=>{
 const queues=new Map(),calls=[]
 for(const [index,row]of fixture.responses.entries()){if(!queues.has(row.requestedUrl))queues.set(row.requestedUrl,[]);queues.get(row.requestedUrl).push({...row,index})}
 return{calls,fetchImpl:async(url,init)=>{
  const original=queues.get(url)?.shift();assert.ok(original,'Uncaptured native read '+url)
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString('utf8')};change(row,url)
  calls.push({url,method:init.method??'GET',phase:row.phase})
  return Object.defineProperties(new Response(row.body,{status:row.status,headers:row.headers}),{url:{value:row.url},redirected:{value:row.redirected}})
 }}
}

test('normal current source qualifies14 whole native Mangalore workplaces and preserves4 partial criteria alternatives',async()=>{
 const io=replay(),network=mock.method(globalThis,'fetch',()=>{throw Error('Uncaptured network')})
 try{
  const jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0})
  assert.equal(jobs.length,14);assert.ok(jobs.every(job=>job.country==='India'&&job.city==='Mangalore'&&job.state==='Karnataka'))
  assert.ok(jobs.every(job=>job.sourceClosingReconciled&&job.sourceNativeOpeningRoleHTML&&job.sourceNativeClosingRoleHTML))
  assert.equal(jobs.filter(job=>job.fullCriteriaRecovered===true).length,10)
  assert.equal(jobs.filter(job=>job.fullCriteriaRecovered===false).length,4)
  assert.ok(jobs.filter(job=>!job.fullCriteriaRecovered).every(job=>job.sourceNativeStructuredModels.length===1&&job.sourceCriteriaAlternativesUnreconciled))
  assert.ok(jobs.every(job=>job.sourceNativeApplication.authoredRoleHandoffQualified&&job.sourceNativeApplication.rolePreselected===false&&job.backendApplicationActivationVerified===false))
  assert.ok(jobs.every(job=>job.requisitionId===null&&job.postingDate===null))
  assert.equal(jobs.nativeCollectionEvidence.nativeObservedRecords,22);assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,8)
  assert.equal(io.calls.length,66);assert.ok(io.calls.every(call=>call.method==='GET'))
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  const assessment=assessSoftFailureAcquisition({source:'winmansoftware'},jobs)
  assert.equal(assessment.runnerOutcome.success,true);assert.equal(assessment.indiaJobs,14);assert.equal(assessment.cleanupOptions.replaceExisting,false)
 }finally{network.mock.restore()}
})

const target='https://www.winmansoftware.com/more/careers/product-software-programmer/'
const partial='https://www.winmansoftware.com/more/careers/software-engineer/'
const changed=async change=>run({fetchImpl:replay(change).fetchImpl,requestIntervalMs:0})
const heldRole=(jobs,url=target)=>{assert.equal(jobs.length,13);assert.ok(!jobs.some(job=>job.sourceUrl===url));assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,9)}

test('a whole Mangalore location alternative containing United States stays held',async()=>{
 const jobs=await changed((row,url)=>{if(url===target)row.body=row.body.replace(/(JobDescription-location\.png[^>]+>[\s\S]*?)Mangalore/, '$1Mangalore / United States')})
 heldRole(jobs)
})

test('footer city and applicant city dropdowns cannot replace missing own role workplace',async()=>{
 const jobs=await changed((row,url)=>{if(url===target)row.body=row.body.replace('JobDescription-location.png','unbound-location.png')})
 heldRole(jobs)
})

test('own role employer header cannot be replaced by a foreign employer',async()=>{
 const jobs=await changed((row,url)=>{if(url===target)row.body=row.body.replace('Winman Software India LLP','Another Employer')})
 heldRole(jobs)
})

test('authored own role application URL must remain the exact own handoff',async()=>{
 const jobs=await changed((row,url)=>{if(url===target)row.body=row.body.replaceAll('https://winman.in/jobs/resume.aspx','https://unrelated.example/apply')})
 heldRole(jobs)
})

test('a different native structured work country overrides the visible city match',async()=>{
 const jobs=await changed((row,url)=>{if(url===partial)row.body=row.body.replace('"addressCountry": "India"','"addressCountry": "United States"')})
 heldRole(jobs,partial)
})

test('a different structured publisher cannot become a partial criteria case',async()=>{
 const jobs=await changed((row,url)=>{if(url===partial)row.body=row.body.replace('"name": "Winman Software India LLP"','"name": "Another Employer"')})
 heldRole(jobs,partial)
})

test('decoded duplicate structured country keys are rejected',async()=>{
 const jobs=await changed((row,url)=>{if(url===partial)row.body=row.body.replace('"addressCountry": "India"','"addressCountry": "India", "address\\u0043ountry": "United States"')})
 heldRole(jobs,partial)
})

test('a legitimate added visible requirement is retained without a frozen title or criteria list',async()=>{
 const jobs=await changed((row,url)=>{if(url===target)row.body=row.body.replace('Job Summary</h2>','Job Summary</h2><p>Additional current native requirement.</p>')})
 assert.equal(jobs.length,14);assert.match(jobs.find(job=>job.sourceUrl===target).jobDescription,/Additional current native requirement/)
})

test('missing criteria labels keep the valid native own role explicitly partial',async()=>{
 const jobs=await changed((row,url)=>{if(url===target)row.body=row.body.replace('Minimum Marks Throughout','Current Unqualified Requirements')})
 assert.equal(jobs.length,14);const job=jobs.find(job=>job.sourceUrl===target);assert.equal(job.fullCriteriaRecovered,false);assert.equal(job.sourceDetailComplete,false)
 assert.match(job.sourceNativeOpeningRoleHTML,/Current Unqualified Requirements/)
})

test('changed whole closing role criteria hold the affected role',async()=>{
 const jobs=await changed((row,url)=>{if(url===target&&row.phase==='closing-role-declared-location')row.body=row.body.replace('Job Summary</h2>','Job Summary</h2><p>Changed at closing.</p>')})
 heldRole(jobs)
})

for(const [name,addition]of [['closed role','<p>This role is now closed.</p>'],['client role','<p>Our client is hiring.</p>'],['explicit foreign work country','<p>Work country: United States</p>']]){
 test(name+' cannot inherit reviewed Mangalore geography',async()=>{
  const jobs=await changed((row,url)=>{if(url===target)row.body=row.body.replace('</h1>','</h1>'+addition)})
  heldRole(jobs)
 })
}

test('an expired native structured role stays held',async()=>{
 const jobs=await changed((row,url)=>{if(url===partial)row.body=row.body.replace('"@type": "JobPosting",','"@type": "JobPosting", "validThrough": "2020-01-01",')})
 heldRole(jobs,partial)
})

test('a changed public application control cannot hide behind opaque request-state exclusions',async()=>{
 await assert.rejects(changed(row=>{if(row.phase==='closing-application')row.body=row.body.replace('id="hfjobprofile"','id="hfjobprofileChanged"')}),/public application form\/control/)
})

test('a changed declared own application program requires review',async()=>{
 await assert.rejects(changed(row=>{if(row.phase==='opening-application-program')row.body+='\n// Unreviewed program change'}),/reviewed own application program changed/)
})

test('an unbound role redirect cannot trigger a foreign fetch',async()=>{
 const io=replay((row,url)=>{if(url===target.slice(0,-1))row.headers.location='https://unrelated.example/role'})
 const jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0});heldRole(jobs);assert.ok(!io.calls.some(call=>call.url.startsWith('https://unrelated.example/')))
})

test('caller opaque abort bounds an uncooperative original fetch',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'opaque Winman abort'});let entered
 const started=new Promise(resolve=>{entered=resolve}),pending=run({signal:controller.signal,fetchImpl:()=>{entered();return new Promise(()=>{})},requestIntervalMs:0})
 await started;controller.abort(reason);await assert.rejects(pending,error=>error===reason)
})
