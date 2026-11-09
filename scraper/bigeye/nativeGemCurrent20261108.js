import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { parse } from 'acorn'
import { readNativeAttributeTokens } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME='https://www.bigeye.com/', CAREERS=HOME+'careers'
const BOARD='https://jobs.gem.com/bigeye', LIST='https://api.gem.com/job_board/v0/bigeye/job_posts/'
const CONFIG_SHA='2b475335a50b80eb06256aa0928d4d2ef339537a4ee02eae0cb747bfbd446bf4'
const CLIENT_SHA='55fa53756ae8c71149dc1bd24b7f3d53cc56221bd3722d534899e1e70cda967c'
const MAX_BODY=4e6,MAX_TOTAL=24e6,MAX_ROWS=1000
const HEADERS=Object.freeze({'User-Agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'})
const sha=value=>createHash('sha256').update(value).digest('hex')
const contractErrors=new WeakSet(),httpErrors=new WeakSet()
class GemContractError extends Error {
 constructor(message,evidence){super('Bigeye native Gem '+message);contractErrors.add(this);this.name='BigeyeNativeContractError';this.failureKind='coverage_gap';this.softFailure=true;this.abortRetries=true;this.inventoryCleanupAllowed=false;if(evidence!==undefined)this.evidence=evidence}
}
const check=(ok,message,evidence)=>{if(!ok)throw new GemContractError(message,evidence)}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const plainObject=x=>object(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x))
const safeData=(x,depth=0)=>{
 check(depth<=64,'native nesting exceeds bound')
 if(x===null||typeof x!=='object'){check(['string','number','boolean'].includes(typeof x)||x===null,'native non-JSON value');if(typeof x==='number')check(Number.isFinite(x),'native nonfinite number');return}
 check(Array.isArray(x)||plainObject(x),'native inherited carrier')
 for(const k of Reflect.ownKeys(x)){
  check(typeof k==='string','native symbol carrier');const d=Object.getOwnPropertyDescriptor(x,k)
  check(d&&Object.hasOwn(d,'value'),'native accessor carrier')
  if(Array.isArray(x)&&k==='length')continue
  check(d.enumerable&&(!Array.isArray(x)||/^(?:0|[1-9]\d*)$/.test(k)),'native unreviewed property')
  safeData(d.value,depth+1)
 }
 if(Array.isArray(x))check(Object.keys(x).length===x.length,'native sparse array')
}
// Decode keys before accepting JSON; JSON.parse alone would discard conflicts.
export const parseGemJSON=text=>{
 check(typeof text==='string'&&Buffer.byteLength(text)<=MAX_BODY,'JSON body size/type changed')
 let i=0,work=0
 const space=()=>{while(/[\x20\t\r\n]/.test(text[i]||'!'))i++}
 const string=()=>{const start=i++;let escape=false;while(i<text.length){const c=text[i++];if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c==='"'){try{return JSON.parse(text.slice(start,i))}catch{throw new GemContractError('JSON string grammar changed')}}}throw new GemContractError('JSON string unterminated')}
 const value=depth=>{
  check(depth<=64&&++work<=500000,'JSON nesting/work bound');space()
  if(text[i]==='"'){string();return}
  if(text[i]==='{'){i++;space();const keys=new Set();if(text[i]==='}'){i++;return}while(true){check(text[i]==='"','JSON key grammar');const k=string();check(!keys.has(k),'duplicate decoded JSON key');keys.add(k);space();check(text[i++]===':','JSON separator');value(depth+1);space();const c=text[i++];if(c==='}')return;check(c===',','JSON object delimiter');space()}}
  if(text[i]==='['){i++;space();if(text[i]===']'){i++;return}while(true){value(depth+1);space();const c=text[i++];if(c===']')return;check(c===',','JSON array delimiter')}}
  const m=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);check(m,'JSON value grammar');i+=m[0].length
 }
 value(0);space();check(i===text.length,'JSON trailing data')
 try{return JSON.parse(text)}catch{throw new GemContractError('JSON grammar changed')}
}
const textValue=(x,label,max=200000)=>check(typeof x==='string'&&x.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x),label+' type/controls changed')
const nativeDate=(value,observedAt,label)=>{
 check(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value),label+' calendar changed')
 const m=value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,3}))?(Z|([+-])(\d\d):(\d\d))$/)
 const [y,month,day,hour,minute,second]=m.slice(1,7).map(Number)
 const days=new Date(Date.UTC(y,month,0)).getUTCDate()
 check(y>=1000&&month>=1&&month<=12&&day>=1&&day<=days&&hour<24&&minute<60&&second<60&&(!m[10]||Number(m[10])<24&&Number(m[11])<60),'invalid '+label+' calendar')
 const time=Date.parse(value);check(Number.isFinite(time)&&time<=Date.parse(observedAt),label+' future/invalid calendar')
 return value
}
const nested=(value,kind)=>{
 const fields=kind==='location'?['name']:kind==='office'?['id','name','parent_id','location','child_ids','parent_office_external_id','child_office_external_ids','deleted_at']:['id','name','parent_id','child_ids']
 check(plainObject(value)&&Object.keys(value).every(k=>fields.includes(k)),'unreviewed '+kind+' carrier',value)
 for(const [key,v]of Object.entries(value)){
  if(key==='location')nested(v,'location')
  else if(['child_ids','child_office_external_ids'].includes(key)){check(Array.isArray(v)&&v.length<=MAX_ROWS,'native nested array changed');v.forEach(s=>textValue(s,key,1000))}
  else textValue(v,key,2000)
 }
}
const ownRoleURL=value=>{
 check(typeof value==='string','native role URL type');let u;try{u=new URL(value)}catch{throw new GemContractError('native role URL grammar')}
 check(u.origin==='https://jobs.gem.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/bigeye\/[^/]+$/.test(u.pathname)&&!/%|\\/.test(value),'native role URL authority changed')
}
const ROW_FIELDS=['id','title','first_published_at','internal_job_id','content','content_plain','created_at','updated_at','departments','offices','absolute_url','location','location_type','employment_type','requisition_id']
export const decodeGemList=(models,observedAt)=>{
 safeData(models);check(Array.isArray(models)&&models.length<=MAX_ROWS,'native list schema/bound changed',models)
 check(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'local observation clock invalid')
 const ids=new Set(),observations=[],holds=[]
 for(const model of models){
  check(plainObject(model),'native posting object missing',model)
  check(typeof model.id==='string'&&model.id.trim()===model.id&&model.id.length>0&&model.id.length<=1000&&!/[\s<>\u0000-\u001f]/.test(model.id),'native posting ID unsupported',model)
  check(typeof model.title==='string'&&model.title.trim().length>0,'native posting title missing',model)
  check(!ids.has(model.id),'duplicate native posting ID',models);ids.add(model.id)
  const reasons=['no-native-typed-country-carrier','no-native-legal-employer-carrier','full-role-country-and-criteria-evidence-unreviewed']
  if(Object.keys(model).some(k=>!ROW_FIELDS.includes(k)))reasons.push('unsupported-native-fields')
  for(const [key,value]of Object.entries(model)){
   if(!ROW_FIELDS.includes(key))continue // Whole unknown business data stays held, never projected.
   if(['departments','offices'].includes(key)){check(Array.isArray(value)&&value.length<=MAX_ROWS,'native '+key+' type/bound changed',model);value.forEach(v=>nested(v,key==='offices'?'office':'department'))}
   else if(key==='location')nested(value,'location')
   else if(['first_published_at','created_at','updated_at'].includes(key))nativeDate(value,observedAt,key)
   else {textValue(value,key);if(key==='absolute_url')ownRoleURL(value)}
  }
  if(!Object.hasOwn(model,'absolute_url'))reasons.push('missing-native-role-URL')
  if(!Object.hasOwn(model,'content')||!Object.hasOwn(model,'content_plain'))reasons.push('missing-native-full-criteria')
  observations.push({nativeId:model.id,nativeURL:model.absolute_url??null,recordKind:'vacancy-rows',country:null,legalEmployer:null,qualification:'discovery-only',model})
  holds.push({nativeId:model.id,model,reasons,country:null,legalEmployer:null,postingDate:model.first_published_at??null,
   rawDates:Object.fromEntries(['first_published_at','created_at','updated_at'].filter(k=>Object.hasOwn(model,k)).map(k=>[k,model[k]])),
   rawCriteria:Object.fromEntries(['content','content_plain'].filter(k=>Object.hasOwn(model,k)).map(k=>[k,model[k]])),
   rawLocations:Object.fromEntries(['location','offices'].filter(k=>Object.hasOwn(model,k)).map(k=>[k,model[k]]))})
 }
 return {models,observations,holds}
}

// Attribute/ancestor safety is checked on source tokens; shared visibility decides
// active declarations. This does not execute any programme or certify a browser.
const tokens=html=>{
 const result=[],stack=[],voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
 const re=/<!--[^]*?-->|<![^>]*>|<\/?([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;let m
 while((m=re.exec(html))){
  if(!m[1])continue;const tag=m[1].toLowerCase()
  if(m[0].startsWith('</')){const i=stack.map(n=>n.tag).lastIndexOf(tag);if(i>=0)stack.length=i;continue}
  const pairs=readNativeAttributeTokens(m[2]),names=pairs.map(([k])=>k.toLowerCase()),attrs=Object.fromEntries(pairs),n={tag,attrs,names,parents:[...stack],raw:''}
  result.push(n)
  if(['script','style','title','textarea'].includes(tag)){
   const close=new RegExp('</'+tag+'\\s*>','gi');close.lastIndex=re.lastIndex;const end=close.exec(html);check(end,'unterminated authority document element');n.raw=html.slice(re.lastIndex,end.index);re.lastIndex=close.lastIndex
  }else if(!voids.has(tag))stack.push(n)
 }
 return result
}
const safeContext=n=>{
 for(const item of [...n.parents,n]){
  check(new Set(item.names).size===item.names.length,'duplicate authority/ancestor attributes')
  check(!item.names.some(k=>/^on/i.test(k))&&!item.names.some(k=>['hidden','inert','srcdoc'].includes(k))&&item.attrs['aria-hidden']!=='true','inert/event authority context')
  check(!['template','noscript','iframe','object','svg','math'].includes(item.tag),'unreviewed authority ancestor')
 }
}
const astNodes=tree=>{const out=[];const visit=n=>{if(!n||typeof n!=='object')return;if(n.type)out.push(n);for(const [k,v]of Object.entries(n))if(!['start','end'].includes(k)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)}};visit(tree);return out}
export const validateGemPublisher=(html,kind)=>{
 check(typeof html==='string'&&Buffer.byteLength(html)<=MAX_BODY&&['home','careers'].includes(kind),'publisher body/kind changed')
 const raw=tokens(html),doc=readVisibleNativeDocument(html)
 check(!raw.some(n=>n.tag==='base'),'base authority changed')
 const canonical=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='canonical')
 check(canonical.length===1&&canonical[0].attrs.href===(kind==='home'?'https://www.bigeye.com':CAREERS),'canonical own authority changed')
 const canonicalRaw=raw.filter(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='canonical');check(canonicalRaw.length===1,'ambiguous canonical');safeContext(canonicalRaw[0])
 const titles=doc.nodes(n=>n.tag==='title');check(titles.length===1&&/\bBigeye\b/.test(titles[0].raw||''),'own brand title missing')
 if(kind==='home'){
  const links=doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers'),all=raw.filter(n=>n.tag==='a'&&n.attrs.href==='/careers')
  check(links.length>0&&links.length===all.length,'own active careers handoff missing/ambiguous');all.forEach(safeContext)
  return {kind,canonical:canonical[0].attrs.href,careersURL:CAREERS,publicationBrand:'Bigeye',routingOnly:true,browserEquivalenceClaimed:false}
 }
 const selected=[]
 for(const [field,digest,bytes]of[['config',CONFIG_SHA,58],['client',CLIENT_SHA,937]]){
  const candidates=raw.filter(n=>n.tag==='script'&&sha(n.raw)===digest)
  check(candidates.length===1,'unknown/ambiguous current '+field+' programme');const n=candidates[0];safeContext(n)
  check(n.names.length===0&&Buffer.byteLength(n.raw)===bytes,'selected programme attributes changed')
  check(doc.nodes(v=>v.tag==='script'&&v.raw===n.raw).length===1,'selected programme inactive')
  selected.push(n)
 }
 // Other account/list declarations are conflicting even if a healthy one remains.
 check(raw.filter(n=>n.tag==='script'&&n.raw.includes('__gemJobBoardUrl')).length===1&&raw.filter(n=>n.tag==='script'&&n.raw.includes('api.gem.com/job_board/')).length===1,'conflicting native authority programme')
 const [config,client]=selected
 const statement=parse(config.raw,{ecmaVersion:'latest'}).body
 check(statement.length===1&&statement[0].type==='ExpressionStatement','config AST changed')
 const assignment=statement[0].expression
 check(assignment.type==='AssignmentExpression'&&assignment.operator==='='&&assignment.left.object?.name==='window'&&assignment.left.property?.name==='__gemJobBoardUrl'&&assignment.right.value===BOARD,'config native account changed')
 const nodes=astNodes(parse(client.raw,{ecmaVersion:'latest'})),calls=nodes.filter(n=>n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='fetch')
 check(calls.length===1&&calls[0].arguments.length===2&&calls[0].arguments[0].value===LIST,'native list AST route changed')
 const init=calls[0].arguments[1]
 check(init.type==='ObjectExpression'&&init.properties.length===1&&init.properties[0].key.name==='signal'&&init.properties[0].value.callee?.object?.name==='AbortSignal'&&init.properties[0].value.callee?.property?.name==='timeout'&&init.properties[0].value.arguments[0].value===10000,'native GET initializer changed')
 return {kind,canonical:CAREERS,publicationBrand:'Bigeye',boardURL:BOARD,listURL:LIST,configSHA256:CONFIG_SHA,clientSHA256:CLIENT_SHA,routingOnly:true,browserEquivalenceClaimed:false}
}

const cancel=body=>{try{const p=body?.cancel?.();p?.catch?.(()=>{})}catch{}}
const httpError=(receipt,cause)=>{
 const e=new Error('Bigeye native HTTP '+receipt.status,{cause});httpErrors.add(e);Object.assign(e,{status:receipt.status,statusCode:receipt.status,requestUrl:receipt.requestedURL,failureKind:[401,403,406,429].includes(receipt.status)?'blocked_or_access_denied':'upstream_http_error',upstreamOutage:true,softFailure:true,abortRetries:true,inventoryCleanupAllowed:false,receipt});return e
}
export const runBigeye=async(options={})=>{
 check(plainObject(options),'options object changed')
 check(!options.fetchPage&&!options.fetchJson,'parsed legacy callback unsupported: original Response required')
 const timeout=options.sourceTimeoutMs??90000,limit=options.maxRequests??48
 check(Number.isInteger(timeout)&&timeout>0&&timeout<=90000&&Number.isInteger(limit)&&limit>0&&limit<=48,'request/deadline budget invalid or broadened')
 check(options.fetchImpl===undefined||typeof options.fetchImpl==='function','fetch callback type changed')
 const caller=options.signal
 check(caller===undefined||caller instanceof AbortSignal,'caller signal type changed')
 const stop=new AbortController(),timer=setTimeout(()=>stop.abort(new GemContractError('aggregate deadline exceeded')),timeout)
 const aggregate=AbortSignal.any([stop.signal,...(caller?[caller]:[])])
 const receipts=[],opening={},closing={};let total=0,requests=0
 const ensure=()=>{if(caller?.aborted)throw caller.reason;if(aggregate.aborted)throw aggregate.reason}
 const at=()=>{const value=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now;const date=new Date(value);check(Number.isFinite(+date),'local observation clock invalid');return date.toISOString()}
 const read=async(url,format)=>{
  ensure();check([HOME,CAREERS,LIST].includes(url),'undeclared read URL');check(++requests<=limit,'request budget exceeded')
  const local=new AbortController(),signal=AbortSignal.any([aggregate,local.signal]),deadline=setTimeout(()=>local.abort(new GemContractError('read deadline exceeded')),15000)
  const init={method:'GET',redirect:'manual',credentials:'omit',headers:{...HEADERS,Accept:format==='json'?'application/json':'text/html'},signal}
  const receipt={requestedURL:url,method:'GET',redirect:'manual',credentials:'omit',requestHeaders:init.headers,startedAt:at(),status:null,finalURL:null,contentType:null,body:'',bodyBytes:0,bodySHA256:sha(''),complete:false}
  receipts.push(receipt);let response,reader,knownHTTP=false,listener
  const bounded=async promise=>{
   if(signal.aborted){if(caller?.aborted)throw caller.reason;throw signal.reason}
   return await Promise.race([promise,new Promise((_,reject)=>{listener=()=>reject(caller?.aborted?caller.reason:signal.reason);signal.addEventListener('abort',listener,{once:true})})]).finally(()=>{signal.removeEventListener('abort',listener)})
  }
  try{
   const pending=Promise.resolve().then(()=>{ensure();return(options.fetchImpl||globalThis.fetch)(url,init)})
   pending.then(r=>{if(signal.aborted)cancel(r?.body)},()=>{})
   response=await bounded(pending)
   if(caller?.aborted)throw caller.reason
   receipt.finalURL=response.url;check(response.url===url,'response final authority changed',receipt)
   const status=response.status;check(Number.isInteger(status)&&status>=100&&status<=599,'response status invalid',receipt);receipt.status=status;knownHTTP=status!==200
   receipt.contentType=response.headers.get('content-type')||''
   const length=response.headers.get('content-length');if(length!==null)check(/^\d+$/.test(length)&&Number(length)<=MAX_BODY,'response advertised body bound',receipt)
   const chunks=[];let bytes=0
   if(response.body){reader=response.body.getReader();while(true){const part=await bounded(reader.read());if(part.done)break;const chunk=Buffer.from(part.value);bytes+=chunk.length;total+=chunk.length;check(bytes<=MAX_BODY&&total<=MAX_TOTAL,'response decoded byte bound',receipt);chunks.push(chunk);receipt.bodyBytes=bytes;receipt.bodySHA256=sha(Buffer.concat(chunks));receipt.body=Buffer.concat(chunks).toString('utf8')}}
   const body=Buffer.concat(chunks);receipt.body=new TextDecoder('utf-8',{fatal:true}).decode(body);receipt.bodyBytes=body.length;receipt.bodySHA256=sha(body);receipt.complete=true;receipt.completedAt=at()
   ensure();if(knownHTTP)throw httpError(receipt)
   check(format==='json'?/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(receipt.contentType):/^text\/html(?:\s*;|$)/i.test(receipt.contentType),'response MIME changed',receipt)
   return receipt.body
  }catch(error){
   if(caller?.aborted)throw caller.reason
   if(knownHTTP&&!httpErrors.has(error))throw httpError(receipt,error)
   throw error
  }finally{clearTimeout(deadline);if(reader){try{const p=reader.cancel();p?.catch?.(()=>{})}catch{}}else cancel(response?.body)}
 }
 try{
  ensure();const observedAt=at()
  for(const snapshot of[opening,closing]){
   snapshot.home=validateGemPublisher(await read(HOME,'html'),'home')
   snapshot.careers=validateGemPublisher(await read(CAREERS,'html'),'careers')
   snapshot.native=decodeGemList(parseGemJSON(await read(LIST,'json')),observedAt)
  }
  check(isDeepStrictEqual(opening,closing),'opening/closing full native or authority model changed',{opening,closing})
  ensure();const jobs=[]
  const audit={source:'bigeye',recordKind:'vacancy-rows',publicationBrand:'Bigeye',legalEmployer:null,observedAt,completedAt:at(),opening,closing,receipts,
   nativeChannelObservedRecords:opening.native.models.length,observedRecordCount:opening.native.models.length,observedVacancyCount:opening.native.models.length,heldRecordCount:opening.native.holds.length,returnedRoleCount:0,
   sourceScopeComplete:false,sourceListingComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,inventoryCleanupAllowed:false,eligibilityAssessed:false,
   qualification:'Declared native-channel discovery only; no reviewed native typed-country/legal-employer/full-role positive contract; no company-zero authority.'}
  Object.defineProperty(jobs,'nativeAudit',{value:audit,configurable:true})
  attachSourceObservationEvidence(jobs,{source:'bigeye',recordKind:'vacancy-rows',observedRecordCount:audit.observedRecordCount,observedVacancyCount:audit.observedVacancyCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'discovery-only',surface:LIST,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'native-channel-only-country-and-company-scope-unverified'})
  return jobs
 }catch(error){
  if(caller?.aborted)throw caller.reason
  // Never inspect, coerce or annotate an opaque callback/abort exception.
  if(contractErrors.has(error))error.sourceAudit={source:'bigeye',opening,closing,receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  throw error
 }finally{clearTimeout(timer);if(!stop.signal.aborted)stop.abort()}
}
