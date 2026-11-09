import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/kidvento/fixtures/native-20261030.json.gz',import.meta.url))))
export function kidventoFixtureTransport(change=()=>{}){
 const counts=new Map(),calls=[]
 return {calls,fetchImpl:async(url,init={})=>{
  url=String(url);calls.push(url);const row=structuredClone(fixture.records.find(r=>r.url===url));assert.ok(row,'unexpected URL '+url)
  const n=(counts.get(url)||0)+1;counts.set(url,n);change(row,n,init)
  const response=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType||'text/html'}});Object.defineProperty(response,'url',{value:row.responseUrl||row.finalUrl});return response
 }}
}
