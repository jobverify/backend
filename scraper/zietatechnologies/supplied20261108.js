import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {buildHttpError} from '../../scraper-support/utils/fetch.js'
import {failure,errorValue} from './runtime20261108.js'
import {MAX_BYTES} from './transport20261108.js'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),diagnostic=e=>({name:errorValue(e,'name')??'Error',message:errorValue(e,'message')??'Unreadable supplied metadata'})
const clone=value=>{
 if(typeof value==='function'||typeof value==='symbol')return {uncloneableMetadata:true,type:typeof value}
 if(typeof value==='bigint')return {suppliedPrimitiveType:'bigint',value:String(value)}
 if(typeof value==='number'&&!Number.isFinite(value))return {suppliedPrimitiveType:'number',value:String(value)}
 try{if(!types.isProxy(value)&&value instanceof Headers)return Object.fromEntries(Headers.prototype.entries.call(value));return structuredClone(value)}catch{return {uncloneableMetadata:true,type:typeof value}}
}
// The supplied reader owns acquisition. Its bytes and claims remain original
// evidence; a synthetic Response cannot establish when its HTTP entity ended.
export function inspectSuppliedOriginal(p,url,{check,onReceipt,localReadStartedAt}){
 check();const issues=[],values=Object.create(null),providedFields=[],object=Boolean(p)&&typeof p==='object',field=k=>Object.hasOwn(values,k)?values[k]:undefined
 const take=k=>{let value,own=false;try{own=object&&Object.hasOwn(p,k);value=object?p[k]:undefined}catch(e){issues.push({field:k,reason:'unreadable-supplied-field',...diagnostic(e)});value=undefined;own=true}check();values[k]=value;if(own||value!==undefined)providedFields.push(k);return value}
 const bodyClaim=take('bodyBase64');let bytes=null,canonical=false
 if(typeof bodyClaim==='string')try{bytes=Buffer.from(bodyClaim,'base64');canonical=bytes.toString('base64')===bodyClaim}catch(e){issues.push({field:'bodyBase64',reason:'undecodable-original-byte-claim',...diagnostic(e)})}
 check();const packet={url:null,status:null,headers:null,contentType:null,body:null,bodyComplete:null,bodyBytes:canonical?bytes.length:null,receivedBodyBytes:canonical?bytes.length:null,rawBodyBase64:typeof bodyClaim==='string'?bodyClaim:null,bodySHA256:canonical?sha(bytes):null,requestedAt:null,headersObservedAt:null,completedAt:null,localReadStartedAt,localReadCompletedAt:null,suppliedProvenanceQualified:false,suppliedOriginalMetadata:Object.create(null),suppliedProvidedFields:providedFields,suppliedValidationFailures:issues}
 onReceipt(packet)
 if(typeof bodyClaim!=='string'&&providedFields.includes('bodyBase64')){const value=clone(bodyClaim);check();packet.suppliedOriginalMetadata.bodyBase64=value}
 if(!object){check();packet.suppliedOriginalMetadata.unqualifiedReaderValue=clone(p)}
 const essentials=['url','status','headers','bodyComplete','redirected','html','requestedAt','headersObservedAt','completedAt'];let extras=[]
 try{if(object)extras=Object.keys(p)}catch(e){issues.push({field:'packet',reason:'unreadable-supplied-field-list',...diagnostic(e)})}
 for(const key of new Set([...essentials,...extras]))if(key!=='bodyBase64'){take(key);const value=clone(field(key));check();if(providedFields.includes(key))packet.suppliedOriginalMetadata[key]=value}
 check();packet.url=clone(field('url')??null);packet.status=clone(field('status')??null);packet.bodyComplete=clone(field('bodyComplete')??null)
 let headers=null
 try{const value=packet.suppliedOriginalMetadata.headers;if(!value||typeof value!=='object')throw failure('Supplied headers are not an HTTP header container','ZIETA_NATIVE_PROOF');headers=new Headers(value);check();packet.headers=Object.fromEntries(headers.entries());packet.contentType=headers.get('content-type')}catch(e){check();packet.headers=clone(packet.suppliedOriginalMetadata.headers??null);issues.push({field:'headers',reason:'unusable-original-header-container',...diagnostic(e)})}
 const bad=(condition,field,reason)=>{if(!condition)issues.push({field,reason})}
 bad(object&&!Array.isArray(p),'packet','original-packet-is-not-an-object');bad(canonical,'bodyBase64','canonical-original-byte-claim-unavailable');bad(field('url')===url,'url','original-response-URI-conflict');bad(Number.isInteger(field('status'))&&field('status')>=100&&field('status')<=599,'status','original-HTTP-status-unavailable');bad(field('bodyComplete')===true,'bodyComplete','explicit-original-completeness-unavailable');bad(field('redirected')===false,'redirected','explicit-original-manual-redirect-provenance-unavailable')
 let exceedsLimit=canonical&&bytes.length>MAX_BYTES
 if(canonical){bad(!exceedsLimit,'bodyBase64','original-entity-exceeds16777216-byte-limit');if(!exceedsLimit)try{packet.body=new TextDecoder('utf8',{fatal:true}).decode(bytes)}catch(e){issues.push({field:'bodyBase64',reason:'original-entity-is-not-valid-UTF8',...diagnostic(e)})}bad(field('html')===undefined||field('html')===packet.body,'html','decoded-text-disagrees-with-original-bytes')}
 if(headers){const length=headers.get('content-length'),encoding=(headers.get('content-encoding')??'').trim().toLowerCase();if(length!==null){const valid=/^\d+$/.test(length)&&Number.isSafeInteger(Number(length));bad(valid,'headers.content-length','invalid-original-length-claim');if(valid&&Number(length)>MAX_BYTES){exceedsLimit=true;bad(false,'headers.content-length','declared-original-entity-exceeds16777216-byte-limit')}if(valid&&(!encoding||encoding==='identity')&&canonical)bad(Number(length)===bytes.length,'headers.content-length','unencoded-original-length-disagrees-with-available-bytes')}}
 for(const [key,expected]of Object.entries({bodySHA256:packet.bodySHA256,bodyBytes:packet.bodyBytes,receivedBodyBytes:packet.receivedBodyBytes,requestedURL:url,finalURL:url,method:'GET',redirect:'manual',credentials:'omit'}))if(providedFields.includes(key))bad(field(key)===expected,key,'declared-original-claim-contradicts-available-entity-or-request')
 if(providedFields.includes('requestBody'))bad(field('requestBody')===null||field('requestBody')===undefined,'requestBody','declared-request-body-contradicts-anonymous-GET')
 for(const key of ['requestedAt','headersObservedAt','completedAt'])if(field(key)!==undefined&&field(key)!==null){const value=field(key);bad(typeof value==='string'&&Number.isFinite(Date.parse(value)),key,'unusable-declared-original-timestamp');packet[key]=clone(value)}
 const timing=['requestedAt','headersObservedAt','completedAt'].map(key=>[key,packet[key]]).filter(([,value])=>typeof value==='string'&&Number.isFinite(Date.parse(value)))
 for(let i=1;i<timing.length;i++)bad(Date.parse(timing[i-1][1])<=Date.parse(timing[i][1]),timing[i][0],'declared-original-timestamp-precedes-'+timing[i-1][0])
 check();packet.localReadCompletedAt=new Date().toISOString()
 const status=field('status')
 if(Number.isInteger(status)&&status!==200&&status>=100&&status<=599){packet.bodyUnavailableReason='Available supplied original retained with non-200 HTTP status';const error=buildHttpError({status,headers},url);Object.assign(error,{message:'Zieta supplied HTTP '+status,code:'ZIETA_NATIVE_HTTP',requestUrl:url,finalUrl:field('url')??null,abortRetries:true});throw error}
 bad(status===200,'status','original-response-is-not-HTTP200');bad((packet.contentType??'').split(';',1)[0].trim().toLowerCase()==='text/html','headers.content-type','original-HTML-MIME-unavailable')
 if(exceedsLimit){packet.bodyUnavailableReason='Available supplied original retained without body-limit qualification';throw failure('Zieta supplied original exceeds the native entity byte limit','ZIETA_BODY_LIMIT')}
 if(issues.length){packet.bodyUnavailableReason='Available supplied original claims and bytes retained without provenance qualification';throw failure('Zieta supplied original provenance is incomplete or contradictory','ZIETA_NATIVE_PROOF')}
 check();packet.suppliedProvenanceQualified=true;return packet
}
