import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {parse} from 'acorn'
import {decodeHTML} from 'entities'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

// Reviewed as data, never evaluated. This profile covers the current career
// factory's public feed and its error-only Workable fallback, not a browser.
const CAREERS='https://leena.ai/careers'
const BUNDLE='https://leena.ai/_next/static/chunks/pages/careers-899cb3bac7400f27.js'
const FEED='https://bots.leena.ai/api/website/careers/jobs'
const ACCOUNT='https://apply.workable.com/api/v1/accounts/leena-ai'
const UID='85ac63c3-e445-4568-8ba6-f8bcd55f9c2a'
const HTML_SHA='9ff38586012d7b843575f4ed0d04d56e54885088295fd758417b75acac7ebb8a'
const HTML_FRAME_SHA='f6f31d7df7750e2bdeaefeb4c0f8786cf8059bc469d5a2d3af5ca87db911b366'
const BUNDLE_SHA='378ca87d08ba1705fd9e81af142fc3fff753867c101d712bf1705768861b2842'
const HEADERS={'User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,application/javascript,text/javascript,*/*;q=0.8'}
const MAX_BODY=3*1024*1024, MAX_ROWS=40, MAX_READS=96
const sha=value=>createHash('sha256').update(value).digest('hex')
class ContractError extends Error {
 constructor(message){super('Leena AI native '+message);this.name='LeenaNativeContractError';this.failureKind='parser_or_contract_error';this.abortRetries=true}
}
const fail=message=>{throw new ContractError(message)}
const assert=(ok,message)=>{if(!ok)fail(message)}
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const exactKeys=(value,keys,label)=>{
 assert(record(value),label+' object changed')
 assert(Object.keys(value).every(key=>keys.includes(key))&&keys.every(key=>Object.hasOwn(value,key)),label+' fields changed')
}
const plain=(value,label,optional=false,max=1000)=>{
 if(optional&&value===null)return null
 assert(typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!/[\u0000-\u001f<>]/.test(value),label+' text changed')
 return value
}
const canonical=value=>{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'
 if(record(value))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}'
 return JSON.stringify(value)
}

// A bounded lexical preflight preserves JSON.parse's value semantics while
// refusing decoded duplicate keys before JSON.parse can silently discard one.
export const parseNativeJSON=text=>{
 assert(typeof text==='string'&&Buffer.byteLength(text)<=MAX_BODY,'JSON size changed')
 let i=0,steps=0
 const space=()=>{while(/[\x20\t\r\n]/.test(text[i]||'!'))i++}
 const string=()=>{
  const start=i++;let escaped=false
  while(i<text.length){const c=text[i++];if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c==='"'){try{return JSON.parse(text.slice(start,i))}catch{fail('JSON string grammar changed')}}}
  fail('JSON string is unterminated')
 }
 const value=depth=>{
  assert(depth<=64&&++steps<=500000,'JSON nesting or work bound exceeded');space()
  if(text[i]==='"'){string();return}
  if(text[i]==='{'){
   i++;space();const keys=new Set();if(text[i]==='}'){i++;return}
   while(true){assert(text[i]==='"','JSON object key changed');const key=string();assert(!keys.has(key),'JSON duplicate decoded key');keys.add(key);space();assert(text[i++]===':','JSON separator changed');value(depth+1);space();const c=text[i++];if(c==='}')return;assert(c===',','JSON object delimiter changed');space()}
  }
  if(text[i]==='['){i++;space();if(text[i]===']'){i++;return}while(true){value(depth+1);space();const c=text[i++];if(c===']')return;assert(c===',','JSON array delimiter changed')}}
  const m=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)
  assert(m,'JSON value grammar changed');i+=m[0].length
 }
 value(0);space();assert(i===text.length,'JSON trailing data changed')
 try{return JSON.parse(text)}catch{fail('JSON grammar changed')}
}

const nativeDate=(value,now,label)=>{
 assert(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value),label+' calendar changed')
 const time=Date.parse(value)
 assert(Number.isFinite(time)&&new Date(time).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z')&&time<=now,label+' impossible or future calendar')
 return value
}
const countryNames=new Intl.DisplayNames(['en'],{type:'region'})
const shortNames=new Intl.DisplayNames(['en'],{type:'region',style:'short'})
const country=(name,code)=>{
 assert(typeof code==='string'&&/^[A-Z]{2}$/.test(code)&&!['ZZ','EU','UN','XA','XB','QO'].includes(code),'country code changed')
 assert(typeof name==='string'&&countryNames.of(code)!==code&&[countryNames.of(code),shortNames.of(code)].includes(name)&&((code==='IN')===(name==='India')),'country pair contradicts or is unknown')
}
const publicURL=(value,origin,label)=>{
 assert(typeof value==='string',label+' URL changed');let url
 try{url=new URL(value)}catch{fail(label+' URL changed')}
 assert(url.origin===origin&&!url.username&&!url.password&&!url.search&&!url.hash,label+' URL authority changed')
 return url
}
const shortcode=value=>assert(typeof value==='string'&&/^[A-Z0-9]{6,32}$/.test(value),'shortcode changed')
export const decodeDiscoveryFeed=(payload,now=Date.now())=>{
 exactKeys(payload,['jobs','departments','locations','fetchedAt'],'discovery')
 // Cache observation has no chronology relation to this local acquisition clock.
 // Keep strict ISO/calendar validation; raw fetchedAt and local observedAt/receipts
 // remain separate. Native vacancy creation/publication still use their own bounds.
 nativeDate(payload.fetchedAt,Infinity,'feed fetchedAt')
 for(const key of ['departments','locations'])assert(Array.isArray(payload[key])&&payload[key].length<=200&&payload[key].every(v=>typeof v==='string'&&plain(v,'discovery option')),'discovery options changed')
 assert(Array.isArray(payload.jobs)&&payload.jobs.length<=MAX_ROWS,'discovery row bound changed')
 const ids=new Set(),codes=new Set(),urls=new Set()
 for(const row of payload.jobs){
  exactKeys(row,['id','shortcode','title','department','location','city','country','countryCode','workplaceType','url','applicationUrl','createdAt'],'discovery row')
  plain(row.id,'opaque proxy ID');shortcode(row.shortcode);plain(row.title,'discovery title');plain(row.department,'discovery department');plain(row.location,'discovery location');plain(row.city,'discovery city',true)
  country(row.country,row.countryCode);nativeDate(row.createdAt,now,'discovery creation metadata')
  assert(row.location===(row.city?row.city+', ':'')+row.country,'discovery location contradicts its typed country/city')
  assert(['on_site','hybrid','remote'].includes(row.workplaceType),'discovery workplace changed')
  const role=publicURL(row.url,'https://leena-ai.workable.com','discovery role')
  assert(/^\/jobs\/[1-9]\d*$/.test(role.pathname),'discovery role route changed')
  const app=publicURL(row.applicationUrl,'https://leena-ai.workable.com','declared application')
  assert(app.pathname===role.pathname+'/candidates/new','declared application relation changed')
  assert(!ids.has(row.id)&&!codes.has(row.shortcode)&&!urls.has(row.url),'discovery duplicate identity')
  ids.add(row.id);codes.add(row.shortcode);urls.add(row.url)
 }
 return {rows:payload.jobs,india:payload.jobs.filter(row=>row.country==='India'&&row.countryCode==='IN')}
}

// Full original account is compared at closing in memory. Only these public
// identity fields leave the reader: application config/mailbox are not evidence.
export const decodeNativeAccount=payload=>{
 assert(record(payload),'account object changed')
 const keys=['id','uid','name','subdomain','url','logo','languages','details']
 assert(Object.keys(payload).every(key=>keys.includes(key)),'account authority fields changed')
 assert(Number.isSafeInteger(payload.id)&&payload.id>0&&payload.uid===UID&&payload.name==='Leena AI'&&payload.subdomain==='leena-ai'&&payload.url==='https://leena.ai/','account reciprocal identity changed')
 if(Object.hasOwn(payload,'logo'))assert(payload.logo===null,'unreviewed account logo')
 if(Object.hasOwn(payload,'languages')){
  exactKeys(payload.languages,['default','options'],'account languages');assert(payload.languages.default==='en'&&Array.isArray(payload.languages.options)&&payload.languages.options.length===1,'account language changed')
  const item=payload.languages.options[0];exactKeys(item,['enabled','name','published','visible'],'account language option');assert(item.enabled===true&&item.name==='en'&&item.published===true&&item.visible===true,'account visibility changed')
 }
 if(Object.hasOwn(payload,'details')){
  exactKeys(payload.details,['overview','ofccp','ofccpDisability','ofccpVeteran','applyWithIndeed','applyWithLinkedin','departmentsPublicLevel','guessAvatar','hasPrivacyPolicies','mailbox'],'account configuration')
  exactKeys(payload.details.overview,['description'],'account overview');assert(payload.details.overview.description==='','unreviewed account overview criteria')
  for(const key of ['ofccp','ofccpDisability','ofccpVeteran','applyWithIndeed','guessAvatar','hasPrivacyPolicies'])assert(typeof payload.details[key]==='boolean','account configuration type changed')
  assert(payload.details.departmentsPublicLevel===1,'account department scope changed')
  exactKeys(payload.details.applyWithLinkedin,['appId','awliOrganizationId','rscOrganizationId'],'unexecuted application configuration')
  for(const value of Object.values(payload.details.applyWithLinkedin))plain(value,'unexecuted application configuration')
  exactKeys(payload.details.mailbox,['email','enabled','text'],'unexecuted mailbox configuration')
  assert(typeof payload.details.mailbox.email==='string'&&payload.details.mailbox.enabled===false&&payload.details.mailbox.text===null,'mailbox configuration changed')
 }
 return Object.fromEntries(['id','uid','name','subdomain','url'].map(key=>[key,payload[key]]))
}
const location=(value,hidden)=>{
 exactKeys(value,hidden?['city','country','countryCode','region','hidden']:['city','country','countryCode','region'],'native worksite')
 country(value.country,value.countryCode);plain(value.city,'native city',true);plain(value.region,'native region',true)
 if(hidden)assert(value.hidden===false,'native worksite hidden or unreviewed')
 return value
}
const roleFields=detail=>{
 assert(record(detail),'role object changed')
 assert(!('type' in detail)||Object.hasOwn(detail,'type'),'inherited role type carrier changed')
 return ['id','shortcode','title','remote','location','locations','state','isInternal','code','published','type','language','department','accountUid','approvalStatus','workplace','description','requirements','benefits'].filter(key=>key!=='type'||Object.hasOwn(detail,'type'))
}
const criterion=(html,label)=>{
 assert(typeof html==='string'&&html.length<=200000&&html.trim().length>20,label+' full criteria missing or changed')
 // Both genuine roles use these plain, attribute-free authored elements. Any
 // extra carrier (including hidden/inert text or country metadata) is held.
 let cursor=0
 for(const match of html.matchAll(/<[^>]*>/g)){
  assert(!html.slice(cursor,match.index).includes('<'),label+' malformed criteria')
  assert(/^<\/?(?:p|h3|strong|em|ul|li|br|u)\s*\/?\s*>$/i.test(match[0]),label+' unreviewed authored carrier')
  cursor=match.index+match[0].length
 }
 assert(!html.slice(cursor).includes('<'),label+' malformed criteria')
 const text=decodeHTML(html.replace(/<\/(?:p|h3|li|ul)>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,''))
 assert(text.trim().length>20&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text),label+' substantive criteria missing')
 return text.trim()
}
export const decodeNativeRole=(detail,proxy,account,observedAt)=>{
 exactKeys(detail,roleFields(detail),'role')
 assert(Number.isSafeInteger(detail.id)&&detail.id>0&&detail.shortcode===proxy.shortcode&&detail.title===proxy.title&&detail.accountUid===account.uid,'role identity/account changed')
  assert(String(detail.id)===new URL(proxy.url).pathname.split('/').at(-1),'native integer ID disagrees with the declared role route')
 assert(detail.state==='published'&&detail.isInternal===false&&detail.approvalStatus==='approved','role public state changed')
 assert(detail.code===null||typeof detail.code==='string'&&detail.code.length<=200,'role code changed')
 assert(typeof detail.remote==='boolean'&&['on_site','hybrid','remote'].includes(detail.workplace)&&detail.workplace===proxy.workplaceType&&(detail.remote===(detail.workplace==='remote')),'role workplace contradiction')
 assert((!Object.hasOwn(detail,'type')||detail.type==='full')&&detail.language==='en','role native type/language changed')
 assert(Array.isArray(detail.department)&&detail.department.length>0&&detail.department.length<=20,'role department changed');detail.department.forEach(v=>plain(v,'native department'))
 nativeDate(detail.published,Date.parse(observedAt),'native publication')
 const primary=location(detail.location,false)
 assert(primary.country===proxy.country&&primary.countryCode===proxy.countryCode,'detail/discovery country contradiction')
  assert(proxy.city===null||primary.city===proxy.city,'detail/discovery primary city contradiction')
 assert(primary.countryCode==='IN','detail has no own typed India worksite')
 assert(Array.isArray(detail.locations)&&detail.locations.length>0&&detail.locations.length<=20,'native worksite list changed')
 const places=detail.locations.map(value=>location(value,true))
 assert(places.every(value=>value.countryCode==='IN'),'native alternate worksite country contradiction')
 assert(places.some(value=>['city','country','countryCode','region'].every(key=>value[key]===primary[key])),'primary and alternate native worksites disagree')
 const sections={description:detail.description,requirements:detail.requirements,benefits:detail.benefits}
 const content=Object.entries(sections).map(([key,value])=>key!=='description'&&value===''?'':criterion(value,key))
 return {
  title:detail.title,company:'Leena AI',source:'leenaai',jobId:detail.shortcode,requisitionId:detail.shortcode,
  nativeId:detail.id,discoveryProxyId:proxy.id,sourceUrl:proxy.url,applyUrl:proxy.applicationUrl,link:proxy.url,
  country:'India',city:null,location:null,remoteStatus:detail.workplace==='remote'?'Remote':detail.workplace==='hybrid'?'Hybrid':'On-site',
  employmentType:null,department:detail.department.join(' / '),legalEmployer:null,
  postingDate:detail.published,closingDate:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  jobDescription:content[0]+(content[1]?'\n\nRequirements\n'+content[1]:'')+(content[2]?'\n\nBenefits\n'+content[2]:''),
  sourceNativeCriteria:sections,sourceNativeModel:detail,sourceDiscoveryModel:proxy,
  sourceDetailComplete:true,sourceScopeComplete:false,sourceListingComplete:false,inventoryCleanupAllowed:false,
  scrapedAt:observedAt,companyCareerPage:CAREERS,companyDomain:'leena.ai',atsPlatform:'workable-public-detail',
 }
}

// Only the three observed ASCII delivery-parameter content spans vary.
// The whole remaining UTF8 page, including every tag/program/URL byte, is pinned.
// These values are opaque data: never executed, requested, or used as job clocks.
const publisherProfileSHA=html=>{
 assert(typeof html==='string','corporate declaration profile changed')
 const bytes=Buffer.from(html,'utf8')
 assert(bytes.length===188301,'corporate declaration profile changed')
 // Exactly two observed direct-body layouts share this fixed1475-byte region.
 // The360-byte beacon and oneLF move around the complete1114-byte inline
 // element. Only this validation copy is reordered; raw HTML/receipt hashes
 // remain original. No general script sort or execution equivalence is used.
 const regionStart=186812,regionEnd=188287,beaconLength=360,inlineLength=1114
 const beaconSHA='2de28415c6181ca4d754c39f8bd3751c6abdcc147ccb35f367a0675015d522d8'
 const inlineAt=start=>bytes.subarray(start,start+8).toString('ascii')==='<script>'&&bytes.subarray(start+inlineLength-9,start+inlineLength).toString('ascii')==='</script>'
 const firstLayout=inlineAt(regionStart)&&sha(bytes.subarray(regionStart+inlineLength,regionEnd-1))===beaconSHA&&bytes[regionEnd-1]===10
 const secondLayout=sha(bytes.subarray(regionStart,regionStart+beaconLength))===beaconSHA&&bytes[regionStart+beaconLength]===10&&inlineAt(regionStart+beaconLength+1)
 assert(firstLayout||secondLayout,'corporate fixed delivery layout changed')
 const profileBytes=secondLayout?Buffer.concat([bytes.subarray(0,regionStart),bytes.subarray(regionStart+beaconLength+1,regionEnd),bytes.subarray(regionStart,regionStart+beaconLength),bytes.subarray(regionStart+beaconLength,regionStart+beaconLength+1),bytes.subarray(regionEnd)]):bytes
 const ranges=[[186991,187007],[187012,187028],[187221,187237]]
 const values=ranges.map(([start,end])=>{
  const value=profileBytes.subarray(start,end)
  assert(value.every(byte=>byte<128),'corporate delivery parameter encoding changed')
  return value.toString('ascii')
 })
 const [r,t,copy]=values
 assert(/^[0-9a-f]{16}$/.test(r)&&copy===r,'corporate delivery parameter correlation changed')
 assert(/^[A-Za-z0-9+/]{14}==$/.test(t)&&Buffer.from(t,'base64').toString('base64')===t,'corporate opaque delivery parameter changed')
 const frame=Buffer.from(profileBytes)
 for(const[start,end]of ranges)frame.fill(48,start,end)
 const fingerprint=sha(frame)
 assert(fingerprint===HTML_FRAME_SHA,'corporate declaration profile changed')
 return fingerprint
}

export const validateCurrentPublisher=(html,bundle)=>{
 const corporateProfileSHA256=publisherProfileSHA(html)
 assert(sha(bundle)===BUNDLE_SHA,'career factory whole-program profile changed')
 let tree
 try{tree=parse(bundle,{ecmaVersion:'latest',sourceType:'script'})}catch{fail('career factory AST changed')}
 const nodes=[];const walk=value=>{
  if(!value||typeof value!=='object')return
  if(typeof value.type==='string')nodes.push(value)
  for(const [key,child]of Object.entries(value))if(key!=='start'&&key!=='end'){if(Array.isArray(child))child.forEach(walk);else if(child&&typeof child==='object')walk(child)}
 };walk(tree)
 const node=(start,end,type)=>nodes.find(n=>n.start===start&&n.end===end&&n.type===type)
 const fetchCall=node(77993,78002,'CallExpression')
 assert(fetchCall?.callee.type==='Identifier'&&fetchCall.callee.name==='fetch'&&fetchCall.arguments.length===1,'current public feed call changed')
 assert(node(77865,78257,'ArrowFunctionExpression')&&node(89729,91736,'ArrowFunctionExpression')&&node(90788,91125,'LogicalExpression'),'current role component/error fallback changed')
 // Whole fingerprint also pins both literal URI definitions, the hook effect,
 // tab registry, public rendering, and error-only window.open; no execution.
 return {profile:'leena-careers-899cb3bac7400f27',corporateSHA256:sha(html),corporateReferenceSHA256:HTML_SHA,corporateProfileSHA256,bundleSHA256:sha(bundle),browserEquivalenceClaimed:false}
}

const dispose=body=>{try{const pending=body?.cancel?.();pending?.catch?.(()=>{})}catch{}}
const httpError=(receipt,cause)=>{
 const error=new Error('Leena AI native HTTP '+receipt.status+' for '+receipt.requestedURL,{cause})
 Object.assign(error,{status:receipt.status,statusCode:receipt.status,requestURL:receipt.requestedURL,finalURL:receipt.finalURL,abortRetries:true})
 error.receipt=Object.freeze({...receipt})
 return error
}
const ownHTTP=new WeakSet()
const safeHeldModel=detail=>{
 // A refusal is not permission to copy an arbitrary response into evidence.
 // Unknown nested/private objects are a fatal schema boundary, not a hold.
 exactKeys(detail,roleFields(detail),'held role')
 assert(Number.isSafeInteger(detail.id)&&detail.id>0,'held native ID changed')
 for(const key of ['shortcode','title','state','language','accountUid','approvalStatus','workplace'])plain(detail[key],'held '+key)
 if(Object.hasOwn(detail,'type'))plain(detail.type,'held type')
 assert(typeof detail.remote==='boolean'&&typeof detail.isInternal==='boolean','held public-state shape changed')
 assert(detail.code===null||typeof detail.code==='string','held code shape changed')
 assert(detail.published===null||typeof detail.published==='string','held calendar shape changed')
 assert(Array.isArray(detail.department)&&detail.department.length<=20,'held department shape changed');detail.department.forEach(value=>plain(value,'held department'))
 const place=(value,hidden)=>{
  exactKeys(value,hidden?['city','country','countryCode','region','hidden']:['city','country','countryCode','region'],'held worksite')
  for(const key of ['city','country','countryCode','region'])assert(value[key]===null||typeof value[key]==='string'&&value[key].length<=1000,'held worksite shape changed')
  if(hidden)assert(typeof value.hidden==='boolean','held visibility shape changed')
 }
 place(detail.location,false);assert(Array.isArray(detail.locations)&&detail.locations.length<=20,'held worksite list shape changed');detail.locations.forEach(value=>place(value,true))
 for(const key of ['description','requirements','benefits']){
  assert(detail[key]===null||typeof detail[key]==='string'&&detail[key].length<=200000,'held criteria shape changed')
  // Public authored prose remains business data. A new form/program carrier
  // could contain personal/application values and is never copied on refusal.
  assert(detail[key]===null||!/<\s*(?:script|input|form|iframe|object|embed|textarea|select)\b/i.test(detail[key]),'unsafe held criteria carrier')
 }
 return detail
}
export const runCurrentOrLegacy=async({fetchImpl=globalThis.fetch,fetchText,signal,now=()=>new Date().toISOString(),legacy}={})=>{
 await Promise.resolve();signal?.throwIfAborted()
 const started=performance.now(),aggregate=new AbortController(),receipts=[]
 const timeout=Object.assign(new Error('Leena AI native aggregate deadline exceeded'),{code:'ETIMEDOUT',abortRetries:true})
 const timer=setTimeout(()=>aggregate.abort(timeout),90000)
 const check=()=>{signal?.throwIfAborted();if(performance.now()-started>=90000&&!aggregate.signal.aborted)aggregate.abort(timeout);aggregate.signal.throwIfAborted()}
 const read=async(url,json=false)=>{
  check();assert(receipts.length<MAX_READS,'request bound exceeded')
  const permitted=url===CAREERS||url===FEED||url===ACCOUNT||/^https:\/\/leena\.ai\/_next\/static\/chunks\/pages\/careers-[a-z0-9]+\.js$/.test(url)||/^https:\/\/apply\.workable\.com\/api\/v2\/accounts\/leena-ai\/jobs\/[A-Z0-9]{6,32}$/.test(url)
  assert(permitted,'unreviewed read authority or route')
  const receipt={requestedURL:url,method:'GET',observedAt:new Date().toISOString(),kind:fetchText?'injected-text':'http',status:null,finalURL:null,contentType:null,complete:false,bodyBytes:0,bodySHA256:null}
  receipts.push(receipt)
  const perRead=new AbortController(),readFailure=Object.assign(new Error('Leena AI native request deadline exceeded'),{code:'ETIMEDOUT',abortRetries:true})
  const readTimer=setTimeout(()=>perRead.abort(readFailure),15000)
  const combined=AbortSignal.any([...(signal?[signal]:[]),aggregate.signal,perRead.signal])
  let response,reader,finished=false,authority=false,onAbort
  const aborted=new Promise((_,reject)=>{
   onAbort=()=>{dispose(reader||response?.body);reject(signal?.aborted?signal.reason:combined.reason)}
   combined.addEventListener('abort',onAbort,{once:true})
  })
  try{
   let body
   if(fetchText){
    const pending=Promise.resolve().then(()=>{combined.throwIfAborted();return fetchText(url,{signal:combined})})
    body=await Promise.race([pending,aborted]);assert(typeof body==='string'&&Buffer.byteLength(body)<=MAX_BODY,'injected body bound changed')
   }else{
    const pending=Promise.resolve().then(()=>{combined.throwIfAborted();return fetchImpl(url,{method:'GET',headers:json?{...HEADERS,Accept:'application/json'}:HEADERS,redirect:'manual',credentials:'omit',signal:combined})})
    pending.then(value=>{if(finished||combined.aborted)dispose(value?.body)},()=>{})
    response=await Promise.race([pending,aborted]);signal?.throwIfAborted()
    receipt.status=response.status;receipt.finalURL=response.url;receipt.contentType=response.headers?.get?.('content-type')||''
    assert(response.url===url,'response authority or redirect changed');authority=true
    assert(Number.isInteger(response.status)&&response.status>=100&&response.status<=599,'HTTP status changed')
    const chunks=[];let count=0
    if(response.body){
     reader=response.body.getReader()
     while(true){const part=await Promise.race([reader.read(),aborted]);if(part.done)break;assert(part.value instanceof Uint8Array,'response byte stream changed');count+=part.value.byteLength;assert(count<=MAX_BODY,'response body bound exceeded');chunks.push(Buffer.from(part.value))}
    }
    const bytes=Buffer.concat(chunks);receipt.bodyBytes=bytes.length;receipt.bodySHA256=sha(bytes);receipt.complete=true
    if(response.status!==200){const error=httpError(receipt);ownHTTP.add(error);throw error}
    assert(json?/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(receipt.contentType):/^(?:text\/html|application\/javascript|text\/javascript)(?:\s*;|$)/i.test(receipt.contentType),'response representation changed')
    body=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
   }
   signal?.throwIfAborted();combined.throwIfAborted();check()
   if(fetchText){receipt.bodyBytes=Buffer.byteLength(body);receipt.bodySHA256=sha(body);receipt.complete=true}
   return {body,payload:json?parseNativeJSON(body):null,receipt}
  }catch(error){
   signal?.throwIfAborted()
   if(authority&&receipt.status!==200&&receipt.status>=300&&!ownHTTP.has(error)){
    const primary=httpError(receipt,error);ownHTTP.add(primary);throw primary
   }
   if(ownHTTP.has(error))throw error
   combined.throwIfAborted();throw error
  }finally{
   finished=true;clearTimeout(readTimer);combined.removeEventListener('abort',onAbort)
   if(!receipt.complete)dispose(reader||response?.body)
   try{reader?.releaseLock()}catch{}
  }
 }
 try{
  let corporate
  try{corporate=await read(CAREERS)}catch(error){signal?.throwIfAborted();if(fetchText&&error instanceof Error&&!ownHTTP.has(error)&&!aggregate.signal.aborted)throw new Error('Leena AI API-only migration could not fetch '+CAREERS+': '+error.message,{cause:error});throw error}
  const advertised=[...corporate.body.matchAll(/<script[^>]+src=["']([^"']*\/_next\/static\/chunks\/pages\/careers-[^"']+\.js)["'][^>]*>/gi)]
  assert(advertised.length===1,'career bundle declaration missing or duplicated')
  let bundleURL
  try{bundleURL=new URL(advertised[0][1],CAREERS).href}catch{fail('career bundle URI changed')}
  // Default/current transport cannot dispatch an unreviewed publisher to the
  // historical text-injection path, or fetch outside the pinned native route.
  // Explicit legacy fetchText fixtures retain their existing compatibility.
  if(typeof fetchText!=='function'){assert(bundleURL===BUNDLE,'unreviewed current publisher/bundle profile');publisherProfileSHA(corporate.body)}
  const bundle=await read(bundleURL)
  if(bundleURL!==BUNDLE){assert(typeof fetchText==='function'&&typeof legacy==='function','unreviewed legacy career profile');check();return await legacy(corporate.body,bundle.body)}
  const profile=validateCurrentPublisher(corporate.body,bundle.body)
  const observedAt=now();assert(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'observation clock changed')
  const openingFeed=await read(FEED,true),discovery=decodeDiscoveryFeed(openingFeed.payload)
  const openingAccount=await read(ACCOUNT,true),account=decodeNativeAccount(openingAccount.payload)
  const opening=[],jobs=[],held=[]
  const detailURL=row=>'https://apply.workable.com/api/v2/accounts/leena-ai/jobs/'+row.shortcode
  const collect=async row=>{
   let packet
   try{packet=await read(detailURL(row),true)}catch(error){
    signal?.throwIfAborted()
    if(ownHTTP.has(error)&&[404,410].includes(error.status))return {shortcode:row.shortcode,status:error.status,bodySHA256:receipts.at(-1).bodySHA256,model:null,job:null,heldReason:'own-public-detail-unavailable'}
    throw error
   }
   try{return {shortcode:row.shortcode,status:200,model:packet.payload,job:decodeNativeRole(packet.payload,row,account,observedAt),heldReason:null}}
   catch(error){if(!(error instanceof ContractError))throw error
    // Unknown schemas/authority are not copied into runtime evidence: retain
    // exact transport digest plus the reviewed business fields, if all exist.
    return {shortcode:row.shortcode,status:200,model:safeHeldModel(packet.payload),job:null,heldReason:error.message}
   }
  }
  for(const row of discovery.india){check();const entry=await collect(row);opening.push(entry);if(entry.job)jobs.push(entry.job);else held.push({discovery:row,...entry})}
  const closingCorporate=await read(CAREERS),closingBundle=await read(BUNDLE)
  const closingProfile=validateCurrentPublisher(closingCorporate.body,closingBundle.body)
  assert(closingProfile.corporateProfileSHA256===profile.corporateProfileSHA256&&closingBundle.body===bundle.body,'publisher changed during collection')
  const closingFeed=await read(FEED,true);decodeDiscoveryFeed(closingFeed.payload)
  // fetchedAt is the publisher's cache-observation clock, not vacancy data.
  // Its full original value and digest are retained separately on both sides.
  const feedBusiness=payload=>({jobs:payload.jobs,departments:payload.departments,locations:payload.locations})
  assert(canonical(feedBusiness(openingFeed.payload))===canonical(feedBusiness(closingFeed.payload)),'discovery business inventory changed during collection')
  const closingAccount=await read(ACCOUNT,true);decodeNativeAccount(closingAccount.payload)
  assert(canonical(openingAccount.payload)===canonical(closingAccount.payload),'own account changed during collection')
  const closing=[]
  for(let i=0;i<discovery.india.length;i++){
   check();const entry=await collect(discovery.india[i]);closing.push(entry)
   const business=item=>({shortcode:item.shortcode,status:item.status,model:item.model,bodySHA256:item.model?null:item.bodySHA256,heldReason:item.heldReason})
   assert(canonical(business(entry))===canonical(business(opening[i])),'own full detail changed during collection')
  }
  check()
  const audit={source:'leenaai',recordKind:'vacancy-rows',observedRecordCount:discovery.rows.length,observedVacancyCount:discovery.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,
   inventoryCleanupAllowed:false,configuredBoardInventoryComplete:false,discoveryOnly:true,profile,publisherClosingProfile:closingProfile,observedAt,
   selectedTypedIndiaCount:discovery.india.length,returnedCount:jobs.length,heldCount:held.length,
   feedFetchedAt:{opening:openingFeed.payload.fetchedAt,closing:closingFeed.payload.fetchedAt,semantic:'cache-observation-only'},
   account,openingDiscovery:openingFeed.payload,closingDiscovery:closingFeed.payload,
   opening:opening.map(({job,...entry})=>entry),closing:closing.map(({job,...entry})=>entry),held,receipts,
   closingProof:'same publisher/profile/feed/account and all selected full detail models; discovery-only, not native inventory enumeration',
   unobservedScope:'Foreign discovery rows were not full-detail collected; native inventory total and company/India totals unknown',
  }
  attachInventoryEvidence(jobs,{status:'discovery-only',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'published-feed-detail-discovery-only'})
  attachSourceObservationEvidence(jobs,audit)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true})
  return jobs
 }catch(error){signal?.throwIfAborted();if(ownHTTP.has(error))throw error;check();throw error}
 finally{clearTimeout(timer)}
}
