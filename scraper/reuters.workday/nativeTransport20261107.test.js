import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {createReutersReader} from './nativeTransport.js'

const URL='https://www.thomsonreuters.com/en/careers'
const API='https://thomsonreuters.wd5.myworkdayjobs.com/wday/cxs/thomsonreuters/External_Career_Site/jobs'
const sha=b=>createHash('sha256').update(b).digest('hex')
const response=(url,body='original response',{status=200,mime='text/html',headers={}}={})=>{
 const value=new Response(body,{status,headers:{'content-type':mime,...headers}})
 Object.defineProperty(value,'url',{value:url});return value
}
function reader(fetchImpl,options={}){
 const r=createReutersReader({fetchImpl,...options});r.grant(URL,{method:'GET',finalURL:URL,mime:'html'});return r
}

test('declared GET retains exact original UTF8 bytes/hash, request identity, headers and authority',async()=>{
 const text='Original \u00a0 criteria\n\uFEFF retained',basis={kind:'corporate-declared-careers'}
 const r=createReutersReader({fetchImpl:async(url,init)=>{
  assert.equal(url,URL);assert.equal(init.method,'GET');assert.equal(init.redirect,'follow');assert.equal(init.credentials,'omit')
  assert.equal(init.body,undefined);assert.equal(init.referrerPolicy,undefined);assert.equal(init.cache,undefined)
  assert.deepEqual(init.headers,{accept:'text/html','user-agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'})
  assert.ok(init.signal instanceof AbortSignal);return response(url,text)
 }})
 try{
  r.grant(URL,{method:'GET',finalURL:URL,mime:'html',authorityBasis:basis})
  const page=await r.read(URL);assert.equal(page.html,text);assert.equal(page.bodySHA256,sha(text));assert.equal(page.bodyBytes,Buffer.byteLength(text))
  assert.equal(r.receipts.length,1);assert.equal(r.receipts[0].body,text);assert.equal(r.receipts[0].bodyUnavailable,false)
  assert.deepEqual(r.receipts[0].authorityBasis,basis);assert.equal(r.receipts[0].headers['set-cookie'],undefined)
 }finally{r.close()}
})

test('native JSON POST uses only the declared method and exact original serialized body',async()=>{
 const body=JSON.stringify({appliedFacets:{Location_Country:['published-id']},limit:20,offset:0,searchText:''})
 let calls=0;const r=createReutersReader({fetchImpl:async(url,init)=>{
  calls++;assert.equal(url,API);assert.equal(init.method,'POST');assert.equal(init.body,body)
  assert.deepEqual(init.headers,{accept:'application/json','user-agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)','content-type':'application/json'})
  return response(url,'{"total":8}',{mime:'application/json'})
 }})
 try{
  r.grant(API,{method:'POST',finalURL:API,mime:'json'})
  const page=await r.read(API,{method:'POST',body});assert.equal(page.html,'{"total":8}');assert.equal(calls,1)
  assert.equal(r.receipts[0].requestBodySHA256,sha(body));assert.equal(r.receipts[0].requestBodyBytes,Buffer.byteLength(body))
 }finally{r.close()}
})

test('an exact declared current-client alias may redirect only to its pinned final program URL',async()=>{
 const requested='https://wd5.myworkdaycdn.com/wday/asset/candidate-experience-jobs/cx-jobs.min.js'
 const final='https://wd5.myworkdaycdn.com/wday/asset/candidate-experience-jobs/2026.44.13/cx-jobs.min.js'
 const r=createReutersReader({fetchImpl:async(_,init)=>{assert.equal(init.headers.accept,'text/html');return response(final,'/* current original program data */',{mime:'application/javascript'})}})
 try{r.grant(requested,{method:'GET',finalURL:final,mime:'javascript'});assert.equal((await r.read(requested)).url,final)}finally{r.close()}
})

for(const [label,operation]of[
 ['ungranted URL',r=>r.read('https://unrelated.invalid/jobs')],
 ['ungranted method',r=>r.read(URL,{method:'POST',body:'{}'})],
 ['GET body',r=>r.read(URL,{body:'{}'})],
 ['changed grant',r=>r.grant(URL,{method:'GET',finalURL:URL+'/different',mime:'html'})],
])test('no network for '+label,async()=>{
 let calls=0;const r=reader(async()=>{calls++;throw Error('Must not fetch')})
 try{await assert.rejects(async()=>operation(r),/grant|GET|method|body|authority/i);assert.equal(calls,0)}finally{r.close()}
})

for(const [label,modify]of[
 ['unexpected final authority',()=>response('https://unrelated.invalid/','original')],
 ['wrong response MIME',()=>response(URL,'original',{mime:'application/json'})],
 ['declared body cap',()=>response(URL,'original',{headers:{'content-length':'4000001'}})],
])test('rejects '+label+' without alternate reads',async()=>{
 let calls=0;const r=reader(async()=>{calls++;return modify()})
 try{await assert.rejects(r.read(URL));assert.equal(calls,1);assert.equal(r.receipts.length,1);assert.equal(r.receipts[0].bodyUnavailable,true)}finally{r.close()}
})

test('observed original403 completed body remains numeric denial with full original body',async()=>{
 const r=reader(async()=>response(URL,'Original denied body',{status:403}))
 try{await assert.rejects(r.read(URL),e=>e.status===403&&e.statusCode===403&&e.failureKind==='blocked_or_access_denied'&&e.upstreamOutage===true&&e.requestUrl===URL)
  assert.equal(r.receipts[0].body,'Original denied body');assert.equal(r.receipts[0].bodySHA256,sha('Original denied body'))
 }finally{r.close()}
})

for(const status of [200,403])test('original'+status+' failed stream preserves cause and observed status without invented bytes',async()=>{
 const original=Error('Original stream failed');let cancels=0,releases=0
 const r=reader(async()=>({status,url:URL,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{
  read:async()=>{throw original},cancel:()=>{cancels++;return new Promise(()=>{})},releaseLock(){releases++}
 }}}}))
 try{await assert.rejects(r.read(URL),e=>status===200?e.cause===original:e.status===403&&e.cause===original&&e.upstreamOutage===true)
  assert.equal(cancels,1);assert.equal(releases,1);assert.equal(r.receipts[0].bodyBytes,null);assert.equal(r.receipts[0].bodySHA256,null)
 }finally{r.close()}
})

for(const reason of [Object.freeze({opaque:'caller'}),Symbol('caller'),null,0,''])test('opaque caller reason survives ignored pending headers: '+String(reason),async()=>{
 const caller=new AbortController();let began
 const started=new Promise(resolve=>{began=resolve}),r=reader(async()=>{began();return new Promise(()=>{})},{signal:caller.signal})
 try{const pending=r.read(URL);await started;caller.abort(reason);await assert.rejects(pending,e=>e===reason)}finally{r.close()}
})

for(const label of ['null-prototype reason','throwing-coercion reason'])test('caller cancellation never coerces '+label,async()=>{
 let coercions=0
 const reason=label==='null-prototype reason'?Object.freeze(Object.create(null)):Object.freeze({toString(){coercions++;throw Error('Caller coercion must not execute')}})
 const caller=new AbortController();let began
 const started=new Promise(resolve=>{began=resolve}),r=reader(async()=>{began();return new Promise(()=>{})},{signal:caller.signal})
 try{
  const pending=r.read(URL);await started;caller.abort(reason)
  let rejected=false
  try{await pending}catch(error){rejected=true;assert.equal(error,reason)}
  assert.equal(rejected,true);assert.equal(coercions,0)
  assert.equal(r.receipts[0].failureMessage,'Caller cancelled native request')
 }finally{r.close()}
})

test('known403 stalled body preserves request deadline, source URL and bounded cancellation',async()=>{
 const r=reader(async()=>({status:403,url:URL,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{
  read:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{}),releaseLock(){}
 }}}}),{requestTimeoutMs:20,sourceTimeoutMs:1000})
 try{await assert.rejects(r.read(URL),e=>e.status===403&&e.requestUrl===URL&&e.upstreamOutage===true&&e.cause?.name==='TimeoutError'&&/request deadline/.test(e.cause.message))}
 finally{r.close()}
})

test('caller abort after403 body starts wins over denial and ignores hanging cleanup',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:'body caller'});let began
 const started=new Promise(resolve=>{began=resolve}),r=reader(async()=>({status:403,url:URL,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{
  read:()=>{began();return new Promise(()=>{})},cancel:()=>new Promise(()=>{}),releaseLock(){}
 }}}}),{signal:caller.signal})
 try{const pending=r.read(URL);await started;caller.abort(reason);await assert.rejects(pending,e=>e===reason)}finally{r.close()}
})

test('late fetch is cancelled once after request timeout and cannot cause another network read',async()=>{
 let finish,cancels=0,calls=0
 const r=reader(async()=>{calls++;return new Promise(resolve=>{finish=resolve})},{requestTimeoutMs:20})
 try{
  await assert.rejects(r.read(URL),e=>e.name==='TimeoutError'&&/request deadline/.test(e.message))
  finish({status:200,url:URL,headers:new Headers({'content-type':'text/html'}),body:{cancel(){cancels++;return new Promise(()=>{})}}})
  await new Promise(resolve=>setImmediate(resolve));assert.equal(cancels,1)
  await assert.rejects(r.read(URL));assert.equal(calls,1)
 }finally{r.close()}
})

test('monotonic source deadline catches a synchronous transport that blocks timers',async()=>{
 const r=reader(async()=>{const until=performance.now()+35;while(performance.now()<until){}return response(URL)},{sourceTimeoutMs:20,requestTimeoutMs:100})
 try{await assert.rejects(r.read(URL),e=>e.name==='TimeoutError'&&/source deadline/.test(e.message))}finally{r.close()}
})

test('streamed and aggregate byte limits bound original data before any subsequent request',async()=>{
 for(const options of [{responseBytes:5},{aggregateBytes:5}]){
  let calls=0;const r=reader(async()=>{calls++;return response(URL,'123456')},options)
  try{await assert.rejects(r.read(URL),/byte|limit|bound/i);await assert.rejects(r.read(URL));assert.equal(calls,1);assert.equal(r.receipts[0].bodySHA256,null)}finally{r.close()}
 }
})

test('request bound prevents an extra fetch and close prevents every future read',async()=>{
 let calls=0;const r=reader(async()=>{calls++;return response(URL)},{maxRequests:1})
 try{await r.read(URL);await assert.rejects(r.read(URL),/request.*bound|request.*limit/i);assert.equal(calls,1)}finally{r.close()}
 await assert.rejects(r.read(URL));assert.equal(calls,1)
})

test('invalid UTF8 retains complete original raw bytes instead of replacement characters',async()=>{
 const bytes=Uint8Array.from([0x80,0xff]),r=reader(async()=>response(URL,bytes))
 try{await assert.rejects(r.read(URL));assert.equal(r.receipts[0].bodyBytes,2);assert.equal(r.receipts[0].bodySHA256,sha(bytes));assert.equal(r.receipts[0].originalBodyBase64,Buffer.from(bytes).toString('base64'))}
 finally{r.close()}
})

test('invalid transport status is retained as shape evidence and never becomes an invented HTTP code',async()=>{
 const r=reader(async()=>({status:0,url:URL,headers:new Headers({'content-type':'text/html'}),body:null}))
 try{await assert.rejects(r.read(URL),e=>e.failureKind==='coverage_gap'&&e.status===undefined)
  assert.equal(r.receipts[0].status,null);assert.equal(r.receipts[0].observedInvalidStatus,0)
 }finally{r.close()}
})

test('declared native POST can preserve the original strict redirect error policy',async()=>{
 const r=createReutersReader({fetchImpl:async(url,init)=>{assert.equal(init.redirect,'error');return response(url,'{"total":8}',{mime:'application/json'})}})
 try{
  r.grant(API,{method:'POST',finalURL:API,mime:'json',redirect:'error'})
  await r.read(API,{method:'POST',body:'{"appliedFacets":{}}'})
  assert.equal(r.receipts[0].redirect,'error')
 }finally{r.close()}
})
