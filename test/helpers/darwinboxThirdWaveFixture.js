import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'

export function thirdWaveTransport(source,change=()=>{}) {
 const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL(`../../scraper/${source}/fixtures/native-20261030.json.gz`,import.meta.url))))
 const calls=[]
 return {calls,fetchImpl:async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted()
  const packet=packets.find(row=>row.url===url);assert.ok(packet,`No observed public fixture for ${url}`)
  const row=structuredClone(packet);change(row,calls);calls.push(url)
  const response=new Response(row.body,{status:row.status,headers:{'Content-Type':row.contentType||'text/html','Set-Cookie':'fixture-public=1; Path=/'}})
  Object.defineProperty(response,'url',{value:row.finalUrl||row.url});return response
 }}
}
