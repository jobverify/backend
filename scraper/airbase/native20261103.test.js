import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readBoard} from './native.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseBoundedProgram} from '../../scraper-support/utils/remoteScriptData.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-paylocity-20261103.json.gz',import.meta.url))))
const nativeBoard='https://2000recruiting.paylocity.com/recruiting/jobs/All/e2bcef5a-b6e5-4c5a-8fdd-c4da179dd98c/Paylocity'
async function exercise(t,{change=()=>{},beforeRead=()=>{},options={}}={}){
 const fixture=structuredClone(capture);change(fixture)
 const calls=[]
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  init.signal?.throwIfAborted();calls.push({url,init});beforeRead(fixture,url,calls);const packet=fixture.responses[url];assert.ok(packet,'Unexpected public Airbase URL: '+url)
  const response=new Response(packet.html,{status:packet.status,headers:{'content-type':packet.contentType,...(packet.location?{location:packet.location}:{})}})
  Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 })
 const provider=getScraperCatalog().find(row=>row.source==='airbase')
 const jobs=await createCatalogScraper(provider).run(options)
 return{jobs,calls,fixture}
}
test('current Airbase corporate handoff recovers4 employer-branded India roles through its exact public parent tenant',async t=>{
 const{jobs}=await exercise(t)
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),['41843','46127','48032','48705'])
 assert.ok(jobs.every(j=>j.company==='Airbase by Paylocity'&&j.country==='India'&&j.sourceDetailComplete===true))
 assert.ok(jobs.every(j=>j.sourceDescription.length>2000&&j.sourceNativeApplicationQuestions.length>0))
 assert.equal(analyzePublishableJobs(jobs,{now:'2026-11-03T00:00:00Z'}).eligibleJobs.length,2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(jobs[0].sourceNativeInventory.parentBoardObservedCount,231)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
})
test('Airbase retains native PublishedDate and exact own-country facts instead of edit time or headquarters',async t=>{
 const{jobs}=await exercise(t),job=jobs.find(j=>j.jobId==='48705')
 assert.equal(job.postingDate,'2026-10-16T06:33:46.000Z')
 assert.equal(job.sourceNativePublishedDate,'2026-10-16T01:33:46-05:00')
 assert.equal(job.sourceNativeApplicationJob.jobLocation.country,'IND')
 assert.notEqual(job.postingDate,job.sourceNativeApplicationJob.lastChangedUtc)
 assert.equal(job.sourceNativeApplicationJob.companyName,'PAYLOCITY CORPORATION')
})
test('Airbase caps only after full native listing and every own detail/application closing comparison',async t=>{
 const{jobs,calls}=await exercise(t,{options:{maxJobs:1}})
 assert.equal(jobs.length,1)
 assert.equal(calls.filter(c=>c.url===nativeBoard).length,3)
 assert.equal(calls.filter(c=>/\/(Details|Apply)\/\d+$/.test(c.url)).length,16)
})
for(const[label,change]of[
 ['foreign parent handoff',f=>{f.responses['https://www.airbase.com/careers'].location='https://other.example/jobs'}],
 ['wrong own tenant',f=>{for(const r of Object.values(f.responses))if(r.url.includes('/Apply/48705'))r.html=r.html.replace('"moduleNumber":"2000"','"moduleNumber":"3000"')}],
 ['conflicting own country',f=>{for(const r of Object.values(f.responses))if(r.url.includes('/Apply/48705'))r.html=r.html.replace('"country":"IND"','"country":"SGP"')}],
 ['wrong own role',f=>{for(const r of Object.values(f.responses))if(r.url.includes('/Apply/48705'))r.html=r.html.replaceAll('"jobId":48705','"jobId":99999')}],
 ['foreign own application URL',f=>{for(const r of Object.values(f.responses))if(r.url.includes('/Apply/48705'))r.html=r.html.replace('https://2000recruiting.paylocity.com/recruiting/jobs/Apply/48705/Paylocity/Manager-Engineering','https://other.example/recruiting/jobs/Apply/48705/Paylocity/Manager-Engineering')}],
 ['missing actual detail initializer',f=>{for(const r of Object.values(f.responses))if(r.url.includes('/Details/48705'))r.html=r.html.replace("document.getElementById('applicant-tracking').style.display = 'block'","document.getElementById('applicant-tracking').style.display = 'none'")}],
])test('Airbase rejects '+label,async t=>{await assert.rejects(exercise(t,{change}),/Current native contract/)})
test('Airbase cancellation precedes all public handoff and native requests',async t=>{
 let calls=0;const reason=new Error('stop Airbase');t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Unexpected request')})
 const provider=getScraperCatalog().find(row=>row.source==='airbase')
 await assert.rejects(createCatalogScraper(provider).run({signal:AbortSignal.abort(reason)}),e=>e===reason)
 assert.equal(calls,0)
})

test('Airbase retains original inventory while quarantining changed closing application criteria',async t=>{
 const{jobs}=await exercise(t,{beforeRead:(f,url,calls)=>{
  if(url.endsWith('/Apply/48705')&&calls.filter(c=>c.url===url).length===2)f.responses[url].html=f.responses[url].html.replace('Have you previously interviewed with Paylocity or Airbase?','Do you hold a newly required professional certification?')
 }})
 assert.equal(jobs.length,3)
 assert.ok(jobs.every(j=>j.jobId!=='48705'))
 assert.equal(jobs[0].sourceNativeInventory.originalParentBoard.Jobs.length,231)
 assert.ok(jobs[0].sourceNativeInventory.failures.some(f=>f.jobId===48705&&f.stage==='closing-native-criteria'))
})

test('Airbase preserves cancellation during a noncooperative injected public read',async()=>{
 const {createAirbaseNativeScraper}=await import('./native.js'),controller=new AbortController(),reason=Error('cancel pending public read')
 const timer=setTimeout(()=>controller.abort(reason),10)
 try{await assert.rejects(createAirbaseNativeScraper().run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})}),e=>e===reason)}finally{clearTimeout(timer)}
})

test('Airbase holds only the role removed after all closing public detail and question reads',async t=>{
 const{jobs}=await exercise(t,{beforeRead:(fixture,url,calls)=>{
  if(url!==nativeBoard||calls.filter(c=>c.url===nativeBoard).length!==3||calls.filter(c=>/\/(Details|Apply)\/\d+$/.test(c.url)).length!==16)return
  const packet=fixture.responses[url],model=readBoard(packet.html)
  model.Jobs=model.Jobs.filter(row=>row.JobId!==48705)
  const script=readNativeDocument(packet.html).nodes(n=>n.tag==='script'&&(n.raw||'').includes('window.pageData'))[0]
  const assignment=parseBoundedProgram(script.raw).body.find(s=>s.type==='ExpressionStatement'&&s.expression.left?.property?.name==='pageData').expression.right
  packet.html=packet.html.replace(script.raw,script.raw.slice(0,assignment.start)+JSON.stringify(model)+script.raw.slice(assignment.end))
 }})
 assert.equal(jobs.length,3)
 assert.ok(jobs.every(j=>j.jobId!=='48705'))
 assert.equal(jobs[0].sourceNativeInventory.originalParentBoard.Jobs.length,231)
 assert.equal(jobs[0].sourceNativeInventory.finalParentBoard.Jobs.length,230)
 assert.ok(jobs[0].sourceNativeInventory.originalOwnRoleFacts.some(f=>f.row.JobId===48705&&f.description.length>2000))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
