import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'

const fixture=path=>JSON.parse(gunzipSync(readFileSync(new URL(path,import.meta.url))))
const capture=fixture('./test-data/current-programs-20261128.json.gz')
const previous=fixture('./test-data/current-programs-20261119.json.gz')
const origin='https://amararajacareers.peoplestrong.com',base=origin+'/api/cp/rest/altone/cp/'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
for(const packet of capture.packets){
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(sha(bytes),packet.sha256)
  assert.equal(bytes.length,packet.bodyBytes)
}
const body=(packets,name)=>Buffer.from(packets.find(packet=>packet.url.endsWith('/'+name)).bodyBase64,'base64').toString('utf8')
const job='chunk-5KKCXGYG.js',service='chunk-B7GQ3CPB.js',filter='chunk-ZKMRUQJB.js',helper='chunk-IIGMZVP4.js'
const rewrite=(packets,name,change)=>{
  const packet=packets.find(packet=>packet.url.endsWith('/'+name))
  const original=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),changed=change(original)
  assert.notEqual(changed,original,'The negative must change the actual captured body: '+name)
  packet.bodyBase64=Buffer.from(changed).toString('base64')
}
async function attempt(mutate=()=>{}){
  const packets=structuredClone(capture.packets),calls=[]
  mutate(packets)
  let error
  try{
    await run({now:capture.startedAt,fetchPage:async(url,init)=>{
      calls.push({url,method:init.method??'GET',body:init.body??null})
      const packet=packets.find(packet=>packet.url===url&&(packet.method??'GET')===(init.method??'GET'))
      if(!packet)throw Error('CONTROLLED_UNCAPTURED_NATIVE_READ '+url)
      return{status:packet.status,url:packet.finalUrl,headers:packet.headers,body:Buffer.from(packet.bodyBase64,'base64').toString('utf8')}
    }})
  }catch(caught){error=caught}
  assert.ok(error,'The prefix cannot establish unobserved API inventory or completion')
  return{calls,error}
}

test('current Amara complete job and service bodies differ only at the reviewed import literals, with identical filter and retained helper declaration',()=>{
  const currentJob=body(capture.packets,job),oldJob=body(previous.packets,'chunk-QOT5H7Z2.js')
  const currentService=body(capture.packets,service),oldService=body(previous.packets,'chunk-P66I7TEB.js')
  assert.equal(currentJob.split('./'+service).length,2)
  assert.equal(currentJob.replace('./'+service,'./chunk-P66I7TEB.js'),oldJob)
  assert.equal(currentService.split('./chunk-LVOKEYFI.js').length,2)
  assert.equal(currentService.replace('./chunk-LVOKEYFI.js','./chunk-B2MJ73ZP.js'),oldService)
  assert.equal(body(capture.packets,filter),body(previous.packets,filter))
  assert.ok(currentJob.includes('import"./'+helper+'"'))
  assert.ok(oldJob.includes('import"./'+helper+'"'))
  assert.equal(sha(Buffer.from(body(capture.packets,helper))),'1b5bc0127b8317393c3742a070b54e3bb04a4e379a6ded31d0e52eec71e01513')
})

test('genuine current Amara graph verifies every declared direct import before reaching the uncaptured native tenant GET',async()=>{
  const result=await attempt()
  assert.equal(result.error.message,'CONTROLLED_UNCAPTURED_NATIVE_READ '+base+'urlinfo')
  for(const filename of[job,filter,service,helper])assert.ok(result.calls.some(call=>call.url===origin+'/'+filename),filename)
  assert.deepEqual(result.calls.filter(call=>call.url.startsWith(base)),[{url:base+'urlinfo',method:'GET',body:null}])
  assert.ok(result.calls.every(call=>call.method==='GET'&&call.body===null))
})

for(const[label,mutate]of[
  ['an altered initial filter constructor',packets=>rewrite(packets,job,text=>text.replace('this.filterTO=new q,','this.filterTO=Object.assign(new q,{searchString:"India"}),'))],
  ['an altered filter class',packets=>rewrite(packets,filter,text=>text.replace('class{','class{constructor(){this.searchString="India"}'))],
  ['a changed native page size',packets=>rewrite(packets,service,text=>text.replace(',ay=45,',',ay=100,'))],
  ['a different native search path',packets=>rewrite(packets,service,text=>text.replaceAll('jobs/v1?offset=','jobs/v2?offset='))],
  ['a changed native request body projection',packets=>rewrite(packets,job,text=>text.replace('bandList:this.filterTO.bandList','bandList:["India"]'))],
  ['a different declared service import',packets=>rewrite(packets,job,text=>text.replace('./'+service,'./chunk-FOREIGN0.js'))],
  ['a foreign declared helper import',packets=>rewrite(packets,job,text=>text.replace('./'+helper,'https://foreign.invalid/'+helper))],
  ['an omitted declared helper import',packets=>rewrite(packets,job,text=>text.replace('import"./'+helper+'";',''))],
  ['an appended job executable',packets=>rewrite(packets,job,text=>text+';globalThis.changedInitialFilter=true')],
  ['an appended service executable',packets=>rewrite(packets,service,text=>text+';globalThis.changedNativeAuthority=true')],
  ['an appended helper executable',packets=>rewrite(packets,helper,text=>text+';globalThis.changedNativeAuthority=true')],
  ['an unavailable helper body',packets=>{packets.find(packet=>packet.url.endsWith('/'+helper)).status=404}],
  ['a foreign helper final URL',packets=>{packets.find(packet=>packet.url.endsWith('/'+helper)).finalUrl='https://foreign.invalid/'+helper}],
  ['a changed current employer delegation',packets=>rewrite(packets,'careers/',text=>text.replaceAll(origin,'https://foreign.invalid'))],
])test('current Amara graph refuses '+label+' before native API reads',async()=>{
  const result=await attempt(mutate)
  assert.equal(result.calls.some(call=>call.url.startsWith(base)),false,result.error.message)
  assert.match(result.error.message,/Amara native:/)
})
