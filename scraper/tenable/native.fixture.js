import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
export const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261030-svg.json.gz',import.meta.url))))
export const originalFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261030.json.gz',import.meta.url))))
export const priorPublisherFixture=fixture.priorPublisherGeneration
export function transport(change=(row,url)=>row,recording=fixture){const counts=new Map(),calls=[];const fetchImpl=async(input,init={})=>{const url=String(input),method=init.method||'GET';const n=(counts.get(url)||0)+1;const sequence=recording.responseSequences?.[method+' '+url];const original=sequence?.[Math.min(n-1,sequence.length-1)]||recording.responses[method+' '+url];assert.ok(original,'Unretained fixtureHTTP '+method+' '+url);counts.set(url,n);calls.push({url,method,n});const row={...original,body:Buffer.from(original.bodyBase64,'base64').toString('utf8')};change(row,url,n,init);const r=new Response(row.body,{status:row.status,headers:{...(row.headers||{}),...(row.contentType?{'content-type':row.contentType}:{}),...(row.redirectLocation?{location:row.redirectLocation}:{})}});Object.defineProperty(r,'url',{value:row.finalUrl});return r};fetchImpl.calls=calls;return fetchImpl}
