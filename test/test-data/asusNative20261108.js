import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./recruitmentGoal20261108/asus-original-native-models.json.gz',import.meta.url))))
export const mutateBody=(packet,edit)=>{const raw=Buffer.from(edit(Buffer.from(packet.bodyBase64,'base64').toString('utf8')));packet.bodyBase64=raw.toString('base64');packet.bodyBytes=raw.length;packet.bodySHA256=createHash('sha256').update(raw).digest('hex');delete packet.headers['content-length'];return packet}
export const changeSchema=(packet,edit)=>{const model=fixture.expected.details[Number(packet.label.slice(7))],old=model.nativeSchemaCarriers[0].rawJSON,value=structuredClone(model.nativeSchemaCarriers[0].value);edit(value);const replacement=JSON.stringify(value).replaceAll('<','\\u003c');mutateBody(packet,html=>{assert.ok(html.includes(old));return html.replace(old,replacement)})}
export const changeNuxt=(packet,edit)=>{const model=packet.label==='closing-primary'?fixture.expected.closingPrimary:fixture.expected.openingPrimary,old=model.nativeSSRCarriers[0].rawJSON,value=structuredClone(model.nativeSSRCarriers[0].flatNativeGraph);edit(value);mutateBody(packet,html=>{assert.ok(html.includes(old));return html.replace(old,JSON.stringify(value).replaceAll('<','\\u003c'))})}
export function replay(edit=()=>{}){
 const requests=[],uncaptured=[];let index=0
 const packet=async(url,init={})=>{const target=String(url);requests.push({url:target,method:init.method??'legacy-helper',redirect:init.redirect??null,credentials:init.credentials??null});const original=fixture.packets[index];if(!original||target!==original.requestedURL){uncaptured.push(target);throw Object.assign(Error('No exact captured original for '+target),{code:'NO_CAPTURED_ORIGINAL',abortRetries:true})}index++;const value=structuredClone(original);await edit(value,target,index);return value}
 const fetchImpl=async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const p=await packet(url,init),response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response}
 const fetchPage=async(url,init)=>{const p=await packet(url,init),html=Buffer.from(p.bodyBase64,'base64').toString('utf8');return{...p,html,body:html,redirected:false}}
 return{requests,uncaptured,options:{fetchImpl,fetchPage,fetchJson:async url=>{uncaptured.push(String(url));throw Object.assign(Error('No captured JSON route'),{code:'NO_CAPTURED_ORIGINAL',abortRetries:true})},rateLimitMs:0,now:()=>fixture.captureCompletedAt}}
}
