import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/terminal-denial-20261125.json.gz',import.meta.url))))
const endpoint='https://keyence.darwinbox.in/ms/candidateapi/getCompanyConfig?is_preview=false&companyId=main'
const replay=(change=p=>p)=>{
 const seen=new Map(),reads=[]
 return{reads,options:{fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');reads.push(url)
  const index=seen.get(url)??0;seen.set(url,index+1)
  const original=capture.packets.filter(p=>p.url===url)[index];assert.ok(original,'Only retained current public HTTP observations')
  const p=change(original),headers=new Headers(p.headers)
  for(const name of p.setCookieNames??[])headers.append('set-cookie',name+'=controlled-public-fixture-session; Path=/')
  return Object.defineProperties(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers}),{url:{value:p.finalURL},redirected:{value:p.redirected}})
 }}}
}
test('Keyence genuine terminal native403 retains its HTTP denial after the existing bounded anonymous-session refresh',async()=>{
 const r=replay()
 await assert.rejects(run(r.options),error=>error.httpStatus===403&&error.failureKind==='blocked_or_access_denied'&&error.abortRetries===true&&error.requestedUrl===endpoint&&error.sourceScopeComplete===false&&error.lifecycleCleanupAllowed===false)
 assert.equal(r.reads.filter(url=>url===endpoint).length,2);assert.equal(r.reads.length,40)
})
test('Keyence a nonrefreshable native429 remains one typed denial without another API attempt',async()=>{
 const r=replay(p=>p.url===endpoint?{...p,status:429,headers:{...p.headers,'retry-after':'3'}}:p)
 await assert.rejects(run(r.options),error=>error.httpStatus===429&&error.failureKind==='blocked_or_access_denied'&&error.abortRetries===true)
 assert.equal(r.reads.filter(url=>url===endpoint).length,1)
})
