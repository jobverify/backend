import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {readCurrentHpclDocument} from './currentDocuments20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url)))),pdf=fixture.responses.find(r=>r.url.endsWith('Advertisement%20-Dir%20Marketing.pdf'))
const context=options=>({options,signal:options.signal??new AbortController().signal,check:()=>options.signal?.throwIfAborted(),receipts:[],bytesRead:()=>{}})
test('HPCL exact declared PDF HTTP403 metadata takes priority over missing callback body',async()=>{
 const ctx=context({fetchPage:async url=>({url,status:403,headers:{'content-type':'text/html'},bodyUnavailable:true})});await assert.rejects(readCurrentHpclDocument(pdf.url,ctx),e=>e.httpStatus===403&&e.failureKind==='blocked_or_access_denied');assert.equal(ctx.receipts[0].status,403);assert.equal(ctx.receipts[0].bodyComplete,false)
})
test('HPCL PDF known403 and202 WAF remain prior to stalled denied bodies and elapsed source budget',async()=>{
 for(const status of [403,202]){let reads=0,late=false;const timeout=new DOMException('source expired','TimeoutError'),ctx=context({fetchImpl:async url=>{late=true;return {status,url,headers:new Headers(status===202?{'x-amzn-waf-action':'challenge'}:{}),body:{getReader(){reads++;assert.fail('No denied body reads')},cancel:async()=>{}}}}});ctx.check=()=>{if(late)throw timeout}
  await assert.rejects(readCurrentHpclDocument(pdf.url,ctx),e=>e.httpStatus===status);assert.equal(reads,0);assert.equal(ctx.receipts[0].status,status)
 }
})
test('HPCL PDF exact frozen pre-abort and fulfilled or rejected in-flight caller reasons are never replaced by audit/body failures',async()=>{
 for(const mode of ['pre','fulfil','reject']){const c=new AbortController(),reason=Object.freeze({owner:'hpcl-pdf-'+mode});if(mode==='pre')c.abort(reason);let calls=0;const ctx=context({signal:c.signal,fetchImpl:async url=>{calls++;c.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'),'url',{value:url})}})
  await assert.rejects(readCurrentHpclDocument(pdf.url,ctx),e=>e===reason);assert.equal(calls,mode==='pre'?0:1)
 }
})
test('HPCL whole actual public director PDF is retained with complete body but no invented country or full criteria completeness',async()=>{
 const ctx=context({fetchImpl:async url=>Object.defineProperty(new Response(Buffer.from(pdf.bodyBase64,'base64'),{status:pdf.status,headers:pdf.headers}),'url',{value:url})}),r=await readCurrentHpclDocument(pdf.url,ctx)
 assert.equal(r.sha256,pdf.sha256);assert.equal(r.bodyBase64,pdf.bodyBase64);assert.ok(r.nativeExtractedText.includes('29.04.2026'));assert.equal(r.nativeTextCompletenessQualified,false);assert.equal(r.fullRoleCriteriaQualified,false);assert.equal(r.applicationInteractions,0)
})

test('HPCL actual window PDF retains its raw public document model without OCR model or other network fallback',async t=>{
 let external=0;t.mock.method(globalThis,'fetch',async()=>{external++;assert.fail('No external PDF/OCR fallback')});const window=fixture.responses.find(r=>r.url.endsWith('Officers%2026-27.pdf')),ctx=context({fetchImpl:async url=>Object.defineProperty(new Response(Buffer.from(window.bodyBase64,'base64'),{status:window.status,headers:window.headers}),'url',{value:url})}),r=await readCurrentHpclDocument(window.url,ctx)
 assert.equal(r.sha256,window.sha256);assert.equal(typeof r.nativeExtractedText,'string');assert.equal(r.ocrInvoked,false);assert.equal(r.nativePdfTextModel.numPages,1);assert.equal(r.nativeTextCompletenessQualified,false);assert.equal(external,0)
})
