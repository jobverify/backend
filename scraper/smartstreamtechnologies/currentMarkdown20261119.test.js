import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './nativeWorkable20261114.js'
import {run as scriptRun} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-markdown-20261119.json.gz',import.meta.url))))
const replay=(change=()=>{})=>{
 const queues=new Map(),calls=[]
 for(const response of fixture.responses){
  if(!queues.has(response.requestedUrl))queues.set(response.requestedUrl,[])
  queues.get(response.requestedUrl).push(response)
 }
 return {calls,fetchPage:async(url,init)=>{
  const original=queues.get(url)?.shift();assert.ok(original,'Unbound or repeated original URL '+url)
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString('utf8')}
  change(row,url);calls.push({url,phase:row.phase,method:init?.method??'GET'})
  row.bodyBase64=Buffer.from(row.body).toString('base64')
  return row
 }}
}

test('current declared native feeds recover all thirty observed India roles through the catalog entry',async()=>{
 const transport=replay(),jobs=await run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt})
 assert.equal(jobs.length,30);assert.equal(transport.calls.length,130)
 assert.ok(transport.calls.every(row=>row.method==='GET'))
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceClosingReconciled))
 assert.ok(jobs.every(job=>/^\d+$/.test(job.jobId)&&/^[A-F0-9]{10}$/.test(job.requisitionId)))
 assert.ok(jobs.every(job=>job.applyUrl==='https://apply.workable.com/smartstream/j/'+job.requisitionId+'/apply'))
 assert.ok(jobs.every(job=>job.applicationSubmitted===false&&job.backendApplicationActivationVerified===false))
 assert.ok(jobs.some(job=>job.title==='SMSTR106-Analyst'))
 assert.ok(jobs.some(job=>job.title==='SMSTR137 - Solution Developer'))
 assert.ok(jobs.some(job=>job.sourceNativeDetailRecord.salary_to!=null))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.originalResponses.length,130)
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='smartstreamtechnologies'),jobs)
 assert.equal(assessment.runnerOutcome.success,true);assert.equal(assessment.indiaJobs,30)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('both production exports use the current feed collector',async()=>{
 assert.equal((await scriptRun({fetchPage:replay().fetchPage,now:()=>fixture.observedAt})).length,30)
})

test('legitimate vacancy title and criteria changes are accepted when every current native representation agrees',async()=>{
 const transport=replay(row=>{
  row.body=row.body.replaceAll('SMSTR123 - Junior Analyst','SMSTR123 - Graduate Analyst')
  if(row.body.includes('A61CB80590')&&row.url.includes('/api/v2/')){
   const detail=JSON.parse(row.body);detail.description+='<p>Additional current authored selection criterion.</p>';row.body=JSON.stringify(detail)
  }
  if(row.url.endsWith('/jobs/view/A61CB80590.md'))
   row.body=row.body.replace('\n## Requirements\n','\nAdditional current authored selection criterion.\n\n## Requirements\n')
 })
 const jobs=await run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt})
 const current=jobs.find(job=>job.requisitionId==='A61CB80590')
 assert.equal(current.title,'SMSTR123 - Graduate Analyst')
 assert.match(current.jobDescription,/Additional current authored selection criterion/)
})

for(const [name,change,reason] of [
 ['another account',record=>{record.accountUid='another-employer'},/employer|account/i],
 ['foreign secondary location',record=>{record.locations[0].country='Canada';record.locations[0].countryCode='CA'},/country|India/i],
 ['unpublished role',record=>{record.state='draft'},/published|publication/i],
 ['internal role',record=>{record.isInternal=true},/internal|publication/i],
 ['future native publication',record=>{record.published='2099-01-01T00:00:00.000Z'},/date|future/i],
 ['explicit closure',record=>{record.description+='<p>This position has been closed.</p>'},/closed/i],
 ['contradictory employment type',record=>{record.type='part'},/type/i],
 ['contradictory department',record=>{record.department=['Another Department']},/department/i],
]){
 test('current feed retains and holds '+name+' without discarding other valid roles',async()=>{
  const transport=replay((row,url)=>{
   if(url.endsWith('/api/v2/accounts/smartstream/jobs/A61CB80590')){
    const record=JSON.parse(row.body);change(record);row.body=JSON.stringify(record)
   }
  })
  const jobs=await run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt})
  assert.equal(jobs.length,29);assert.equal(jobs.some(job=>job.requisitionId==='A61CB80590'),false)
  const held=jobs.nativeCollectionEvidence.heldNativeRows.find(row=>row.shortcode==='A61CB80590')
  assert.match(held.reason,reason);assert.ok(held.openingRecord);assert.ok(held.closingRecord)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 })
}

test('contradictory declared workplace metadata is held',async()=>{
 const transport=replay((row,url)=>{if(url.endsWith('/jobs/view/A61CB80590.md'))row.body=row.body.replace('**Workplace:** on_site','**Workplace:** remote')})
 const jobs=await run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt})
 assert.equal(jobs.length,29)
 assert.match(jobs.nativeCollectionEvidence.heldNativeRows.find(row=>row.shortcode==='A61CB80590').reason,/workplace/i)
})

test('whole unknown native properties are retained and reconciled at closing',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/api/v2/accounts/smartstream/jobs/A61CB80590')){
   const detail=JSON.parse(row.body);detail.additional_native_criteria={qualification:row.phase==='closing'?'changed':'original'}
   row.body=JSON.stringify(detail)
  }
 })
 const jobs=await run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt})
 assert.equal(jobs.length,29)
 const held=jobs.nativeCollectionEvidence.heldNativeRows.find(row=>row.shortcode==='A61CB80590')
 assert.match(held.reason,/closing|changed/i)
 assert.equal(held.openingRecord.detail.additional_native_criteria.qualification,'original')
 assert.equal(held.closingRecord.detail.additional_native_criteria.qualification,'changed')
})

test('contradictory full native Markdown and API criteria are held',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/api/v2/accounts/smartstream/jobs/A61CB80590')){
   const detail=JSON.parse(row.body);detail.description+='<p>Additional mandatory in-office work in Canada.</p>';row.body=JSON.stringify(detail)
  }
 })
 const jobs=await run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt})
 assert.equal(jobs.length,29)
 assert.match(jobs.nativeCollectionEvidence.heldNativeRows.find(row=>row.shortcode==='A61CB80590').reason,/criteria.*disagree/i)
})

test('duplicate original native integer identities cannot publish two different roles',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/api/v2/accounts/smartstream/jobs/C46D1BFE0E')){
   const detail=JSON.parse(row.body)
   const first=fixture.responses.find(response=>response.url.endsWith('/api/v2/accounts/smartstream/jobs/A61CB80590'))
   detail.id=JSON.parse(Buffer.from(first.bodyBase64,'base64')).id;row.body=JSON.stringify(detail)
  }
 })
 await assert.rejects(run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt}),/duplicate.*identity/i)
})

test('an application URL for another role is held with both original native models',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/jobs/view/A61CB80590.md'))row.body=row.body.replace('/j/A61CB80590/apply','/j/AAAAAAAAAA/apply')
 })
 const jobs=await run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt})
 assert.equal(jobs.length,29)
 assert.match(jobs.nativeCollectionEvidence.heldNativeRows.find(row=>row.shortcode==='A61CB80590').reason,/application/i)
})

for(const [name,change] of [
 ['unavailable closing feed',row=>{if(row.phase==='closing'&&row.url.includes('jobs.md?'))row.status=503}],
 ['undeclared feed',row=>{if(row.url==='https://apply.workable.com/smartstream/')row.body=row.body.replaceAll('llms.txt','unrelated.txt')}],
 ['body-only response',row=>{row.bodyUnavailable=true}],
 ['missing original redirect metadata',row=>{delete row.redirected}],
 ['wrong original MIME',row=>{if(row.url.includes('jobs.md?'))row.headers['content-type']='text/html'}],
 ['foreign final URL',row=>{row.url='https://example.org/'}],
 ['duplicate native JSON key',row=>{if(row.url.endsWith('/api/v2/accounts/smartstream/jobs/A61CB80590'))row.body=row.body.replace('{','{"state":"published",')}],
])test('current feed cannot report recovery from '+name,async()=>{
 const transport=replay(change)
 await assert.rejects(run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt}))
})

test('valid published jobs with incomplete API criteria retain explicit partial status under current policy',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/api/v2/accounts/smartstream/jobs/A61CB80590')){
   const detail=JSON.parse(row.body);detail.description='';detail.requirements='';detail.benefits='';row.body=JSON.stringify(detail)
  }
 })
 const jobs=await run({fetchPage:transport.fetchPage,now:()=>fixture.observedAt})
 assert.equal(jobs.length,30)
 assert.equal(jobs.find(job=>job.requisitionId==='A61CB80590').sourceDetailComplete,false)
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='smartstreamtechnologies'),jobs)
 assert.equal(assessment.indiaJobs,30)
})

test('opaque caller cancellation is preserved while an original read never resolves',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancelled:'caller'})
 const promise=run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})})
 setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(promise,error=>error===reason)
})
