import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {publisher,profileForPublisher,program,profileModuleURL,loadingContract,PRIMARY,API} from './nativeModels.js'
const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261117/default-graph.json.gz',import.meta.url))))
const graph=new Map(capture.responses.map(row=>[row.url,row]))
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const currentContract=()=>{
 const modules=profileForPublisher(publisher(text(graph.get(PRIMARY)))),programs={}
 for(const key of Object.keys(modules))programs[key]=program(text(graph.get(profileModuleURL(key,modules))),key,modules)
 return{modules,programs,contract:loadingContract(programs)}
}
test('Groupon fresh default graph retains the exact current declared public GET and complete role renderer',()=>{
 for(const row of capture.responses)assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64,'base64')).digest('hex'),row.bodySHA256)
 const {modules,contract}=currentContract()
 assert.equal(profileModuleURL('main',modules),'https://careers.groupon.com/assets/index-wTVOiLWE.js')
 assert.equal(contract.inventoryURL,API)
 assert.equal(contract.method,'GET')
 assert.equal(contract.publisherProgramsExecuted,false)
 assert.equal(contract.officeCountryModels.length,11)
})
test('Groupon fresh default graph still rejects edited original program bytes and mixed reviewed graphs',()=>{
 const {modules,programs}=currentContract()
 assert.throws(()=>program(text(graph.get(profileModuleURL('roles',modules)))+';window.unreviewed=true','roles',modules),/program changed/)
 assert.throws(()=>loadingContract({...programs,detail:{...programs.detail,url:'https://careers.groupon.com/assets/useJob-DvA4pv2Q.js'}}),/mixed reviewed native program graphs/)
})
test('Groupon fresh default program cannot authorize another deployment filename',()=>{
 assert.throws(()=>publisher(text(graph.get(PRIMARY)).replace('index-wTVOiLWE.js','index-00000000.js')),/declared main module changed/)
})
