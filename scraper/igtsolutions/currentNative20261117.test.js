import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
import{currentIgtTransport}from'./currentTransport20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),home='https://atain.com/',careers=home+'careers/',join=home+'join-the-squad/'
function replay(edit=(p,s)=>s){const reads=[],counts=new Map(),read=url=>{const p=fixture.responses.find(p=>p.url===String(url));assert.ok(p,'Only a current employer-declared URL may be read: '+url);const count=(counts.get(url)??0)+1;counts.set(url,count);reads.push(String(url));return{p,s:edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count)}};return{reads,options:{requestIntervalMs:0,fetchPage:async url=>{const{p,s}=read(url);return{url:p.url,status:p.status,html:s}},fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');const{p,s}=read(String(url));return Object.defineProperty(new Response(s,{status:p.status,headers:p.headers}),'url',{value:p.url})}}}}
test('IGT current Atain intake remains unavailable inventory with full form evidence, never a fabricated empty or an unlinked legacy request',async()=>{
 const{reads,options}=replay();await assert.rejects(run(options),error=>{
  assert.equal(error.failureKind,'source_inventory_unavailable');assert.equal(error.abortRetries,true);const e=error.nativeCollectionEvidence
  assert.equal(e.retainedResponses.length,6);assert.equal(e.companyIndiaTotal,null);assert.equal(e.companyGlobalTotal,null);assert.equal(e.observedVacancyCount,null);assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.sourceScopeComplete,false)
  assert.equal(e.closingCurrentIntakeModelMatches,true);assert.equal(e.nativeOpeningModel.nativeApplicationForm.attrs.method,'post');assert.ok(e.nativeOpeningModel.nativeApplicationForm.controls.some(c=>c.attrs.name==='country'))
  assert.equal(e.applicationSubmitted,false);assert.equal(e.roleEmployerBindingsProven,false);assert.equal(e.nativeOpeningModel.pages.length,3);return true
 });assert.deepEqual(reads,[home,careers,join,home,careers,join])
})
test('IGT current closing model retains every generic form control and passive HTML rather than dropping unknown fields',async()=>{
 for(const mode of['form','page']){const{options}=replay((p,s,count)=>count===2&&p.url===join?mode==='form'?s.replace('name="country"','name="country"><option value="New unknown country">New unknown country</option><select name="unknown_current_context"'):s.replace('Recruitment Fraud Awareness','Recruitment Fraud Awareness. Additional current restriction'):s)
  await assert.rejects(run(options),error=>error.failureKind==='parser_or_contract_error',mode)
 }
})
test('IGT current intake authority rejects inert/foreign handoffs and any new executable program, including hidden programs',async()=>{
 for(const mode of['inert','foreign','extra','hidden']){const{options}=replay((p,s)=>p.url===careers?mode==='inert'?s.replaceAll('href="https://atain.com/join-the-squad/"','hidden href="https://atain.com/join-the-squad/"'):mode==='foreign'?s.replaceAll('https://atain.com/join-the-squad/','https://foreign.invalid/join-the-squad/'):s.replace('</body>',`<script${mode==='hidden'?' hidden':''}>window.unreviewedRecruitment=true</script></body>`):s)
  await assert.rejects(run(options),error=>error.failureKind==='parser_or_contract_error',mode)
 }
})
test('IGT native cancellation is owned and an AWS challenge is observed once without a browser or retry',async()=>{
 const caller=new AbortController();caller.abort(Object.freeze({owner:'igt-current'}));let reads=0
 await assert.rejects(run({signal:caller.signal,fetchImpl:async()=>{reads++}}),e=>e===caller.signal.reason);assert.equal(reads,0)
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async url=>{reads++;return Object.defineProperty(new Response(null,{status:202,headers:{'x-amzn-waf-action':'challenge'}}),'url',{value:String(url)})}}),e=>e.httpStatus===202&&e.failureKind==='blocked_or_access_denied');assert.equal(reads,1)
})
test('IGT pacing preserves exact opaque/null/TimeoutError caller ownership and never starts the next request',async()=>{
 for(const reason of[Object.freeze({owner:'igt-pacing'}),null,'deadline']){const controller=new AbortController(),deadline=reason==='deadline'?AbortSignal.timeout(40):null,signal=deadline??controller.signal;let reads=0,timer
  const io=currentIgtTransport({signal,requestIntervalMs:1000,fetchImpl:async()=>{reads++;return Object.defineProperty(new Response('native',{headers:{'content-type':'text/html'}}),'url',{value:home})}})
  try{await io.read(home);if(!deadline)timer=setTimeout(()=>controller.abort(reason),40);await assert.rejects(io.read(home),e=>e===signal.reason);assert.equal(reads,1)}finally{clearTimeout(timer);io.close()}
 }
})
test('IGT checks elapsed source deadline after synchronous fulfillment even before timeout callbacks are serviced',async()=>{
 let reads=0;const io=currentIgtTransport({timeoutMs:10,requestIntervalMs:0,fetchImpl:()=>{reads++;const until=performance.now()+35;while(performance.now()<until){/* Keep timeout callbacks unserviced during fulfillment. */}return Object.defineProperty(new Response('native',{headers:{'content-type':'text/html'}}),'url',{value:home})}})
 try{await assert.rejects(io.read(home),e=>e.name==='TimeoutError'&&e.message==='IGT Solutions current source deadline exceeded');assert.equal(reads,1)}finally{io.close()}
})
test('IGT an observed native denial survives an unserviced local deadline and keeps its actual HTTP status',async()=>{
 let reads=0;const io=currentIgtTransport({timeoutMs:10,requestIntervalMs:0,fetchImpl:()=>{reads++;const until=performance.now()+35;while(performance.now()<until){/* Fulfill with an observed denial before timer callbacks run. */}return Object.defineProperty(new Response('Denied',{status:403,headers:{'content-type':'text/html'}}),'url',{value:home})}})
 try{await assert.rejects(io.read(home),e=>e.httpStatus===403&&e.failureKind==='blocked_or_access_denied');assert.equal(reads,1)}finally{io.close()}
})
test('IGT cleanup preserves a later opaque caller reason over a local read timeout',async()=>{
 const caller=new AbortController(),reason=Object.freeze({owner:'igt-cleanup'});let reads=0
 const io=currentIgtTransport({signal:caller.signal,timeoutMs:10,requestIntervalMs:0,fetchImpl:async()=>{reads++;return Object.defineProperty(new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})}),{headers:{'content-type':'text/html'}}),'url',{value:home})}}),timer=setTimeout(()=>caller.abort(reason),40)
 try{await assert.rejects(io.read(home),e=>e===reason);assert.equal(reads,1)}finally{clearTimeout(timer);io.close()}
})
