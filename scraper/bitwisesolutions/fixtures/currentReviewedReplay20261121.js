import fs from 'node:fs'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {originalPacket,originalText,networkFences,replay as legacyReplay} from './currentReplay20261121.js'
export {originalPacket,originalText,networkFences}
export const dependencyPacket=JSON.parse(gunzipSync(fs.readFileSync(new URL('./current-declared-dependency-originals-20261121.json.gz',import.meta.url))))
for(const record of dependencyPacket.records){const body=Buffer.from(record.bodyBase64,'base64');assert.equal(body.length,record.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),record.sha256)}
export function replay(mutate=value=>value){
 const calls=[],counts=new Map(),legacy=legacyReplay(),originals=[...originalPacket.records,...dependencyPacket.records]
 const html=originalText(originalPacket.records.find(r=>r.requestedUrl.endsWith('/company/careers/openings')))
 const declared=new Set([...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>new URL(m[1],'https://www.bitwiseglobal.com/').href))
 return{calls,legacyTextCalls:legacy.legacyTextCalls,fetchText:legacy.fetchText,evidenceTruth:'Nine genuine role/discovery opening originals plus three separately timed genuine dependency opening originals. All second uses are simulated closing, never genuine paired/current proof.',fetchImpl:async(url,init={})=>{
  const requestedUrl=String(url),method=init.method??'GET',key=method+' '+requestedUrl,original=originals.find(r=>r.method===method&&r.requestedUrl===requestedUrl)
  assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');if(method==='POST'){assert.equal(init.body,'{}');assert.equal(new Headers(init.headers).get('content-type'),'application/json')}else assert.equal(init.body,undefined)
  const occurrence=counts.get(key)??0;assert.ok(occurrence<2,'no retry/third occurrence');counts.set(key,occurrence+1)
  if(!original){
   assert.ok(method==='GET'&&declared.has(requestedUrl),'strict native exact-original or actual-declared unavailable dependency fence: '+key)
   calls.push({url:requestedUrl,method,phase:occurrence?'simulated-closing':'opening',counterfactualUnavailableDependency:true,status:503})
   const response=new Response('Counterfactual unretained declared dependency unavailable',{status:503,headers:{'content-type':'application/javascript'}});Object.defineProperties(response,{url:{value:requestedUrl},redirected:{value:false}});return response
  }
  const phase=occurrence?'simulated-closing':'opening',value={url:original.url,status:original.status,headers:structuredClone(original.headers),body:originalText(original)},changed=mutate(value,{original,phase,key,occurrence,index:calls.length})??value
  calls.push({url:requestedUrl,method,phase,originalSHA256:original.sha256,simulatedClosing:occurrence>0,status:changed.status})
  const response=new Response(changed.body,{status:changed.status,headers:changed.headers});Object.defineProperties(response,{url:{value:changed.url},redirected:{value:false}});return response
 }}
}
