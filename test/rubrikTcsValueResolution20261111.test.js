import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {setTimeout as nativeTimeout} from 'node:timers';
import {createRubrikScraper} from '../scraper/rubrik/script.js';
import {createTcsScraper,OFFICIAL_INDIA_CAREERS_URL} from '../scraper/tcs/script.js';

// Authored supported injection protocols, not publisher observations. These
// values reach the existing native surface guard; no job facts are supplied.
const html='<title>Authored invalid native careers surface</title>';
const wait=()=>new Promise(resolve=>nativeTimeout(resolve,0));
const observe=pending=>{
  const state={fulfilled:false,reason:undefined};
  state.done=Promise.resolve(pending).then(value=>{state.fulfilled=true;state.value=value;},reason=>{state.reason=reason;});
  return state;
};
const descriptors=value=>value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptors(value):null;
const reasons=[['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],['frozen',()=>Object.freeze(Error('Authored caller cancellation'))],['default',()=>AbortSignal.abort().reason]];
function checkListeners(caller,signals){
  assert.equal(getEventListeners(caller.signal,'abort').length,0);
  for(const signal of signals)if(signal)assert.equal(getEventListeners(signal,'abort').length,0);
}
function nativeGuard(state,api,primary){
  assert.equal(state.fulfilled,false);assert.notEqual(state.reason,primary);
  assert.match(state.reason.message,api==='Rubrik'?/Rubrik careers page no longer matches/:/TCS official India careers handoff/);
}
function transfer(mode,value,counters){
  if(mode==='promise')return Promise.resolve(value);
  if(mode==='thenable')return{then(resolve){counters.thenCalls++;resolve(value);}};
  return value;
}
function response(body=html){
  return{status:200,ok:true,url:OFFICIAL_INDIA_CAREERS_URL,headers:{get:()=> 'text/html',getSetCookie:()=>[]},text(){return body;}};
}
function proxy(target){
  return new Proxy(target,{get(object,key){const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;}});
}
const apis=[{name:'Rubrik',models:['plain-object','string-object'],run:options=>createRubrikScraper().run(options),option:'fetchText'},
  {name:'TCS',models:['plain-response','native-response','proxy-response'],run:options=>createTcsScraper().run(options),option:'fetch'}];

for(const api of apis)for(const model of api.models)for(const mode of ['raw','promise','thenable'])for(const failure of ['none','first','second'])test(`ordinary transport ${api.name} ${model} ${mode} then-${failure} preserves one resolution`,async()=>{
  const caller=new AbortController(),signals=new Set(),primary=Object.freeze(Error('Authored transport then lookup primary'));
  const counters={reads:0,bodies:0,thenCalls:0,fetchCalls:0};
  let target=api.name==='Rubrik'?(model==='string-object'?Object(html):{toString:()=>html}):model==='native-response'||model==='proxy-response'?new Response(html,{headers:{'content-type':'text/html'}}):response();
  if(api.name==='TCS'){
    const method=target.text;
    target.text=function(){assert.equal(this,target);counters.bodies++;return Reflect.apply(method,target,[]);};
  }
  Object.defineProperty(target,'then',{get(){counters.reads++;if(failure==='first'||failure==='second'&&counters.reads>1)throw primary;return undefined;}});
  const value=model==='proxy-response'?proxy(target):target;
  const state=observe(api.run({signal:caller.signal,[api.option]:(_url,options)=>{counters.fetchCalls++;signals.add(options.signal);return transfer(mode,value,counters);}}));
  await state.done;await wait();assert.equal(counters.fetchCalls,1);
  if(failure==='first'){assert.equal(state.reason,primary);assert.equal(counters.bodies,0);}
  else{nativeGuard(state,api.name,primary);assert.equal(counters.bodies,api.name==='TCS'?1:0);}
  assert.equal(counters.reads,1,'the successful transport value must have only its original await-resolution lookup');
  assert.equal(counters.thenCalls,mode==='thenable'?1:0);checkListeners(caller,signals);
});

for(const model of ['string-object','proxy-string-object'])for(const mode of ['raw','promise','thenable'])for(const failure of ['none','first','second'])test(`ordinary body TCS ${model} ${mode} then-${failure} preserves original two source resolutions`,async()=>{
  const caller=new AbortController(),signals=new Set(),primary=Object.freeze(Error('Authored body then lookup primary'));
  const counters={reads:0,bodies:0,thenCalls:0,fetchCalls:0,getters:0};
  const target=Object(html);
  Object.defineProperty(target,'then',{get(){counters.reads++;if(failure==='first'||failure==='second'&&counters.reads>1)throw primary;return undefined;}});
  const value=model==='proxy-string-object'?proxy(target):target;
  const state=observe(createTcsScraper().run({signal:caller.signal,fetch:(_url,options)=>{
    counters.fetchCalls++;signals.add(options.signal);const result=response();
    Object.defineProperty(result,'text',{get(){counters.getters++;return function(){assert.equal(this,result);counters.bodies++;return transfer(mode,value,counters);};}});return result;
  }}));
  await state.done;await wait();assert.equal(counters.fetchCalls,1);assert.equal(counters.getters,1);assert.equal(counters.bodies,1);
  if(failure==='none')nativeGuard(state,'TCS',primary);else assert.equal(state.reason,primary);
  // The legacy async public request returns content after its original body
  // await, so successful object content has exactly two observable resolutions.
  assert.equal(counters.reads,failure==='first'?1:2);assert.equal(counters.thenCalls,mode==='thenable'?1:0);checkListeners(caller,signals);
});

for(const api of apis)for(const stage of ['transport',...(api.name==='TCS'?['body']:[])])for(const[kind,makeReason]of reasons)for(const outcome of ['returns-undefined','throws'])test(`value then caller ${api.name} ${stage} ${kind} ${outcome} keeps priority`,async()=>{
  const caller=new AbortController(),reason=makeReason(),before=descriptors(reason),signals=new Set();let reads=0,bodies=0,calls=0;
  const value=api.name==='Rubrik'?{toString:()=>html}:stage==='body'?Object(html):response();
  Object.defineProperty(value,'then',{get(){reads++;caller.abort(reason);if(outcome==='throws')throw Error('Authored getter replacement');return undefined;}});
  const state=observe(api.run({signal:caller.signal,[api.option]:(_url,options)=>{
    calls++;signals.add(options.signal);
    if(stage==='transport')return value;
    const result=response();result.text=function(){assert.equal(this,result);bodies++;return value;};return result;
  }}));
  await state.done;await wait();assert.equal(state.fulfilled,false);assert.equal(Object.is(state.reason,reason),true);
  assert.equal(reads,1);assert.equal(calls,1);assert.equal(bodies,stage==='body'?1:0);
  if(before)assert.deepEqual(Object.getOwnPropertyDescriptors(reason),before);checkListeners(caller,signals);
});
