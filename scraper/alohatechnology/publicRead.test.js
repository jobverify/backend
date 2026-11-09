import test from 'node:test'
import assert from 'node:assert/strict'
import {publicRead,structure} from './publicRead.js'
test('source deadline bounds an ignoring response reader without a caller signal',async()=>{
 await assert.rejects(publicRead({source:'alohatechnology',company:'Aloha Technology'},{collectionBudgetMs:15,fetchImpl:async url=>({status:200,url,text:()=>new Promise(()=>{})})},({read})=>read('https://www.alohatechnology.com/careers.html')),e=>e.code==='PUBLIC_COLLECTION_TIMEOUT')
})
test('original text leaves decode once and inline punctuation/encoded examples survive',()=>{
 const s=structure('<p>Use <strong>Python</strong>, preserve &amp;lt;b&amp;gt; and &copy;.</p>')
 assert.equal(s.text(s.root),'Use Python, preserve &lt;b&gt; and ©.')
})
test('opaque public audit rejection is invoked once and preserved exactly',async()=>{
 const reason={observer:'original'},calls=[]
 await assert.rejects(publicRead({source:'alohatechnology',company:'Aloha Technology'},{onAudit:()=>{calls.push(1);throw reason}},({audit})=>audit({sourceScopeComplete:false})),e=>e===reason);assert.equal(calls.length,1)
})
test('allowed redirects cancel the abandoned body and settle both per-request signals before returning text',async()=>{
 const first='https://www.alohatechnology.com/careers.html',target='https://www.alohatechnology.com/current-careers.html',cancelled=[],requests=[]
 const text=await publicRead({source:'alohatechnology',company:'Aloha Technology'},{fetchImpl:async(url,{signal})=>{
  requests.push({url,signal});return{status:url===first?302:200,url,headers:new Headers(url===first?{location:target}:{}),body:{cancel:async()=>{cancelled.push(url)}},text:async()=>'<p>Complete public response</p>'}
 }},({read})=>read(first,{allowedFinalUrls:[first,target]}))
 assert.equal(text,'<p>Complete public response</p>');assert.deepEqual(requests.map(r=>r.url),[first,target]);assert.ok(cancelled.includes(first));assert.ok(requests.every(r=>r.signal.aborted))
})
test('an unsupported redirect disposes its body without replacing the original boundary error with a cleanup error',async()=>{
 const cleanup={cleanup:'opaque failure'},requests=[];let cancelled=0
 await assert.rejects(publicRead({source:'alohatechnology',company:'Aloha Technology'},{fetchImpl:async(url,{signal})=>{requests.push(signal);return{status:302,url,headers:new Headers({location:'https://unreviewed.example/private'}),body:{cancel:()=>{cancelled++;throw cleanup}}}}},({read})=>read('https://www.alohatechnology.com/careers.html')),e=>e!==cleanup&&e.code==='PUBLIC_NATIVE_CONTRACT'&&/redirect left/.test(e.message))
 assert.equal(requests.length,1);assert.equal(cancelled,1);assert.equal(requests[0].aborted,true)
})
test('wrong-final-URL bodies get bounded cleanup and their producer signal terminates on early rejection',async()=>{
 let signal,cancelled=0;const started=Date.now()
 await assert.rejects(publicRead({source:'alohatechnology',company:'Aloha Technology'},{fetchImpl:async(_url,request)=>{signal=request.signal;return{status:200,url:'https://unreviewed.example/other',body:{cancel:()=>{cancelled++;return new Promise(()=>{})}}}}},({read})=>read('https://www.alohatechnology.com/careers.html')),e=>e.code==='PUBLIC_NATIVE_CONTRACT'&&/URL identity/.test(e.message))
 assert.equal(cancelled,1);assert.equal(signal.aborted,true);assert.ok(Date.now()-started<1500)
})
test('caller abort during abandoned-body cleanup remains the exact opaque cancellation reason',async()=>{
 const c=new AbortController(),reason={abort:'cleanup-caller'};let signal,cancelled=0
 await assert.rejects(publicRead({source:'alohatechnology',company:'Aloha Technology'},{signal:c.signal,fetchImpl:async(_url,r)=>{signal=r.signal;return{status:200,url:'https://unreviewed.example/other',body:{cancel:()=>{cancelled++;c.abort(reason);return new Promise(()=>{})}}}}},({read})=>read('https://www.alohatechnology.com/careers.html')),e=>e===reason)
 assert.equal(cancelled,1);assert.equal(signal.aborted,true)
})
