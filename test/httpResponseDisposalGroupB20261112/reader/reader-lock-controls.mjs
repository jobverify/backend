import assert from 'node:assert/strict'
import test,{after} from 'node:test'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {backend,RealResponse,RealReadableStream,denyFetch,requestFailure,readAllowed,hash,finishGuard} from './guard.mjs'

// Root review follow-up only: retain actual standard readers and their Response
// bodies. The getReader observer forwards its exact receiver/arguments; actual
// read, cancel and releaseLock methods are never replaced.
const source=await import(pathToFileURL(path.join(backend,'scraper/optum/currentNative.js')))
const observations=[]
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}}
const reflect=value=>Promise.resolve(value).then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const bounded=async pending=>{let timer;try{return await Promise.race([pending,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('Reader ownership control exceeded1800ms')),1800)})])}finally{clearTimeout(timer)}}
const retained=response=>{
 const record={response,reader:null,getReaderCalls:0},getReader=response.body.getReader
 Object.defineProperty(response.body,'getReader',{value:function(...args){record.getReaderCalls++;record.reader=Reflect.apply(getReader,this,args);return record.reader}})
 return record
}
const response=(url,body,row={})=>{const value=new RealResponse(body,{status:row.status||200,headers:{'content-type':row.contentType||'text/html'}});Object.defineProperty(value,'url',{value:url});return value}
for(const mode of ['completed-cancel','pending-cancel-timeout'])await test('Optum releases its actual reader lock after early budget '+mode,async()=>{
 const entered=deferred(),release=deferred();let cancels=0,record,calls=0
 const stream=new RealReadableStream({start(controller){controller.enqueue(new Uint8Array(4*1024*1024+1))},cancel(){cancels++;entered.resolve();if(mode==='pending-cancel-timeout')return release.promise}})
 globalThis.fetch=async url=>{calls++;assert.equal(String(url),source.CAREER_PAGE_URL);record=retained(response(String(url),stream));return record.response}
 const started=performance.now(),pending=reflect(source.createOptumScraper({maxPages:1,maxJobs:1}).run())
 try{
  await bounded(entered.promise);const result=await bounded(pending)
  assert.equal(result.ok,false);assert.match(result.reason.message,/response-byte-budget/);assert.equal(cancels,1);assert.equal(calls,1)
  assert.ok(record.reader instanceof ReadableStreamDefaultReader);assert.equal(record.getReaderCalls,1)
  observations.push({mode,authored:true,elapsedMs:Math.round(performance.now()-started),bodyLocked:record.response.body.locked,actualReader:true,cancels,calls,primaryMessage:result.reason.message})
  assert.equal(record.response.body.locked,false,'Source must release its owned reader after bounded cancellation settles or expires')
 }finally{release.resolve();await bounded(pending);globalThis.fetch=denyFetch}
})
await test('Optum successful unchanged fixture EOF releases every owned actual reader',async()=>{
 const fixture=JSON.parse(gunzipSync(readAllowed('scraper/optum/test-data/native-current-20261107.json.gz'))),rows=[...fixture.listings,fixture.detail],records=[]
 globalThis.fetch=async url=>{const row=rows.find(row=>row.requestUrl===String(url));if(!row)return requestFailure(url);assert.equal(hash(Buffer.from(row.body)),row.sha256);const record=retained(response(row.url||String(url),row.body,row));records.push(record);return record.response}
 try{
  const jobs=await source.createOptumScraper({maxPages:1,maxJobs:1}).run({now:()=>fixture.capturedAt})
  assert.equal(jobs.length,1);assert.equal(records.length,4);assert.ok(records.every(record=>record.reader instanceof ReadableStreamDefaultReader&&record.getReaderCalls===1))
  observations.push({mode:'genuine-fixture-EOF',authored:false,retainedFixtureOnly:true,roles:jobs.length,requests:records.length,lockedBodies:records.filter(record=>record.response.body.locked).length})
  assert.ok(records.every(record=>record.response.body.locked===false),'EOF must release every reader owned by defaultFetchPage')
 }finally{globalThis.fetch=denyFetch}
})
after(()=>console.log('HTTP_DISPOSAL_OPTUM_READER '+JSON.stringify({...finishGuard(),observations,publisherProgramsExecuted:0})))
