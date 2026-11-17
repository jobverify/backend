import test from 'node:test'
import assert from 'node:assert/strict'
import {run,CAREERS_URL,GLOBAL_JOB_BOARD_URL} from './script.js'

// Controlled legacy-compatible bodies isolate cancellation at each await.
// They are not fixtures proving any current native employer or job inventory.
const careers='<h1>Be a PayUneer</h1><h2>Life at PayU India</h2><h3>Who do we hire? We hire the right tribe</h3><a href="https://corporate.payu.com/job-board/">View all open positions</a>'
const board='<h1>Become a PayUneer</h1><p>Showing 3 of 3 positions</p><span data-type="location">Prague, Czech Republic</span><span data-type="location">Poznan, Poland</span><span data-type="location">Bucharest, Romania</span>'
const page=url=>({status:200,url,html:url===CAREERS_URL?careers:board})
async function rejectsExact(promise,reason){
 let rejected=false
 try{await promise}catch(error){rejected=true;assert.strictEqual(error,reason)}
 assert.equal(rejected,true,'Caller cancellation must reject, never return an empty result')
}

test('PayU caller abort as first legacy careers response resolves stops before the fallback board',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'cancelled-on-first-payu-response'}),requests=[]
 await rejectsExact(run({signal:controller.signal,fetchPage:async(url,options)=>{
  requests.push({url,signalForwarded:options?.signal===controller.signal})
  if(url===CAREERS_URL){controller.abort(reason);return page(url)}
  if(url===GLOBAL_JOB_BOARD_URL)return page(url)
  assert.fail('Unexpected URL')
 }}),reason)
 assert.deepEqual(requests,[{url:CAREERS_URL,signalForwarded:true}]);assert.deepEqual(Reflect.ownKeys(reason),['caller'])
})

for(const[label,reason]of[
 ['frozen object',Object.freeze({cancel:'opaque'})],['string','opaque-cancel'],['zero',0],['false',false],['null',null],['symbol',Symbol('opaque-cancel')],['bigint',2n],
])test('PayU abort on resolved fallback board preserves exact '+label+' reason and forwards the signal',async()=>{
 const controller=new AbortController(),requests=[]
 await rejectsExact(run({signal:controller.signal,fetchPage:async(url,options)=>{
  requests.push({url,signalForwarded:options?.signal===controller.signal});if(url===GLOBAL_JOB_BOARD_URL)controller.abort(reason);return page(url)
 }}),reason)
 assert.deepEqual(requests,[{url:CAREERS_URL,signalForwarded:true},{url:GLOBAL_JOB_BOARD_URL,signalForwarded:true}])
})

for(const stopURL of [CAREERS_URL,GLOBAL_JOB_BOARD_URL])test('PayU caller abort takes precedence over a rejected '+stopURL+' transport',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:stopURL}),requests=[]
 await rejectsExact(run({signal:controller.signal,fetchPage:async(url,options)=>{
  requests.push(url);assert.equal(options.signal,controller.signal)
  if(url===stopURL){controller.abort(reason);throw Error('Transport failed concurrently with cancellation')}
  return page(url)
 }}),reason)
 assert.equal(requests.length,stopURL===CAREERS_URL?1:2);assert.deepEqual(Reflect.ownKeys(reason),['cancel'])
})

test('PayU forwards caller cancellation to an in-flight fallback read',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'in-flight-fallback'});let started
 const began=new Promise(resolve=>{started=resolve})
 const pending=run({signal:controller.signal,fetchPage:async(url,options)=>{
  if(url===CAREERS_URL)return page(url)
  assert.equal(url,GLOBAL_JOB_BOARD_URL);started(options)
  if(!options?.signal)return page(url)
  return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}))
 }})
 const options=await began;controller.abort(reason);await rejectsExact(pending,reason);assert.equal(options?.signal,controller.signal)
})

test('PayU uncancelled fallback transport failures retain their original identity',async()=>{
 const reason=Object.freeze({network:'original-error'})
 await rejectsExact(run({fetchPage:async url=>{if(url===CAREERS_URL)return page(url);throw reason}}),reason)
 assert.deepEqual(Reflect.ownKeys(reason),['network'])
})
