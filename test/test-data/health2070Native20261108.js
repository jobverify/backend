import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./recruitmentGoal20261108/health2070-original-primary-and-empty-detail-v2.json.gz',import.meta.url))))
export const PRIMARY='https://2070health.com/careers/'
export const mutateBody=(p,edit)=>{const bytes=Buffer.from(edit(Buffer.from(p.bodyBase64,'base64').toString('utf8')));p.bodyBase64=bytes.toString('base64');p.bodyBytes=bytes.length;p.bodySHA256=createHash('sha256').update(bytes).digest('hex');delete p.headers['content-length'];return p}
export function replay(edit=()=>{}){
 const requests=[],uncaptured=[]
 const packet=async(url,init={})=>{const target=String(url);requests.push({url:target,method:init.method??'legacy-helper',redirect:init.redirect??null,credentials:init.credentials??null});const original=fixture.packets.find(p=>p.requestedURL===target);if(!original){uncaptured.push(target);throw Object.assign(Error('No captured original for '+target),{abortRetries:true,code:'NO_CAPTURED_ORIGINAL'})}const p=structuredClone(original);await edit(p,target,requests.length);return p}
 const fetchImpl=async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const p=await packet(url,init),response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response}
 const fetchPage=async(url,init)=>{const p=await packet(url,init),html=Buffer.from(p.bodyBase64,'base64').toString('utf8');return{...p,html,body:html,redirected:false}}
 return{requests,uncaptured,options:{fetchImpl,fetchPage,fetchJson:async()=>{throw Object.assign(Error('No captured JSON request'),{abortRetries:true})},rateLimitMs:0,now:()=>fixture.captureCompletedAt}}
}
