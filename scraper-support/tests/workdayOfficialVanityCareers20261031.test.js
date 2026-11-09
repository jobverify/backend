import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
import nodeTest from 'node:test'
import {runWorkdayScraper,WorkdayHostCircuitBreaker} from '../myworkday/engine.js'
import {WORKDAY_COUNTRY_INVENTORY_PROOF} from '../myworkday/countryInventoryProof.js'
import {activeScripts} from '../utils/activeNativeHtml.js'

const packet=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/eset/test-data/2026-10-31-'+name+'.json.gz',import.meta.url))))
const official=packet('official'),native=packet('native-vanity')
const PRIMARY='https://www.eset.com/us/about/careers/',VANITY='https://jobs.eset.com/en-US/ESET_External'
const BOARD='https://eset.wd3.myworkdayjobs.com/ESET_External',API='https://eset.wd3.myworkdayjobs.com/wday/cxs/eset/ESET_External/jobs'
const test=(name,operation)=>nodeTest(name,{timeout:5000,concurrency:false},operation)
const response=(page,changes={})=>{
 const row={...page,...changes}
 const result=new Response(row.body,{status:row.status,headers:{'content-type':row.headers?.['content-type']||'text/html'}})
 Object.defineProperty(result,'url',{value:row.finalUrl||row.url})
 for(const key of ['capturedAt','startedAt'])if(Object.hasOwn(row,key))Object.defineProperty(result,key,{value:row[key],configurable:true,enumerable:true})
 return result
}
const exercise=async(t,{primary={},vanity={},config={},options={},mutateResponse=()=>{},customFetch}={})=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'eset-vanity-proof-'))
 t.after(()=>{
  const target=fs.realpathSync(directory)
  assert.equal(path.dirname(target),fs.realpathSync(os.tmpdir()))
  assert.ok(path.basename(target).startsWith('eset-vanity-proof-'))
  fs.rmSync(target,{recursive:true})
 })
 fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify({listingStrategy:'jobs-api',inventoryScope:'complete-board-country-proof',officialCareersUrl:PRIMARY,officialVanityCareersUrl:VANITY,jobsApiUrl:API,detailUrlBase:BOARD,locationCountry:null,searchText:'',...config}))
 const calls=[]
 const mock=t.mock.method(globalThis,'fetch',async(url,init={})=>{
  calls.push({url,method:init.method||'GET',signal:init.signal})
  if(customFetch)return customFetch(url,init,calls)
  let result
  if(url===PRIMARY)result=response(official,primary)
  else if(url===VANITY)result=response(native,vanity)
  else if(url===BOARD)result=response({url,body:'<html><body>Controlled bootstrap only, not a current vacancy capture.</body></html>',status:200})
  else if(url===API){
   assert.equal(init.method,'POST')
   assert.deepEqual(JSON.parse(init.body),{appliedFacets:{},limit:20,offset:0,searchText:''})
   result=response({url,body:JSON.stringify({total:0,jobPostings:[]}),status:200,headers:{'content-type':'application/json'}})
  }else throw Error('Unexpected HTTP boundary: '+url)
  mutateResponse(result,url)
  return result
 })
 let jobs,error
 try{jobs=await runWorkdayScraper({company:'ESET',source:'eset-vanity-control',baseUrl:BOARD,scraperDir:directory,requestTimeoutMs:1000,retryBaseDelayMs:0,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}},circuitBreaker:new WorkdayHostCircuitBreaker(),...options})}
 catch(caught){error=caught}
 finally{mock.mock.restore()}
 return {jobs,error,calls,receipt:jobs?.[WORKDAY_COUNTRY_INVENTORY_PROOF]?.boardReceipt}
}
const rejectsBefore=(result,reads)=>{
 assert.ok(result.error,'Unqualified handoff must fail before any inventory output')
 assert.equal(result.jobs,undefined)
 assert.equal(result.calls.length,reads)
}

test('actual ESET primary and literal vanity configuration bind the board before controlled inventory IO',async t=>{
 const result=await exercise(t)
 assert.ifError(result.error)
 assert.deepEqual(result.calls.map(call=>call.url),[PRIMARY,VANITY,BOARD,API,API])
 assert.ok(result.calls.every(call=>call.signal instanceof AbortSignal))
 assert.equal(result.receipt.board,BOARD)
 assert.equal(result.receipt.anchorUrl,VANITY)
 assert.equal(result.receipt.method,'official-visible-vanity-and-literal-workday-config')
 assert.deepEqual(result.receipt.responses.map(row=>[row.url,row.sha256,row.capturedAt]),[[PRIMARY,official.sha256,official.capturedAt],[VANITY,native.sha256,native.capturedAt]])
 assert.equal(result.receipt.fetchedAt,official.capturedAt)
})

test('default direct-anchor proof does not implicitly activate vanity resolution',async t=>{
 const result=await exercise(t,{config:{officialVanityCareersUrl:undefined}})
 rejectsBefore(result,1)
 assert.match(result.error.message,/scope|active anchor/i)
})

test('hidden CSS or disabled primary links cannot activate the native vanity read',async t=>{
 const target='href="'+VANITY+'"'
 for(const body of [official.body.replace(target,'hidden '+target),official.body.replace(target,'aria-hidden="true" '+target),official.body.replace(target,'aria-disabled="true" '+target),official.body.replace(target,'disabled '+target),official.body.replace('</head>','<style>a[href="'+VANITY+'"]{display:none}</style></head>')]){
  assert.notEqual(body,official.body)
  rejectsBefore(await exercise(t,{primary:{body}}),1)
 }
})

test('primary status exact URL and HTML type are required before any native follow',async t=>{
 for(const primary of [{status:403},{finalUrl:'https://unrelated.example/careers/'},{headers:{'content-type':'application/json'}}])rejectsBefore(await exercise(t,{primary}),1)
})

test('native vanity denial redirect foreign URL and nonHTML content stop before bootstrap',async t=>{
 for(const vanity of [{status:403},{status:302},{finalUrl:'https://unrelated.example/'},{headers:{'content-type':'application/json'}}])rejectsBefore(await exercise(t,{vanity}),2)
})

test('the vanity canonical is unique and must exactly match the configured Workday board',async t=>{
 for(const body of [native.body.replace(BOARD,'https://other.wd3.myworkdayjobs.com/ESET_External'),native.body.replace('</head>','<link rel="canonical" href="'+BOARD+'"></head>')]){
  assert.notEqual(body,native.body)
  rejectsBefore(await exercise(t,{vanity:{body}}),2)
 }
})

test('native tenant site external-CXS identity and duplicate keys cannot be overridden',async t=>{
 for(const [before,after]of [['tenant: "eset"','tenant: "other"'],['siteId: "ESET_External"','siteId: "Other"'],['appName: "cxs"','appName: "other"'],['isExternal: true','isExternal: false'],['tenant: "eset"','tenant: "other",tenant: "eset"']]){
  const body=native.body.replace(before,after);assert.notEqual(body,native.body)
  rejectsBefore(await exercise(t,{vanity:{body}}),2)
 }
})

test('additional config assignments or executable initializer values cannot qualify literal identity',async t=>{
 for(const body of [native.body.replace('</body>','<script>window.workday=window.workday||{tenant:"eset",siteId:"ESET_External",appName:"cxs",isExternal:true};</script></body>'),native.body.replace('</body>','<script>window.workday.siteId="Other";</script></body>'),native.body.replace('tenant: "eset"','tenant: (()=>"eset")()'),native.body.replace('</body>','<script>delete window.workday.siteId;</script></body>'),native.body.replace('</body>','<script>delete window.workday;</script></body>')]){
  assert.notEqual(body,native.body)
  rejectsBefore(await exercise(t,{vanity:{body}}),2)
 }
})

test('an unreachable initializer inside a function or conditional is not the demonstrated native activation',async t=>{
 const script=activeScripts(native.body)[0]
 for(const replacement of ['function neverCalled(){'+script+'}','if(false){'+script+'}']){
  const body=native.body.replace(script,replacement)
  assert.notEqual(body,native.body)
  rejectsBefore(await exercise(t,{vanity:{body}}),2)
 }
})

const globalWrites=[
 ['earlier global var',null],
 ['Object.defineProperty on window','Object.defineProperty(window,"workday",{value:{tenant:"other",siteId:"Other"}});'],
 ['aliased Workday object','var cfg=window.workday;cfg.tenant="other";'],
 ['globalThis Workday replacement','globalThis.workday={tenant:"other",siteId:"Other"};'],
 ['self Workday replacement','self.workday={tenant:"other",siteId:"Other"};'],
 ['Reflect.set on a global','Reflect.set(window,"workday",{tenant:"other"});'],
 ['Reflect.defineProperty on self','Reflect.defineProperty(self,"workday",{value:{tenant:"other"}});'],
 ['copied window alias','var w=window;w.workday={tenant:"other"};'],
 ['copied globalThis alias','var w=globalThis;w.workday={tenant:"other"};'],
 ['destructured Workday alias','var {workday:cfg}=window;cfg.tenant="other";'],
 ['destructured global alias','var {self:w}=window;w.workday={tenant:"other"};'],
 ['function parameter escape','(function(cfg){cfg.tenant="other"})(window.workday);'],
 ['Object.assign mutation','Object.assign(window.workday,{tenant:"other"});'],
 ['this global replacement','this.workday={tenant:"other"};'],
 ['returned window alias','function globalAlias(){return window}var w=globalAlias();w.workday={tenant:"other"};'],
 ['document defaultView alias','var w=document.defaultView;w.workday={tenant:"other"};'],
 ['computed Workday identity','window["work"+"day"]={tenant:"other"};'],
 ['dynamic evaluation','eval("window.workday={tenant:\\"other\\"}");'],
 ['dynamic global constructor','Function("return this")().workday={tenant:"other"};'],
]
for(const [name,payload]of globalWrites)test('unmodelled native identity/global dataflow fails closed: '+name,async t=>{
 const body=payload==null?native.body.replace(/<script\b/i,'<script>var workday={tenant:"other",siteId:"Other"};</script><script')
  :native.body.replace('</head>','<script>'+payload+'</script></head>')
 assert.notEqual(body,native.body)
 rejectsBefore(await exercise(t,{vanity:{body}}),2)
})

test('inherited accessor invalid and absent replay clocks cannot be restamped by runtime observations',async t=>{
 for(const kind of ['inherited','getter','numeric','invalid','missing']){
  let getters=0
  const result=await exercise(t,{mutateResponse(value,url){
   if(url!==PRIMARY)return
   const original=value.capturedAt;delete value.capturedAt
   if(kind==='inherited')Object.setPrototypeOf(value,Object.assign(Object.create(Object.getPrototypeOf(value)),{capturedAt:original}))
   if(kind==='getter')Object.defineProperty(value,'capturedAt',{get(){getters++;return original}})
   if(kind==='numeric')Object.defineProperty(value,'capturedAt',{value:+new Date(original)})
   if(kind==='invalid')Object.defineProperty(value,'capturedAt',{value:'yesterday'})
  }})
  assert.ifError(result.error)
  assert.equal(getters,0)
  assert.equal(result.receipt.responses[0].capturedAt,null)
  assert.equal(result.receipt.fetchedAt,null)
 }
})

test('caller pre-abort does not fetch or start a fallback',async t=>{
 const controller=new AbortController(),reason=Object.freeze(Error('controlled immutable ESET pre-abort'))
 controller.abort(reason)
 const result=await exercise(t,{options:{signal:controller.signal}})
 assert.equal(result.error,reason);assert.equal(result.calls.length,0)
})

test('caller abort at primary headers preserves its exact reason and starts no body or native follow',async t=>{
 const controller=new AbortController(),reason=Object.freeze(Error('controlled immutable ESET header stop'))
 let reads=0
 const result=await exercise(t,{options:{signal:controller.signal},customFetch:async()=>{
  const result=response(official)
  Object.defineProperty(result,'body',{value:{getReader(){reads++;throw Error('Body read after header abort')}}})
  controller.abort(reason)
  return result
 }})
 assert.equal(result.error,reason);assert.equal(reads,0);assert.equal(result.calls.length,1)
})

test('caller cancellation during primary body consumption preserves exact reason and cancels the stream',async t=>{
 const controller=new AbortController(),reason=Object.freeze(Error('controlled immutable ESET body stop'))
 let cancelled=0
 const result=await exercise(t,{options:{signal:controller.signal},customFetch:async()=>{
  let timer
  const stream=new ReadableStream({start(value){timer=setTimeout(()=>value.close(),80)},pull(){queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})},cancel(){clearTimeout(timer);cancelled++}},{highWaterMark:0})
  return response(official,{body:stream})
 }})
 assert.equal(result.error,reason);assert.equal(cancelled,1);assert.equal(result.calls.length,1)
})

test('new vanity boundary enforces bounded streamed bodies and starts no next read',async t=>{
 let cancelled=0
 let timer
 const result=await exercise(t,{customFetch:async()=>response(official,{body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4*1024*1024+1));timer=setTimeout(()=>controller.close(),80)},cancel(){clearTimeout(timer);cancelled++}})})})
 rejectsBefore(result,1);assert.equal(cancelled,1)
 assert.match(result.error.message,/scope|body|bound/i)
})

test('own request deadline retains its exact native timeout reason during stalled body consumption',async t=>{
 let capturedSignal,cancelled=0
 const result=await exercise(t,{options:{requestTimeoutMs:15},customFetch:async(_url,init)=>{
  capturedSignal=init.signal
  let timer
  return response(official,{body:new ReadableStream({start(value){timer=setTimeout(()=>value.close(),80)},pull(){return new Promise(()=>{})},cancel(){clearTimeout(timer);cancelled++}})})
 }})
 assert.ok(capturedSignal.aborted)
 assert.equal(result.error,capturedSignal.reason)
 assert.equal(result.error.name,'WorkdayRequestTimeoutError')
 assert.equal(cancelled,1);assert.equal(result.calls.length,1)
})
