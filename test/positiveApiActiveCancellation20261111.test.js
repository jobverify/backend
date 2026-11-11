import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {setTimeout as nativeTimeout,clearTimeout as nativeClear} from 'node:timers';
import {runNativeFidelity} from '../scraper/fidelity/nativeRun.js';
import {runNativeByteridge} from '../scraper/byteridge/nativeRun.js';
import {runNativeBrainvire} from '../scraper/brainvire/nativeRun.js';
import {runNativeBanyan} from '../scraper/banyansoftware/nativeRun.js';
import {runNativeMonocept} from '../scraper/monocept/nativeRun.js';
import {run as runMoEVing} from '../scraper/moeving/script.js';
import {runNativeLava} from '../scraper/lavainternational/native.js';

// Actual exported readers, authored first-request Promise protocols only.
// No captured publisher response, job, native scope, HTTP or DB is supplied.
const apis=[
  {name:'Fidelity',run:runNativeFidelity,option:'fetchPage'},
  {name:'ByteRidge',run:runNativeByteridge,option:'fetchImpl',method:'text'},
  {name:'Brainvire',run:runNativeBrainvire,option:'fetchImpl',method:'text'},
  {name:'Banyan',run:runNativeBanyan,option:'fetchImpl',method:'text'},
  {name:'Monocept',run:runNativeMonocept,option:'fetchImpl',method:'text'},
  {name:'MoEVing',run:runMoEVing,option:'fetchText'},
  {name:'Lava',run:runNativeLava,option:'fetchImpl',method:'arrayBuffer'},
];
const reasons=[
  ['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],
  ['frozen',()=>Object.freeze(Error('Authored caller cancellation'))],
  ['default',()=>AbortSignal.abort().reason],
  ['mutable-network',()=>Object.assign(Error('ECONNRESET authored caller cancellation'),{code:'ECONNRESET'})],
  ['frozen-network',()=>Object.freeze(Object.assign(Error('ECONNRESET authored caller cancellation'),{code:'ECONNRESET'}))],
];
const wait=ms=>new Promise(resolve=>nativeTimeout(resolve,ms));
const snapshot=value=>value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptors(value):null;
const observe=pending=>{
  const state={settled:false,fulfilled:false,reason:undefined};
  state.done=Promise.resolve(pending).then(value=>{state.settled=true;state.fulfilled=true;state.value=value;},reason=>{state.settled=true;state.reason=reason;});
  return state;
};
const response=url=>({status:200,ok:true,url,headers:{get:()=> 'text/html',getSetCookie:()=>[]}});
function lifecycle(t){
  const handles=new Set(),signals=new Set();
  const setDescriptor=Object.getOwnPropertyDescriptor(globalThis,'setTimeout');
  const clearDescriptor=Object.getOwnPropertyDescriptor(globalThis,'clearTimeout');
  globalThis.setTimeout=(fn,ms,...args)=>{
    let handle;
    handle=nativeTimeout((...values)=>{handles.delete(handle);fn(...values);},ms,...args);
    handles.add(handle);return handle;
  };
  globalThis.clearTimeout=handle=>{handles.delete(handle);return nativeClear(handle);};
  t.after(()=>{
    Object.defineProperty(globalThis,'setTimeout',setDescriptor);
    Object.defineProperty(globalThis,'clearTimeout',clearDescriptor);
    for(const handle of handles)nativeClear(handle);
  });
  return{signals,verify(caller,reason,before){
    assert.equal(getEventListeners(caller.signal,'abort').length,0);
    for(const signal of signals)assert.equal(getEventListeners(signal,'abort').length,0);
    assert.equal(handles.size,0,'source-created global deadline timers must be released');
    if(before)assert.deepEqual(Object.getOwnPropertyDescriptors(reason),before,'caller reason descriptors must not be annotated');
  }};
}
const exact=(state,reason)=>{
  assert.equal(state.settled,true,'logical source cancellation must settle without waiting for the opaque producer');
  assert.equal(state.fulfilled,false);assert.equal(Object.is(state.reason,reason),true,'caller reason identity must survive');
};

for(const api of apis)for(const[kind,makeReason]of reasons){
  test(`${api.name} preabort ${kind} admits no transport`,async t=>{
    const caller=new AbortController(),reason=makeReason(),before=snapshot(reason),life=lifecycle(t);caller.abort(reason);
    let calls=0;
    const state=observe(api.run({signal:caller.signal,[api.option]:()=>{calls++;throw Error('Forbidden preabort work');}}));
    await state.done;exact(state,reason);assert.equal(calls,0);life.verify(caller,reason,before);
  });
  for(const stage of ['request',...(api.method?['body']:[])])test(`${api.name} active ${stage} ${kind} settles and owns late rejection`,async t=>{
    const caller=new AbortController(),reason=makeReason(),before=snapshot(reason),life=lifecycle(t);
    let started,release,calls=0,bodyCalls=0;
    const admitted=new Promise(resolve=>{started=resolve;});
    const pending=new Promise((_,reject)=>{release=reject;});
    const fetchControl=(url,options)=>{
      calls++;life.signals.add(options.signal);
      if(stage==='request'){started();return pending;}
      const value=response(url);value[api.method]=function(){assert.equal(this,value);bodyCalls++;started();return pending;};return value;
    };
    const state=observe(api.run({signal:caller.signal,[api.option]:fetchControl}));
    await Promise.race([admitted,wait(100)]);
    assert.equal(calls,1,'actual supported injection must be admitted once');
    if(stage==='body')assert.equal(bodyCalls,1);
    caller.abort(reason);
    await Promise.race([state.done,wait(30)]);
    const settledBeforeRelease=state.settled;
    release(Object.freeze(Error('Authored late producer rejection')));
    await state.done;await wait(0);
    assert.equal(settledBeforeRelease,true,'cancellation must release a noncooperative wait before it is manually rejected');
    exact(state,reason);
    for(const signal of life.signals){assert.equal(signal.aborted,true);assert.equal(Object.is(signal.reason,reason),true,'transport sees the original caller reason');}
    life.verify(caller,reason,before);
  });
  test(`${api.name} queued ${kind} stops producer before admission`,async t=>{
    const caller=new AbortController(),reason=makeReason(),before=snapshot(reason),life=lifecycle(t);
    let calls=0,release;
    const pending=new Promise((_,reject)=>{release=reject;});
    const state=observe(api.run({signal:caller.signal,[api.option]:(_url,options)=>{calls++;life.signals.add(options.signal);return pending;}}));
    caller.abort(reason);await Promise.race([state.done,wait(30)]);
    if(calls)release(Error('Authored queued producer release'));
    await state.done;await wait(0);exact(state,reason);assert.equal(calls,0,'no new producer may start after the synchronous caller abort');
    life.verify(caller,reason,before);
  });
  if(api.method)for(const outcome of ['returns-method','throws'])test(`${api.name} body getter ${kind} ${outcome} cannot admit body work`,async t=>{
    const caller=new AbortController(),reason=makeReason(),before=snapshot(reason),life=lifecycle(t);
    let calls=0,getters=0,bodies=0;
    const state=observe(api.run({signal:caller.signal,[api.option]:(url,options)=>{
      calls++;life.signals.add(options.signal);const value=response(url);
      Object.defineProperty(value,api.method,{get(){getters++;caller.abort(reason);
        if(outcome==='throws')throw Error('Authored body getter replacement');
        return function(){assert.equal(this,value);bodies++;return '';};
      }});return value;
    }}));
    await state.done;exact(state,reason);assert.equal(calls,1);assert.equal(getters,1);assert.equal(bodies,0);
    life.verify(caller,reason,before);
  });
}

for(const api of apis)for(const timing of ['throw','reject'])for(const primaryKind of ['frozen','mutable-network']){
  test(`${api.name} ordinary ${timing} ${primaryKind} preserves its established failure behavior`,async t=>{
    const primary=primaryKind==='frozen'?Object.freeze(Error('Authored ordinary primary')):Object.assign(Error('ECONNRESET authored ordinary primary'),{code:'ECONNRESET'});
    const caller=new AbortController(),life=lifecycle(t);let calls=0;
    const state=observe(api.run({[api.option]:()=>{calls++;if(timing==='throw')throw primary;return Promise.reject(primary);}}));
    await state.done;assert.equal(calls,1);assert.equal(state.fulfilled,false);
    if(api.name==='MoEVing'){assert.equal(state.reason.code,'MOEVING_COVERAGE_GAP');assert.equal(state.reason.cause,primary);}
    else assert.equal(state.reason,primary);
    if(primaryKind==='mutable-network'&&['ByteRidge','Monocept'].includes(api.name)){
      assert.equal(primary.abortRetries,true);assert.equal(primary.failureKind,'network_or_timeout');
    }
    life.verify(caller,null,null);
  });
  if(api.method&&primaryKind==='frozen')test(`${api.name} ordinary body ${timing} retains receiver and primary`,async t=>{
    const primary=Object.freeze(Error('Authored ordinary body primary')),caller=new AbortController(),life=lifecycle(t);
    let calls=0,getters=0,bodies=0;
    const state=observe(api.run({[api.option]:(url,options)=>{
      calls++;life.signals.add(options.signal);const value=response(url);
      Object.defineProperty(value,api.method,{get(){getters++;return function(){assert.equal(this,value);bodies++;
        if(timing==='throw')throw primary;return Promise.reject(primary);
      };}});return value;
    }}));
    await state.done;assert.equal(state.reason,primary);assert.equal(calls,1);assert.equal(getters,1);assert.equal(bodies,1);life.verify(caller,null,null);
  });
}

for(const stage of ['request','body'])for(const[kind,makeReason]of reasons)test(`Banyan synchronous ${stage} abort ${kind} observes the returned rejecting thenable`,async t=>{
  const caller=new AbortController(),reason=makeReason(),before=snapshot(reason),life=lifecycle(t);let assimilated=0;
  const returned={then(_resolve,reject){assimilated++;queueMicrotask(()=>reject(Error('Authored thenable late rejection')));}};
  const state=observe(runNativeBanyan({signal:caller.signal,fetchImpl:(url,options)=>{
    life.signals.add(options.signal);
    if(stage==='request'){caller.abort(reason);return returned;}
    const value=response(url);value.text=function(){assert.equal(this,value);caller.abort(reason);return returned;};return value;
  }}));
  await state.done;await wait(0);exact(state,reason);assert.equal(assimilated,1,'even already-aborted returned work must have a rejection owner');
  life.verify(caller,reason,before);
});
