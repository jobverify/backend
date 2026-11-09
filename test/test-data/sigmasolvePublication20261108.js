import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./recruitmentGoal20261108/sigmasolve-original-role-chain.json.gz',import.meta.url))))
export function replay({transform}={}){
 const packets=new Map(fixture.packets.map(v=>[v.requestedURL,v])),requests=[],uncaptured=[]
 const obtain=async url=>{url=String(url);requests.push(url);const original=packets.get(url);if(!original){uncaptured.push(url);throw Error('Uncaptured Sigma Solve URL: '+url)}const p=structuredClone(original);if(transform)await transform(p,requests);return p}
 const fetchPage=async(url,init)=>{const p=await obtain(url);return {url:p.finalURL,status:p.status,headers:p.headers,bodyBase64:p.bodyBase64}}
 const fetchText=async url=>Buffer.from((await obtain(url)).bodyBase64,'base64').toString('utf8')
 const fetchImpl=async(url,init)=>{if(init.method!=='GET'||init.redirect!=='manual'||init.credentials!=='omit'||init.body!==undefined)throw Error('Anonymous manual public GET required');const p=await obtain(url),r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}
 return {requests,uncaptured,options:{fetchPage,fetchText,fetchImpl,rateLimitMs:0,now:()=>fixture.captureCompletedAt}}
}
export const mutateBody=(p,text)=>{p.bodyBase64=Buffer.from(text).toString('base64');p.bodyBytes=Buffer.byteLength(text);delete p.headers['content-length']}