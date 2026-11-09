import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/cribl/fixtures/'+name,import.meta.url))))
export const fixture=load('current-originals-20261107.json.gz')
const companions=[...load('companion-originals-20261107.json.gz').packets,...load('companion-canonical-original-20261107.json.gz').packets]
export function replay({transform}={}){
 const packets=new Map([...fixture.packets,...companions].map(p=>[p.requestedURL,p])),requests=[],uncaptured=[]
 const fetchPage=async value=>{
  const url=String(value);requests.push(url);const original=packets.get(url)
  if(!original){uncaptured.push(url);throw Error('Original not captured: '+url)}
  const packet=structuredClone(original)
  if(transform)await transform(packet,requests)
  const raw=Buffer.from(packet.bodyBase64,'base64')
  return {url:packet.finalURL,status:packet.status,headers:packet.headers,contentType:packet.headers['content-type'],html:raw.toString('utf8'),bodyBase64:packet.bodyBase64,bodyComplete:true}
 }
 const fetchImpl=async(url,init)=>{
  if(init?.method!=='GET'||init?.redirect!=='manual'||init?.credentials!=='omit')throw Error('Anonymous manual GET required')
  const p=await fetchPage(url),r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers})
  Object.defineProperty(r,'url',{value:p.url});return r
 }
 return {requests,uncaptured,options:{fetchImpl,fetchPage,rateLimitMs:0,now:()=>fixture.captureCompletedAt}}
}
export const mutateBody=(packet,text)=>{const raw=Buffer.from(text);packet.bodyBase64=raw.toString('base64');packet.bodyBytes=raw.length;packet.bodySHA256=createHash('sha256').update(raw).digest('hex');delete packet.headers['content-length']}
