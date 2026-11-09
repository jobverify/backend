import test from 'node:test'
import assert from 'node:assert/strict'
import {createSkyscannerScraper} from './script.js'
test('Skyscanner retains the supplied429Retry-After while withholding native board calls',async()=>{
 let nativeCalls=0
 await assert.rejects(createSkyscannerScraper().run({fetchPage:async url=>({url,status:429,headers:{'retry-after':'60'},html:'Rate limited'}),fetchJson:()=>{nativeCalls++;throw Error('Cannot substitute for employer binding')}}),error=>error.status===429&&error.retryDelayMs===60000&&error.failureKind==='public_access_denied')
 assert.equal(nativeCalls,0)
})
test('default Skyscanner recognizes a declared CAPTCHA redirect without following or reading it',async()=>{
 let calls=0,bodies=0
 await assert.rejects(createSkyscannerScraper().run({fetchImpl:async url=>{calls++;return{url,status:302,headers:new Headers({location:'/sttc/px/captcha-v2/index.html?url=controlled'}),body:{cancel:async()=>{}},text:async()=>{bodies++;return'Challenge'}}}}),error=>error.status===302&&error.abortRetries===true&&error.failureKind==='public_access_denied')
 assert.equal(calls,1);assert.equal(bodies,0)
})
