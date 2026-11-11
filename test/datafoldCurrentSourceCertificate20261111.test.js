import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {readCurrentDatafoldProgramme,runCurrentDatafoldProgramme} from '../scraper/datafold/currentProgramme.js'
import {HOME,BOARD,API,readNative} from '../scraper/datafold/currentProgrammeData.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const compressed=name=>fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))
const oldBytes=compressed('datafold-current-programme-07dd-20261111.json.gz')
const sourceBytes=compressed('ashby-renderer-source-certificate-20261111.json.gz')
assert.equal(sha(oldBytes),'ad010dc522eefab6f38c1bb5bc6f151f80fac84612d8068205cd36e5d3382841')
assert.equal(sha(sourceBytes),'3f14a60771dce3aad14c77fc48cd4e08fdaf7a45852cb78f13bfac54ca6796ea')
const historical=JSON.parse(gunzipSync(oldBytes))
const graph=JSON.parse(gunzipSync(sourceBytes)).graphs.find(row=>row.label==='current')
const currentBoard=JSON.parse(gunzipSync(compressed('datafold-current-b542-bootstrap-20261111.json.gz'))).response
const OLD='07ddf247e844137b3955a192112a7970230c6ccf',CURRENT=graph.declaration.version
const ownURLs=historical.responses.filter(row=>row.kind==='role'&&row.phase==='opening').map(row=>row.requestedURL)
const decode=row=>{
 const bytes=Buffer.from(row.bodyBase64,'base64')
 assert.equal(sha(bytes),row.bodySHA256??row.provenance.originalReceipt.bodySHA256)
 return {url:row.finalURL,status:row.status,headers:structuredClone(row.headers),
  text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}
}

// CONTROLLED protocol responses, explicitly not a fresh publisher transaction.
// Old own pages receive only derived deployment-reference substitutions; their
// original JSON/LD/headers stay exact. Actual current assets and the one actual
// current board opening are reused by test doubles for simulated closings.
const simulatedRows=new Map()
for(const row of historical.responses){
 if(!['corporate','feed','role'].includes(row.kind))continue
 const original=decode(row),page={...original}
 if(row.kind==='role'){
  const before=readNative({...original,hash:sha(original.text)},true)
  for(const area of['frontend_non_user/','cdn_assets/']){
   const prefix='https://cdn.ashbyprd.com/'+area
   const old=prefix+OLD+'/',current=prefix+CURRENT+'/'
   assert.equal(page.text.split(old).length-1,area==='frontend_non_user/'?5:7)
   page.text=page.text.split(old).join(current)
  }
  const after=readNative({...page,hash:sha(page.text)},true)
  assert.equal(after.rawJSON,before.rawJSON);assert.deepEqual(after.rawSchema,before.rawSchema)
  assert.deepEqual(after.headers,before.headers);assert.equal(after.nonce,before.nonce)
 }
 const list=simulatedRows.get(row.requestedURL)||[];list.push(page);simulatedRows.set(row.requestedURL,list)
}
simulatedRows.set(BOARD,[decode(currentBoard),decode(currentBoard)])
const resourceURLs={}
for(const[kind,row]of Object.entries(graph.packets)){
 const page=decode(row);resourceURLs[kind]=row.requestedURL
 simulatedRows.set(row.requestedURL,[page,page])
}
function replay(change=(page)=>page,options={}){
 const calls=[],occurrences=new Map()
 const readPage=async(url,init)=>{
  const occurrence=occurrences.get(url)||0,page=simulatedRows.get(url)?.[occurrence]
  assert.ok(page,'Only explicitly controlled responses may be requested: '+url)
  occurrences.set(url,occurrence+1);calls.push({url,occurrence,init})
  return change({...page,headers:structuredClone(page.headers)},{url,occurrence,calls})
 }
 return {calls,readPage,
  run:()=>readCurrentDatafoldProgramme({readPage,now:new Date().toISOString(),...options}),
  runTransport:()=>runCurrentDatafoldProgramme({requestIntervalMs:0,...options,fetchImpl:async(url,init)=>{
   const page=await readPage(url,init),response=new Response(page.text,{status:page.status,headers:page.headers})
   Object.defineProperty(response,'url',{value:page.url});return response
  }})}
}
const order=[HOME,BOARD,API,...['manifest','entry','recorder','profiler','css'].map(kind=>resourceURLs[kind]),
 ...ownURLs,...ownURLs,BOARD,API,HOME,...['manifest','entry','recorder','profiler','css'].map(kind=>resourceURLs[kind])]

test('controlled twenty-read source protocol closes every role and all five source resources without a currentness claim',async()=>{
 const r=replay(),jobs=await r.run(),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.deepEqual(r.calls.map(row=>row.url),order)
 assert.equal(r.calls.length,20);assert.equal(audit.requests,20);assert.equal(audit.roles.length,2)
 assert.equal(audit.currentDeclaredSourceProgramComplete,true)
 assert.equal(audit.completeSourceCertificateRequired,true);assert.equal(audit.allDeclaredSourceResourcesRechecked,true)
 assert.equal(audit.renderer.sourceBodiesQualified,true);assert.equal(audit.closingRendererSourceCertificate.sourceBodiesQualified,true)
 assert.equal(audit.renderer.declaration.version,CURRENT)
 for(const[kind,row]of Object.entries(graph.packets)){
  assert.equal(audit.renderer.resources[kind].originalSHA256,sha(Buffer.from(row.bodyBase64,'base64')))
  assert.equal(audit.closingRendererSourceCertificate.resources[kind].originalSHA256,audit.renderer.resources[kind].originalSHA256)
 }
 assert.deepEqual(audit.nativePayload,JSON.parse(simulatedRows.get(API)[0].text))
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalScopeQualified,false)
 assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,2)
 for(const call of r.calls){
  assert.equal(call.init.method,'GET');assert.equal(call.init.redirect,'manual');assert.equal(call.init.credentials,'omit');assert.equal(call.init.cache,'no-store')
 }
})

test('controlled source protocol exercises raw transport and original CSS/JS MIME handling',async()=>{
 const r=replay(),jobs=await r.runTransport()
 assert.equal(jobs.nativeCollectionEvidence.requests,20);assert.equal(r.calls.length,20)
 assert.equal(r.calls.find(row=>row.url===resourceURLs.css).init.headers.Accept,'text/css')
 assert.equal(r.calls.find(row=>row.url===resourceURLs.recorder).init.headers.Accept,'application/javascript')
 assert.equal(jobs.nativeCollectionEvidence.renderer.stylesheetBytesAcquired,true)
})

test('nineteen remaining native requests cannot start the required twenty-read transaction',async()=>{
 let audits=0
 const r=replay(page=>page,{maxRequests:19,onAudit:()=>{audits++}})
 await assert.rejects(r.run(),error=>error.softFailure===true&&/Reserve/.test(error.message))
 assert.equal(r.calls.length,3);assert.equal(audits,0)
})

test('new source protocol still enforces the six-role detail caller bound',async()=>{
 const r=replay(page=>page,{maxDetails:1})
 await assert.rejects(r.run(),/Every current native role must fit the detail bound/)
 assert.equal(r.calls.length,3)
})

test('controlled complete single-role membership uses eighteen reads without a fixed two-role pin',async()=>{
 const r=replay((page,{url})=>{
  if(url===API){const data=JSON.parse(page.text);data.jobs=data.jobs.slice(0,1);return {...page,text:JSON.stringify(data)}}
  if(url===BOARD){const native=readNative({...page,hash:sha(page.text)}),data=structuredClone(native.model)
   data.jobBoard.jobPostings=data.jobBoard.jobPostings.slice(0,1)
   return {...page,text:page.text.replace(native.rawJSON,JSON.stringify(data))}}
  return page
 })
 const jobs=await r.run()
 assert.equal(r.calls.length,18);assert.equal(readInventoryEvidence(jobs).reportedTotal,1)
 assert.equal(r.calls.some(row=>row.url===ownURLs[1]),false)
})

test('an own page declaring another reviewed deployment cannot share this source certificate',async()=>{
 const r=replay((page,{url})=>url===ownURLs[0]?{...page,text:page.text.split(CURRENT).join(OLD)}:page)
 await assert.rejects(r.run(),error=>error.softFailure===true&&/renderer\/bootstrap/.test(error.message))
 assert.equal(r.calls.length,9)
})

test('earlier role raw drift after the later opening still holds the new source path',async()=>{
 let later=false
 const r=replay((page,{url,occurrence})=>{
  if(url===ownURLs[1]&&occurrence===0)later=true
  return later&&url===ownURLs[0]&&occurrence===1?{...page,text:page.text+'\n<!-- controlled closing change -->'}:page
 })
 await assert.rejects(r.run(),/Own role whole original body changed/)
 assert.equal(r.calls.length,11)
})

for(const kind of['entry','recorder','profiler','css'])
 test('changed closing '+kind+' is a source coverage hold before any final observer',async()=>{
  let audits=0
  const r=replay((page,{url,occurrence})=>url===resourceURLs[kind]&&occurrence===1?{...page,text:page.text+' '}:page,{onAudit:()=>{audits++}})
  await assert.rejects(r.run(),error=>{
   assert.equal(error.softFailure,true)
   assert.equal(error.failureKind,'coverage_gap')
   assert.equal(error.cause?.code,'ASHBY_SOURCE_CERTIFICATE_HOLD')
   assert.equal(error.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false)
   return true
  })
  assert.equal(audits,0)
 })

test('changed closing manifest graph is a source coverage hold before further source closing requests',async()=>{
 const r=replay((page,{url,occurrence})=>{
  if(url!==resourceURLs.manifest||occurrence!==1)return page
  const data=JSON.parse(page.text);data['index.html'].imports=['unexpected.js']
  return {...page,text:JSON.stringify(data)}
 })
 await assert.rejects(r.run(),error=>{
  assert.equal(error.softFailure,true);assert.equal(error.failureKind,'coverage_gap')
  assert.equal(error.cause?.code,'ASHBY_SOURCE_CERTIFICATE_HOLD');return true
 })
 assert.equal(r.calls.at(-1).url,resourceURLs.manifest)
})
