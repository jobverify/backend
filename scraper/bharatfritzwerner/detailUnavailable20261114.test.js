import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261114/current-native.json.gz',import.meta.url))))
const roleURL=url=>url.startsWith('https://bfwindia.com/careers/')&&url!=='https://bfwindia.com/careers/'
const replay=(change=page=>page)=>{
 const calls=[]
 return{calls,fetchPage:async url=>{
  calls.push(url)
  const response=fixture.responses.find(row=>row.requestedUrl===url)
  assert.ok(response,'Unexpected first-party route '+url)
  const page={status:response.status,url:response.url,html:fixture.entities[response.sha256]}
  return roleURL(url)?change(page,url):page
 }}
}

test('actual five native linked detail 404s retain HTTP evidence and cannot establish an empty inventory',async()=>{
 const io=replay()
 await assert.rejects(run({fetchPage:io.fetchPage}),error=>{
  assert.equal(error.code,'BFW_NATIVE_DETAIL_HTTP404')
  assert.equal(error.status,404)
  assert.equal(error.softFailure,true)
  assert.equal(error.abortRetries,true)
  assert.equal(error.sourceScopeComplete,false)
  assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(roleURL(error.requestUrl),true)
  const audit=error.recruitmentObservations
  assert.equal(audit.source,'bharatfritzwerner')
  assert.equal(audit.nativeDetailResponse.status,404)
  assert.equal(audit.nativeDetailResponse.requestedUrl,error.requestUrl)
  const row=fixture.responses.find(row=>row.requestedUrl===error.requestUrl)
  assert.equal(audit.nativeDetailResponse.bodySHA256,row.sha256)
  assert.equal(audit.nativeDetailResponse.bodyBytes,Buffer.byteLength(fixture.entities[row.sha256]))
  assert.equal(audit.companyIndiaZeroProven,false)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(error.inventoryEvidence,undefined)
  return true
 })
 assert.equal(io.calls.filter(roleURL).length,5)
})

for(const status of[200,403,500,'404'])test(`native detail status ${typeof status} ${status} does not fabricate an exact HTTP404 error`,async()=>{
 const io=replay(page=>({...page,status}))
 await assert.rejects(run({fetchPage:io.fetchPage}),error=>{
  assert.notEqual(error.code,'BFW_NATIVE_DETAIL_HTTP404')
  assert.match(error.message,/detail page no longer matches/)
  return true
 })
})

test('a detail HTTP404 cannot qualify even if its body gains old valid marker strings',async()=>{
 const io=replay(page=>({...page,html:'<title>Role - Bharat Fritz Werner (BFW) India</title><main>Apply for this position<form class="elementor-form"><input type="file">Apply now</form></main>'}))
 await assert.rejects(run({fetchPage:io.fetchPage}),error=>error.status===404&&error.code==='BFW_NATIVE_DETAIL_HTTP404')
})
