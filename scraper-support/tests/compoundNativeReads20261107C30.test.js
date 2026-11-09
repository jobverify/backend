import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setImmediate as flush} from 'node:timers/promises'
import {withNativeRuntimeControls} from '../native-sources/declaredGreenhouse/runtimeControls.js'
import {createCurrentGreenhouseScraper} from '../../scraper/buildkite/currentNative.js'
import {createBiofourmisScraper} from '../../scraper/biofourmis/native.js'
import {HOME,GENERAL,CLINICAL,LOADER,BOARD,API} from '../../scraper/biofourmis/publicInventory.js'

// Offline timing controls. Delays and the two explicitly marked JSON envelopes
// are artificial; retained public entities keep their original capture dates.
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const outcome=p=>p.then(value=>({value}),error=>({error}))
const advance=async(t,ms)=>{t.mock.timers.tick(ms);await flush()}
const runtime=(options,collect)=>withNativeRuntimeControls({}, {}, options, collect)

for(const [budget,count] of [[45000,2],[120000,5]])test('compound hook permits '+count+' separately completed 10-second reads',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 let completed=0
 const pending=outcome(runtime({nativeReadTimeoutMs:budget},async(_options,controls)=>controls.read(async()=>{
  for(let i=0;i<count;i++){await delay(10000);completed++}
  return completed
 })))
 await flush();for(let i=0;i<count;i++)await advance(t,10000)
 const result=await pending;assert.ifError(result.error);assert.equal(result.value,count)
})

for(const [label,options,ms] of [['default',{},15000],['explicit',{nativeReadTimeoutMs:1000},1000]])test(label+' logical read deadline aborts an ignored callback and blocks later reads',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 let finish,calls=0,observed,result
 const controller=new AbortController()
 const gate=new Promise(resolve=>{finish=resolve})
 const pending=outcome(runtime({...options,signal:controller.signal},async(options,controls)=>{
  observed=options.signal
  return controls.read(async()=>{calls++;await gate;return controls.read(()=>{calls++;return 'late'})})
 })).then(value=>{result=value;return value})
 await flush();await advance(t,ms+1)
 const deadlineError=result?.error,wasAborted=observed.aborted
 controller.abort(Error('Test cleanup'));finish();await pending;await flush()
 assert.match(deadlineError?.message||'Deadline did not fire',/native read deadline/);assert.equal(wasAborted,true);assert.equal(calls,1)
})

test('a compound read budget does not extend the 15-second audit deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const pending=outcome(runtime({nativeReadTimeoutMs:120000},async(_options,controls)=>controls.audit(()=>new Promise(()=>{}))))
 await flush();await advance(t,15001);assert.match((await pending).error.message,/native audit deadline/)
})

for(const value of [0,-1,120001,Infinity,NaN,'45000',null,1.5])test('invalid compound read budget '+String(value)+' fails before starting work',async()=>{
 let calls=0
 await assert.rejects(runtime({nativeReadTimeoutMs:value},()=>{calls++;return []}),error=>error instanceof RangeError&&/read.*deadline|read.*budget|read.*timeout/i.test(error.message))
 assert.equal(calls,0)
})

test('compound controls preserve caller cancellation identity and callback failure identity',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const controller=new AbortController(),reason={opaque:'caller'},failure=Error('original callback failure')
 const pending=outcome(runtime({nativeReadTimeoutMs:120000,signal:controller.signal},async(_options,controls)=>controls.read(()=>new Promise(()=>{}))))
 await flush();controller.abort(reason);assert.equal((await pending).error,reason)
 await assert.rejects(runtime({nativeReadTimeoutMs:45000},async(_options,controls)=>controls.read(()=>{throw failure})),error=>error===failure)
})

for(const source of ['buildkite','tripadvisor'])test(source+' current source hook completes multiple bounded requests beyond 15 seconds',async t=>{
 const f=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/'+source+'/test-data/native-current-20261103.json.gz',import.meta.url))))
 const pages=new Map(f.responses.map(row=>[row.url,row])),calls=[]
 t.mock.timers.enable({apis:['setTimeout']})
 const count=source==='buildkite'?2:3
 const pending=outcome(createCurrentGreenhouseScraper(source).run({fetchPage:async url=>{
  calls.push(url);if(calls.length<=count)await delay(10000)
  const r=pages.get(url);assert.ok(r,'Original captured entity '+url)
  return {url:r.finalUrl,status:r.status,headers:r.headers,bodyBase64:r.bodyBase64}
 }}))
 await flush();for(let i=0;i<count;i++)await advance(t,10000)
 const result=await pending;assert.ifError(result.error)
 assert.ok(result.value.sourceAudit.observations.length>0);assert.equal(result.value.sourceAudit.sourceSnapshots[0].qualified,true)
 assert.equal(result.value.sourceAudit.sourceScopeComplete,false)
})

test('Biofourmis completes its five-read hook without treating a clinical 404 as a source zero',async t=>{
 const captured=name=>{
  const base=new URL('../../scraper/biofourmis/native-captures/'+name,import.meta.url)
  const r=JSON.parse(readFileSync(new URL(base.href+'.json')))
  const suffix=name.includes('current-')||name.includes('homepage-')?'.html':'.txt'
  return {url:r.url||r.requestedUrl,status:r.status,headers:r.headers,requestedAt:r.requestedAt,completedAt:r.completedAt,
   bodyBase64:readFileSync(new URL(base.href+suffix)).toString('base64')}
 }
 const syntheticEnvelope=(url,value)=>({url,status:200,headers:{'content-type':'application/json'},
  requestedAt:'2026-11-01T01:05:40.000Z',completedAt:'2026-11-01T01:05:41.000Z',bodyBase64:Buffer.from(JSON.stringify(value)).toString('base64')})
 const pages=new Map([[HOME,captured('biofourmis-homepage-20261101')],[GENERAL,captured('biofourmis-current-20261101')],
  [CLINICAL,captured('biofourmis-clinical-20261101')],[LOADER,captured('biofourmis-careers-loader-20261101')],
  [BOARD,captured('biofourmis-native-board-20261101')],[API+'/jobs?content=true',captured('biofourmis-native-20261101')],
  [API+'/departments/',captured('biofourmis-departments-20261101')],
  [API,syntheticEnvelope(API,{name:'Biofourmis'})],[API+'/offices',syntheticEnvelope(API+'/offices',{offices:[]})]])
 const calls=[];t.mock.timers.enable({apis:['setTimeout']})
 const pending=outcome(createBiofourmisScraper().run({now:()=> '2026-11-01T02:00:00.000Z',fetchPage:async url=>{
  calls.push(url);if(calls.length<=5)await delay(10000)
  assert.ok(pages.has(url),'Retained capture or labelled transport envelope '+url);return structuredClone(pages.get(url))
 }}))
 await flush();for(let i=0;i<5;i++)await advance(t,10000)
 const result=await pending;assert.ifError(result.error);assert.deepEqual(calls.slice(0,5),[GENERAL,HOME,CLINICAL,BOARD,LOADER])
 assert.equal(result.value.sourceAudit.publicInventoryProof.complete,false)
 assert.equal(result.value.sourceAudit.sourceScopeComplete,false)
 assert.ok(result.value.sourceAudit.publicInventoryProof.failures.some(row=>row.code==='ADVERTISED_CAREERS_UNAVAILABLE'))
})

for(const source of ['buildkite','tripadvisor','biofourmis'])test(source+' physical deadline still stops the second request inside a longer hook',async t=>{
 const f=source==='biofourmis'?null:JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/'+source+'/test-data/native-current-20261103.json.gz',import.meta.url))))
 const originals=new Map(f?.responses.map(row=>[row.url,row])||[])
 const primary=source==='biofourmis'?{
  url:GENERAL,status:200,headers:{'content-type':'text/html'},
  bodyBase64:readFileSync(new URL('../../scraper/biofourmis/native-captures/biofourmis-current-20261101.html',import.meta.url)).toString('base64')
 }:null
 const calls=[],signals=[];let finish,result
 t.mock.timers.enable({apis:['setTimeout']})
 const scraper=source==='biofourmis'?createBiofourmisScraper():createCurrentGreenhouseScraper(source)
 const pending=outcome(scraper.run({fetchPage:async(url,{signal})=>{
  calls.push(url);signals.push(signal)
  if(calls.length===1){await delay(10000);const r=originals.get(url);return primary||{url:r.finalUrl,status:r.status,headers:r.headers,bodyBase64:r.bodyBase64}}
  return new Promise(resolve=>{finish=()=>resolve({url,status:200,headers:{},bodyBase64:Buffer.from('Late artificial timing control').toString('base64')})})
 }})).then(value=>{result=value;return value})
 await flush();await advance(t,10000);assert.equal(calls.length,2)
 await advance(t,14999);assert.equal(result,undefined)
 await advance(t,2);assert.match((await pending).error.message,/native read deadline/)
 finish();await flush();assert.equal(calls.length,2);assert.ok(signals.every(signal=>signal.aborted))
})

for(const source of ['buildkite','tripadvisor','biofourmis'])for(const stage of ['fetch','body'])test(source+' bounds an uncooperative native '+stage+' wait',async t=>{
 let observedSignal,cancelled=false
 t.mock.timers.enable({apis:['setTimeout']})
 const scraper=source==='biofourmis'?createBiofourmisScraper():createCurrentGreenhouseScraper(source)
 const pending=outcome(scraper.run({fetchImpl:async(url,{signal})=>{
  observedSignal=signal
  if(stage==='fetch')return new Promise(()=>{})
  return {url,status:200,headers:new Headers(),arrayBuffer:()=>new Promise(()=>{}),
   body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancelled=true},releaseLock:()=>{}})}}
 }}))
 await flush();await advance(t,15001)
 assert.match((await pending).error.message,/native read deadline/);assert.equal(observedSignal.aborted,true)
 if(source==='biofourmis'&&stage==='body')assert.equal(cancelled,true)
})
