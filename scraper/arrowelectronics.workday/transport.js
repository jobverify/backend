import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
export const WIDGET_FIXED=Object.freeze({lang:'en_us',deviceType:'desktop',country:'us',pageName:'search-results',ddoKey:'refineSearch',jobs:true,counts:true,all_fields:['country'],size:500,global:true,keywords:'',sortBy:'Most recent',sort:{field:'postedDate',order:'desc'}});
const need=(ok,message)=>{if(!ok)throw Error('Arrow native transport: '+message);};
export function validateRequest(value,{method='GET',body}={}){
 const u=new URL(value);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&!u.search,'unapproved origin, query, credentials, port or fragment');
 if(method==='GET')need(body==null&&u.origin==='https://careers.arrow.com'&&(['/us/en','/us/en/','/us/en/search-results'].includes(u.pathname)||/^\/us\/en\/job\/R[1-9]\d*\/[A-Za-z0-9-]+\/?$/.test(u.pathname)),'unapproved public GET path');
 else{need(method==='POST'&&u.origin==='https://careers.arrow.com'&&u.pathname==='/widgets','unapproved method or endpoint');need(body&&typeof body==='object'&&!Array.isArray(body),'missing native widget body');const {from,...fixed}=body;need(Number.isInteger(from)&&from>=0&&from<=49500&&from%500===0&&isDeepStrictEqual(fixed,WIDGET_FIXED),'unapproved read-only refineSearch body');}
 return u.href;
}
/** Each destination is validated before a request; response chunks and failures are retained. */
export const createNativeRequest=({fetchImpl=globalThis.fetch,signal,onPacket,packets=[],clock=()=>new Date().toISOString(),timeoutMs=30000}={})=>async(input,{method='GET',body}={})=>{
 let current=validateRequest(input,{method,body});const visited=new Set();
 for(let hop=0;hop<=5;hop++){
  signal?.throwIfAborted();need(!visited.has(current),'redirect cycle');visited.add(current);
  const activeSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(timeoutMs)]),chunks=[];
  const packet={requestedURL:validateRequest(current,{method,body}),method,requestBody:body??null,hop,startedAt:clock(),responseAt:null,completedAt:null,status:null,headers:null,bodyBase64:'',failure:null};let response;
  try{response=await fetchImpl(packet.requestedURL,{method,redirect:'manual',signal:activeSignal,headers:{Accept:method==='GET'?'text/html,application/xhtml+xml':'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});packet.responseAt=clock();packet.status=response.status;packet.headers=Object.fromEntries(response.headers);need(response.redirected!==true&&(!response.url||response.url===current),'unvalidated automatic redirect');if(response.body)for await(const chunk of response.body){chunks.push(Buffer.from(chunk));activeSignal.throwIfAborted();}activeSignal.throwIfAborted();}
  catch(error){packet.failure={name:error.name,message:error.message,cause:error.cause?.message??null};}
  const bytes=Buffer.concat(chunks);packet.bodyBase64=bytes.toString('base64');packet.bytes=bytes.length;packet.bodySHA256=createHash('sha256').update(bytes).digest('hex');packet.completedAt=clock();packets.push(packet);if(onPacket)await onPacket(packet);
  if(packet.failure){const e=Error('Arrow native transport: '+packet.failure.message);e.nativePackets=packets;throw e;}
  if([301,302,303,307,308].includes(packet.status)){need(hop<5,'redirect bound exceeded');const location=response.headers.get('location');need(location?.trim(),'redirect Location missing');const destination=validateRequest(new URL(location,current).href,{method,body});need(new URL(destination).origin===new URL(input).origin,'redirect changed origin');need(method==='GET'||[307,308].includes(packet.status),'POST redirect changes read-only method contract');current=destination;continue;}
  need(packet.status===200,'HTTP '+packet.status);return bytes.toString('utf8');
 }
 throw Error('Arrow native redirect bound exceeded');
};
