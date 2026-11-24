import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
export const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/registered-native-20261120.json.gz',import.meta.url))))
export const recordedBody=r=>Buffer.from(r.bodyBase64,'base64')
for(const r of fixture.responses){assert.equal(r.bodyOriginalUnmodified,true);assert.equal(createHash('sha256').update(recordedBody(r)).digest('hex'),r.sha256);assert.equal(r.sha256,r.persistedSHA256)}
export function replayOptions(extra={},change){
 const counts=new Map(),calls=[]
 return {now:()=>fixture.observedAt,requestIntervalMs:0,rateLimitMs:0,...extra,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const n=counts.get(url)||0;counts.set(url,n+1);const row=fixture.responses.filter(r=>r.requestedURL===url)[n];assert.ok(row,'Only saved current native declaration '+url);calls.push(url)
  const body=change?change(recordedBody(row).toString(),url,n):recordedBody(row),r=new Response(body,{status:row.status,headers:row.headers});Object.defineProperty(r,'url',{value:row.finalURL});return r
 },calls}
}
export async function exactRejection(pending,reason){const result=await pending.then(value=>({resolved:value}),error=>({error}));assert.ok(Object.hasOwn(result,'error'),'must reject instead of returning after caller cancellation');assert.equal(result.error,reason)}
