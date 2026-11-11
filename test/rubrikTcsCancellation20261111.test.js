import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getEventListeners} from 'node:events';
import {setTimeout as nativeTimeout,clearTimeout as nativeClear} from 'node:timers';
import {createRubrikScraper,CAREERS_URL} from '../scraper/rubrik/script.js';
import {createTcsScraper,OFFICIAL_INDIA_CAREERS_URL,CAREER_PAGE_URL,SEARCH_API_URL} from '../scraper/tcs/script.js';

// Actual exports and supported fetchText/fetch injection only. First-request
// responses are authored lifecycle protocols. Deeper TCS paths reuse unchanged
// checked-in captures, with explicitly authored session/pagination envelopes;
// no employer request, invented native capture or inventory claim is made.
const wait=ms=>new Promise(resolve=>nativeTimeout(resolve,ms));
const observe=pending=>{
  const state={settled:false,fulfilled:false,reason:undefined};
  state.done=Promise.resolve(pending).then(value=>{state.settled=true;state.fulfilled=true;state.value=value;},reason=>{state.settled=true;state.reason=reason;});
  return state;
};
const reasons=[['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],
  ['frozen',()=>Object.freeze(Error('Authored caller cancellation'))],['default',()=>AbortSignal.abort().reason]];
const primaries=[...reasons.slice(0,5),['undefined',()=>undefined],['symbol',()=>Symbol('Authored primary')],['error',()=>Error('Authored ordinary primary')]];
const descriptorSnapshot=value=>value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptors(value):null;
function lifecycle(t){
  const handles=new Set(),signals=new Set(),setDescriptor=Object.getOwnPropertyDescriptor(globalThis,'setTimeout'),clearDescriptor=Object.getOwnPropertyDescriptor(globalThis,'clearTimeout');
  globalThis.setTimeout=(fn,ms,...args)=>{let handle;handle=nativeTimeout((...values)=>{handles.delete(handle);fn(...values);},ms,...args);handles.add(handle);return handle;};
  globalThis.clearTimeout=handle=>{handles.delete(handle);return nativeClear(handle);};
  t.after(()=>{Object.defineProperty(globalThis,'setTimeout',setDescriptor);Object.defineProperty(globalThis,'clearTimeout',clearDescriptor);for(const handle of handles)nativeClear(handle);});
  return{signals,verify(caller,reason,before){
    assert.equal(getEventListeners(caller.signal,'abort').length,0,'caller listeners must be released');
    for(const signal of signals)if(signal)assert.equal(getEventListeners(signal,'abort').length,0,'physical-signal listeners must be released');
    assert.equal(handles.size,0,'no new source global timers may remain');
    if(before)assert.deepEqual(Object.getOwnPropertyDescriptors(reason),before);
  }};
}
const exact=(state,reason)=>{assert.equal(state.settled,true);assert.equal(state.fulfilled,false);assert.equal(Object.is(state.reason,reason),true,'exact primary/caller reason must survive');};
const response=url=>({status:200,ok:true,url,headers:{get:()=> 'text/html',getSetCookie:()=>[]}});
const apis=[{name:'Rubrik',run:options=>createRubrikScraper().run(options),option:'fetchText'},
  {name:'TCS',run:options=>createTcsScraper().run(options),option:'fetch',body:'text'}];

for(const api of apis)for(const[kind,makeReason]of reasons){
  test(`${api.name} preabort ${kind} suppresses supported transport`,async t=>{
    const caller=new AbortController(),reason=makeReason(),before=descriptorSnapshot(reason),life=lifecycle(t);caller.abort(reason);let calls=0;
    const state=observe(api.run({signal:caller.signal,[api.option]:()=>{calls++;throw Error('Forbidden preabort producer');}}));
    await state.done;exact(state,reason);assert.equal(calls,0);life.verify(caller,reason,before);
  });
  test(`${api.name} queued ${kind} suppresses transport admission`,async t=>{
    const caller=new AbortController(),reason=makeReason(),before=descriptorSnapshot(reason),life=lifecycle(t);let calls=0,release;
    const opaque=new Promise((_,reject)=>{release=reject;});
    const state=observe(api.run({signal:caller.signal,[api.option]:(_url,options)=>{calls++;life.signals.add(options.signal);return opaque;}}));
    caller.abort(reason);await Promise.race([state.done,wait(30)]);const settledBeforeRelease=state.settled;
    if(calls)release(Error('Authored queued release'));await state.done;await wait(0);
    assert.equal(settledBeforeRelease,true);exact(state,reason);assert.equal(calls,0);life.verify(caller,reason,before);
  });
  for(const stage of ['request',...(api.body?['body']:[])]){
    test(`${api.name} active ${stage} ${kind} settles without producer cooperation`,async t=>{
      const caller=new AbortController(),reason=makeReason(),before=descriptorSnapshot(reason),life=lifecycle(t);let calls=0,bodies=0,start,release;
      const admitted=new Promise(resolve=>{start=resolve;});const opaque=new Promise((_,reject)=>{release=reject;});
      const state=observe(api.run({signal:caller.signal,[api.option]:(url,options)=>{
        calls++;life.signals.add(options.signal);if(stage==='request'){start();return opaque;}
        const value=response(url);value.text=function(){assert.equal(this,value);bodies++;start();return opaque;};return value;
      }}));
      await Promise.race([admitted,wait(100)]);assert.equal(calls,1);if(stage==='body')assert.equal(bodies,1);
      caller.abort(reason);await Promise.race([state.done,wait(30)]);const settledBeforeRelease=state.settled;
      release(Object.freeze(Error('Authored late rejection')));await state.done;await wait(0);
      assert.equal(settledBeforeRelease,true,'caller cancellation must release logical work before opaque producer release');exact(state,reason);
      for(const signal of life.signals){assert.equal(signal.aborted,true);assert.equal(Object.is(signal.reason,reason),true);}
      life.verify(caller,reason,before);
    });
    for(const outcome of ['throw','reject','thenable'])test(`${api.name} synchronous ${stage} abort ${kind} ${outcome} owns work and prefers caller`,async t=>{
      const caller=new AbortController(),reason=makeReason(),before=descriptorSnapshot(reason),life=lifecycle(t);let calls=0,reads=0,bodies=0,assimilated=0;
      const producer=()=>{caller.abort(reason);if(outcome==='throw')throw Error('Authored synchronous replacement');
        if(outcome==='reject')return Promise.reject(Error('Authored synchronous returned rejection'));
        return{then(_resolve,reject){assimilated++;queueMicrotask(()=>reject(Error('Authored returned thenable rejection')));}};};
      const state=observe(api.run({signal:caller.signal,[api.option]:(url,options)=>{
        calls++;life.signals.add(options.signal);if(stage==='request')return producer();
        const value=response(url);Object.defineProperty(value,'text',{get(){reads++;return function(){assert.equal(this,value);bodies++;return producer();};}});return value;
      }}));
      await state.done;await wait(0);exact(state,reason);assert.equal(calls,1);
      if(stage==='body'){assert.equal(reads,1);assert.equal(bodies,1);}if(outcome==='thenable')assert.equal(assimilated,1);
      life.verify(caller,reason,before);
    });
  }
  if(api.body)for(const outcome of ['return-method','throw'])test(`TCS body getter abort ${kind} ${outcome} suppresses method`,async t=>{
    const caller=new AbortController(),reason=makeReason(),before=descriptorSnapshot(reason),life=lifecycle(t);let calls=0,reads=0,bodies=0;
    const state=observe(api.run({signal:caller.signal,fetch:(url,options)=>{
      calls++;life.signals.add(options.signal);const value=response(url);
      Object.defineProperty(value,'text',{get(){reads++;caller.abort(reason);if(outcome==='throw')throw Error('Authored getter replacement');return function(){bodies++;return '';};}});return value;
    }}));await state.done;exact(state,reason);assert.equal(calls,1);assert.equal(reads,1);assert.equal(bodies,0);life.verify(caller,reason,before);
  });
}

for(const api of apis)for(const[primaryKind,makePrimary]of primaries)for(const timing of ['throw','reject'])test(`${api.name} ordinary request ${timing} ${primaryKind} keeps primary`,async t=>{
  const primary=makePrimary(),caller=new AbortController(),life=lifecycle(t);let calls=0;
  const state=observe(api.run({[api.option]:(_url,options)=>{calls++;life.signals.add(options.signal);if(timing==='throw')throw primary;return Promise.reject(primary);}}));
  await state.done;exact(state,primary);assert.equal(calls,1);life.verify(caller,null,null);
});
for(const[primaryKind,makePrimary]of primaries)for(const point of ['getter','method'])test(`TCS ordinary body ${point} ${primaryKind} retains lookup/receiver/error`,async t=>{
  const primary=makePrimary(),caller=new AbortController(),life=lifecycle(t);let reads=0,bodies=0;
  const state=observe(createTcsScraper().run({fetch:(url,options)=>{
    life.signals.add(options.signal);const value=response(url);Object.defineProperty(value,'text',{get(){reads++;if(point==='getter')throw primary;return function(){assert.equal(this,value);bodies++;return Promise.reject(primary);};}});return value;
  }}));await state.done;exact(state,primary);assert.equal(reads,1);assert.equal(bodies,point==='method'?1:0);life.verify(caller,null,null);
});
for(const mode of ['value','promise','thenable'])test(`TCS ordinary body ${mode} reads once and keeps receiver before unchanged native guard`,async t=>{
  const caller=new AbortController(),life=lifecycle(t);let reads=0,bodies=0;
  const state=observe(createTcsScraper().run({fetch:(url,options)=>{
    life.signals.add(options.signal);const value=response(url);Object.defineProperty(value,'text',{get(){reads++;return function(){assert.equal(this,value);bodies++;const body='<title>Authored non-native surface</title>';return mode==='value'?body:mode==='promise'?Promise.resolve(body):{then(resolve){resolve(body);}};};}});return value;
  }}));await state.done;assert.equal(state.fulfilled,false);assert.match(state.reason.message,/handoff|careers|surface/i);assert.equal(reads,1);assert.equal(bodies,1);life.verify(caller,null,null);
});
test('TCS noncallable body method retains TypeError',async()=>{
  const state=observe(createTcsScraper().run({fetch:url=>({...response(url),text:7})}));await state.done;assert.equal(state.reason instanceof TypeError,true);
});

const careers='<title>Careers at Rubrik | Discover the Power of You</title><meta name="description" content="Explore cybersecurity and AI careers at Rubrik."><p>View openings</p>'+Array.from({length:8},(_,index)=>'<a href="/company/careers/departments/authored-'+index+'">Authored '+index+'</a>').join('');
const department='<a href="/company/careers/departments/job.authored-1?reqId=authored-1">Authored role</a>';
for(const stage of ['department','detail'])for(const[kind,makeReason]of reasons)test(`Rubrik ${stage} ${kind} releases admitted waits and stops queued records`,async t=>{
  const caller=new AbortController(),reason=makeReason(),before=descriptorSnapshot(reason),life=lifecycle(t);let calls=0,blocked=0,start;
  const admitted=new Promise(resolve=>{start=resolve;});const releases=[];
  const state=observe(createRubrikScraper({departmentPageConcurrency:2,jobDetailPageConcurrency:2}).run({signal:caller.signal,fetchText:(url,options)=>{
    calls++;assert.equal(options.signal,caller.signal);life.signals.add(options.signal);
    if(url===CAREERS_URL)return careers;
    if(stage==='detail'&&!url.includes('/job.'))return department.replaceAll('authored-1',new URL(url).pathname.split('/').at(-1));
    blocked++;if(blocked===2)start();return new Promise((_,reject)=>releases.push(reject));
  }}));
  await Promise.race([admitted,wait(100)]);assert.equal(blocked,2);caller.abort(reason);
  await Promise.race([state.done,wait(30)]);const settledBeforeRelease=state.settled,callsAtAbort=calls;
  for(const release of releases)release(Error('Authored Rubrik late department/detail rejection'));
  await state.done;await wait(0);assert.equal(settledBeforeRelease,true);exact(state,reason);assert.equal(calls,callsAtAbort);assert.equal(blocked,2);life.verify(caller,reason,before);
});

const fixture=name=>readFileSync(new URL('../scraper-support/tests/fixtures/tcs/'+name,import.meta.url),'utf8');
const publishedPage=JSON.parse(fixture('current-listing-pages.json'))[0];
const corporate=fixture('current-india-careers.html'),shell=fixture('current-app-shell.html'),geographies=fixture('current-geographies.json');
function deeperTcs(life,onDetail,onWorkerShell){
  const calls=[];let shells=0;
  const respond=(url,body,json=false)=>({...response(url),headers:{get:name=>name.toLowerCase()==='x-next-xsrf-token'?'authored-dummy-csrf':json?'application/json':'text/html',getSetCookie:()=>['SESSION=authored-dummy-session; Path=/candidate/next']},text:()=>typeof body==='string'?body:JSON.stringify(body)});
  const fetch=(url,options)=>{
    calls.push({url,options});life.signals.add(options.signal);
    if(url===OFFICIAL_INDIA_CAREERS_URL)return respond(url,corporate);
    if(url===CAREER_PAGE_URL){shells++;if(shells>1&&onWorkerShell)return onWorkerShell(url,options);return respond(url,shell);}
    if(url.endsWith('/api/geographies'))return respond(url,geographies,true);
    if(url.endsWith('/api/candidate'))return respond(url,{result:true,status:200,message:'Authored session protocol'},true);
    if(url===SEARCH_API_URL){
      const payload=structuredClone(publishedPage.payload),content=payload.content.slice(0,4);
      Object.assign(payload,{content,totalElements:4,totalPages:1,number:0,size:10,numberOfElements:4,first:true,last:true,empty:false,pageable:{...payload.pageable,pageNumber:0,pageSize:10,offset:0}});
      return respond(url,{...publishedPage,payload},true);
    }
    if(url.includes('/en-IN/job/desc/'))return onDetail(url,options);
    throw Error('Unexpected authored TCS lifecycle route '+url);
  };
  return{fetch,calls};
}
for(const stage of ['worker-bootstrap','detail'])for(const[kind,makeReason]of reasons)test(`TCS ${stage} ${kind} cancels all workers and suppresses queued details`,async t=>{
  const caller=new AbortController(),reason=makeReason(),before=descriptorSnapshot(reason),life=lifecycle(t);let start,blocked=0;const admitted=new Promise(resolve=>{start=resolve;}),releases=[];
  const block=()=>{blocked++;if(blocked===2)start();return new Promise((_,reject)=>releases.push(reject));};
  const control=deeperTcs(life,block,stage==='worker-bootstrap'?block:undefined);
  const state=observe(createTcsScraper({pageSize:10,detailConcurrency:2}).run({signal:caller.signal,fetch:control.fetch}));
  await Promise.race([admitted,wait(100)]);assert.equal(blocked,2);caller.abort(reason);
  await Promise.race([state.done,wait(30)]);const settledBeforeRelease=state.settled,callsAtAbort=control.calls.length;
  for(const release of releases)release(Error('Authored TCS late worker rejection'));
  await state.done;await wait(0);assert.equal(settledBeforeRelease,true);exact(state,reason);assert.equal(control.calls.length,callsAtAbort);assert.equal(blocked,2);life.verify(caller,reason,before);
});
for(const[primaryKind,makePrimary]of primaries)test(`TCS first ${primaryKind} worker failure releases stalled siblings and retains primary`,async t=>{
  const primary=makePrimary(),caller=new AbortController(),life=lifecycle(t);let start;const admitted=new Promise(resolve=>{start=resolve;}),releases=[];
  const control=deeperTcs(life,()=>new Promise((_,reject)=>{releases.push(reject);if(releases.length===2)start();}));
  const state=observe(createTcsScraper({pageSize:10,detailConcurrency:2}).run({fetch:control.fetch}));
  await Promise.race([admitted,wait(100)]);assert.equal(releases.length,2);releases[1](primary);
  await Promise.race([state.done,wait(30)]);const settledBeforeRelease=state.settled,callsAtFailure=control.calls.length;
  releases[0](Error('Authored stalled worker late rejection'));await state.done;await wait(0);
  assert.equal(settledBeforeRelease,true);exact(state,primary);assert.equal(releases.length,2);assert.equal(control.calls.length,callsAtFailure);life.verify(caller,null,null);
});
for(const[primaryKind,makePrimary]of primaries)test(`TCS settling earlier-index sibling cannot replace captured ${primaryKind} primary`,async t=>{
  const primary=makePrimary(),caller=new AbortController(),life=lifecycle(t);let start;const admitted=new Promise(resolve=>{start=resolve;}),releases=[];
  const control=deeperTcs(life,()=>new Promise((_,reject)=>{releases.push(reject);if(releases.length===2)start();}));
  const state=observe(createTcsScraper({pageSize:10,detailConcurrency:2}).run({fetch:control.fetch}));
  await admitted;releases[1](primary);await wait(0);releases[0](Error('Authored earlier-index sibling failure'));
  await state.done;await wait(0);exact(state,primary);assert.equal(releases.length,2);life.verify(caller,null,null);
});
for(const[kind,makeReason]of reasons)test(`TCS caller ${kind} outranks captured internal worker failure`,async t=>{
  const caller=new AbortController(),reason=makeReason(),before=descriptorSnapshot(reason),life=lifecycle(t);let start;const admitted=new Promise(resolve=>{start=resolve;}),releases=[];
  const control=deeperTcs(life,()=>new Promise((_,reject)=>{releases.push(reject);if(releases.length===2)start();}));
  const state=observe(createTcsScraper({pageSize:10,detailConcurrency:2}).run({signal:caller.signal,fetch:control.fetch}));
  await admitted;releases[1](Error('Authored earlier worker primary'));queueMicrotask(()=>caller.abort(reason));
  await Promise.race([state.done,wait(30)]);const settledBeforeRelease=state.settled;
  releases[0](Error('Authored later worker release'));await state.done;await wait(0);
  assert.equal(settledBeforeRelease,true);exact(state,reason);assert.equal(releases.length,2);life.verify(caller,reason,before);
});
for(const stage of ['request','body'])test(`TCS existing request timeout releases noncooperative ${stage} with exact physical timeout`,async t=>{
  const caller=new AbortController(),life=lifecycle(t);let start,release,physical;
  const admitted=new Promise(resolve=>{start=resolve;}),opaque=new Promise((_,reject)=>{release=reject;});
  const state=observe(createTcsScraper({requestTimeoutMs:20}).run({fetch:(url,options)=>{
    physical=options.signal;life.signals.add(physical);if(stage==='request'){start();return opaque;}
    return{...response(url),text(){start();return opaque;}};
  }}));
  await admitted;await Promise.race([state.done,wait(60)]);const settledBeforeRelease=state.settled;
  release(Error('Authored deadline late rejection'));await state.done;await wait(0);
  assert.equal(settledBeforeRelease,true);assert.equal(physical.aborted,true);assert.equal(physical.reason.name,'TimeoutError');exact(state,physical.reason);life.verify(caller,null,null);
});
