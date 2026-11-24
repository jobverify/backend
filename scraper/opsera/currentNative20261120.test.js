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
test('registered current six-row client has no native criteria/application and does not guess slug routes',async()=>{
 const {error,requests}=await replay()
 assert.ok(error?.nativeCollectionEvidence,'typed native hold audit is required')
 const a=error.nativeCollectionEvidence
 assert.equal(a.observedRecordCount,6);assert.equal(a.indiaJobs,1);assert.equal(a.eligibleJobs,0);assert.equal(a.closingReconciled,true)
 assert.equal(a.records[0].hold,'native_criteria_and_application_unpublished');assert.equal(a.records[0].country,'India')
 assert.equal(a.companyIndiaTotal,null);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(requests.length,20)
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

test('whole actual client graph retains native metadata without manufacturing slug navigation',async()=>{
 const {readCurrentOpseraPage,readCurrentOpseraClient}=await import('./currentNative20261120.js')
 const page=readCurrentOpseraPage(fixture.responses[0].body),rows=readCurrentOpseraClient(fixture.responses[6].body)
 assert.equal(rows.length,6);assert.equal(rows[0].slug,'devops-evangelist');assert.equal(page.records[0].nativeCountry,'India')
 assert.throws(()=>readCurrentOpseraClient(fixture.responses[6].body+';location.href="/careers/guessed"'),/Unreviewed native application/)
 assert.equal(readCurrentOpseraPage(fixture.responses[0].body.replace('</head>','<script src="/unrelated-style.js"></script></head>')).records.length,6)
})
test('new role and criteria cannot be smuggled into exact declared client model',async()=>{
 const {readCurrentOpseraClient,readCurrentOpseraPage,findCurrentOpseraBindings,bindCurrentOpseraRows}=await import('./currentNative20261120.js')
 const changed=fixture.responses[6].body.replace('DevOps Evangelist','Changed native role')
 assert.equal(readCurrentOpseraClient(changed)[0].title,'Changed native role')
 assert.throws(()=>bindCurrentOpseraRows(readCurrentOpseraPage(fixture.responses[0].body),findCurrentOpseraBindings(changed)[0]),/metadata conflicts/)
})

test('configured original URL denial before redirect preserves actual denial without admitting a foreign URL',async()=>{
 const {error,requests}=await replay({},row=>({...row,status:429,body:'Denied',finalURL:row.requestedURL}))
 assert.equal(error?.status,429);assert.equal(error?.failureKind,'blocked_or_access_denied')
 assert.equal(error?.requestedUrl,'https://www.opsera.io/careers/');assert.equal(requests.length,1)
 const foreign=await replay({},row=>({...row,status:429,body:'Denied',finalURL:'https://unrelated.invalid/careers'}))
 assert.equal(foreign.error?.failureKind,'parser_or_contract_error')
})

test('harmless actual-original non-recruiting style-client edits preserve the literal metadata binding',async()=>{
 const {readCurrentOpseraClient}=await import('./currentNative20261120.js')
 const original=fixture.responses[6].body
 const changed=original.replace('chipCount:"careers-module__zrnIpG__chipCount"','chipCount:"harmless-current-style-change"')
 assert.notEqual(changed,original)
 assert.deepEqual(readCurrentOpseraClient(changed),readCurrentOpseraClient(original))
})
test('harmless newly declared own client URL does not invalidate native SSR role metadata',async()=>{
 const {readCurrentOpseraPage}=await import('./currentNative20261120.js')
 const original=fixture.responses[0].body,changed=original.replaceAll('1w534hvog6gw_.js','current-harmless-client.js')
 assert.notEqual(changed,original)
 assert.equal(readCurrentOpseraPage(changed).records.length,6)
})

test('new application navigation changes the relevant renderer and is held',async()=>{
 const {readCurrentOpseraClient}=await import('./currentNative20261120.js')
 const body=fixture.responses[6].body,changed=body.replace('as:"li",className:n.default.role','as:"li",onClick:()=>location.href="/new-application",className:n.default.role')
 assert.notEqual(changed,body);assert.throws(()=>readCurrentOpseraClient(changed),/renderer\/application behavior/)
})
test('closing harmless style-client delta retains raw inequality but reconciles native metadata',async()=>{
 let visits=0
 const {error}=await replay({},row=>{
  if(row.requestedURL.endsWith('/3pc-vlq0hwuqq.js')&&++visits===2)row.body=row.body.replace('chipCount:"careers-module__zrnIpG__chipCount"','chipCount:"harmless-closing-style"')
  return row
 })
 assert.equal(error?.nativeCollectionEvidence?.closingReconciled,true)
 assert.equal(error?.nativeCollectionEvidence?.rawGlobalEqual,false)
 assert.equal(error?.nativeCollectionEvidence?.eligibleJobs,0)
})
test('closing changed native role remains held even when both SSR and its literal client change consistently',async()=>{
 let pages=0,closing=false
 const {error}=await replay({},row=>{
  if(row.requestedURL==='https://www.opsera.io/careers/'&&++pages===2)closing=true
  if(closing)row.body=row.body.replaceAll('DevOps Evangelist','Changed native role')
  return row
 })
 assert.equal(error?.nativeCollectionEvidence?.closingReconciled,false)
 assert.equal(error?.nativeCollectionEvidence?.eligibleJobs,0)
})

test('harmless role reveal timing change is not a recruitment identity predicate',async()=>{
 const {readCurrentOpseraClient}=await import('./currentNative20261120.js')
 const original=fixture.responses[6].body,changed=original.replace('delay:60*r','delay:75*r')
 assert.notEqual(changed,original);assert.deepEqual(readCurrentOpseraClient(changed),readCurrentOpseraClient(original))
})
