import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const CAREERS='https://www.harbingergroup.com/current-openings/',BOARD='https://harbingergroup.darwinbox.in/ms/candidatev2/main/careers/home',MAIN='https://harbingergroup.darwinbox.in/ms/candidatev2/main.819c4120b20f8091.js',INFO='https://harbingergroup.darwinbox.in/ms/candidateapi/getCompanyConfig?is_preview=false&companyId=main'
function replay(change=()=>{}){
 const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url)))),calls=[]
 return{calls,fetchImpl:async(url,init)=>{
  assert.equal(init.method??'GET','GET');const o=originals.find(row=>row.requestedUrl===url&&(url!==BOARD||row.captureName==='harbingersystems-board.json'));assert.ok(o,'Unbound URL '+url);calls.push(url)
  const r={...structuredClone(o),body:Buffer.from(o.bodyBase64,'base64').toString()};change(r,url)
  const response=new Response(r.body,{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response
 }}
}
test('the current exact Harbinger candidatev2 handoff reaches its actual public employer-config HTTP403 blocker',async t=>{
 const r=replay();t.mock.method(globalThis,'fetch',r.fetchImpl)
 await assert.rejects(run({fetchImpl:r.fetchImpl}),error=>{
  assert.equal(error.status,403);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.lifecycleCleanupAllowed,false)
  assert.match(error.message,/employer.*config|company.*config/i)
  assert.equal(error.recruitmentObservations.originalResponses.length,4)
  assert.equal(error.recruitmentObservations.companyIndiaTotal,null);assert.equal(error.recruitmentObservations.sourceScopeComplete,false);return true
 });assert.deepEqual(r.calls,[CAREERS,BOARD,MAIN,INFO])
})
test('changed tenant handoff or unreviewed client cannot acquire an unrelated inventory',async()=>{
 for(const target of [CAREERS,MAIN]){
  const {fetchImpl,calls}=replay((r,url)=>{if(url===target)r.body=target===CAREERS?r.body.replaceAll('harbingergroup.darwinbox.in','other.darwinbox.in'):r.body+'/* changed */'})
  await assert.rejects(run({fetchImpl}),/native.*(handoff|HTML)|reviewed.*client|employer/i);assert.equal(calls.includes(INFO),false)
 }
})
test('native requests use the exact ordinary public app representation captured at its declared URL',async()=>{
 const {fetchImpl}=replay(),wrapped=async(url,init)=>{if(url===BOARD){assert.match(init.headers['User-Agent'],/Chrome\/138/);assert.equal(init.headers.Accept,'*/*');assert.equal(init.cache,undefined)}return fetchImpl(url,init)}
 await assert.rejects(run({fetchImpl:wrapped}),error=>error.status===403)
})
test('a native metadata-only representation remains inventory unknown and cannot certify jobs or empty',async()=>{
 const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url)))),preview=originals.find(row=>row.captureName==='harbingersystems-board-default.json')
 const {fetchImpl,calls}=replay((r,url)=>{if(url===BOARD)r.body=Buffer.from(preview.bodyBase64,'base64').toString()})
 await assert.rejects(run({fetchImpl}),error=>error.lifecycleCleanupAllowed===false&&error.failureKind==='coverage_gap'&&/metadata.*preview|preview.*metadata/i.test(error.message))
 assert.deepEqual(calls,[CAREERS,BOARD])
})
test('a newly accessible employer config remains unqualified until current native inventory is reviewed',async()=>{
 const {fetchImpl}=replay((r,url)=>{if(url===INFO){r.status=200;r.headers['content-type']='application/json';r.body='{"status":"success","message":{"company_name":"Harbinger Group"}}'}})
 await assert.rejects(run({fetchImpl}),error=>error.lifecycleCleanupAllowed===false&&/unreviewed|unqualified|inventory.*unknown/i.test(error.message))
})
test('body-only callbacks cannot certify the current tenant handoff',async()=>{
 await assert.rejects(run({fetchText:async()=>'<html>Harbinger</html>'}),/original.*metadata|body-only/i)
})
