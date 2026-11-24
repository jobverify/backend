import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {publisher,profileForPublisher,program,profileModuleURL,loadingContract,PRIMARY,API,CURRENT_20261119_MODULES} from './nativeModels.js'
import {run} from './script.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261120/current-graph.json.gz',import.meta.url))))
const graph=new Map(fixture.responses.map(row=>[row.url,row]))
const original=row=>Buffer.from(row.bodyBase64,'base64')
const text=row=>original(row).toString('utf8')
const current=()=>{
 const modules=profileForPublisher(publisher(text(graph.get(PRIMARY)))),programs={}
 for(const key of Object.keys(modules))programs[key]=program(text(graph.get(profileModuleURL(key,modules))),key,modules)
 return{modules,programs,contract:loadingContract(programs)}
}

test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('No network permitted in original Groupon graph replay')}))

test('Groupon Nov20 original graph authorizes the production inventory GET after the exact own-role rendering graph',()=>{
 for(const row of fixture.responses)assert.equal(createHash('sha256').update(original(row)).digest('hex'),row.bodySHA256)
 const {modules,contract}=current()
 assert.equal(profileModuleURL('main',modules),'https://careers.groupon.com/assets/index-BJfNRE2S.js')
 assert.equal(contract.inventoryURL,'https://api-core.livingsocial.com/careers/jobs')
 assert.equal(contract.method,'GET')
 assert.equal(contract.publishedApplicationTemplate,'https://careers.groupon.com/apply/?job={literal-published-id}')
 assert.equal(contract.officeCountryModels.length,11)
 assert.equal(contract.publisherProgramsExecuted,false)
})

test('Groupon Nov20 original graph reaches inventory only after all seven current publisher and programme originals',async()=>{
 const reads=[]
 await assert.rejects(run({fetchResponse:async(url,init)=>{
  reads.push(url)
  assert.equal(init.method,'GET');assert.equal(init.body,null)
  if(url===API)throw Object.assign(Error('Reached declared native inventory boundary'),{abortRetries:true})
  const packet=graph.get(url);assert.ok(packet,'Only declared graph routes are available')
  return{bytes:original(packet),requestedURL:url,finalURL:url,method:'GET',body:null,status:packet.status,headers:packet.headers,contentType:packet.headers['content-type'],bodySHA256:packet.bodySHA256}
 }}),/Reached declared native inventory boundary/)
 assert.deepEqual(reads,[
  'https://www.grouponcareers.com/','https://careers.groupon.com/',
  'https://careers.groupon.com/assets/index-BJfNRE2S.js','https://careers.groupon.com/assets/src-Chmq7nvF.js',
  'https://careers.groupon.com/assets/page-DnT3o9iZ.js','https://careers.groupon.com/assets/useJob-DwsXeAll.js',
  'https://careers.groupon.com/assets/locations-C3ZnT-yL.js','https://api-core.livingsocial.com/careers/jobs',
 ])
})

test('Groupon Nov20 byte changes, unseen entries and a prior-deployment detail URL cannot authorize native inventory',async()=>{
 const {modules,programs}=current()
 assert.throws(()=>program(text(graph.get(profileModuleURL('roles',modules))).replace('dangerouslySetInnerHTML','unreviewedRenderer'),'roles',modules),/program changed/)
 assert.throws(()=>program(text(graph.get(profileModuleURL('detail',modules))).replace('`/careers/jobs`','`/careers/other`'),'detail',modules),/program changed/)
 assert.throws(()=>publisher(text(graph.get(PRIMARY)).replace('index-BJfNRE2S.js','index-unseen00.js')),/declared main module changed/)
 assert.throws(()=>loadingContract({...programs,detail:{...programs.detail,url:profileModuleURL('detail',CURRENT_20261119_MODULES)}}),/mixed reviewed native program graphs/)
 const reads=[]
 await assert.rejects(run({fetchResponse:async(url)=>{
  reads.push(url);const packet=graph.get(url);assert.ok(packet)
  const bytes=url.endsWith('/page-DnT3o9iZ.js')?Buffer.concat([original(packet),Buffer.from('\n/* unreviewed byte */')]):original(packet)
  return{bytes,requestedURL:url,finalURL:url,method:'GET',body:null,status:packet.status,headers:packet.headers}
 }}),/program changed/)
 assert.equal(reads.some(url=>url.startsWith(API)),false)
})
