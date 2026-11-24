import test from 'node:test'
import assert from 'node:assert/strict'
import {runCurrentJasperProgramme} from './currentProgramme.js'
globalThis.fetch=()=>assert.fail('Caller audit controls forbid publisher HTTP')
for(const kind of ['native-error','dom-exception'])test('exact extensible '+kind+' caller retains genuinely acquired prefix audit',async()=>{
 const caller=new AbortController(),reason=kind==='native-error'?new Error('Controlled cancellation'):new DOMException('Controlled cancellation','AbortError')
 const body=Buffer.alloc(128,65)
 let reads=0,cancels=0,error
 try{await runCurrentJasperProgramme({signal:caller.signal,requestIntervalMs:0,fetchImpl:async()=>({
  url:'https://www.jasper.ai/careers',status:200,headers:new Headers({'content-type':'text/html; charset=utf-8','content-encoding':'gzip'}),
  body:{getReader(){return{async read(){if(++reads===1)return{done:false,value:body};caller.abort(reason);throw reason},async cancel(){cancels++}}}}
 })})}catch(caught){error=caught}
 assert.equal(error,reason)
 assert.equal(cancels,1)
 assert.equal(error.nativeCollectionEvidence?.rawPages[0].bodyBytes,128)
 assert.equal(error.nativeCollectionEvidence.rawPages[0].status,200)
 assert.equal(error.nativeCollectionEvidence.rawPages[0].bodyBase64,body.toString('base64'))
 assert.equal(error.nativeCollectionEvidence.currentTransactionQualified,false)
 assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(Object.isFrozen(error.nativeCollectionEvidence),true)
})
