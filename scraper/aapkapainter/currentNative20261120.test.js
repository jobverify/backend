import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-native20261120.json.gz',import.meta.url))))
export async function replay(options={},mutate=(row)=>row){
 const requests=[],originalFetch=globalThis.fetch
 globalThis.fetch=async(url,init={})=>{
  const row=fixture.responses.find(row=>row.requestedURL===String(url));assert.ok(row,'No unrecorded or guessed network URL: '+String(url))
  requests.push(String(url));const changed=mutate(structuredClone(row),requests.length,init)
  const response=new Response(changed.body,{status:changed.status,headers:changed.headers});Object.defineProperty(response,'url',{value:changed.finalURL});return response
 }
 try{return {jobs:await run(options),requests}}catch(error){return {error,requests}}finally{globalThis.fetch=originalFetch}
}
test('all current original fixture bodies retain their persisted integrity',()=>{
 for(const row of fixture.responses){assert.equal(createHash('sha256').update(row.body).digest('hex'),row.persistedSHA256);assert.equal(Buffer.byteLength(row.body),row.persistedBytes)}
})
test('actual declared widget HTTP504 retains upstream evidence and stops without invented adjacent routes',async()=>{
 const {error,requests}=await replay()
 assert.equal(error?.status,504)
 assert.equal(error?.nativeCollectionEvidence?.closingReconciled,false)
 assert.equal(error?.nativeCollectionEvidence?.sourceScopeComplete,false)
 assert.equal(error?.nativeCollectionEvidence?.lifecycleCleanupAllowed,false)
 assert.equal(error?.nativeCollectionEvidence?.widget?.tenantId,'1476')
 assert.equal(requests.length,3)
})

test('caller entry abort preserves an exact frozen opaque reason with no read',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:'caller-entry'});caller.abort(reason)
 const {error,requests}=await replay({signal:caller.signal})
 assert.equal(error,reason);assert.equal(requests.length,0)
})
test('body-only callbacks cannot certify current HTTP authority',async()=>{
 const {error,requests}=await replay({fetchText:async()=>'<html>not evidence</html>'})
 assert.match(error?.message??'',/metadata|body-only/i);assert.equal(requests.length,0)
})
test('denial is retained and stops at the first configured read',async()=>{
 const {error,requests}=await replay({},row=>({...row,status:403,body:'<title>Access denied</title>'}))
 assert.equal(error?.status,403);assert.equal(error?.failureKind,'blocked_or_access_denied');assert.equal(requests.length,1)
 assert.equal(error?.nativeCollectionEvidence?.closingReconciled,false)
})
test('foreign final URL never receives trusted source authority',async()=>{
 const {error,requests}=await replay({},row=>({...row,finalURL:'https://unrelated.invalid/careers'}))
 assert.equal(error?.failureKind,'parser_or_contract_error');assert.equal(requests.length,1)
})
test('caller abort during pacing preserves opaque reason and prevents next fetch',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:'during-pacing'})
 const {error,requests}=await replay({signal:caller.signal},row=>{setTimeout(()=>caller.abort(reason),30);return row})
 assert.equal(error,reason);assert.equal(requests.length,1)
})
test('caller cancellation triggered by final reader close retains exact ownership',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:'during-close'})
 const {error,requests}=await replay({signal:caller.signal},(row,n,init)=>{
  init.signal.addEventListener('abort',()=>caller.abort(reason),{once:true})
  return {...row,body:'<title>Unreviewed own source</title>'}
 })
 assert.equal(error,reason);assert.ok(requests.length<=2)
})

test('tenant state must be active literal declared native script, not inert text',async()=>{
 const {readCurrentAapkaPainterShell}=await import('./currentNative20261120.js')
 assert.equal(readCurrentAapkaPainterShell(fixture.responses[0].body,fixture.responses[1].body).tenantId,'1476')
 assert.throws(()=>readCurrentAapkaPainterShell(fixture.responses[0].body,fixture.responses[1].body.replace("var USERID = '1476';","function dormant(){var USERID = '1476';}")),/tenant changed/)
 assert.throws(()=>readCurrentAapkaPainterShell(fixture.responses[0].body,fixture.responses[1].body.replace("var USERID = '1476';","var USERID = '9999';")),/tenant changed/)
})
test('ordinary widget server errors keep actual status and never become empty inventory',async()=>{
 const {error,requests}=await replay({},(row,n)=>n===3?{...row,status:503,body:'<title>Unavailable</title>'}:row)
 assert.equal(error?.status,503);assert.equal(error?.failureType,'upstream_unavailable');assert.equal(requests.length,3)
 assert.equal(error?.nativeCollectionEvidence?.indiaJobs,null)
})
