import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/actual-http-20261101.json.gz',import.meta.url))));
const entities=new Map(fixture.entities.map(e=>[e.receipt.url,e]));
export const replay=(mutate=(u,p)=>p,extras=new Map())=>{
 const requests=[],audits=[],records=[],visits=new Map();
 const fetchPage=async (url,init={})=>{init.signal?.throwIfAborted();requests.push(url);const e=entities.get(url),extra=extras.get(url);
  if(!e&&!extra&&fixture.withheld.some(r=>r.url===url))throw Error('Retained withheld configured primary; no HTTP response: '+url);
  assert.ok(e||extra,'Unretained public GET: '+url);const count=(visits.get(url)||0)+1;visits.set(url,count);
  const page=extra?structuredClone(extra):{url,status:e.receipt.status,headers:e.receipt.headers,bodyBase64:e.bodyBase64};
  const changed=await mutate(url,page,count);const html=Buffer.from(changed.bodyBase64||'','base64').toString('utf8');return {...changed,html,text:html};
 };
 const fetchImpl=async (url,init={})=>{assert.equal(init.method||'GET','GET','No POST search authorized');assert.equal(init.body,undefined);const p=await fetchPage(String(url),init),b=Buffer.from(p.bodyBase64,'base64');const r=new Response(b.length?b:null,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.url});return r};
 return {requests,audits,records,visits,options:{fetchPage,fetchImpl,fetchText:async u=>(await fetchPage(u)).html,fetchJson:async(u,i={})=>{assert.equal(i.method||'GET','GET','POST search forbidden');return JSON.parse((await fetchPage(u,i)).html)},resolveHosts:async()=>[{address:'127.0.0.1',family:4}],onAudit:async a=>audits.push(a),onRecords:async r=>records.push(r),now:()=> '2026-11-01T12:30:00.000Z'}};
};
export const jsonPage=(url,value)=>({url,status:200,headers:{'content-type':'application/json'},bodyBase64:Buffer.from(JSON.stringify(value)).toString('base64')});
export const htmlPage=(url,html)=>({url,status:200,headers:{'content-type':'text/html'},bodyBase64:Buffer.from(html).toString('base64')});
export const editJSON=(page,fn)=>{const m=JSON.parse(Buffer.from(page.bodyBase64,'base64'));fn(m);return {...page,bodyBase64:Buffer.from(JSON.stringify(m)).toString('base64')}};
