import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import mongoose from 'mongoose'

const fixtureURL=new URL('../test-data/recruitmentGoal20261107/opentext-c2-default-public.json.gz',import.meta.url)
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
let cached
export function loadOpenTextZipFixture(){
 if(cached)return cached
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(fixtureURL)).toString('utf8'))
 assert.equal(fixture.schema,'opentext-c2-original30-and-controlled-c3-v1')
 assert.equal(fixture.responses.length,30);assert.equal(fixture.sourceClocks.length,55)
 for(const r of fixture.responses){const b=Buffer.from(r.bodyBase64,'base64');assert.equal(b.length,r.body.bytes);assert.equal(sha(b),r.body.sha256);assert.equal(r.status,200);assert.ok(r.contentType);assert.equal(new URL(r.finalURL).origin,'https://careers.opentext.com')}
 assert.equal(fixture.originalOutputSHA256,'fb9eda15420731f5a7be6e1b4179164531ede4f0bf4f37469530b7de0011b246')
 assert.equal(sha(Buffer.from(JSON.stringify(fixture.originalOutput,null,2)+'\n')),fixture.originalOutputSHA256)
 assert.equal(sha(Buffer.from(JSON.stringify(fixture.controlledExpectedOutput,null,2)+'\n')),fixture.controlledExpectedOutputSHA256)
 assert.equal(fixture.controlledExpectedQualification.liveCandidateCapture,false)
 cached=fixture;return fixture
}

export function encodeOpenTextOutput(value,seen=new Map()){
 if(value===undefined)return {$type:'undefined'}
 if(typeof value==='symbol')return {$symbol:Symbol.keyFor(value)??value.description??''}
 if(typeof value==='bigint')return {$bigint:String(value)}
 if(typeof value==='number'&&!Number.isFinite(value))return {$number:String(value)}
 if(value===null||typeof value!=='object')return value
 if(seen.has(value))return {$ref:seen.get(value)}
 const id=seen.size;seen.set(value,id)
 return {$id:id,$type:Array.isArray(value)?'Array':Object.getPrototypeOf(value)?.constructor?.name??'null-prototype',properties:Reflect.ownKeys(value).map(key=>{const d=Object.getOwnPropertyDescriptor(value,key);assert.ok('value'in d,'Output accessors must not be silently invoked');return {key:typeof key==='symbol'?{$symbol:Symbol.keyFor(key)??key.description??''}:key,enumerable:d.enumerable,configurable:d.configurable,writable:d.writable,value:encodeOpenTextOutput(d.value,seen)}})}
}

// Controlled negative mutations replace only the retained genuine JSON object.
// The scanner identifies the original literal boundary; it evaluates no code.
export function mutateOpenTextDetailHTML(html,mutate){
 const marker=/\bphApp\s*\.\s*ddo\s*=\s*(?=\{)/g
 const candidates=[]
 for(const match of html.matchAll(marker)){
  const start=match.index+match[0].length;let depth=0,quoted=false,escape=false,end=-1
  for(let i=start;i<html.length;i++){const c=html[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){end=i+1;break}}
  if(end<0)continue
  let model;try{model=JSON.parse(html.slice(start,end))}catch{continue}
  if(model?.jobDetail?.data?.job)candidates.push({start,end,model})
 }
 assert.equal(candidates.length,1,'Expected one original genuine detail model')
 const {start,end,model}=candidates[0];mutate(model.jobDetail.data.job,model)
 return html.slice(0,start)+JSON.stringify(model)+html.slice(end)
}

export async function replayOpenTextZip({scraper,mutateJob=null,mutateHTML=null,denyFirst=false}={}){
 const fixture=loadOpenTextZipFixture(),rows=fixture.responses.filter(x=>x.phase==='actual-default-run')
 assert.equal(rows.length,29)
 const nativeDate=Date,oldFetch=globalThis.fetch,restore=[],clocks=fixture.sourceClocks
 let calls=0,clockIndex=0,network=0,database=0,completion=0,scheduled=false
 const pending=new Map(),order=[...rows].sort((a,b)=>a.completionOrder-b.completionOrder)
 const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..').replaceAll('\\','/').toLowerCase()+'/'
 const ownFile=fileURLToPath(import.meta.url).replaceAll('\\','/')
 function clock(kind){const caller=new Error().stack.split('\n').slice(2).find(s=>!s.replaceAll('\\','/').includes(ownFile));if(caller?.replaceAll('\\','/').toLowerCase().includes(repo)){const value=clocks[clockIndex++];assert.ok(value,'Unexpected extra source clock');assert.equal(kind,value.kind);return value.value}return nativeDate.now()}
 globalThis.Date=class extends nativeDate{constructor(...args){super(...(args.length?args:[clock('newDate')]))}static now(){return clock('Date.now')}}
 const replace=(object,key,value)=>{const old=object[key];restore.push(()=>{object[key]=old});object[key]=value}
 for(const m of [http,https])for(const key of ['request','get'])replace(m,key,()=>{network++;throw Error('Offline OpenText HTTP tripwire')})
 for(const [object,key]of [[mongoose,'connect'],[mongoose,'createConnection'],[mongoose.Connection.prototype,'openUri']])replace(object,key,()=>{database++;throw Error('Offline OpenText DB tripwire')})
 const initRecord=init=>Object.fromEntries(Object.entries(init).map(([k,v])=>[k,k==='signal'?{present:!!v,aborted:v?.aborted??false}:k==='headers'?[...new Headers(v)]:v]))
 function drain(){if(scheduled)return;scheduled=true;setImmediate(()=>{scheduled=false;const next=order[completion];if(next&&pending.has(next.sequence)){const resolve=pending.get(next.sequence);pending.delete(next.sequence);completion++;resolve();drain()}})}
 globalThis.fetch=async(url,init={})=>{
  const packet=rows[calls++];assert.ok(packet,'Unexpected request');assert.equal(String(url),packet.requestedURL);assert.deepEqual(initRecord(init),packet.sourceInit)
  let bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.body.sha256)
  if(mutateJob&&packet.requestedURL.includes('/job/54296/'))bytes=Buffer.from(mutateOpenTextDetailHTML(bytes.toString('utf8'),mutateJob))
  if(mutateHTML&&packet.requestedURL.includes('/job/54296/'))bytes=Buffer.from(mutateHTML(bytes.toString('utf8'),packet))
  await new Promise(resolve=>{pending.set(packet.sequence,resolve);drain()})
  const response=new Response(bytes,{status:denyFirst&&packet.sequence===1?403:packet.status,headers:packet.responseHeaders});Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }
 let jobs,error
 try{jobs=await scraper.run()}catch(e){error=e}finally{globalThis.fetch=oldFetch;globalThis.Date=nativeDate;for(const f of restore.reverse())f()}
 if(denyFirst){assert.equal(calls,1);assert.equal(clockIndex,0)}else{assert.equal(calls,29);assert.equal(clockIndex,55)}
 assert.equal(network,0);assert.equal(database,0)
 return {jobs,error,requestCount:calls,sourceClockCount:clockIndex,networkAttempts:network,databaseAttempts:database}
}

export function assertOpenTextWholeOutput(jobs,{original=false}={}){
 const fixture=loadOpenTextZipFixture();assert.deepEqual(encodeOpenTextOutput(jobs),original?fixture.originalOutput:fixture.controlledExpectedOutput)
}

export function assertIndependentOpenTextClosing(){
 const fixture=loadOpenTextZipFixture(),opening=fixture.responses.find(x=>x.sourceInit.method==='POST'),closing=fixture.responses[29]
 assert.equal(closing.phase,'separate-closing-listing');assert.deepEqual(closing.sourceInit.headers,opening.sourceInit.headers);assert.equal(closing.sourceInit.body,opening.sourceInit.body)
 const a=JSON.parse(Buffer.from(opening.bodyBase64,'base64').toString('utf8')),b=JSON.parse(Buffer.from(closing.bodyBase64,'base64').toString('utf8'))
 assert.equal(a.refineSearch.data.jobs.length,27);assert.deepEqual(a.refineSearch.data.jobs,b.refineSearch.data.jobs)
 return {scope:'Separate original diagnostic closing response, never a production-code closing claim',rawJobModels:27,entireResponseEqual:JSON.stringify(a)===JSON.stringify(b)}
}
