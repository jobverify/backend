import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAdityaBirlaGroupScraper } from './script.js'
import { readBirlaNativeJobs } from './nativeJobs.js'
const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const searchHtml=captures.find(row=>row.requestedUrl==='https://careers.adityabirla.com/job-search').html
const read=async url=>{
  if(url.endsWith('/api/v3/organisations'))return JSON.stringify({status:200,data:[]})
  if(url.includes('/api/v3/jobs?'))return JSON.stringify({status:200,count:0,totalJobs:0,data:[]})
  const found=captures.findLast(row=>row.requestedUrl===url)
  assert.ok(found,'unexpected public request '+url)
  return found.html
}
const observeSettlement=async promise=>{
  let timer
  try{return await Promise.race([promise.then(value=>({value}),reason=>({reason})),new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),150)})])}
  finally{clearTimeout(timer)}
}

test('caller abort settles an injected public reader that ignores its signal', async()=>{
  const controller=new AbortController(),reason={opaque:'caller cancelled public read'}
  const result=await observeSettlement(createAdityaBirlaGroupScraper().run({signal:controller.signal,fetchText:(_url,options)=>{
    assert.equal(options.signal,controller.signal);controller.abort(reason);return new Promise(()=>{})
  }}))
  assert.equal(result.reason,reason)
})

test('caller abort settles an audit observer that ignores its signal with the exact opaque reason',async()=>{
  const controller=new AbortController(),reason={opaque:'caller cancelled native observation'};let calls=0
  const result=await observeSettlement(readBirlaNativeJobs({read,searchHtml,signal:controller.signal,onAudit:()=>{
    calls++;controller.abort(reason);return new Promise(()=>{})
  }}))
  assert.equal(result.reason,reason)
  assert.equal(calls,1)
})

test('a rejected audit observer propagates once with its exact original reason',async()=>{
  const controller=new AbortController(),reason={opaque:'audit observer rejected'};let calls=0
  await assert.rejects(readBirlaNativeJobs({read,searchHtml,signal:controller.signal,onAudit:async()=>{calls++;throw reason}}),error=>error===reason)
  assert.equal(calls,1)
  assert.equal(controller.signal.aborted,false)
})
