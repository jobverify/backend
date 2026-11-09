import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/xponentai/fixtures/current-originals-20261108.json.gz',import.meta.url))))
const correctedOracle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/xponentai/fixtures/criteria-oracle-v2-20261108.json.gz',import.meta.url))))
fixture.expected.roles=correctedOracle.roles
const baseline=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/xponentai/fixtures/legacy-projection-original-20261108.json.gz',import.meta.url))))
export function replay({transform}={}){
 const packets=new Map([...fixture.packets,...baseline.packets].map(p=>[p.requestedURL,p])),requests=[],uncaptured=[]
 const fetchText=async value=>{const url=String(value);requests.push(url);const raw=packets.get(url);if(!raw){uncaptured.push(url);throw Error('Original not captured: '+url)}const p=structuredClone(raw);if(transform)await transform(p,requests);return Buffer.from(p.bodyBase64,'base64').toString('utf8')}
 const fetchImpl=async(value,init)=>{const url=String(value);if(init.method!=='GET'||init.redirect!=='manual'||init.credentials!=='omit')throw Error('Anonymous manual GET required');requests.push(url);const raw=packets.get(url);if(!raw){uncaptured.push(url);throw Error('Original not captured: '+url)}const p=structuredClone(raw);if(transform)await transform(p,requests);const response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalURL});return response}
 return {requests,uncaptured,options:{fetchText,fetchJson:async url=>JSON.parse(await fetchText(url)),fetchImpl,rateLimitMs:0,now:()=>fixture.captureCompletedAt}}
}
export const mutateBody=(packet,text)=>{const raw=Buffer.from(text);packet.bodyBase64=raw.toString('base64');packet.bodyBytes=raw.length;delete packet.headers['content-length']}
