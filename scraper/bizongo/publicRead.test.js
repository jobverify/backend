import test from 'node:test'
import assert from 'node:assert/strict'
import {publicRead} from './publicRead.js'
test('ordinary Response body streams are consumed through text under the active deadline',async()=>{
 const text=await publicRead({source:'bizongo',company:'Bizongo'},{fetchImpl:async url=>({status:200,url,body:new ReadableStream(),text:async()=>'<p>Public corporate text</p>'})},({read})=>read('https://bizongo.com/careers'))
 assert.equal(text,'<p>Public corporate text</p>')
})
test('default collection deadline settles an ignoring reader without a caller signal',async()=>{
 await assert.rejects(publicRead({source:'bizongo',company:'Bizongo'},{collectionBudgetMs:15,fetchImpl:()=>new Promise(()=>{})},({read})=>read('https://bizongo.com/careers')),e=>e.code==='PUBLIC_COLLECTION_TIMEOUT')
})
test('opaque observer rejection is delivered once unchanged',async()=>{
 const reason={observer:'opaque'},calls=[]
 await assert.rejects(publicRead({source:'bizongo',company:'Bizongo'},{onAudit:()=>{calls.push(1);throw reason}},({audit})=>audit({sourceScopeComplete:false})),e=>e===reason);assert.equal(calls.length,1)
})
test('denial stops without a second public request',async()=>{
 let calls=0;await assert.rejects(publicRead({source:'bizongo',company:'Bizongo'},{fetchImpl:async()=>{calls++;return{status:403}}},({read})=>read('https://bizongo.com/careers')),e=>e.status===403);assert.equal(calls,1)
})
