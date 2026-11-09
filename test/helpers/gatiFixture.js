import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/gati/fixtures/native-20261030.json.gz',import.meta.url))))
export function gatiFixtureTransport(change=()=>{}){
 const calls=[],counts=new Map()
 const fetchImpl=async(url,init={})=>{
  url=String(url);calls.push({url,method:init.method||'GET'});const row=structuredClone(fixture.records.find(r=>r.url===url));assert.ok(row,'Unadvertised request '+url)
  const count=(counts.get(url)||0)+1;counts.set(url,count);change(row,count,init)
  const headers={'content-type':row.contentType,'set-cookie':'public_session=fixture; Path=/; Secure; HttpOnly'};if(row.location)headers.location=row.location
  const response=new Response(row.body,{status:row.status,headers});Object.defineProperty(response,'url',{value:row.responseUrl});return response
 }
 return {fetchImpl,calls}
}
