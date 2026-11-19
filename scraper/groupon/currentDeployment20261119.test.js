import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {publisher,profileForPublisher,program,profileModuleURL,loadingContract,PRIMARY,API} from './nativeModels.js'
import {run} from './script.js'
import {GROUPON_CATALOG} from './catalog.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261119/current-graph.json.gz',import.meta.url))))
const graph=new Map(capture.responses.map(row=>[row.url,row]))
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const currentContract=()=>{
 const modules=profileForPublisher(publisher(text(graph.get(PRIMARY)))),programs={}
 for(const key of Object.keys(modules))programs[key]=program(text(graph.get(profileModuleURL(key,modules))),key,modules)
 return{modules,programs,contract:loadingContract(programs)}
}

test('Groupon current complete declared graph retains exact production GET and full authored role renderer',()=>{
 for(const row of capture.responses)assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64,'base64')).digest('hex'),row.bodySHA256)
 const {modules,contract}=currentContract()
 assert.equal(profileModuleURL('main',modules),'https://careers.groupon.com/assets/index-CHl4g8nw.js')
 assert.equal(contract.inventoryURL,API)
 assert.equal(contract.method,'GET')
 assert.equal(contract.publisherProgramsExecuted,false)
 assert.equal(contract.officeCountryModels.length,11)
})

test('Groupon current graph cannot authorize changed native endpoints, rendered criteria or a mixed deployment',()=>{
 const {modules,programs}=currentContract()
 assert.throws(()=>program(text(graph.get(profileModuleURL('detail',modules))).replace('`/careers/jobs`','`/careers/other`'),'detail',modules),/program changed/)
 assert.throws(()=>program(text(graph.get(profileModuleURL('roles',modules))).replace('dangerouslySetInnerHTML','unreviewedRenderer'),'roles',modules),/program changed/)
 assert.throws(()=>loadingContract({...programs,detail:{...programs.detail,url:'https://careers.groupon.com/assets/useJob-CPR5-WtU.js'}}),/mixed reviewed native program graphs/)
})

test('Groupon current publisher cannot authorize an unseen entry program or foreign publisher identity',()=>{
 const html=text(graph.get(PRIMARY))
 assert.throws(()=>publisher(html.replace('index-CHl4g8nw.js','index-00000000.js')),/declared main module changed/)
 assert.throws(()=>publisher(html.replace('<title>Groupon Careers</title>','<title>Other Careers</title>')),/first-party careers identity changed/)
})

test('Groupon current 72-response imported workflow preserves whole criteria and unresolved countries without a complete-zero claim',async t=>{
 const workflow=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261119/current-native.json.gz',import.meta.url))))
 let index=0
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const packet=workflow.responses[index++]
  assert.ok(packet,'No undeclared public reads')
  assert.equal(String(url),packet.requestedURL)
  assert.equal(init.method,'GET')
  assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
  return Object.defineProperty(new Response(bytes,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 })
 const jobs=await run()
 assert.equal(index,72)
 assert.equal(jobs.length,28)
 assert.equal(jobs.nativeCollectionEvidence.wholeNativeModelsClosingReconciled,true)
 assert.equal(jobs.filter(job=>job.sourceCountryScopeUnresolved).length,27)
 assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.sourceScopeComplete===false&&job.activeApplyVerified===false))
 for(const job of jobs){
  const original=workflow.responses.find(packet=>packet.requestedURL===API+'/'+job.jobId)
  assert.equal(job.sourceDescription,JSON.parse(Buffer.from(original.bodyBase64,'base64').toString('utf8')).job.contentHtml)
 }
 const assessed=assessSoftFailureAcquisition(GROUPON_CATALOG,jobs)
 assert.equal(assessed.indiaJobs,0)
 assert.equal(assessed.eligibleJobs,0)
 assert.equal(assessed.runnerOutcome.success,false)
 assert.equal(assessed.zeroJobEvidence,'coverage-gap')
 assert.equal(readSourceObservationEvidence(jobs,'groupon').observedRecordCount,28)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
