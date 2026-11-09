import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'

export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./recruitmentGoal20261108/base64ai-original-native-models.json.gz',import.meta.url))))
for(const packet of fixture.packets){const raw=Buffer.from(packet.bodyBase64,'base64');assert.equal(raw.length,packet.bodyBytes);assert.equal(createHash('sha256').update(raw).digest('hex'),packet.bodySHA256)}
export const mutateBody=(packet,edit)=>{const raw=Buffer.from(edit(Buffer.from(packet.bodyBase64,'base64').toString('utf8')));packet.bodyBase64=raw.toString('base64');packet.bodyBytes=raw.length;packet.bodySHA256=createHash('sha256').update(raw).digest('hex');delete packet.headers['content-length'];return packet}
export const changeJSON=(packet,edit)=>mutateBody(packet,source=>{const value=JSON.parse(source);edit(value);return JSON.stringify(value)})
export function replay(edit=()=>{}){
 const requests=[],uncaptured=[];let index=0
 const packet=async(url,init={})=>{
  const target=String(url);requests.push({url:target,method:init.method??'legacy-helper',redirect:init.redirect??null,credentials:init.credentials??null})
  const original=fixture.packets[index]
  if(!original||target!==original.requestedURL){uncaptured.push(target);throw Object.assign(Error('No exact captured Base64.ai original for '+target),{code:'NO_CAPTURED_ORIGINAL',abortRetries:true})}
  index++;const value=structuredClone(original);await edit(value,target,index);return value
 }
 const fetchImpl=async(url,init)=>{
  const value=await packet(url,init)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined)
  const response=new Response(Buffer.from(value.bodyBase64,'base64'),{status:value.status,headers:value.headers})
  Object.defineProperty(response,'url',{value:value.url});return response
 }
 const fetchPage=async(url,init)=>{const value=await packet(url,init),html=Buffer.from(value.bodyBase64,'base64').toString('utf8');return{...value,html,body:html,redirected:false}}
 return{requests,uncaptured,options:{fetchImpl,fetchPage,rateLimitMs:0,now:()=>fixture.captureCompletedAt}}
}
