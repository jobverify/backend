import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCurrentTemenosScraper} from './script.js'
import {TEMENOS_CAREERS,TEMENOS_JOBS} from './worksites.js'
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name+'.json.gz',import.meta.url))))
const historical=load('worksites-native-20261103'),media=load('json-media-current-20261107'),denied=media.responses.find(r=>r.status===406),current=media.responses.find(r=>r.status===200),sha=b=>createHash('sha256').update(b).digest('hex')
const currentBytes=Buffer.from(current.bodyBase64,'base64'),deniedBytes=Buffer.from(denied.bodyBase64,'base64'),currentModel=JSON.parse(currentBytes)
assert.equal(sha(currentBytes),current.bodySHA256);assert.equal(sha(deniedBytes),denied.bodySHA256);assert.equal(current.requestedURL,denied.requestedURL)
async function exercise(t,change=()=>null,options={}){
 const calls=[];let targetCalls=0
 const mock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),headers=new Headers(init.headers),method=init.method||'GET',offset=init.body?JSON.parse(init.body).offset:null,extra=url===current.requestedURL&&headers.get('user-agent')==='JobverifyScraper/1.0'
  calls.push({url,method,offset,accept:headers.get('accept'),userAgent:headers.get('user-agent'),redirect:init.redirect,signal:init.signal})
  if(extra){
   targetCalls++;const changed=change({url,init,headers,targetCalls,calls});if(changed)return changed
   const json=headers.get('accept')==='application/json',packet=json?current:denied,response=new Response(json?currentBytes:deniedBytes,{status:packet.status,headers:{'content-type':packet.contentType}});Object.defineProperty(response,'url',{value:url});return response
  }
  const row=historical.responses.find(r=>r.url===url&&(r.method||'GET')===method&&(method!=='POST'||r.requestBody.offset===offset));assert.ok(row,'Only existing genuine historical guard workflow '+url)
  const response=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:url});return response
 })
 try{return{result:await createCurrentTemenosScraper().collect({requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{}},...options}),calls,targetCalls}}
 finally{mock.mock.restore()}
}
const response=(url,{status=200,contentType='application/json',body=currentBytes,finalURL=url}={})=>{const r=new Response(body,{status,headers:{'content-type':contentType}});Object.defineProperty(r,'url',{value:finalURL});return r}

test('current genuine same-endpoint406/200 media comparison closes within the explicitly historical22-role guard workflow',async t=>{
 const {result:r,calls,targetCalls}=await exercise(t)
 assert.equal(targetCalls,2);assert.equal(r.nativeDetails.length,22);assert.equal(r.closingNativeDetails.length,22);assert.equal(r.closingStable,true)
 const opened=r.nativeDetails.find(r=>r.requisitionId==='JR2178'),closed=r.closingNativeDetails.find(r=>r.requisitionId==='JR2178')
 assert.deepEqual(opened.nativePayload,currentModel);assert.deepEqual(closed.nativePayload,currentModel);assert.equal(opened.nativePayload.jobPostingInfo.startDate,'2026-11-02');assert.equal(opened.nativePayload.jobPostingInfo.country.descriptor,'United States of America')
 assert.equal(r.companyGlobalTotal,null);assert.equal(r.companyIndiaTotal,null);assert.equal(r.sourceScopeComplete,false);assert.equal(r.lifecycleCleanupAllowed,false)
 const corporate=calls.filter(c=>c.url===TEMENOS_CAREERS&&c.userAgent==='JobverifyScraper/1.0');assert.equal(corporate.length,2);assert.ok(corporate.every(c=>c.accept==='text/html,application/javascript'&&c.redirect==='manual'))
 assert.ok(calls.filter(c=>c.url===current.requestedURL&&c.userAgent==='JobverifyScraper/1.0').every(c=>c.accept==='application/json'&&c.method==='GET'&&c.redirect==='manual'))
 assert.ok(calls.filter(c=>c.url===TEMENOS_JOBS).every(c=>c.method==='POST'&&c.accept==='application/json'))
})
for(const contentType of ['text/html','text/plain','application/json-seq'])test('native JSON media intent rejects genuine JSON bytes advertised as '+contentType,async t=>{
 await assert.rejects(exercise(t,({url})=>response(url,{contentType})),/JSON MIME/i)
})
for(const status of [403,406,503])test('correct JSON intent preserves actualHTTP'+status+' and starts no later physical read',async t=>{
 let countAtFailure,calls
 await assert.rejects(exercise(t,context=>{calls=context.calls;countAtFailure=calls.length;return response(context.url,{status,contentType:denied.contentType,body:deniedBytes})}),e=>e.status===status&&e.abortRetries===true)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,countAtFailure)
})
test('JSON media intent cannot accept a response from another authority',async t=>{
 await assert.rejects(exercise(t,({url})=>response(url,{finalURL:'https://unrelated.invalid/role'})),/URL identity changed/)
})
for(const [label,mutate] of [
 ['requisition',m=>{m.jobPostingInfo.jobReqId='JR999999'}],
 ['employer',m=>{m.hiringOrganization.name='Unrelated Ltd'}],
 ['native URL',m=>{m.jobPostingInfo.externalUrl='https://unrelated.invalid/role'}],
 ['original date',m=>{m.jobPostingInfo.startDate=''}],
 ['full criteria',m=>{m.jobPostingInfo.jobDescription=''}],
])test('JSON negotiation retains the existing strict native '+label+' guard',async t=>{
 const model=structuredClone(currentModel);mutate(model)
 await assert.rejects(exercise(t,({url})=>response(url,{body:JSON.stringify(model)})),/native detail role, employer, original date or full description binding changed/)
})
test('opaque caller abort during a pending native JSON acquisition remains exact and stops later reads',async t=>{
 const c=new AbortController(),reason=Symbol('native JSON caller');let calls,countAtAbort
 await assert.rejects(exercise(t,context=>{calls=context.calls;countAtAbort=calls.length;queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})},{signal:c.signal}),e=>e===reason)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,countAtAbort)
})
