import test from 'node:test'
import assert from 'node:assert/strict'
for(const source of ['genexspace','yelloskye','manycontradingandcontracting','kathirsudhirautomation'])test(source+' honors caller cancellation before HTTP requests',async()=>{
 const {run}=await import('../../scraper/'+source+'/script.js')
 const reason=Error('cancelled '+source)
 await assert.rejects(run({signal:AbortSignal.abort(reason),fetchText:async()=>{throw Error('Network called')},fetchPage:async()=>{throw Error('Network called')}}),error=>error===reason)
})
