import {readNativeDocument} from '../carrier.workday/nativeHtml.js'
import {createHash} from 'node:crypto'
export const CORPORATE='https://www.corporate.carrier.com/',HOME='https://www.carrier.com/us/en/',PRIVACY=HOME+'privacy-notice/',CAREERS=HOME+'careers/'
const prove=(ok,message)=>{if(!ok)throw Error('Carrier Global current group delegation: '+message)}
export async function verifyCarrierGroupDelegation({fetchPage,signal=AbortSignal.timeout(30000)}={}){
 const responses=[]
 async function nativePage(url){
  const response=await fetch(url,{signal,redirect:url===CORPORATE?'follow':'error',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}})
  const reader=response.body?.getReader(),chunks=[];let bytes=0,complete=false
  try{if(reader)for(;;){signal.throwIfAborted();const part=await reader.read();signal.throwIfAborted();if(part.done){complete=true;break}bytes+=part.value.byteLength;prove(bytes<=2000000,'Native corporate body bound');chunks.push(Buffer.from(part.value))}}
  finally{if(reader&&!complete)await reader.cancel().catch(()=>{});reader?.releaseLock()}
  const body=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes))
  return{status:response.status,url:response.url,headers:{'content-type':response.headers.get('content-type')},body,capturedAt:new Date().toISOString()}
 }
 async function get(url,expected){signal.throwIfAborted();let listener
  try{const p=await Promise.race([(async()=>fetchPage?fetchPage(url,{signal}):nativePage(url))(),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})]);signal.throwIfAborted();prove(p?.status===200&&(p.finalUrl??p.url)===expected&&typeof p.body==='string'&&Buffer.byteLength(p.body)<=2000000,'HTTP/final corporate URL unavailable');const d=readNativeDocument(p.body),c=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');prove(c.length===1&&c[0].attrs.href===expected,'Current corporate canonical missing');responses.push({url,finalUrl:p.finalUrl??p.url,status:p.status,sha256:createHash('sha256').update(p.body).digest('hex'),capturedAt:p.capturedAt,contentType:p.headers?.get?.('content-type')??p.headers?.['content-type']});return d}finally{signal.removeEventListener('abort',listener);signal.throwIfAborted()}
 }
 const links=(d,base)=>d.nodes(n=>n.tag==='a'&&n.attrs.href).flatMap(n=>{try{return[new URL(n.attrs.href,base).href]}catch{return[]}}),body=d=>d.text(d.nodes(n=>n.tag==='root')[0])
 const corporate=await get(CORPORATE,HOME)
 prove(corporate.nodes(n=>n.tag==='title').some(n=>n.raw==='Intelligent Climate and Energy Solutions | Carrier')&&body(corporate).includes('Carrier Global Corporation (NYSE: CARR)'),'Current Carrier Global corporate identity missing')
 prove(links(corporate,HOME).includes(CAREERS)&&links(corporate,HOME).includes(PRIVACY),'Current corporate career/privacy handoff missing')
 const privacy=await get(PRIVACY,PRIVACY)
 prove(/Carrier Global Corporation and its subsidiaries and affiliates \(collectively, [“"]Carrier[”"]\)/.test(body(privacy))&&links(privacy,PRIVACY).includes(CAREERS),'Current collective Carrier group name and careers relationship missing')
 const timed=responses.every(response=>typeof response.capturedAt==='string'&&Number.isFinite(Date.parse(response.capturedAt))&&Date.parse(response.capturedAt)>0&&Date.parse(response.capturedAt)<=Date.now()&&/^text\/html\b/i.test(response.contentType||''))
 return{relationship:'same-official-group-recruiting-surface',canonicalSource:'carrier',legalEmployerAlias:false,companyScopeComplete:false,corporateURL:CORPORATE,finalCorporateURL:HOME,privacyURL:PRIVACY,careersURL:CAREERS,
  // A replay retains its oldest actual native clock. Untimed/body-only legacy
  // transports can exercise the guard but cannot manufacture fresh evidence.
  observation:timed?{verifiedAt:new Date(Math.min(...responses.map(response=>Date.parse(response.capturedAt)))).toISOString(),evidence:{method:'official-group-name-and-career-handoffs',url:PRIVACY,responses:responses.map(({capturedAt,contentType,...response})=>response)}}:null}
}
