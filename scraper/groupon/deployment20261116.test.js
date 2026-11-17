import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createNativeGrouponScraper} from './nativeRun.js'
import {publisher,profileForPublisher,program,profileModuleURL,loadingContract,PRIMARY,API} from './nativeModels.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261116/deployment.json.gz',import.meta.url))))
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const graph=new Map(capture.responses.map(row=>[row.url,row]))
const contract=()=>{
 const modules=profileForPublisher(publisher(text(graph.get(PRIMARY)))),programs={}
 for(const key of Object.keys(modules))programs[key]=program(text(graph.get(profileModuleURL(key,modules))),key,modules)
 return{modules,programs,loading:loadingContract(programs)}
}
test('Groupon Nov16 exact current graph retains the public GET full-role contract',()=>{
 const {loading}=contract()
 assert.equal(loading.inventoryURL,API)
 assert.equal(loading.method,'GET')
 assert.equal(loading.publisherProgramsExecuted,false)
 assert.equal(loading.officeCountryModels.length,11)
})
test('Groupon Nov16 current native observations retain full original criteria with country/application/cleanup holds',async()=>{
 const visits=new Map(),jobs=await createNativeGrouponScraper().run({fetchResponse:async url=>{
  const count=visits.get(url)||0;visits.set(url,count+1)
  const row=capture.responses.filter(row=>row.url===url)[count]
  assert.ok(row,'Uncaptured native GET '+url)
  return{...row,bytes:Buffer.from(row.bodyBase64,'base64')}
 }})
 assert.equal(jobs.length,24)
 assert.equal(jobs.nativeCollectionEvidence.wholeNativeModelsClosingReconciled,true)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false&&job.activeApplyVerified===false&&job.sourceDetailComplete===false))
 for(const job of jobs)assert.equal(job.sourceDescription,JSON.parse(text(graph.get(API+'/'+job.jobId))).job.contentHtml)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(jobs.filter(job=>job.country==='India').length,0)
})
test('Groupon Nov16 known filenames cannot authorize edited program bytes or a mixed graph',()=>{
 const {modules,programs}=contract()
 assert.throws(()=>program(text(graph.get(profileModuleURL('roles',modules)))+';window.changed=true','roles',modules),/program changed/)
 assert.throws(()=>loadingContract({...programs,detail:{...programs.detail,url:'https://careers.groupon.com/assets/useJob-C89Jdq1v.js'}}),/mixed reviewed/)
})
