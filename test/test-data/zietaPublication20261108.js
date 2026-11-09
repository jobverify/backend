import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./recruitmentGoal20261108/zieta-original-role-chain.json.gz',import.meta.url))))
export const PRIMARY=fixture.packets[0].requestedURL
export function replay({transform}={}){
 const requests=[],uncaptured=[],packet=fixture.packets[0]
 const obtain=async url=>{url=String(url);requests.push(url);if(url!==packet.requestedURL){uncaptured.push(url);throw Error('Uncaptured Zieta URL: '+url)}const p=structuredClone(packet);if(transform)await transform(p,requests);return p}
 const fetchPage=async(url,init)=>{const p=await obtain(url);return {url:p.finalURL,status:p.status,headers:p.headers,bodyBase64:p.bodyBase64,bodyComplete:p.bodyComplete,redirected:false}}
 const fetchText=async url=>Buffer.from((await obtain(url)).bodyBase64,'base64').toString()
 const fetchImpl=async(url,init)=>{if(init.method!=='GET'||init.redirect!=='manual'||init.credentials!=='omit'||init.body!==undefined)throw Error('Anonymous manual public GET required');const p=await obtain(url),r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}
 return {requests,uncaptured,options:{fetchPage,fetchText,fetchImpl,rateLimitMs:0,now:()=>fixture.captureCompletedAt}}
}
export const mutateBody=(p,text)=>{p.bodyBase64=Buffer.from(text).toString('base64');p.bodyBytes=Buffer.byteLength(text);delete p.headers['content-length']}
