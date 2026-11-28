import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {run,KEKA_INFO_URL,KEKA_JOBS_URL} from './script.js'

const program=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261128.json.gz',import.meta.url))))
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-country-hold-20261128.json.gz',import.meta.url))))
const native=JSON.parse(fixture.responses.find(row=>row.requestedUrl===KEKA_JOBS_URL).text)
const placeholder=native.find(row=>row.id===148550)
const provider=()=>getScraperCatalog().find(row=>row.source==='amberstudent')
function replay(change=()=>{}){
 const calls=[],visits=new Map()
 // These are two genuine current opening native originals. Repetition at
 // closing is an explicit fixture control, not a captured live closing proof.
 return {calls,visits,options:{requestIntervalMs:0,now:()=> '2026-11-27T23:48:43.554Z',fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');calls.push(url)
  const visit=(visits.get(url)??0)+1;visits.set(url,visit)
  const original=[...program.responses,...fixture.responses].find(row=>row.requestedUrl===url)
  assert.ok(original,'No requests outside genuine current declarations: '+url)
  const packet=structuredClone(original);change(packet,url,visit)
  return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
 }}}
}
const editNative=(edit,other=()=>{})=>replay((packet,url,visit)=>{
 if(url===KEKA_JOBS_URL){const rows=JSON.parse(packet.text);packet.text=JSON.stringify(edit(rows,visit)??rows)}
 other(packet,url,visit)
})
const countries=(row,code,name)=>{row.jobLocations=[{id:16262,name:'Pune',city:'Pune',state:'MH',countryCode:code,countryName:name}]}

test('Amber current original native evidence preserves the complete18-row array and exact NA/unlocated record',()=>{
 assert.equal(fixture.responses.length,2);assert.equal(native.length,18)
 for(const packet of fixture.responses){assert.equal(packet.method,'GET');assert.equal(packet.status,200);assert.equal(packet.bodyOriginalUnmodified,true)
  assert.equal(createHash('sha256').update(packet.text).digest('hex'),packet.sha256)}
 assert.equal(placeholder.title,'Intern- Video Editor');assert.equal(placeholder.description,'<div>NA</div>')
 assert.deepEqual(placeholder.jobLocations,[])
 assert.equal(fixture.responses.find(row=>row.requestedUrl===KEKA_JOBS_URL).sha256,'a8f7f6e027c04776cc7be5d46d44e3b87ce609af9669de6deb26e29c05abf304')
})

test('Amber holds the actual unknown-country NA observation while retaining other full native India criteria',async()=>{
 const r=replay(),jobs=await run(r.options),audit=jobs.nativeCollectionEvidence
 assert.ok(jobs.some(row=>row.jobId==='148527'&&row.title==='Customer Support Intern'))
 assert.ok(jobs.some(row=>row.jobId==='147192'))
 assert.equal(jobs.some(row=>row.jobId==='148550'),false)
 assert.ok(audit.unknownCountryIds.includes('148550'))
 assert.deepEqual(audit.nativeOpeningInventory,native);assert.deepEqual(audit.nativeClosingInventory,native)
 assert.equal(audit.closingFullNativeInventoryMatch,true)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceClosingQualified,true)
  assert.equal(job.sourceRawDescription,native.find(row=>String(row.id)===job.jobId).description)
  assert.deepEqual(job.nativeSourceRecord,job.nativeClosingRecord)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)}
 assert.equal(readSourceObservationEvidence(jobs,'amberstudent').observedRecordCount,18)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(r.visits.get(KEKA_JOBS_URL),2)
})

test('Amber registered assessment excludes every country-unproved row before normalization and retains all18 raw observations',async()=>{
 const r=replay(),jobs=await createCatalogScraper(provider()).run(r.options),assessment=assessSoftFailureAcquisition(provider(),jobs)
 for(const id of['148591','148550','147165','141425','139529'])assert.equal(jobs.some(row=>row.jobId===id),false)
 assert.equal(assessment.indiaJobs,jobs.length)
 assert.equal(assessment.runnerOutcome.rawRecords,18)
 assert.equal(assessment.inventoryEvidence.listingComplete,false)
 assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
 const observation=readSourceObservationEvidence(jobs,'amberstudent')
 assert.equal(observation.sourceScopeComplete,false);assert.equal(observation.companyGlobalTotal,null);assert.equal(observation.companyIndiaTotal,null)
})

test('Amber a sole genuine unlocated NA record cannot become a successful or verified India zero',async()=>{
 const r=editNative(()=>[structuredClone(placeholder)])
 const jobs=await createCatalogScraper(provider()).run(r.options),assessment=assessSoftFailureAcquisition(provider(),jobs)
 assert.equal(jobs.length,0);assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0)
 assert.equal(assessment.runnerOutcome.rawRecords,1);assert.equal(assessment.runnerOutcome.success,false)
 assert.equal(assessment.runnerOutcome.failureKind,'coverage_gap')
 assert.equal(assessment.inventoryEvidence.listingComplete,false);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeOpeningInventory,[placeholder])
 assert.deepEqual(jobs.nativeCollectionEvidence.unknownCountryIds,['148550'])
})

test('Amber city and INR salary cannot supply a country to the held NA record',async()=>{
 const row=structuredClone(placeholder);row.jobLocations=[{id:16262,name:'Pune',city:'Pune',state:'MH'}]
 const r=editNative(()=>[structuredClone(row)]),jobs=await createCatalogScraper(provider()).run(r.options)
 const assessment=assessSoftFailureAcquisition(provider(),jobs)
 assert.equal(jobs.length,0);assert.equal(assessment.indiaJobs,0);assert.equal(assessment.runnerOutcome.success,false)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeOpeningInventory,[row])
 assert.equal(row.salaryRange.currency,'INR');assert.deepEqual(jobs.nativeCollectionEvidence.unknownCountryIds,['148550'])
})

for(const[description,label]of[['<div>NA</div>','NA'],['','empty'],[null,'null']]){
 test('Amber confirmed India role with '+label+' criteria retains the original fatal full-description guard',async()=>{
  const r=editNative(rows=>{const row=rows.find(row=>row.id===148550);countries(row,'IN','India');row.description=description})
  await assert.rejects(run(r.options),/incomplete Keka inventory: invalid job/)
  assert.equal(r.visits.get(KEKA_JOBS_URL),1)
 })
}

test('Amber confirmed foreign country does not bypass the original NA full-description guard',async()=>{
 const r=editNative(rows=>countries(rows.find(row=>row.id===148550),'US','United States'))
 await assert.rejects(run(r.options),/incomplete Keka inventory: invalid job/)
 assert.equal(r.visits.get(KEKA_JOBS_URL),1)
})

test('Amber held unknown-country records still participate in native duplicate identity checks',async()=>{
 const r=editNative(rows=>{rows.push(structuredClone(placeholder))})
 await assert.rejects(run(r.options),/duplicate job ID/)
 assert.equal(r.visits.get(KEKA_JOBS_URL),1)
})

test('Amber missing native identity cannot be quarantined as an unknown-country observation',async()=>{
 const r=editNative(rows=>{delete rows.find(row=>row.id===148550).id})
 await assert.rejects(run(r.options),/incomplete Keka inventory: invalid job/)
})

test('Amber malformed native location containers retain the original structural rejection',async()=>{
 const r=editNative(rows=>{rows.find(row=>row.id===148550).jobLocations=null})
 await assert.rejects(run(r.options),/incomplete Keka inventory: invalid job/)
})

test('Amber a closing criteria change on a held country-unproved record rejects opening positives',async()=>{
 const r=editNative((rows,visit)=>{if(visit===2)rows.find(row=>row.id===148550).description='<div>Changed public criteria</div>'})
 await assert.rejects(run(r.options),/closing full native inventory model changed/)
 assert.equal(r.visits.get(KEKA_JOBS_URL),2);assert.equal(r.visits.get(KEKA_INFO_URL),2)
})

test('Amber removing a held observation during closing cannot preserve opening positives',async()=>{
 const r=editNative((rows,visit)=>visit===2?rows.filter(row=>row.id!==148550):rows)
 await assert.rejects(run(r.options),/closing full native inventory model changed/)
 assert.equal(r.visits.get(KEKA_JOBS_URL),2)
})

test('Amber closing country promotion still requires complete authored criteria before returning any positives',async()=>{
 const r=editNative((rows,visit)=>{if(visit===2)countries(rows.find(row=>row.id===148550),'IN','India')})
 await assert.rejects(run(r.options),/incomplete Keka inventory: invalid job/)
 assert.equal(r.visits.get(KEKA_JOBS_URL),2)
})
