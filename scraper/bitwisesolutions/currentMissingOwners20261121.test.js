import test from 'node:test'
import assert from 'node:assert/strict'
import {createBitwiseSolutionsScraper} from './script.js'
import {networkFences,originalPacket,replay} from './fixtures/currentReplay20261121.js'

test('original opening packet without critical namespace owner Responses cannot establish publication',async t=>{
 const restore=networkFences();t.after(restore);const transport=replay(),saved=transport.fetchImpl;let missing=0
 const fetchImpl=async(url,init)=>{
  if(!originalPacket.records.some(r=>r.method===(init.method??'GET')&&r.requestedUrl===String(url))){
   missing++;const response=new Response('Declared owner unavailable',{status:503,headers:{'content-type':'application/javascript'}})
   Object.defineProperties(response,{url:{value:String(url)},redirected:{value:false}});return response
  }
  return saved(url,init)
 }
 let jobs,error;try{jobs=await createBitwiseSolutionsScraper().run({fetchImpl,requestIntervalMs:0,now:()=>originalPacket.completedAt})}catch(caught){if(caught.code==='ERR_ASSERTION')throw caught;error=caught}
 assert.ok(error&&missing>0&&!jobs,'Ownerless packet must hold after actually acquiring the own source chain; publishing the old three partials is unsafe')
 assert.ok(transport.calls.length>=4)
})
