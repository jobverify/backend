import assert from 'node:assert/strict'
import test from 'node:test'
import {createCurrentReader} from './currentRead20261117.js'
const URL='https://pletratechnologiesindiapvtltd.com/'
const response=(status,{url=URL,headers={},body='original'}={})=>{const r=new Response(body,{status,headers:{'content-type':'text/html',...headers}});Object.defineProperty(r,'url',{value:url});return r}
test('observed429/202 challenge survives stalled denied-body disposal and a20ms request bound',async()=>{
 for(const [status,headers]of [[429,{}],[202,{'x-amzn-waf-action':'challenge'}],[403,{}]]){
  let consumed=0;const io=createCurrentReader({requestIntervalMs:0,requestTimeoutMs:20,fetchImpl:async()=>({status,url:URL,headers:new Headers({'content-type':'text/html',...headers}),body:{cancel:()=>new Promise(()=>{}),getReader(){consumed++;throw Error('denied entity must not be consumed')}}})},[[URL,'html']])
  try{await assert.rejects(io.read(URL),error=>error.status===status&&error.failureKind==='blocked_or_access_denied');assert.equal(consumed,0);assert.equal(io.stats().receipts[0].status,status);assert.equal(io.stats().receipts[0].bodyComplete,false)}finally{io.close()}
 }
})
test('foreign original identity and pending202 retain their distinct hard/soft HTTP boundaries',async()=>{
 for(const [value,expected]of [[response(403,{url:'https://example.org/'}),false],[response(202),true]]){
  const io=createCurrentReader({requestIntervalMs:0,fetchImpl:async()=>value},[[URL,'html']])
  try{await assert.rejects(io.read(URL),error=>error.softFailure===expected&&error.status===value.status)}finally{io.close()}
 }
})
test('request body deadline never becomes an empty entity; frozen caller owns stalled read cancellation',async()=>{
 for(const cancel of [false,true]){
  const caller=new AbortController(),reason=Object.freeze({owner:'pletratechnologiesindiapvtltd'}),io=createCurrentReader({signal:caller.signal,requestIntervalMs:0,requestTimeoutMs:20,fetchImpl:async()=>({status:200,url:URL,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{}),releaseLock(){}})}})},[[URL,'html']])
  const timer=cancel?setTimeout(()=>caller.abort(reason),5):null
  try{await assert.rejects(io.read(URL),error=>cancel?error===reason:error.name==='TimeoutError');assert.equal(io.stats().receipts[0].bodyComplete,false)}finally{clearTimeout(timer);io.close()}
 }
})
test('source pacing preserves local deadline and opaque caller ownership without another fetch',async()=>{
 for(const cancel of [false,true]){
  const caller=new AbortController(),reason=Object.freeze({owner:'pletratechnologiesindiapvtltd-pacing'});let reads=0
  const io=createCurrentReader({signal:caller.signal,sourceTimeoutMs:cancel?1000:30,requestIntervalMs:100,fetchImpl:async()=>{reads++;return response(200)}},[[URL,'html']])
  let timer
  try{await io.read(URL);if(cancel)timer=setTimeout(()=>caller.abort(reason),5);await assert.rejects(io.read(URL),error=>cancel?error===reason:error.name==='TimeoutError'&&error.message.includes('source deadline'));assert.equal(reads,1)}finally{clearTimeout(timer);io.close()}
 }
})
test('wrong MIME, malformed UTF8 and an unbound redirect do not qualify a publisher',async()=>{
 for(const value of [response(200,{headers:{'content-type':'application/json'}}),response(200,{body:new Uint8Array([0xc3,0x28])}),response(302,{headers:{location:'https://example.org/'}})]){
  const io=createCurrentReader({requestIntervalMs:0,fetchImpl:async()=>value},[[URL,'html']])
  try{await assert.rejects(io.read(URL))}finally{io.close()}
 }
})

