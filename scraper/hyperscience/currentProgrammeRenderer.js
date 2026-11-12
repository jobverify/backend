import {createHash} from 'node:crypto';
import {types,isDeepStrictEqual} from 'node:util';
import {decodeHTML} from 'entities';
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js';
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js';

export const C0='https://www.hyperscience.ai/about-us/careers/';
export const C1=C0+'open-positions/';
export const A='https://api.ashbyhq.com/posting-api/job-board/hyperscience';
export const H='https://jobs.ashbyhq.com/Hyperscience/form/talent-community';
export const ORG='6ee4479e-f868-4423-83db-242e14f71b39';
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const sha=value=>createHash('sha256').update(value).digest('hex');
export function hold(gate,message){throw Object.assign(Error('[hyperscience] '+message),{code:'HYPERSCIENCE_PROGRAMME_HOLD',gate,reason:gate,softFailure:true,failureKind:'coverage_gap',abortRetries:true});}
export const need=(condition,gate,message)=>{if(!condition)hold(gate,message);};
export const same=isDeepStrictEqual;
export const shape=(value,keys,gate)=>need(value&&typeof value==='object'&&!types.isProxy(value)&&!Array.isArray(value)&&same(Object.keys(value).sort(),[...keys].sort()),gate,'Unknown complete field model');
const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const nativeLength=Object.getOwnPropertyDescriptor(typedArrayPrototype,'length').get;
const nativeByteLength=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength').get;
const nativeBuffer=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer').get;
const nativeSet=typedArrayPrototype.set;
const nativeResizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get;
const MAX_BODY=6291456;
function objectDescriptors(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) hold('ownership', 'Plain own-data object required');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) hold('ownership', 'Unreviewed object prototype');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string')) hold('ownership', 'Symbol data is unreviewed');
  for (const descriptor of Object.values(descriptors)) {
    if (!Object.hasOwn(descriptor, 'value')) hold('ownership', 'Accessors are unreviewed');
  }
  return descriptors;
}

function exactFields(value, fields) {
  const descriptors = objectDescriptors(value);
  const names = Object.keys(descriptors);
  if (names.length !== fields.length || names.some(name => !fields.includes(name))) hold('ownership', 'Exact raw input shape required');
  return Object.fromEntries(names.map(name => [name, descriptors[name].value]));
}

function plainSnapshot(value, ancestors = new Set(), budget = { count: 0 }, depth = 0) {
  if (++budget.count > 50000 || depth > 64) hold('ownership', 'Metadata bounds exceeded');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value) || ancestors.has(value)) hold('ownership', 'Plain acyclic JSON metadata required');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) hold('ownership', 'Unreviewed array prototype');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length.value;
    if (length > 50000 || Reflect.ownKeys(descriptors).length !== length + 1) hold('ownership', 'Dense bounded array required');
    result = [];
    for (let i = 0; i < length; i++) {
      const descriptor = descriptors[i];
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) hold('ownership', 'Array accessors/holes are unreviewed');
      result.push(plainSnapshot(descriptor.value, ancestors, budget, depth + 1));
    }
  } else {
    const descriptors = objectDescriptors(value);
    result = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === 'toJSON') hold('ownership', 'Serialization hooks are unreviewed');
      Object.defineProperty(result, key, { value: plainSnapshot(descriptor.value, ancestors, budget, depth + 1),
        enumerable: true, writable: true, configurable: true });
    }
  }
  ancestors.delete(value);
  return result;
}

function privateBytes(value, maximum = MAX_BODY) {
  if (!value || types.isProxy(value) || !types.isUint8Array(value)) hold('ownership', 'Original Buffer/Uint8Array required');
  let length, byteLength, buffer;
  try {
    length = nativeLength.call(value);
    byteLength = nativeByteLength.call(value);
    buffer = nativeBuffer.call(value);
  } catch { hold('ownership', 'Invalid native byte view'); }
  if (!length || length !== byteLength || length > maximum || types.isSharedArrayBuffer(buffer)) hold('ownership', 'Byte size/shared-memory bound');
  if (nativeResizable?.call(buffer)) hold('ownership', 'Resizable byte storage is unreviewed');
  // Numeric indexed properties belong to the native view. Reject all custom
  // own hooks without reading their values; no conversion/getter/species call.
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= length) hold('ownership', 'Custom byte properties are unreviewed');
  }
  const copy = new Uint8Array(length);
  try { nativeSet.call(copy, value, 0); }
  catch { hold('ownership', 'Native byte snapshot failed'); }
  return Buffer.from(nativeBuffer.call(copy));
}

// Bounded byte-indexed JSON parsing retains semantic paths and original UTF8
// string token spans. JSON.parse is used only on individual already-delimited
// string tokens; duplicate semantic keys are checked before object assignment.
function parseOriginal(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) hold('utf8', 'BOM is unreviewed');
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { hold('utf8', 'Strict UTF8 required'); }
  let at = 0;
  let count = 0;
  const strings = new Map();
  const token = () => { if (++count > 50000) hold('json-tokens', 'JSON lexical token bound exceeded'); };
  const whitespace = () => { while ([9, 10, 13, 32].includes(bytes[at])) at++; };
  const punctuation = expected => {
    whitespace();
    if (bytes[at] !== expected) hold('json-syntax', 'Unexpected JSON punctuation');
    token(); at++;
  };
  const string = path => {
    whitespace(); token();
    const start = at;
    if (bytes[at++] !== 34) hold('json-syntax', 'JSON string required');
    let ended = false;
    while (at < bytes.length) {
      const character = bytes[at++];
      if (character === 92) { at++; continue; }
      if (character === 34) { ended = true; break; }
    }
    if (!ended) hold('json-syntax', 'Unterminated JSON string');
    const rawToken = bytes.subarray(start, at).toString('utf8');
    let value;
    try { value = JSON.parse(rawToken); }
    catch { hold('json-syntax', 'Invalid JSON string'); }
    if (path !== null) strings.set(path, { path, value, byteStart: start, byteEndExclusive: at, rawToken });
    return value;
  };
  const pathKey = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
  function value(path, depth) {
    if (depth > 64) hold('json-depth', 'JSON depth bound exceeded');
    whitespace();
    const character = bytes[at];
    if (character === 34) return string(path);
    if (character === 123) {
      punctuation(123);
      const result = {};
      const keys = new Set();
      whitespace();
      if (bytes[at] === 125) { punctuation(125); return result; }
      while (true) {
        const key = string(null);
        if (keys.has(key)) hold('json-duplicate', 'Duplicate semantic JSON key');
        keys.add(key);
        punctuation(58);
        const child = value(`${path}/${pathKey(key)}`, depth + 1);
        Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true });
        whitespace();
        if (bytes[at] === 125) { punctuation(125); return result; }
        punctuation(44);
      }
    }
    if (character === 91) {
      punctuation(91);
      const result = [];
      whitespace();
      if (bytes[at] === 93) { punctuation(93); return result; }
      while (true) {
        result.push(value(`${path}/${result.length}`, depth + 1));
        whitespace();
        if (bytes[at] === 93) { punctuation(93); return result; }
        punctuation(44);
      }
    }
    token();
    for (const [literal, parsed] of [['null', null], ['true', true], ['false', false]]) {
      if (bytes.subarray(at, at + literal.length).toString('ascii') === literal) { at += literal.length; return parsed; }
    }
    const start = at;
    while (at < bytes.length && /[0-9eE+.-]/.test(String.fromCharCode(bytes[at]))) at++;
    const raw = bytes.subarray(start, at).toString('ascii');
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(raw) || !Number.isFinite(Number(raw))) hold('json-syntax', 'Invalid JSON value');
    return Number(raw);
  }
  const model = value('', 1);
  whitespace();
  if (at !== bytes.length) hold('json-syntax', 'Trailing bytes are unreviewed');
  return { model, strings };
}



export {exactFields,plainSnapshot,privateBytes};
export function rawJSON(value){
  const bytes=typeof value==='string'?Buffer.from(value,'utf8'):privateBytes(value,MAX_BODY);
  try{return parseOriginal(bytes).model;}catch(error){if(error.code==='HYPERSCIENCE_PROGRAMME_HOLD')throw error;hold('json','Original JSON unavailable');}
}
export const layout=value=>{need(typeof value==='string','authored','Original layout string required');return value.replace(/[\t\n\r \u00a0]+/g,' ').trim();};
export function authoredCharacters(value){
  need(typeof value==='string','authored','Original authored string required');
  need(!/\p{Cf}/u.test(value)&&![...value].some(c=>{const n=c.codePointAt(0);return n<32&&![9,10,13].includes(n)||n>=127&&n<=159;}),'authored','Unreviewed authored control/format character');
}

const POLICY_INPUTS={"C0":{"mime":"text/html; charset=UTF-8","headerNames":["accept-ch","access-control-allow-origin","alt-svc","cache-control","cf-cache-status","cf-ray","connection","content-encoding","content-security-policy","content-type","date","link","referrer-policy","server","set-cookie","strict-transport-security","transfer-encoding","vary","x-cache","x-cache-ctime","x-cache-group","x-cacheable","x-content-type-options","x-frame-options","x-nitro-cache","x-nitro-cache-from","x-nitro-rev","x-orig-cache-control","x-powered-by"],"securityHashes":["6df3bd25ab673518004a724c9e94c9140a2de5717dd67816641d5898e6800106"]},"C1":{"mime":"text/html; charset=UTF-8","headerNames":["accept-ch","access-control-allow-origin","alt-svc","cache-control","cf-cache-status","cf-ray","connection","content-encoding","content-security-policy","content-type","date","link","referrer-policy","server","set-cookie","strict-transport-security","transfer-encoding","vary","x-cache","x-cache-group","x-cacheable","x-content-type-options","x-frame-options","x-nitro-cache","x-nitro-disabled","x-nitro-disabled-reason","x-orig-cache-control","x-powered-by"],"securityHashes":["6df3bd25ab673518004a724c9e94c9140a2de5717dd67816641d5898e6800106"]},"A":{"mime":"application/json; charset=utf-8","headerNames":["access-control-allow-origin","alt-svc","ashby-session-expiry-alert-level","cache-control","cf-cache-status","cf-ray","connection","content-encoding","content-type","date","etag","referrer-policy","server","strict-transport-security","transfer-encoding","x-ashby-request-id","x-content-type-options","x-frame-options"],"securityHashes":["4f9170cb53f37df0472a54e8e27639deb12c47cb11e083bd08f3d431939f4f08"]},"O":{"mime":"text/html; charset=utf-8","headerNames":["alt-svc","ashby-session-expiry-alert-level","cache-control","cf-cache-status","cf-ray","connection","content-encoding","content-security-policy","content-type","date","referrer-policy","server","strict-transport-security","transfer-encoding","x-ashby-request-id","x-content-type-options","x-frame-options"],"securityHashes":["66dad2f8a160398c521c75974f9e87aa46db7884098dff1ca9a99fc24a0e0405"]},"H":{"mime":"text/html; charset=utf-8","headerNames":["alt-svc","ashby-session-expiry-alert-level","cache-control","cf-cache-status","cf-ray","connection","content-encoding","content-security-policy","content-type","date","referrer-policy","server","strict-transport-security","transfer-encoding","x-ashby-request-id","x-content-type-options","x-frame-options","x-robots-tag"],"securityHashes":["66dad2f8a160398c521c75974f9e87aa46db7884098dff1ca9a99fc24a0e0405"]},"M":{"mime":"application/json","headerNames":["age","alt-svc","cache-control","cf-cache-status","cf-ray","connection","content-encoding","content-type","date","etag","expires","last-modified","server","strict-transport-security","transfer-encoding","x-amz-id-2","x-amz-request-id","x-amz-server-side-encryption","x-amz-version-id"],"securityHashes":["63d527dc0f1e96161014ebf3860fc1c4da2f1b0cbb91a34666f42cb98c34d822"]},"S":{"mime":"text/javascript","headerNames":["age","alt-svc","cache-control","cf-cache-status","cf-ray","connection","content-encoding","content-type","date","etag","expires","last-modified","server","strict-transport-security","transfer-encoding","x-amz-id-2","x-amz-request-id","x-amz-server-side-encryption","x-amz-version-id"],"securityHashes":["63d527dc0f1e96161014ebf3860fc1c4da2f1b0cbb91a34666f42cb98c34d822"]}};
const SECURITY_NAMES=['content-security-policy','content-security-policy-report-only','permissions-policy','document-policy','cross-origin-opener-policy',
  'cross-origin-embedder-policy','cross-origin-resource-policy','referrer-policy','x-frame-options','x-content-type-options','strict-transport-security',
  'access-control-allow-origin','access-control-allow-credentials'];
const CONTROL_HEADERS=['refresh','location','content-location','content-disposition','www-authenticate','proxy-authenticate','authentication-info',
  'proxy-authentication-info','cf-mitigated','cf-chl-out','cf-chl-bypass','x-captcha','x-captcha-required','x-challenge'];
function originalHeaders(receipt){
  const headers=receipt.headers;
  need(headers&&typeof headers==='object'&&!Array.isArray(headers),'security','Original header map missing');
  for(const [name,value]of Object.entries(headers))need(name===name.toLowerCase()&&typeof value==='string'&&!/[\r\n\0]/.test(value),'security','Ambiguous header representation');
  if(Object.hasOwn(receipt,'responseHeaders'))need(same(receipt.responseHeaders,headers),'security','Original response header mirror disagrees');
  if(Object.hasOwn(receipt,'headerEntries')){
    need(Array.isArray(receipt.headerEntries),'security','Actual Fetch entry view malformed');const map={};
    for(const pair of receipt.headerEntries){need(Array.isArray(pair)&&pair.length===2&&pair.every(v=>typeof v==='string')&&!Object.hasOwn(map,pair[0]),'security','Ambiguous Fetch entry view');Object.defineProperty(map,pair[0],{value:pair[1],enumerable:true});}
    need(same(map,headers),'security','Original header views disagree');
  }
  return headers;
}
function securityProfile(receipt,kind,nonce){
  const headers=originalHeaders(receipt),profile=POLICY_INPUTS[kind];
  need(profile,'security','Unknown channel profile');
  need(headers['content-type']===profile.mime,'encoding','Unknown original MIME/charset');
  need(!Object.hasOwn(receipt,'contentType')||receipt.contentType===headers['content-type'],'encoding','Content-type provenance disagrees');
  need(CONTROL_HEADERS.every(name=>!Object.hasOwn(headers,name)),'security','Navigation/authentication/challenge header');
  need(Object.keys(headers).every(name=>profile.headerNames.includes(name)),'security','Unknown initial header');
  if(!['C0','C1'].includes(kind))need(!Object.hasOwn(headers,'set-cookie'),'security','Unreviewed native session header');
  const original=Object.fromEntries(SECURITY_NAMES.map(name=>[name,headers[name]??null]));
  const checked={...original};
  if(kind==='O'||kind==='H'){
    need(typeof nonce==='string'&&/^[A-Za-z0-9_-]{43}$/.test(nonce),'native-carrier','Original boot nonce unavailable');
    const token=`'nonce-${nonce}'`,policy=headers['content-security-policy'];
    need(typeof policy==='string'&&policy.split(token).length===2&&[...policy.matchAll(/'nonce-[^']+'/g)].length===1,'security','Original CSP nonce must bind unique actual boot nonce');
    checked['content-security-policy']=policy.replace(token,"'nonce-[BOUND_NATIVE_NONCE]'");
  }
  need(profile.securityHashes.includes(sha(JSON.stringify(checked))),'security','Unreviewed original initial policy');
  return {original,initialPolicySHA256:sha(JSON.stringify(checked)),nonceBound:kind==='O'||kind==='H',rawSecurityUnchanged:true};
}

export function readRawPacket(record,expectedURL,kind){
  need(typeof expectedURL==='string'&&typeof kind==='string'&&Object.hasOwn(POLICY_INPUTS,kind),'ownership','Qualified raw channel arguments required');
  const own=exactFields(record,['body','receipt']);
  const bytes=privateBytes(own.body,kind==='S'?6291456:kind==='M'?1048576:4194304),receipt=plainSnapshot(own.receipt);
  need(receipt.requestedURL===expectedURL&&receipt.finalURL===expectedURL&&receipt.method==='GET'&&receipt.status===200,'transport','Exact original response route/method/status required');
  need(receipt.cache==='no-store'&&receipt.credentials==='omit'&&receipt.redirect==='manual','transport','Original anonymous bounded options required');
  if(Object.hasOwn(receipt,'requestHeaders')){
    need(receipt.requestHeaders&&typeof receipt.requestHeaders==='object'&&!Array.isArray(receipt.requestHeaders),'transport','Declared request headers unavailable');
    need(Object.entries(receipt.requestHeaders).every(([name,value])=>['accept','user-agent','cache-control','pragma'].includes(name.toLowerCase())&&typeof value==='string'&&!/[\r\n\0]/.test(value)),'transport','Unreviewed supplied auth/cookie/session request header');
  }
  for(const key of ['suppliedCookieOrAuthOrSessionData','suppliedCandidateOrApplicationIdentifiers','suppliedFieldValues','formSubmission','mutation','publisherJavaScriptExecuted'])need(!Object.hasOwn(receipt,key)||receipt[key]===false,'transport','Unreviewed supplied input/execution metadata');
  need(receipt.bodyBytes===bytes.length&&receipt.bodySHA256===sha(bytes),'transport','Original complete entity digest/size mismatch');
  need(!Object.hasOwn(receipt,'consumedBodyBytes')||(Number.isSafeInteger(receipt.consumedBodyBytes)&&receipt.consumedBodyBytes===bytes.length),'transport','Explicit body consumption contradicts the complete original entity');
  for(const key of ['discardedOverflowBytes','overflowBytes'])need(!Object.hasOwn(receipt,key)||(Number.isSafeInteger(receipt[key])&&receipt[key]===0),'transport','Explicit discarded overflow contradicts complete entity retention');
  need(!Object.hasOwn(receipt,'bodyComplete')||receipt.bodyComplete===true,'transport','Incomplete original body');
  need(!Object.hasOwn(receipt,'streamDone')||receipt.streamDone===true,'transport','Incomplete original stream');
  need(!Object.hasOwn(receipt,'decodedPrefixOnly')||receipt.decodedPrefixOnly===false,'transport','Prefix cannot qualify');
  need(!Object.hasOwn(receipt,'error')||receipt.error===null,'transport','Original response error');
  for(const key of ['requestedAt','completedAt'])need(typeof receipt[key]==='string'&&Number.isFinite(Date.parse(receipt[key])),'transport','Original clocks unavailable');
  need(Date.parse(receipt.completedAt)>=Date.parse(receipt.requestedAt)&&Date.parse(receipt.completedAt)-Date.parse(receipt.requestedAt)<=20000,'transport','Individual complete response bound');
  let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{hold('encoding','Invalid original UTF8');}
  need(!text.startsWith('\ufeff')&&Buffer.from(text,'utf8').equals(bytes),'encoding','Unreviewed entity encoding');
  const security=(kind==='O'||kind==='H')?null:securityProfile(receipt,kind,null);
  const completeTransportMetadataQualified=Object.hasOwn(receipt,'headerEntries')&&receipt.bodyComplete===true&&receipt.streamDone===true&&receipt.decodedPrefixOnly===false&&typeof receipt.responseAt==='string'&&Number.isFinite(Date.parse(receipt.responseAt))
    &&Date.parse(receipt.responseAt)>=Date.parse(receipt.requestedAt)&&Date.parse(receipt.responseAt)<=Date.parse(receipt.completedAt);
  return {bytes,text,receipt,security,completeTransportMetadataQualified,
    original:{receipt,bodyBase64:bytes.toString('base64'),bodyBytes:bytes.length,bodySHA256:sha(bytes),actualHeaderEntriesPresent:Object.hasOwn(receipt,'headerEntries')}};
}

const active=({node,ancestors})=>!node.inert&&!node.nativeTagUnqualified&&!ancestors.some(n=>n.inert||n.nativeTagUnqualified||['svg','math','template','noscript','object'].includes(n.tag));
export function documentEntries(text){
  need(typeof text==='string','ownership','Original HTML string required');
  const document=readNativeDocument(text),entries=[];
  const walk=(node,ancestors)=>{entries.push({node,ancestors});for(const child of node.children)if(typeof child!=='string')walk(child,[...ancestors,node]);};
  walk(document.nodes(n=>n.tag==='root')[0],[]);return {document,entries};
}
export function ownArray(value){
  need(Array.isArray(value)&&!types.isProxy(value)&&Object.getPrototypeOf(value)===Array.prototype,'ownership','Own plain array required');
  const descriptors=Object.getOwnPropertyDescriptors(value),length=descriptors.length.value;
  need(length<=50000&&Reflect.ownKeys(descriptors).length===length+1,'ownership','Dense bounded array required');
  return Array.from({length},(_,i)=>{const d=descriptors[i];need(d&&Object.hasOwn(d,'value'),'ownership','Array accessors/holes unreviewed');return d.value;});
}
export function originalText(node,depth=0){
  need(depth<=64,'ownership','Authored tree bound');if(typeof node==='string')return decodeHTML(node);
  const descriptors=objectDescriptors(node);need(descriptors.children,'ownership','Original parsed text children unavailable');
  return ownArray(descriptors.children.value).map(child=>originalText(child,depth+1)).join('');
}
function scanAttributes(text,{native=false,authored=false}={}){
  let at=0;const result=[];
  while((at=text.indexOf('<',at))!==-1){
    if(text.startsWith('<!--',at)){need(!native&&!authored,'native-carrier','Unreviewed comment carrier');const end=text.indexOf('-->',at+4);need(end!==-1,'native-carrier','Unclosed comment');at=end+3;continue;}
    if(/^<!doctype\s+html\s*>/i.test(text.slice(at))){at=text.indexOf('>',at)+1;continue;}
    const match=/^<\/?([a-z][a-z0-9:_-]*)(?=[\s/>])/i.exec(text.slice(at));
    need(match,'native-carrier','Unreviewed HTML token');
    const closing=text[at+1]==='/';let end=at+match[0].length,quote=null;
    for(;end<text.length;end++){const c=text[end];if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
    need(end<text.length,'native-carrier','Unclosed HTML tag');
    const tag=match[1].toLowerCase();
    if(!closing){const tokens=readNativeAttributeTokens(text.slice(at+match[0].length,end)),names=new Set();for(const[name]of tokens){need(!names.has(name),authored?'authored':'native-carrier','Duplicate original HTML attribute');names.add(name);}result.push({tag,tokens});}
    at=end+1;
    if(!closing&&['script','style','title','noscript'].includes(tag)){const expression=new RegExp('</'+tag+'[\\t\\n\\f\\r ]*>','ig');expression.lastIndex=at;const close=expression.exec(text);need(close,'native-carrier','Unclosed raw-text carrier');at=expression.lastIndex;}
  }
  return result;
}

const allowedTags=new Set(['root','h2','h3','p','strong','a','ul','li','em','br','div']);
export function authoredProjection(html,options={}){
  const descriptors=objectDescriptors(options);need(Object.keys(descriptors).every(key=>key==='philosophy')&&(!descriptors.philosophy||typeof descriptors.philosophy.value==='boolean'),'ownership','Authored options must be own boolean data');
  const philosophy=descriptors.philosophy?.value??false;
  need(typeof html==='string'&&Buffer.byteLength(html)<=4194304,'authored','Original authored HTML unavailable');
  authoredCharacters(html);need(!/<!--|<!|<\?/.test(html),'authored','Unreviewed authored declaration/comment');
  scanAttributes(html,{authored:true});const {document,entries}=documentEntries(html);
  for(const {node,ancestors}of entries){
    need(allowedTags.has(node.tag)&&!node.inert&&!node.nativeTagUnqualified&&ancestors.every(n=>!n.inert),'authored','Unreviewed authored tag/visibility');
    const attrs=node.attrs;
    if(node.tag==='a'){
      shape(attrs,['target','rel','href'],'authored');
      need(attrs.target==='_blank'&&['noopener noreferrer','noopener noreferrer nofollow'].includes(attrs.rel),'authored','Unreviewed authored link semantics');
      const href=decodeHTML(attrs.href);authoredCharacters(href);
      need(['https://www.hyperscience.ai/why-were-a-leader/#:~:text=Hyperscience%20has%20been%20named%20to,top%20spot%20on%20the%20list.','mailto:recruiting@hyperscience.ai','http://hyperscience.ai'].includes(href),'authored','Unreviewed authored link target');
    }else if(Object.keys(attrs).length){
      shape(attrs,['style'],'authored');need((['p','ul'].includes(node.tag)&&attrs.style==='min-height:1.5em')||(node.tag==='div'&&attrs.style==='min-height:1.2em;margin-top:0px;margin-bottom:0px'),'authored','Unreviewed authored style');
    }
    if(philosophy)need(['root','p','strong','ul','li'].includes(node.tag),'authored','Unreviewed philosophy tag');
  }
  const render=node=>{
    if(typeof node==='string'){const value=decodeHTML(node);authoredCharacters(value);return value;}
    const children=node.children.map(render).join('');
    if(node.tag==='br')return '\n';
    if(['h2','h3'].includes(node.tag))return '\n\n'+children.toUpperCase()+'\n\n';
    if(['p','div','ul'].includes(node.tag))return '\n\n'+children+'\n\n';
    if(node.tag==='li')return '\n\n - '+children.trim()+'\n\n';
    if(node.tag==='a'){const target=decodeHTML(node.attrs.href);return children+(target.startsWith('mailto:')&&children===target.slice(7)?'':' '+target);}
    return children;
  };
  const originalProjection=render(document.nodes(n=>n.tag==='root')[0]);
  return {originalHTML:html,projection:originalProjection,comparisonText:layout(originalProjection),authoredHTMLSHA256:sha(html),
    projectionScope:'Reviewed source block/list/heading/link layout only; original HTML remains unchanged'};
}

const ORGANIZATION_SHA256='8e49702fcf1c3446fbed4c0f60142bb1ee117fe492c5160222653dd85f055d3e';
const NATIVE_STYLE_HASHES=["4650e39d871827db22654002532bf25b095d9aad4a90cb76db55ab0d2c370e9d","0a8cc339cb7f7134745060763e6d9b9f7e982ac164810e88bf43d0b3d7a0b3f0"];
const NATIVE_NOSCRIPT_HASHES=["99337be7d9c733472c6206694eaabe409f521fbd76fb19ed71d12a07e3eaf755"];
export function readNativePacket(record,options={}){
  const descriptors=objectDescriptors(options);need(Object.keys(descriptors).every(key=>key==='intake')&&(!descriptors.intake||typeof descriptors.intake.value==='boolean'),'ownership','Native options must be own boolean data');
  const intake=descriptors.intake?.value??false;
  const receipt=plainSnapshot(exactFields(record,['body','receipt']).receipt),url=receipt.requestedURL;
  const role=/^https:\/\/jobs\.ashbyhq\.com\/hyperscience\/([a-f0-9-]{36})$/.exec(url);
  need(intake?url===H:role&&UUID.test(role[1]),'transport','Exact current declared native route required');
  const packet=readRawPacket(record,intake?H:url,intake?'H':'O');
  const lex=scanAttributes(packet.text,{native:true}),parsed=documentEntries(packet.text),entries=parsed.entries;
  const allowed=new Set(['root','html','head','meta','link','title','script','style','body','noscript','div']);
  need(entries.every(e=>allowed.has(e.node.tag)),'native-carrier','Foreign/extra native publication carrier');
  const scripts=entries.filter(e=>e.node.tag==='script'),boots=scripts.filter(e=>e.node.raw?.includes('window.__appData'));
  need(boots.length===1&&active(boots[0])&&boots[0].ancestors.map(n=>n.tag).join('/')==='root/html/body','native-carrier','Unique active direct HTML boot required');
  shape(boots[0].node.attrs,['nonce'],'native-carrier');
  const boot=boots[0].node,assignment=/^\s*window\.__appData\s*=\s*/.exec(boot.raw);need(assignment,'native-carrier','Unconditional boot assignment required');
  const start=assignment[0].length;let end=null,depth=0,quoted=false,escape=false;
  for(let i=start;i<boot.raw.length;i++){const c=boot.raw[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if((c==='}'||c===']')&&!--depth){end=i+1;break;}}
  need(end!==null&&boot.raw[start]==='{','native-carrier','Complete original boot JSON required');
  const rawAppData=boot.raw.slice(start,end),model=rawJSON(rawAppData);
  shape(model,['ddRumApplicationId','ddRumClientToken','environment','maintenanceMode','schedulingMaintenanceMode','organization','posting','jobBoard','routerPrefix','recaptchaUniversalPublicSiteKey'],'native-model');
  need(model.environment==='production'&&model.maintenanceMode===false&&model.schedulingMaintenanceMode===false&&model.routerPrefix==='/'&&model.jobBoard===null,'native-model','Native availability/programme changed');
  need(sha(JSON.stringify(model.organization))===ORGANIZATION_SHA256,'native-organization','Unknown full account/theme/configuration');
  need(intake?model.posting===null:model.posting?.id===role[1],'native-model','Own/form model identity changed');
  const nonce=boot.attrs.nonce,nonceMetas=entries.filter(e=>e.node.attrs.id==='csp-nonce');
  need(nonceMetas.length===1&&active(nonceMetas[0])&&nonceMetas[0].node.tag==='meta'&&nonceMetas[0].node.attrs.content===nonce&&packet.text.split(nonce).length===3,'native-carrier','Unique original head/boot nonce binding required');
  const security=securityProfile(packet.receipt,intake?'H':'O',nonce);packet.security=security;
  const outside=boot.raw.slice(0,start)+'[ORIGINAL_NATIVE_MODEL]'+boot.raw.slice(end),base='https://cdn.ashbyprd.com/frontend_non_user/',offsets=[236,2798,3157,4035];
  const version=outside.slice(offsets[0]+base.length,offsets[0]+base.length+40);let checked=outside;
  need(outside.length===4929&&/^[a-f0-9]{40}$/.test(version),'native-bootstrap','Unknown native loader/deployment');
  for(const at of [...offsets].reverse()){need(outside.slice(at,at+base.length+41)===base+version+'/','native-bootstrap','Mixed literal native deployment');checked=checked.slice(0,at+base.length)+'0'.repeat(40)+checked.slice(at+base.length+40);}
  need(sha(checked)==='ffa62de326939b91a2ce1789170cf5465a44e942e46f1a0443543023f6b73ad8','native-bootstrap','Unknown complete original loader');
  const links=entries.filter(e=>e.node.tag==='link').map(e=>({attrs:e.node.attrs,ancestorTags:e.ancestors.map(n=>n.tag)}));
  const comparable=links.map(({attrs,ancestorTags})=>{const copy={...attrs};if(copy.href?.startsWith('https://cdn.ashbyprd.com/')){
    const match=/^https:\/\/cdn\.ashbyprd\.com\/(cdn_assets|frontend_non_user)\/([a-f0-9]{40})\//.exec(copy.href);need(match&&match[2]===version,'native-head','Mixed native head deployment');copy.href=copy.href.slice(0,match[0].length-41)+'0'.repeat(40)+'/'+copy.href.slice(match[0].length);}
    need(ancestorTags.join('/')==='root/html/head','native-carrier','Native resource outside head');return copy;});
  need(links.length===(intake?8:12)&&sha(JSON.stringify(comparable))===(intake?'e6ce0249ac4052a8210815d13f16e6d95410ae2be076ca6ed7a375f456209152':'8c51e5237baa661cc1163c734fec0f70b5da8ae8f32499ebdc62d7464429990a'),'native-head','Unknown complete native head resource declarations');
  const titles=entries.filter(e=>e.node.tag==='title');need(titles.length===1&&active(titles[0])&&titles[0].ancestors.map(n=>n.tag).join('/')==='root/html/head','native-carrier','Unique active native title required');
  const expected=intake?'Talent Community  - Hyperscience':model.posting.title+' @ Hyperscience';
  need(decodeHTML(titles[0].node.raw)===expected,'native-carrier','Native document title contradiction');
  const metas=entries.filter(e=>e.node.tag==='meta'),head={};
  for(const entry of metas){need(active(entry)&&entry.ancestors.map(n=>n.tag).join('/')==='root/html/head','native-carrier','Active HTML head metadata required');const attrs=entry.node.attrs,key=attrs.name??attrs.property??(Object.hasOwn(attrs,'charset')?'charset':null);
    need(typeof key==='string'&&!Object.hasOwn(head,key),'native-head','Unknown/duplicate native metadata');shape(attrs,key==='charset'?['charset']:key==='csp-nonce'?['name','id','content']:key.startsWith('og:')?['property','content']:['name','content'],'native-head');head[key]=attrs;}
  shape(head,['charset','viewport','theme-color','csp-nonce','title','description','twitter:card','og:url','og:type','og:title','og:description','og:image','twitter:title','twitter:description'],'native-head');
  need(head.charset.charset==='utf-8'&&head['og:url'].content===(intake?'https://jobs.ashbyhq.com/hyperscience/form/talent-community':url),'native-head','Original native OG/charset identity changed');
  for(const[key,value]of Object.entries({'viewport':'width=device-width, initial-scale=1, shrink-to-fit=no','theme-color':'#473BCE','twitter:card':'summary','og:type':'website'}))need(head[key].content===value,'native-head','Unknown head presentation');
  for(const key of ['title','og:title','twitter:title'])need(head[key].content===(key==='title'||intake?expected:model.posting.title),'native-head','Native title metadata contradiction');
  const descriptions=['description','og:description','twitter:description'].map(key=>head[key].content);
  need(descriptions.every(v=>typeof v==='string'&&v.length>0&&v===descriptions[0]),'native-head','Native description metadata differs');
  for(const value of [expected,...descriptions,head['og:url'].content]){authoredCharacters(value);authoredCharacters(decodeHTML(value));}
  const ld=scripts.filter(e=>e.node.attrs.type==='application/ld+json');
  need(scripts.length===(intake?1:2)&&ld.length===(intake?0:1)&&lex.filter(t=>t.tag==='script').length===scripts.length,'native-carrier','Unknown/missing/extra original script/schema');
  if(!intake){need(active(ld[0])&&ld[0].ancestors.map(n=>n.tag).join('/')==='root/html/head','native-carrier','Active HTML own schema required');shape(ld[0].node.attrs,['type'],'native-carrier');}
  const styles=entries.filter(e=>e.node.tag==='style'),noscripts=entries.filter(e=>e.node.tag==='noscript');
  need(same(styles.map(e=>sha(e.node.raw)),NATIVE_STYLE_HASHES)&&same(noscripts.map(e=>sha(e.node.raw)),NATIVE_NOSCRIPT_HASHES),'native-carrier','Unknown native inline presentation/fallback');
  const mounts=entries.filter(e=>e.node.attrs.id==='root'),visible=readVisibleNativeDocument(packet.text,{strict:true});
  need(mounts.length===1&&active(mounts[0])&&same(mounts[0].node.attrs,{id:'root'})&&visible.nodes(n=>n.attrs.id==='root').length===1&&visible.text(visible.nodes(n=>n.tag==='root')[0])==='','native-carrier','Unknown/hidden native mount/additional publication');
  return {packet,originalAppData:model,originalLD:intake?null:rawJSON(ld[0].node.raw),rawAppData,rawLD:intake?null:ld[0].node.raw,
    documentTitle:expected,head,headDescriptions:descriptions,links,route:{url,id:role?.[1]??null,intake},declaration:{version,manifestURL:base+version+'/.vite/manifest.json'},securityFacts:security};
}
