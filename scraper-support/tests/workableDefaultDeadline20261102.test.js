import assert from 'node:assert/strict'
import test from 'node:test'
import {setImmediate} from 'node:timers/promises'
import {createWorkablePublicApiScraper} from '../utils/workablePublicApi.js'
import {createEmployerBoundWorkableScraper} from '../utils/workableEmployerInventory.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const flush=async()=>{for(let i=0;i<6;i++)await setImmediate()}
// ALL names, IDs, reciprocal/account/corporate data and zero-row envelopes in
// this diagnostic are SYNTHETIC. They describe no catalog or native employer.
const config=Object.freeze({source:'synthetic-workable-deadline-control',company:'Synthetic Workable Deadline Control',tenant:'synthetic-workable-deadline-control',accountUid:'synthetic-account-uid',careersUrl:'https://synthetic-workable.example/',companyDomain:'synthetic-workable.example',reciprocalWebsiteUrl:'https://synthetic-workable.example/',reconcileClosingInventory:true,boardIdentityVerified:true})
const now=()=> '2026-10-31T12:00:00.000Z'
const urls={page:config.careersUrl,account:'https://apply.workable.com/api/v1/accounts/'+config.tenant,listing:'https://apply.workable.com/api/v3/accounts/'+config.tenant+'/jobs'}
const html='<title>SYNTHETIC Workable Deadline Careers</title><h1>Careers</h1><a href="https://apply.workable.com/'+config.tenant+'/">Careers</a>'
const account={id:1,uid:config.accountUid,subdomain:config.tenant,name:config.company,url:config.reciprocalWebsiteUrl}
const empty={total:0,results:[]}
const observations=[]
const exercise=async(t,{surface,stage})=>{
 const expired=stage!=='healthy',pageTarget=surface==='employer-page',publicEntry=surface==='public-json',targetUrl=publicEntry?urls.listing:pageTarget?urls.page:urls.account,timeoutMs=pageTarget?25000:30000
 const timeout=new AbortController(),started=defer(),gate=defer(),reason=Object.freeze(Object.assign(new Error('CONTROLLED '+surface+' local request deadline'),{name:'TimeoutError'}))
 const originalTimeout=AbortSignal.timeout
 const timeoutCalls=[],calls=[],semantic={status:0,url:0,bodyStarts:0}
 let targetSelected=false,settled=false,pending,result
 const timeoutMock=t.mock.method(AbortSignal,'timeout',ms=>{timeoutCalls.push(ms);return ms===timeoutMs?timeout.signal:originalTimeout(ms)})
 const fetchMock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input);assert.ok(Object.values(urls).includes(url),'No unmodeled request: '+url)
  const isTarget=url===targetUrl&&!targetSelected;if(isTarget)targetSelected=true
  calls.push({url,method:init.method||'GET',requestSignal:init.signal,afterOwnAbort:timeout.signal.aborted,isTarget})
  const payload=url===urls.page?html:url===urls.account?account:empty
  const read=async()=>{if(isTarget&&timeout.signal.aborted)semantic.bodyStarts++;if(expired&&stage==='body'&&isTarget){started.resolve();return gate.promise}return structuredClone(payload)}
  const response={get status(){if(isTarget&&timeout.signal.aborted)semantic.status++;return 200},get url(){if(isTarget&&timeout.signal.aborted)semantic.url++;return url},headers:{get:()=>url===urls.page?'text/html':'application/json'},text:read,json:read,body:{cancel:async()=>{}}}
  if(expired&&stage==='headers'&&isTarget){started.resolve();return gate.promise}
  return response
 })
 try{
  const scraper=publicEntry?createWorkablePublicApiScraper(config):createEmployerBoundWorkableScraper(config)
  pending=scraper.run({now}).then(jobs=>{settled=true;return{rejected:false,jobs}},error=>{settled=true;return{rejected:true,error}})
  let retainedOwnedWait=null,targetSignalAborted=null
  if(expired){
   await started.promise;timeout.abort(reason);await flush();retainedOwnedWait=settled===false
   assert.equal(retainedOwnedWait,true,'Keep direct ownership until the actual read settles; no prompt race required')
   targetSignalAborted=calls.find(c=>c.isTarget).requestSignal.aborted
   assert.equal(targetSignalAborted,true)
   if(stage==='headers'){
    const payload=targetUrl===urls.page?html:targetUrl===urls.account?account:empty
    gate.resolve({get status(){semantic.status++;return 200},get url(){semantic.url++;return targetUrl},headers:{get:()=>pageTarget?'text/html':'application/json'},text:async()=>{semantic.bodyStarts++;return structuredClone(payload)},json:async()=>{semantic.bodyStarts++;return structuredClone(payload)},body:{cancel:async()=>{}}})
   }else gate.resolve(structuredClone(targetUrl===urls.page?html:targetUrl===urls.account?account:empty))
  }
  result=await pending
  const evidence=readInventoryEvidence(result.jobs),targetIndex=calls.findIndex(c=>c.isTarget)
  const row={surface,stage,timeoutMs,retainedOwnedWait,targetSignalAborted,rejected:result.rejected,exactReason:result.error===reason,returnedJobs:result.jobs?.length??null,emptySuccess:Array.isArray(result.jobs)&&result.jobs.length===0,evidence,lateTargetSemanticReads:semantic,laterUrls:calls.slice(targetIndex+1).map(c=>c.url),allUrls:calls.map(c=>c.url),timeoutCalls,syntheticOnly:true}
  observations.push(row)
  if(expired){assert.equal(result.rejected,true,'An expired local default request cannot establish inventory authority');assert.equal(result.error,reason);assert.equal(result.jobs,undefined);assert.equal(row.laterUrls.length,0)}
  else{assert.equal(result.rejected,false);assert.equal(result.jobs.length,0);assert.equal(evidence.status,'verified-empty');assert.equal(evidence.listingComplete,true);assert.equal(evidence.reportedTotal,0)}
 }finally{gate.resolve();if(pending)await pending;fetchMock.mock.restore();timeoutMock.mock.restore()}
}
for(const surface of ['public-json','employer-page','employer-json'])for(const stage of ['healthy','headers','body'])test('Workable existing '+surface+' / '+stage+' local-deadline validity',{timeout:5000,concurrency:false},async t=>exercise(t,{surface,stage}))
test.after(()=>console.log('WORKABLE_DEFAULT_DEADLINE_OBSERVATIONS '+JSON.stringify(observations)))

// Synthetic transport controls only. No case supplies native employer facts.
const abortInput = kind => {
 let reads=0
 const trap=Object.freeze(new Error('Opaque caller getter must not be read'))
 const reason=kind==='Error'?Object.freeze(new Error('controlled caller')):kind==='null'?null:kind==='zero'?0:kind==='false'?false:kind==='empty'?''
  :Object.freeze(Object.defineProperties(Object.create(null),Object.fromEntries(['message','name','code','cause','abortRetries'].map(key=>[key,{get(){reads++;throw trap}}]))))
 return{reason,reads:()=>reads}
}
const bounded = async(promise,ms=60)=>{let timer;try{return await Promise.race([promise.then(value=>({settled:true,value})),new Promise(resolve=>{timer=setTimeout(()=>resolve({settled:false}),ms)})])}finally{clearTimeout(timer)}}
const defaultTransportFixture = (t,{surface,stage='headers',caller=new AbortController(),dispose='immediate',ordinary=null})=>{
 const publicEntry=surface==='public-json',pageTarget=surface==='employer-page',targetURL=publicEntry?urls.listing:pageTarget?urls.page:urls.account
 const targetMs=pageTarget?25000:30000,deadline=new AbortController(),started=defer(),gate=defer(),cancelStarted=defer(),cancelGate=defer()
 cancelGate.promise.catch(()=>{})
 const timeoutCalls=[],calls=[]
 let selected=false,settled=false,pending,semanticReads=0,cancels=0
 const originalTimeout=AbortSignal.timeout
 const timeoutMock=t.mock.method(AbortSignal,'timeout',ms=>{timeoutCalls.push(ms);return ms===targetMs?deadline.signal:originalTimeout(ms)})
 const payload=targetURL===urls.page?html:targetURL===urls.account?account:empty
 const late=()=>deadline.signal.aborted||caller.signal.aborted
 const read=async()=>{if(late())semanticReads++;started.resolve();return stage==='body'?gate.promise:structuredClone(payload)}
 const response={get status(){if(late())semanticReads++;return 200},get url(){if(late())semanticReads++;return targetURL},headers:{get:()=>pageTarget?'text/html':'application/json'},text:read,json:read,
  body:{cancel(){cancels++;cancelStarted.resolve();return dispose==='pending'?cancelGate.promise:Promise.resolve()}}}
 const fetchMock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input);assert.ok(Object.values(urls).includes(url),'No unmodeled default request: '+url)
  const target=url===targetURL&&!selected;if(target)selected=true
  calls.push({url,signal:init.signal,target})
  if(target){if(ordinary)throw ordinary;if(stage==='headers'){started.resolve();return gate.promise}return response}
  const value=url===urls.page?html:url===urls.account?account:empty
  return{status:200,url,headers:{get:()=>url===urls.page?'text/html':'application/json'},text:async()=>structuredClone(value),json:async()=>structuredClone(value),body:{cancel:async()=>{}}}
 })
 const start=()=>{
  const scraper=publicEntry?createWorkablePublicApiScraper(config):createEmployerBoundWorkableScraper(config)
  pending=scraper.run({now,signal:caller.signal}).then(jobs=>{settled=true;return{rejected:false,jobs}},error=>{settled=true;return{rejected:true,error}})
  return pending
 }
 const drain=()=>gate.resolve(stage==='headers'?response:structuredClone(payload))
 const finish=async()=>{drain();cancelGate.resolve();if(pending)await pending;fetchMock.mock.restore();timeoutMock.mock.restore()}
 return{caller,deadline,started,gate,cancelStarted,cancelGate,response,start,drain,finish,targetMs,timeoutCalls,calls,
  get settled(){return settled},get semanticReads(){return semanticReads},get cancels(){return cancels},
  get laterCalls(){const index=calls.findIndex(row=>row.target);return calls.slice(index+1)}}
}

for(const surface of ['public-json','employer-page','employer-json'])for(const stage of ['headers','body']){
 test(`Workable default ${surface}/${stage} caller reasons are exact and cannot start late semantic reads`,{timeout:5000,concurrency:false},async t=>{
  for(const kind of ['Error','null','zero','false','empty','opaque']){
   const item=abortInput(kind),fixture=defaultTransportFixture(t,{surface,stage})
   const pending=fixture.start()
   try{
    await fixture.started.promise;fixture.caller.abort(item.reason);await flush()
    assert.equal(fixture.settled,false,'Direct native read stays owned until actual settlement')
    fixture.drain();const outcome=await pending
    assert.equal(outcome.rejected,true);assert.equal(outcome.error,item.reason);assert.equal(item.reads(),0)
    assert.equal(fixture.semanticReads,0);assert.equal(fixture.cancels,1);assert.equal(fixture.laterCalls.length,0)
    assert.ok(fixture.timeoutCalls.includes(fixture.targetMs))
   }finally{await fixture.finish()}
  }
 })
}

for(const surface of ['public-json','employer-page','employer-json']){
 test(`Workable default ${surface} pre-abort starts no request for any caller reason`,{timeout:5000,concurrency:false},async t=>{
  for(const kind of ['Error','null','zero','false','empty','opaque']){
   const item=abortInput(kind),caller=new AbortController();caller.abort(item.reason)
   const fixture=defaultTransportFixture(t,{surface,caller})
   try{const outcome=await fixture.start();assert.equal(outcome.rejected,true);assert.equal(outcome.error,item.reason);assert.equal(item.reads(),0);assert.equal(fixture.calls.length,0)}
   finally{await fixture.finish()}
  }
 })
}

for(const [surface,kind] of [['public-json','null'],['employer-page','zero'],['employer-json','opaque']])for(const disposal of ['fulfilled','rejected']){
 test(`Workable default ${surface}/${disposal} disposal remains owned and later caller abort outranks own deadline`,{timeout:5000,concurrency:false},async t=>{
  const item=abortInput(kind),fixture=defaultTransportFixture(t,{surface,dispose:'pending'})
  const pending=fixture.start(),ownReason=Object.freeze(Object.assign(new Error('controlled original own deadline'),{name:'TimeoutError'}))
  try{
   await fixture.started.promise;fixture.deadline.abort(ownReason);await flush();assert.equal(fixture.settled,false)
   fixture.drain()
   const disposing=await bounded(fixture.cancelStarted.promise),held=fixture.settled
   fixture.caller.abort(item.reason)
   if(disposal==='rejected')fixture.cancelGate.reject(Object.freeze(new Error('controlled disposal failure')))
   else fixture.cancelGate.resolve()
   const outcome=await pending
   assert.equal(disposing.settled,true);assert.equal(held,false,'Cancellation/disposal must settle before the direct source releases ownership')
   assert.equal(outcome.rejected,true);assert.equal(outcome.error,item.reason);assert.equal(item.reads(),0)
   assert.equal(fixture.cancels,1);assert.equal(fixture.semanticReads,0);assert.equal(fixture.laterCalls.length,0)
  }finally{await fixture.finish()}
 })
}

for(const surface of ['public-json','employer-page','employer-json']){
 test(`Workable default ${surface} rejected native body restores original own timeout without retry`,{timeout:5000,concurrency:false},async t=>{
  const fixture=defaultTransportFixture(t,{surface,stage:'body'}),pending=fixture.start()
  const reason=Object.freeze(Object.assign(new Error('controlled frozen own deadline'),{name:'TimeoutError'}))
  try{
   await fixture.started.promise;fixture.deadline.abort(reason);await flush();assert.equal(fixture.settled,false)
   fixture.gate.reject(new Error('replacement native body rejection'))
   const outcome=await pending
   assert.equal(outcome.rejected,true);assert.equal(outcome.error,reason);assert.equal(fixture.laterCalls.length,0);assert.equal(fixture.cancels,1)
  }finally{await fixture.finish()}
 })
 test(`Workable default ${surface} ordinary noncaller transport failure retains exact error`,{timeout:5000,concurrency:false},async t=>{
  const ordinary=Object.freeze(new Error('controlled ordinary transport error'))
  const fixture=defaultTransportFixture(t,{surface,ordinary})
  try{const outcome=await fixture.start();assert.equal(outcome.rejected,true);assert.equal(outcome.error,ordinary);assert.equal(fixture.cancels,0);assert.equal(fixture.laterCalls.length,0)}
  finally{await fixture.finish()}
 })
}
