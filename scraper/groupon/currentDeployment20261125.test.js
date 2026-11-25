import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {publisher,profileForPublisher,program,profileModuleURL,loadingContract,PRIMARY,API,CURRENT_20261120_MODULES} from './nativeModels.js'
import {run} from './script.js'
import {GROUPON_CATALOG} from './catalog.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261125/current-graph.json.gz',import.meta.url))))
const prior=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261120/current-graph.json.gz',import.meta.url))))
const graph=new Map(fixture.responses.map(row=>[row.url,row]))
const text=row=>Buffer.from(row.bodyBase64,'base64').toString()
const current=()=>{
 const modules=profileForPublisher(publisher(text(graph.get(PRIMARY)))),programs={}
 for(const key of Object.keys(modules))programs[key]=program(text(graph.get(profileModuleURL(key,modules))),key,modules)
 return{modules,programs,contract:loadingContract(programs)}
}

test('Groupon current seven original declarations retain the exact native read methods and complete role renderer',()=>{
 for(const row of fixture.responses)assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64,'base64')).digest('hex'),row.bodySHA256)
 const {modules,contract}=current()
 assert.equal(profileModuleURL('main',modules),'https://careers.groupon.com/assets/index-BDMW3WUv.js')
 assert.equal(contract.inventoryURL,API)
 assert.equal(contract.method,'GET')
 assert.equal(contract.officeCountryModels.length,11)
 assert.equal(contract.publisherProgramsExecuted,false)
 const old=prior.responses.find(row=>row.url===profileModuleURL('roles',CURRENT_20261120_MODULES))
 const normalize=source=>source.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g,'<telemetry>').replace(/([A-Za-z][A-Za-z0-9]*-)[A-Za-z0-9_-]{8}(\.js)/g,'$1<build>$2')
 assert.equal(normalize(text(graph.get(profileModuleURL('roles',modules)))),normalize(text(old)))
})

test('Groupon current whole graph can reach only its declared inventory GET after exact original bytes',async()=>{
 const reads=[]
 await assert.rejects(run({fetchResponse:async(url,init)=>{
  reads.push(url);assert.equal(init.method,'GET');assert.equal(init.body,null)
  if(url===API)throw Error('Reached the reviewed current inventory GET')
  const row=graph.get(url);assert.ok(row,'Only original reviewed graph routes')
  return{bytes:Buffer.from(row.bodyBase64,'base64'),requestedURL:url,finalURL:url,method:'GET',body:null,status:row.status,headers:row.headers}
 }}),/Reached the reviewed current inventory GET/)
 assert.equal(reads.length,8)
})

test('Groupon new native graph cannot authorize unseen paths, changed criteria or endpoint bytes, or mixed releases',()=>{
 const {modules,programs}=current()
 assert.throws(()=>publisher(text(graph.get(PRIMARY)).replace('index-BDMW3WUv.js','index-unreviewed.js')),/main module changed/)
 assert.throws(()=>program(text(graph.get(profileModuleURL('roles',modules))).replace('dangerouslySetInnerHTML','unreviewedRenderer'),'roles',modules),/program changed/)
 assert.throws(()=>program(text(graph.get(profileModuleURL('detail',modules))).replace('`/careers/jobs`','`/careers/other`'),'detail',modules),/program changed/)
 assert.throws(()=>loadingContract({...programs,detail:{...programs.detail,url:profileModuleURL('detail',CURRENT_20261120_MODULES)}}),/mixed reviewed native program graphs/)
})

test('actual current68-read native pass retains26 roles and cannot certify an India zero from25 unqualified countries',async t=>{
 const native=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261125/current-native.json.gz',import.meta.url))))
 let reads=0
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  const row=native.responses[reads++]
  assert.ok(row,'Only the observed bounded native pass')
  assert.equal(String(url),row.requestedURL)
  assert.equal(init.method,'GET')
  assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(row.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)
  return Object.defineProperty(new Response(bytes,{status:row.status,headers:row.headers}),'url',{value:row.url})
 })
 const jobs=await run()
 assert.equal(reads,68)
 assert.equal(jobs.length,26)
 assert.equal(jobs.filter(job=>job.sourceCountryScopeUnresolved).length,25)
 assert.equal(jobs.filter(job=>job.sourceDetailComplete).length,1)
 assert.equal(jobs.nativeCollectionEvidence.wholeNativeModelsClosingReconciled,true)
 const assessment=assessSoftFailureAcquisition(GROUPON_CATALOG,jobs)
 assert.equal(assessment.runnerOutcome.success,false)
 assert.equal(assessment.indiaJobs,0)
 assert.equal(assessment.zeroJobEvidence,'coverage-gap')
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})
