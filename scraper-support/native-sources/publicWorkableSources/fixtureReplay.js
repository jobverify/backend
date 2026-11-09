import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/actual-http-20261101.json.gz',import.meta.url))))
const entities=new Map(fixture.entities.map(e=>[e.receipt.url,e]))
export const replay=(mutate=(url,page)=>page,extras=new Map())=>{
 const audits=[],records=[],requests=[],visits=new Map()
 const fetchPage=async (url,init={})=>{
  init.signal?.throwIfAborted();requests.push(url)
  const item=entities.get(url),extra=extras.get(url)
  if(!item&&!extra&&fixture.failures[url])throw Error('Retained original transport failure: '+url)
  assert.ok(item||extra,'Unretained public GET: '+url)
  const n=(visits.get(url)||0)+1;visits.set(url,n)
  const page=extra?structuredClone(extra):{url,status:item.receipt.status,headers:item.receipt.headers,bodyBase64:item.bodyBase64}
  return mutate(url,page,n)
 }
 const fetchImpl=async(url,init={})=>{
  assert.equal(init.method||'GET','GET','No native POST search or mutation is authorized');assert.equal(init.body,undefined)
  const p=await fetchPage(String(url),init),bytes=Buffer.from(p.bodyBase64,'base64')
  const r=new Response(bytes.length?bytes:null,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.url});return r
 }
 const fetchJson=async(url,init={})=>{assert.equal(init.method||'GET','GET','POST cursor search forbidden');assert.equal(init.body,undefined);return JSON.parse(Buffer.from((await fetchPage(url,init)).bodyBase64,'base64'))}
 const fetchText=async(url,init={})=>Buffer.from((await fetchPage(url,init)).bodyBase64,'base64').toString('utf8')
 return {audits,records,requests,options:{fetchPage,fetchImpl,fetchJson,fetchText,onAudit:async a=>audits.push(a),onRecords:async r=>records.push(r),now:()=> '2026-11-01T01:30:00.000Z'}}
}
export const editJSON=(page,change)=>{const v=JSON.parse(Buffer.from(page.bodyBase64,'base64'));change(v);return {...page,bodyBase64:Buffer.from(JSON.stringify(v)).toString('base64')}}
export const editHTML=(page,change)=>({...page,bodyBase64:Buffer.from(change(Buffer.from(page.bodyBase64,'base64').toString('utf8'))).toString('base64')})
