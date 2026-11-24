import fs from 'node:fs'
import {gunzipSync}from'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readCorporate,readRelevantProtocol,readDetailTemplate}from'./currentProtocol20261121.js'
import {createCurrentReader}from'./currentTransport20261121.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const body=path=>Buffer.from(fixture.packets.find(p=>new URL(p.requestedURL).pathname===path).bodyBase64,'base64').toString()
const original={integration:body('/employer/ui/js/jobboard/careers-integration.js'),controller:body('/employer/ui/js/jobboard/careers.js'),encoder:body('/employer/ui/js/wowjsons/encoder.js'),globalClient:body('/employer/ui/js/wow/wow-global-classes.js')}
test('irrelevant client/style/analytics additions and lexical request-local rename retain the own anonymous protocol',()=>{
 const changed={...original,controller:original.controller.replace('var input = {};','var input = {};')+'\nfunction additionalUnusedPresentation(){return "new UI color"}\n',integration:original.integration+'\n/* current presentation comment */\n'}
 changed.controller=changed.controller.replace('function (clientShortName) {','function (currentTenant) {').replace('"/jobboard/details_by_shortname/get/" + clientShortName','"/jobboard/details_by_shortname/get/" + currentTenant')
 assert.equal(readRelevantProtocol(changed).tenant,'futurismtechnologies')
})
for(const[name,key,from,to]of[
 ['native account route replacement','controller','/jobboard/details_by_shortname/get/','/jobboard/details_by_shortname/get/?changed=1/'],
 ['native listing method','controller','"/careers/reqlist/get"','"/careers/reqlist/get?extra=1"'],
 ['native role suffix','controller','/d17/careers/requisition/object','/d17/careers/requisition/object?foreign=1'],
 ['foreign role argument','controller','input.reqId = $scope.basePage.basePageVars.qStringContext.reqId;','input.reqId = 999;'],
 ['indirect role input overwrite','controller','// get drive list if walkin','const alias = input; alias.reqId = 999;\n // get drive list if walkin'],
 ['wrong effective application role','controller','newQStringContext.reqId = reqId;','newQStringContext.reqId = 999;'],
 ['wrong application page','controller','newQStringContext.pageType = "application";','newQStringContext.pageType = "jd";'],
 ['changed encoding consumer','encoder','return Base64.encode(temp);','return Base64.decode(temp);'],
 ['unconsumed hostname detector','globalClient','var $mnh = _st_global_detect_server();','var $mnh = {};'],
 ['native HTTP injection reordered','controller',"['$http', '$window', 'encoderFactory'","['$window', '$http', 'encoderFactory'"],
])test('current original protocol holds '+name,()=>{
 const changed={...original};assert.ok(changed[key].includes(from),'actual reviewed input substring '+name);changed[key]=changed[key].replace(from,to)
 assert.throws(()=>readRelevantProtocol(changed),/Futurism native/)
})
test('inactive own initializer does not declare a native board',()=>{
 const corporate=body('/careers/').replace('document.readyState === "complete"','document.readyState === "never"')
 assert.throws(()=>readCorporate(corporate),/initializer/)
})
test('a disabled literal Apply control cannot activate a native application URL',()=>{
 const template=body('/employer/ui/html/jobboard/careers/careers-jd.html').replace('class="btn btn-primary btn-block wowFont mnh-jd-submit"','disabled class="btn btn-primary btn-block wowFont mnh-jd-submit"')
 assert.throws(()=>readDetailTemplate(template),/active native apply/)
})
test('metadata-only acquisition preserves exact frozen caller cancellation before any fetch',async()=>{
 const reason=Object.freeze({owner:'caller'}),controller=new AbortController();controller.abort(reason);let calls=0
 const io=createCurrentReader({signal:controller.signal,requestIntervalMs:0,fetchImpl:async()=>{calls++;throw Error('No fetch')}})
 try{await assert.rejects(io.read('https://www.futurismtechnologies.com/careers/'),error=>error===reason);assert.equal(calls,0)}finally{assert.throws(()=>io.close(),error=>error===reason)}
})
test('caller abort during pacing remains exact and prevents a second request',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'pacing'});let calls=0
 const io=createCurrentReader({signal:controller.signal,requestIntervalMs:100,fetchImpl:async url=>{calls++;const response=new Response('<html>ok</html>',{headers:{'Content-Type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}})
 try{await io.read('https://www.futurismtechnologies.com/careers/');setTimeout(()=>controller.abort(reason),10);await assert.rejects(io.read('https://www.futurismtechnologies.com/careers/'),error=>error===reason);assert.equal(calls,1)}finally{try{io.close()}catch(error){assert.equal(error,reason)}}
})
test('ordinary malformed MIME is rejected independently from published body predicates',async()=>{
 const url='https://www.futurismtechnologies.com/careers/',io=createCurrentReader({requestIntervalMs:0,fetchImpl:async()=>{const r=new Response('<html>ok</html>',{headers:{'content-type':'text/htmlx'}});Object.defineProperty(r,'url',{value:url});return r}})
 try{await assert.rejects(io.read(url),/media type/)}finally{io.close()}
})

test('synchronous native JSON decoding remains inside the request deadline',async t=>{
 const packet=fixture.packets.find(p=>p.requestedURL.includes('/details_by_shortname/')),url=packet.requestedURL
 const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{headers:packet.headers});Object.defineProperty(response,'url',{value:url})
 let elapsed=0;const parse=JSON.parse
 t.mock.method(performance,'now',()=>elapsed)
 t.mock.method(JSON,'parse',(...args)=>{const result=parse(...args);elapsed=20;return result})
 const io=createCurrentReader({requestIntervalMs:0,requestTimeoutMs:10,sourceTimeoutMs:1000,fetchImpl:async()=>response})
 try{await assert.rejects(io.read(url,'json'),error=>error.name==='TimeoutError'&&/decode/.test(error.message))}finally{io.close()}
})
test('a local source deadline during pacing preserves TimeoutError and prevents the second fetch',async()=>{
 const packet=fixture.packets[0],url=packet.requestedURL;let calls=0
 const io=createCurrentReader({requestIntervalMs:100,sourceTimeoutMs:30,fetchImpl:async()=>{calls++;const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{headers:packet.headers});Object.defineProperty(response,'url',{value:url});return response}})
 try{await io.read(url);await assert.rejects(io.read(url),error=>error.name==='TimeoutError');assert.equal(calls,1)}finally{io.close()}
})
test('HTTP denial retains observed status and never fabricates an empty company inventory',async()=>{
 const url=fixture.packets[0].requestedURL;let calls=0
 const io=createCurrentReader({requestIntervalMs:0,fetchImpl:async()=>{calls++;const r=new Response('Denied',{status:429,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}})
 try{await assert.rejects(io.read(url),error=>error.httpStatus===429&&error.failureKind==='blocked_or_access_denied');assert.equal(calls,1)}finally{io.close()}
})

test('observed denied HTTP status survives a stalled cancel and an internal request deadline',async()=>{
 const url=fixture.packets[0].requestedURL
 const io=createCurrentReader({requestIntervalMs:0,requestTimeoutMs:10,fetchImpl:async()=>{
  const response=new Response('Denied',{status:429,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:url})
  Object.defineProperty(response.body,'cancel',{value:()=>new Promise(()=>{})})
  return response
 }})
 try{await assert.rejects(io.read(url),error=>error.httpStatus===429&&error.failureKind==='blocked_or_access_denied')}finally{io.close()}
})

test('an uncalled wrapper cannot register the native recruitment factory or controller',()=>{
 const dormant={...original,controller:'function uncalledNativeWrapper(){\n'+original.controller+'\n}'}
 assert.throws(()=>readRelevantProtocol(dormant),/Futurism native/)
})

for(const[name,key,from,to]of[
 ['foreign factory receiver','controller',"angular.module('careersApp').factory('careersFactory'","dummyRecruitmentModule.factory('careersFactory'"],
 ['foreign controller receiver','controller','angular.module(\'careersApp\').controller("careersController"','dummyRecruitmentModule.controller("careersController"'],
 ['foreign encoder receiver','encoder',"encoderApp.factory('encoderFactory'","unrelatedModule.factory('encoderFactory'"],
 ['unrelated created application module','controller',"angular.module('careersApp', __st_global_app_manager.dependencies.careersApp)","angular.module('unrelatedApp', __st_global_app_manager.dependencies.careersApp)"],
])test('native module binding holds '+name,()=>{
 const changed={...original};assert.ok(changed[key].includes(from),'actual native registration substring');changed[key]=changed[key].replace(from,to)
 assert.throws(()=>readRelevantProtocol(changed),/Futurism native/)
})
test('native module binding resolves a lexical encoder module variable rename',()=>{
 const changed={...original,encoder:original.encoder.replace('var encoderApp =','var renamedNativeModule =').replace("encoderApp.factory('encoderFactory'","renamedNativeModule.factory('encoderFactory'")}
 assert.equal(readRelevantProtocol(changed).tenant,'futurismtechnologies')
})
