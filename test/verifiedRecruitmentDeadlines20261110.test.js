import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper} from '../scraper-support/utils/verifiedRecruitment.js'

const provider={source:'deadline-regression',companyName:'Example Corporation',companyDomain:'employer.invalid',
 companyCareerPage:'https://employer.invalid/careers'}
const run=options=>createVerifiedRecruitmentScraper(provider).run({sourceTimeoutMs:40,...options})
const never=()=>new Promise(()=>{})
test.beforeEach(t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Deadline regressions must stay offline')))
async function outcome(promise){
 let timer
 try{return await Promise.race([promise.then(value=>({value}),error=>({error})),
  new Promise(resolve=>{timer=setTimeout(()=>resolve({stalled:true}),350)})])}
 finally{clearTimeout(timer)}
}
const raw=(reader,bodyCancel=()=>Promise.resolve())=>({status:200,url:provider.companyCareerPage,
 headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>reader,cancel:bodyCancel}})

for(const transport of ['fetchPage','fetchJson','fetchImpl'])test('source deadline interrupts a stalled '+transport,async()=>{
 let reads=0
 const result=await outcome(run({[transport]:()=>{reads++;return never()},
  ...(transport==='fetchJson'?{fetchPage:async url=>({url,status:200,html:'<h1>Example Corporation</h1><a href="https://jobs.ashbyhq.com/Example">Jobs</a>'})}:{})}))
 assert.equal(result.stalled,undefined,'A source timeout must settle even when transport ignores its signal')
 assert.equal(result.error?.name,'TimeoutError')
 assert.ok(reads>0)
})

test('a stalled native body read is interrupted and cleanup cannot delay the deadline',async()=>{
 let cancellations=0,releases=0
 const result=await outcome(run({fetchImpl:async()=>raw({read:never,
  cancel:()=>{cancellations++;return never()},releaseLock:()=>{releases++}})}))
 assert.equal(result.stalled,undefined,'A body read and its cancel promise must remain bounded')
 assert.equal(result.error?.name,'TimeoutError')
 assert.equal(cancellations,1)
 assert.equal(releases,1)
})

test('successful complete reads do not wait forever for stream cleanup',async()=>{
 let cancellations=0,releases=0
 const result=await outcome(run({fetchImpl:async()=>raw({read:async()=>({done:true}),
  cancel:()=>{cancellations++;return never()},releaseLock:()=>{releases++}})}))
 assert.equal(result.stalled,undefined)
 assert.equal(result.error?.failureKind,'coverage_gap')
 assert.ok(cancellations>0)
 assert.equal(releases,cancellations)
})

test('caller cancellation interrupts a noncooperative transport with the exact reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancelled:true})
 let started
 const ready=new Promise(resolve=>{started=resolve})
 const pending=run({signal:controller.signal,fetchPage:()=>{started();return never()}})
 await ready
 controller.abort(reason)
 const result=await outcome(pending)
 assert.equal(result.stalled,undefined)
 assert.equal(result.error,reason)
})

test('a response arriving after cancellation has its body canceled without an unhandled rejection',async()=>{
 const controller=new AbortController(),reason=Symbol('caller-cancelled')
 let finish,started,canceledWith
 const ready=new Promise(resolve=>{started=resolve})
 const pending=run({signal:controller.signal,fetchImpl:()=>{started();return new Promise(resolve=>{finish=resolve})}})
 await ready
 controller.abort(reason)
 const result=await outcome(pending)
 assert.equal(result.error,reason)
 finish(raw({read:never,releaseLock:()=>{}},value=>{canceledWith=value;return Promise.reject(Error('cleanup rejected'))}))
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(canceledWith,reason)
})
