import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createRequire,registerHooks} from 'node:module'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const sha=b=>createHash('sha256').update(b).digest('hex'),compressed=fs.readFileSync(new URL('./test-inputs/current-client-20261107.json.gz',import.meta.url))
assert.equal(sha(compressed),'8f63af0bac2059dff6c0aebc7607b18f4097a51e4516096b80714c79c5a71ba7')
const genuine=JSON.parse(gunzipSync(compressed)),old=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz',import.meta.url)))),client=JSON.parse(fs.readFileSync(new URL('./nativeClient.json',import.meta.url)))
const INDEX=client.assets[2].url,currentIndex=genuine.packets.find(p=>p.url===INDEX),currentBody=Buffer.from(currentIndex.bodyBase64,'base64').toString()
assert.equal(sha(currentBody),'487a4823d307f74bc80ae971c06f14825323545e5371e9b1242335c1bd36598b')
let moduleNumber=0
function tripwire(t){
 let databaseAttempts=0
 const require=createRequire(import.meta.url),mongoose=require('mongoose'),{MongoClient}=require('mongodb'),deny=()=>{databaseAttempts++;throw Error('Colgate offline database tripwire')}
 for(const [object,key]of [[mongoose,'connect'],[mongoose,'createConnection'],[mongoose.Connection.prototype,'openUri'],[MongoClient,'connect'],[MongoClient.prototype,'connect']])t.mock.method(object,key,deny)
 const hook=registerHooks({load(url,context,next){if(/\/utils\/saveToDB\.js(?:\?|$)/.test(url))deny();return next(url,context)}});t.after(()=>{hook.deregister();assert.equal(databaseAttempts,0)})
}
async function replay(t,{changeIndex=b=>b,changeClient=()=>{},changePacket=()=>{}}={}){
 tripwire(t)
 const profile=structuredClone(client);changeClient(profile)
 const originalRead=fs.readFileSync;t.mock.method(fs,'readFileSync',function(file,...args){if(String(file).endsWith('/nativeClient.json'))return JSON.stringify(profile);return Reflect.apply(originalRead,this,[file,...args])})
 const {runNative}=await import('./nativeRun.js?current-index-compatibility='+ ++moduleNumber),calls=[]
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const isIndex=String(url)===profile.assets[2].url,p=structuredClone(old.packets.find(p=>p.url===(isIndex?INDEX:String(url))&&p.method===(init.method??'GET')&&(p.requestBody??null)===(init.body??null)))
  assert.ok(p,'No undeclared native/application/network requests');calls.push(String(url));assert.equal(init.redirect,'error')
  if(isIndex)p.body=changeIndex(currentBody)
  changePacket(p)
  // Historical-role compatibility only: this nonce substitution is identical to
  // the existing Oct21 fixture reader. No historical role/date is renewed.
  const body=p.body.replaceAll('[REDACTED_PUBLIC_CSRF]','00000000-0000-4000-8000-000000000000'),response=new Response(body,{status:p.status,headers:{'content-type':p.url.includes('/services/')?'application/json':'text/html'}})
  Object.defineProperty(response,'url',{value:isIndex?String(url):p.finalURL});return response
 })
 return{calls,run:options=>runNative({now:'2026-10-21T14:00:00.000Z',...options})}
}

test('genuine index one-field deployment delta retains the exact currently declared complete loader/manifest/main programs',()=>{
 const previous=old.packets.find(p=>p.url===INDEX),a=JSON.parse(previous.body),b=JSON.parse(currentBody)
 assert.deepEqual(Object.keys(a),Object.keys(b));assert.deepEqual(Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])),['verpVersion'])
 const require=createRequire(import.meta.url),{parse}=require('acorn')
 for(const asset of client.assets.filter(a=>a.url!==INDEX)){
  const actual=genuine.packets.find(p=>p.url===asset.url),prior=old.packets.find(p=>p.url===asset.url),bytes=Buffer.from(actual.bodyBase64,'base64')
  assert.equal(bytes.length,actual.bodyBytes);assert.equal(sha(bytes),asset.sha256);assert.equal(bytes.toString(),prior.body)
  if(new URL(asset.url).pathname.endsWith('.js'))assert.deepEqual(parse(bytes.toString(),{ecmaVersion:'latest'}),parse(prior.body,{ecmaVersion:'latest'}))
 }
 assert.deepEqual(genuine.chainComparison.loaderReaderFunction.responseMemberReads,['versions','virtualPath']);assert.equal(genuine.chainComparison.loaderReaderFunction.verpVersionReads,0)
 assert.equal(genuine.chainComparison.programs[0].bytes,1850648)
})

test('current genuine exact index is compatible with the unchanged historical17-role extraction and closing guards',async t=>{
 const r=await replay(t),jobs=await r.run();assert.equal(r.calls.length,29);assert.equal(jobs.length,17);assert.equal(new Set(jobs.map(j=>j.jobId)).size,17)
 assert.equal(jobs.find(j=>j.jobId==='167261').postedAt,'2025-05-23T00:00:00.000Z')
 assert.ok(jobs.every(j=>j.country==='India'&&j.nativeCompanyBrand==='Colgate-Palmolive'&&j.nativeLegalEmployer===null&&j.sourceDetailComplete&&j.sourceScopeComplete===false))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

for(const [name,change]of[
 ['deployment value',d=>{d.verpVersion+='x'}],['version list',d=>{d.versions=['4.71.3']}],['extra supported version',d=>{d.versions.push('4.71.3')}],
 ['virtual path',d=>{d.virtualPath+='/other'}],['module identity',d=>{d.moduleName='other'}],['unknown field',d=>{d.extra=true}],['SMRF mode',d=>{d.smrf=true}],
])test('finite exact-index profile rejects changed '+name,async t=>{
 const r=await replay(t,{changeIndex:body=>{const d=JSON.parse(body);change(d);return JSON.stringify(d)}});await assert.rejects(r.run(),/Advertised native client changed/)
})
for(const [name,change]of[
 ['whitespace',b=>b+'\n'],['unknown bytes',b=>b+'garbage'],['escaped key spelling',b=>b.replace('verpVersion','verp\\u0056ersion')],['duplicate key',b=>b.replace('{','{"smrf":false,')],
])test('finite exact-index profile rejects '+name,async t=>{const r=await replay(t,{changeIndex:change});await assert.rejects(r.run(),/Advertised native client changed/)})
test('finite index acceptance is bound to exact declared index URL',async t=>{const r=await replay(t,{changeClient:c=>{c.assets[2].url+='&unreviewed=1'}});await assert.rejects(r.run(),/Advertised native client changed/)})
test('finite index acceptance is bound to its original expected profile SHA',async t=>{const r=await replay(t,{changeClient:c=>{c.assets[2].sha256='0'.repeat(64)}});await assert.rejects(r.run(),/Advertised native client changed/)})
for(const asset of client.assets.filter(a=>a.url!==INDEX))test('current index cannot mask another changed whole asset '+client.assets.indexOf(asset),async t=>{
 const r=await replay(t,{changePacket:p=>{if(p.url===asset.url)p.body+=' '}});await assert.rejects(r.run(),/Advertised native client changed/)
})
test('current index cannot mask a foreign native worksite',async t=>{
 const r=await replay(t,{changePacket:p=>{if(p.url.endsWith('/services/recruiting/v1/jobs')){const d=JSON.parse(p.body);if(d.jobSearchResult)d.jobSearchResult[0].response.jobLocationShort=['Mumbai, MH, USA, '];p.body=JSON.stringify(d)}}});await assert.rejects(r.run(),/location outside/)
})
test('current index cannot mask native closing changes',async t=>{
 let pages=0;const r=await replay(t,{changePacket:p=>{if(p.url.endsWith('/services/recruiting/v1/jobs')&&JSON.parse(p.requestBody).pageNumber===0&&++pages===2){const d=JSON.parse(p.body);d.totalJobs++;p.body=JSON.stringify(d)}}});await assert.rejects(r.run(),/changed during extraction/)
})
test('known403 remains denied and opaque already-aborted caller identity wins',async t=>{
 const r=await replay(t,{changePacket:p=>{p.status=403}});await assert.rejects(r.run(),e=>e.status===403&&/403/.test(e.message));assert.equal(r.calls.length,1)
 const reason=Object.freeze(Object.create(null)),controller=new AbortController();controller.abort(reason);await assert.rejects(r.run({signal:controller.signal}),e=>e===reason);assert.equal(r.calls.length,1)
})
