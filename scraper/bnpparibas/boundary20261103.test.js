import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
test('BNP registered entry point forwards injected options and stops at the first denied read',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Implicit default HTTP was not authorized in the offline fixture')};let calls=0
 try{await assert.rejects(run({fetchText:async url=>{calls++;throw Object.assign(Error('HTTP 429 for '+url),{status:429,retryDelayMs:45000})}}),error=>error.status===429&&error.abortRetries===true&&error.retryDelayMs===45000&&error.inventoryEvidence.reportedTotal===null);assert.equal(calls,1)}finally{globalThis.fetch=original}
})
