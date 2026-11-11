import assert from 'node:assert/strict'
import test from 'node:test'
import {getEventListeners} from 'node:events'
import {createNativePdfTextContext} from '../scraper-support/shared/nativePdfTextContext20261111.js'

// These are deadline/cancellation controls, not native PDF/source observations.
const reasons=[null,false,0,'',Object.freeze(new Error('Frozen caller reason'))]
for(const reason of reasons){
  test('native PDF context preserves exact pre-aborted reason '+String(reason),()=>{
    const caller=new AbortController();caller.abort(reason)
    assert.throws(()=>createNativePdfTextContext({signal:caller.signal}),value=>Object.is(value,reason))
  })
  test('native PDF context preserves exact in-flight reason '+String(reason),async()=>{
    const caller=new AbortController(),context=createNativePdfTextContext({signal:caller.signal})
    try{
      const pending=context.wait(new Promise(()=>{}));caller.abort(reason)
      await assert.rejects(pending,value=>Object.is(value,reason))
      assert.equal(getEventListeners(context.signal,'abort').length,0)
    }finally{context.close()}
  })
}
test('native PDF context bounds an unresolved asynchronous operation',async()=>{
  const context=createNativePdfTextContext({timeoutMs:5})
  try{await assert.rejects(context.wait(new Promise(()=>{})),error=>error.code==='NATIVE_PDF_TEXT_TIMEOUT')}
  finally{context.close()}
})
test('native PDF elapsed check catches synchronous stalls before accepting output',async()=>{
  const context=createNativePdfTextContext({timeoutMs:2})
  try{
    const until=performance.now()+10;while(performance.now()<until){/* Controlled synchronous overrun. */}
    await assert.rejects(context.wait(Promise.resolve('late output')),error=>error.code==='NATIVE_PDF_TEXT_TIMEOUT')
  }finally{context.close()}
})
test('native PDF context preserves original in-budget errors and detaches wait listeners',async()=>{
  const context=createNativePdfTextContext(),reason=Object.freeze(new Error('Original parser failure'))
  try{
    await assert.rejects(context.wait(Promise.reject(reason)),error=>error===reason)
    assert.equal(getEventListeners(context.signal,'abort').length,0)
    assert.equal(await context.wait(Promise.resolve('value')),'value')
    assert.equal(getEventListeners(context.signal,'abort').length,0)
  }finally{context.close()}
})
test('native PDF context close settles pending operations and is idempotent',async()=>{
  const context=createNativePdfTextContext(),pending=context.wait(new Promise(()=>{}))
  context.close();context.close()
  await assert.rejects(pending,error=>error.code==='NATIVE_PDF_TEXT_CONTEXT_CLOSED')
  assert.equal(getEventListeners(context.signal,'abort').length,0)
})
for(const timeoutMs of [0,-1,NaN,Infinity,1.5,180001])test('native PDF context rejects invalid bounded timeout '+String(timeoutMs),()=>{
  assert.throws(()=>createNativePdfTextContext({timeoutMs}),RangeError)
})
