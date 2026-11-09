import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./recruitmentGoal20261108/doximity-original-publication-chain.json.gz',import.meta.url))))
export function replay({transform}={}){
 const packets=new Map(),requests=[],uncaptured=[]
 for(const p of fixture.packets)if(!packets.has(p.requestedURL))packets.set(p.requestedURL,p)
 const obtain=async value=>{const url=String(value);requests.push(url);const raw=packets.get(url);if(!raw){uncaptured.push(url);throw Error('Only exact captured original native URLs are allowed: '+url)}const p=structuredClone(raw);if(transform)await transform(p,requests);return p}
 const fetchPage=async(value,init)=>{const p=await obtain(value);return {url:p.finalURL,status:p.status,headers:p.headers,bodyBase64:p.bodyBase64}}
 const fetchImpl=async(value,init)=>{if(init.method!=='GET'||init.redirect!=='manual'||!(init.credentials===undefined||init.credentials==='omit')||init.body!==undefined)throw Error('Anonymous manual GET required');const p=await obtain(value),response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalURL});return response}
 return {requests,uncaptured,options:{fetchPage,fetchImpl,rateLimitMs:0,now:()=>fixture.captureCompletedAt}}
}
export const mutateBody=(packet,text)=>{const raw=Buffer.from(text);packet.bodyBase64=raw.toString('base64');packet.bodyBytes=raw.length;delete packet.headers['content-length']}