import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual,types} from 'node:util'
import {decodeHTML} from 'entities'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence,normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import DALOOPA_CATALOG from './catalog.js'

const PROFILE=JSON.parse(readFileSync(new URL('./reviewedNativeData20261115.json',import.meta.url),'utf8'))
const CURRENT_CLIENT=JSON.parse(readFileSync(new URL('./reviewedClient20261125.json',import.meta.url),'utf8'))
export const SOURCE='daloopa',COMPANY='Daloopa',BOARD_URL=PROFILE.nativeBoardUrl,PROVIDER_METADATA=DALOOPA_CATALOG
const baseDescriptors=PROFILE.readDescriptors.slice(0,3),staticCarriers=new Map(PROFILE.staticCarriers.map(row=>[row.label,row]))
const detailURL=PROFILE.readDescriptors.find(row=>row.label.startsWith('detail-')).url
const publicJD=PROFILE.nativeClientPublicCareerURLs.find(row=>row.pageType==='jd').url
const listFields=Object.keys(PROFILE.listing.reqDetailsBOList[0]),roleFields=Object.keys(PROFILE.roles[0].data.reqDetailsBO)
const sha=value=>createHash('sha256').update(value).digest('hex'),same=isDeepStrictEqual
// Only these observed replica pairs may differ while every remaining original
// envelope/data byte closes. Retain both version tokens as native metadata;
// this grants no renderer, employer, application or company-scope authority.
const reviewedReplicaPairs=[
 new Set(['d17-at-20261103052156','d17-wq-20261103052123']),
 new Set(['d17-ae-20261124072427','d17-8o-20261123230732']),
 new Set(['d17-zx-20261125094135','d17-qc-20261125094104']),
]
const escapeNativeText=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const completeCriteria=role=>role.detail.record.jdDisplay
 +'\n<h2>Original native listing description (plain text)</h2><pre>'+escapeNativeText(role.listRow.jdDisplay)+'</pre>'
 +'\n<h2>Original native listing record (all 44 fields)</h2><pre>'+escapeNativeText(role.rawListRowJSON)+'</pre>'
 +'\n<h2>Original native detail data (all four fields)</h2><pre>'+escapeNativeText(role.detail.rawDataJSON)+'</pre>'
 +'\n<h2>Original native role fields (all 13 fields)</h2><pre>'+escapeNativeText(role.detail.rawRoleJSON)+'</pre>'
const defaults={sourceTimeoutMs:45000,requestTimeoutMs:15000,maxRequests:16,maxPages:6,maxDetails:8,maxEntityBytes:4000000,maxTotalBytes:24000000}
const HTML_BYTES=524288,JSON_BYTES=131072,CLOSING_BYTES=3*HTML_BYTES+4*JSON_BYTES,CLOSING_READS=7
const USER_AGENT='Mozilla/5.0 (compatible; Jobverify scraper)'
const inventory=(pagesFetched=0)=>normalizeInventoryEvidence({status:'coverage-gap',surface:BOARD_URL,firstParty:false,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'native-live-criteria-data-sample-only;other-country-and-company-render-application-scope-unqualified'})
const gap=(message,fields={})=>firstPartyFailure(SOURCE,message,{code:'DALOOPA_NATIVE_DATA_GAP',partial:true,nativeAuthorityFailure:true,firstParty:false,sourceCorporateBindingQualified:false,sourceListingComplete:false,sourceScopeComplete:false,inventoryEvidence:inventory(),...fields})
const need=(condition,message)=>{if(!condition)throw gap(message)}
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const typedArray=Object.getPrototypeOf(Uint8Array.prototype),intrinsic=name=>Object.getOwnPropertyDescriptor(typedArray,name).get
const byteLength=intrinsic('byteLength'),byteOffset=intrinsic('byteOffset'),arrayBuffer=intrinsic('buffer')
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const exact=(value,keys)=>object(value)&&same(Object.keys(value).sort(),[...keys].sort())
const string=value=>typeof value==='string'&&value.isWellFormed()&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
const plainMarkup=/<(?:\/?[a-z][\w:-]*(?=[\s/>]|$)|[!?])/i
const plainText=value=>string(value)&&!plainMarkup.test(value)&&!plainMarkup.test(decodeHTML(value))
const safe=value=>Number.isSafeInteger(value)&&value>=0,positive=value=>safe(value)&&value>0
const numeric=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER&&!Object.is(value,-0)
const listState=new WeakMap()

// Duplicate-aware bounded lexical pass, retaining original token spans. Only
// fixed protocol paths and complete row tokens are captured, never arbitrary
// attacker-sized pointer strings. JSON business values are not example pins.
export function readDaloopaStrictJSON(text){
 need(typeof text==='string'&&Buffer.byteLength(text)<=JSON_BYTES,'Native JSON size changed')
 let cursor=0,nodes=0;const spans=new Map()
 const space=()=>{while(/[\t\n\r ]/.test(text[cursor]??'!'))cursor++}
 const quoted=()=>{const start=cursor;need(text[cursor++]==='"','Native JSON string expected');while(cursor<text.length){const char=text[cursor++];if(char==='"'){let value;try{value=JSON.parse(text.slice(start,cursor))}catch{throw gap('Invalid native JSON string')};need(value.isWellFormed(),'Unpaired native JSON surrogate');return value}need(char.charCodeAt(0)>=32,'Invalid native JSON control');if(char==='\\'){const escape=text[cursor++];if(escape==='u'){need(/^[a-f0-9]{4}$/i.test(text.slice(cursor,cursor+4)),'Invalid native JSON Unicode escape');cursor+=4}else need(typeof escape==='string'&&'"\\/bfnrt'.includes(escape),'Invalid native JSON escape')}}throw gap('Unterminated native JSON string')}
 const child=(parent,key)=>parent===''&&['reqDetailsBOList','data','status','ts','requestId','v'].includes(key)?'/'+key:parent==='/reqDetailsBOList'&&typeof key==='number'?'/reqDetailsBOList/'+key:parent==='/data'&&key==='reqDetailsBO'?'/data/reqDetailsBO':null
 const value=(depth,path)=>{
  need(depth<=32&&++nodes<=50000,'Native JSON depth/node limit exceeded');space();const start=cursor
  if(text[cursor]==='"')quoted()
  else if(text[cursor]==='{'){cursor++;space();const keys=new Set();if(text[cursor]==='}')cursor++;else for(;;){space();const key=quoted();need(!keys.has(key),'Duplicate decoded native JSON key');keys.add(key);space();need(text[cursor++]===':','Native JSON colon changed');value(depth+1,child(path,key));space();const end=text[cursor++];if(end==='}')break;need(end===',','Native JSON object changed')}}
  else if(text[cursor]==='['){cursor++;space();let index=0;if(text[cursor]===']')cursor++;else for(;;){value(depth+1,child(path,index++));space();const end=text[cursor++];if(end===']')break;need(end===',','Native JSON array changed')}}
  else{let literal=false;for(const word of ['true','false','null'])if(text.startsWith(word,cursor)){cursor+=word.length;literal=true;break}if(!literal){const number=/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;number.lastIndex=cursor;const found=number.exec(text);need(found&&Number.isFinite(Number(found[0])),'Invalid/nonfinite native JSON value');cursor=number.lastIndex}}
  if(path!==null)spans.set(path,{start,end:cursor,raw:text.slice(start,cursor)})
 }
 value(0,'');space();need(cursor===text.length,'Trailing native JSON data');let parsed;try{parsed=JSON.parse(text)}catch{throw gap('Original native JSON changed')};return{value:parsed,spans}
}
export function buildDaloopaPublicJDURL(id){
 need(positive(id),'Invalid current native requisition ID')
 const context={pageType:'jd',cvSource:'careers',reqId:id,requester:{id:'',code:'',name:''},page:'careers',bufilter:-1,customFields:{}}
 return publicJD+'?src%3Dcareers%26p%3D'+Buffer.from(JSON.stringify(context)).toString('base64')
}
function descriptor(label){
 const base=baseDescriptors.find(row=>row.label===label);if(base)return base
 const match=/^(detail|landing)-([1-9]\d*)$/.exec(label),id=match?Number(match[2]):NaN;need(positive(id)&&String(id)===match[2],'Unreviewed native role route')
 return match[1]==='detail'?{label,kind:'json',counter:'detail',url:detailURL,method:'POST',body:JSON.stringify({source:'careers',id:'',code:'',reqId:id})}:{label,kind:'html',counter:'detail',url:buildDaloopaPublicJDURL(id),method:'GET'}
}
function representation(page,label){const expected=descriptor(label);need(page.label===label&&page.url===expected.url&&page.method===expected.method&&page.requestBody===(expected.body??null),'Original literal native descriptor changed');need(Buffer.isBuffer(page.bytes)&&typeof page.text==='string'&&Buffer.from(page.text).equals(page.bytes),'Original native UTF8/byte representation changed')}
function pin(page,label){representation(page,label);const expected=staticCarriers.get(label.startsWith('landing-')?'board':label),variants=label==='client'?[expected,CURRENT_CLIENT]:[expected];need(variants.some(row=>row&&(label!=='client'||page.url===row.url&&row.label==='client')&&page.bytes.length===row.bytes&&sha(page.bytes)===row.sha256),'Complete original '+label+' carrier changed')}
export function readDaloopaBoard(page){pin(page,'board');const doc=readNativeDocument(page.text);need(doc.nodes(node=>node.tag==='app-root').length===1&&doc.nodes(node=>node.tag==='title').length===1,'Original static app-root carrier owner changed');return{url:page.url,bytes:page.bytes.length,sha256:sha(page.bytes),scope:'Static carrier only; no roleSSR/JobPosting/rendered authority'}}
export function readDaloopaClient(page){
 pin(page,'client');const value=readDaloopaStrictJSON(page.text).value
 need(same(Object.keys(value),PROFILE.nativeClientOriginalKeys)&&same({clientId:value.clientId,clientName:value.clientName,companyWebsite:value.companyWebsite},PROFILE.nativeClientIdentity),'Original own native client identity changed')
 need(same(value.tenantPreferencesMap?.career_page_url?.url,PROFILE.nativeClientPublicCareerURLs),'Original native public route declarations changed')
 // Complete client controls remain pinned. Opaque cookie-like data is not used.
 return{...PROFILE.nativeClientIdentity,publicCareerURLs:structuredClone(PROFILE.nativeClientPublicCareerURLs),carrierSHA256:sha(page.bytes),unqualifiedCookiePresent:typeof value.cookie==='string'&&value.cookie.length>0,formalLegalEmployerQualified:false}
}
const nullListFields=['buDescription','buURL','stagewiseCounts','questionList','formFieldDetails','buHierarchy','mandatorySkillList','nonMandatorySkillList','educationList','reqPositionsBOs','hiringManagerName','coordinatorName','coordinatorEmployeeMobile','skillFamily','requisitionLocationGroup','countryCode','complianceNotices']
const stringListFields=['buName','reqTitle','location','locationAddress','jdDisplay','approvedOn','employmentType','roleName','designation','careerStream','jobLevel','reqCurrency']
const closedNotice=/\b(?:(?:position|role|job|vacancy|opening|posting)\s+(?:(?:is|was|has\s+been)\s+(?:closed|filled|expired|unavailable|no\s+longer\s+(?:available|open))|has\s+expired)|no\s+longer\s+accepting\s+applications|applications\s+(?:for\s+(?:(?:this|the)\s+)?(?:position|role|job|vacancy|opening|posting)\s+)?are\s+closed)\b/i
const locationLabel=/^(?:(?:job|work|primary|additional|secondary)\s+)?locations?\s*:/i
const flat=value=>decodeHTML(value).replace(/\s+/g,' ').trim()
function worksite(value){need(Array.isArray(value)&&value.length===1&&exact(value[0],['office','address'])&&same(Object.keys(value[0]),['office','address'])&&string(value[0].office)&&string(value[0].address),'Unsupported native one-office/address worksite model')}
function approval(value){need(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+0000$/.test(value),'Unsupported native approval format');const ms=Date.parse(value);need(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,23)===value.slice(0,23),'Invalid native approval calendar')}
function plainIndia(row){if(!plainText(row.jdDisplay))return false;const lines=row.jdDisplay.split(/\r?\n/).map(flat).filter(line=>locationLabel.test(line));return lines.length===1&&lines[0]==='Location: India (Remote)'&&row.location==='Remote'&&row.locationAddress==='Remote'&&same(row.locationList,[{office:'Remote',address:'Remote'}])&&!closedNotice.test(flat(row.jdDisplay))}
export function readDaloopaListing(page){
 representation(page,'listing');const parsed=readDaloopaStrictJSON(page.text),value=parsed.value
 need(exact(value,['requesterTitle','reqDetailsBOList','hrXmlModel'])&&string(value.requesterTitle)&&value.hrXmlModel===null&&Array.isArray(value.reqDetailsBOList)&&value.reqDetailsBOList.length<=500,'Unsupported complete native listing envelope')
 const ids=new Set(),rawRows=new Map(),eligible=[],held=[]
 for(const[index,row]of value.reqDetailsBOList.entries()){
  need(exact(row,listFields)&&positive(row.reqId)&&!ids.has(row.reqId),'Complete44-field native row schema/ID changed');ids.add(row.reqId)
  need(stringListFields.every(key=>string(row[key]))&&row.reqTitle.trim().length>0&&nullListFields.every(key=>row[key]===null),'Native row text/null/control model changed')
  need(plainText(row.jdDisplay),'Unsupported markup in native plain listing criteria')
  need(row.statusId===3&&row.priority===301&&row.positionType===1&&row.screeningMatchPercent===0&&row.fresher===false&&exact(row.customFields,[])&&Array.isArray(row.locationGroup)&&row.locationGroup.length===0,'Unreviewed native control/availability model')
  // Position counts are retained native metadata, not vacancy availability proof.
  // The public listing legitimately includes zero while keeping the full row.
  need(['expMin','expMax','ctcBandHighEnd','ctcBandLowEnd'].every(key=>numeric(row[key]))&&safe(row.totalPositions)&&!Object.is(row.totalPositions,-0)&&safe(row.roleId),'Native numeric experience/band/count model changed');approval(row.approvedOn)
  if(!(row.totalPositions===0&&Array.isArray(row.locationList)&&row.locationList.length===0))worksite(row.locationList)
  const span=parsed.spans.get('/reqDetailsBOList/'+index);need(span,'Complete original listing row token unavailable');rawRows.set(row.reqId,span.raw)
  if(row.totalPositions===0)held.push({id:row.reqId,reason:'native-zero-position-count;availability-unqualified'})
  else if(plainIndia(row))eligible.push(row);else held.push({id:row.reqId,reason:'role-owned-IndiaRemote-and-supported-worksite-not-qualified'})
 }
 listState.set(value,{rawRows,eligible,held});return value
}
function envelopeView(page){
 const parsed=readDaloopaStrictJSON(page.text),value=parsed.value
 need(exact(value,['status','data','ts','requestId','v'])&&same(Object.keys(value),['status','data','ts','requestId','v'])&&value.status===200,'Exact native five-field success envelope changed')
 const ts=parsed.spans.get('/ts'),request=parsed.spans.get('/requestId'),version=parsed.spans.get('/v'),data=parsed.spans.get('/data'),record=parsed.spans.get('/data/reqDetailsBO')
 need(ts&&/^(?:0|[1-9]\d{0,4})$/.test(ts.raw)&&safe(value.ts)&&value.ts<=15000,'Canonical native ts outside conservative bound')
 need(request&&/^"[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"$/.test(request.raw),'Native requestId must be raw canonical ASCII UUIDv4')
 need(version&&typeof value.v==='string'&&value.v.isWellFormed()&&Buffer.byteLength(value.v)>=1&&Buffer.byteLength(value.v)<=256&&!/[\u0000-\u001f\u007f-\u009f]/.test(value.v),'Unsupported opaque native v metadata')
 need(data&&record,'Complete original native data/role token unavailable')
 // Version metadata is retained separately. Only finite observed replica pairs
 // can use the additional version-neutral comparison below.
 const nonDiagnostic=page.text.slice(0,ts.start)+'<ts>'+page.text.slice(ts.end,request.start)+'<requestId>'+page.text.slice(request.end)
 const replicaNeutral=page.text.slice(0,ts.start)+'<ts>'+page.text.slice(ts.end,request.start)+'<requestId>'+page.text.slice(request.end,version.start)+'<reviewed-version>'+page.text.slice(version.end)
 return{value,rawDataJSON:data.raw,rawRoleJSON:record.raw,rawVersionToken:version.raw,nonDiagnosticBodyBase64:Buffer.from(nonDiagnostic).toString('base64'),replicaNeutralBodyBase64:Buffer.from(replicaNeutral).toString('base64')}
}
function sameNativeDetail(opening,closing){
 if(opening.nonDiagnosticBodyBase64===closing.nonDiagnosticBodyBase64)return true
 const canonicalVersion=view=>view.rawVersionToken===JSON.stringify(view.value.v)
 return canonicalVersion(opening)&&canonicalVersion(closing)&&reviewedReplicaPairs.some(pair=>pair.has(opening.value.v)&&pair.has(closing.value.v))&&opening.replicaNeutralBodyBase64===closing.replicaNeutralBodyBase64
}
function richIndia(value){
 need(string(value)&&value.length>=100,'Incomplete original rich criteria')
 const stack=[];let end=0;const tags=/<[^>]*>/g
 for(const match of value.matchAll(tags)){need(!value.slice(end,match.index).includes('<'),'Unknown native rich markup');const token=/^<(\/?)(h1|p|br|strong|ul|li)\s*(\/?)>$/i.exec(match[0]);need(token,'Unsupported native rich tag/attribute/control');const name=token[2].toLowerCase();if(name==='br')need(!token[1],'Unsupported rich closing BR');else if(token[1])need(!token[3]&&stack.pop()===name,'Unbalanced original rich criteria');else{need(!token[3],'Unsupported rich self-closing container');stack.push(name)}end=match.index+match[0].length}
 need(!value.slice(end).includes('<')&&stack.length===0,'Incomplete/unreviewed original rich tree')
 const doc=readNativeDocument(value),text=node=>node.tag==='br'?' ':node.children.map(child=>typeof child==='string'?decodeHTML(child):text(child)).join(' '),paragraphs=doc.nodes(node=>node.tag==='p').filter(node=>locationLabel.test(flat(text(node))))
 need(paragraphs.length===1,'Ambiguous native rich work-location declarations')
 const owner=paragraphs[0],children=owner.children
 need(children.length===2&&typeof children[0]==='object'&&children[0].tag==='strong'&&flat(text(children[0]))==='Location:'&&typeof children[1]==='string'&&flat(children[1])==='India (Remote)','Unqualified native rich role-owned IndiaRemote')
 const fullText=flat(text(doc.nodes(()=>true)[0]));need((fullText.match(/\b(?:(?:job|work|primary|additional|secondary)\s+)?locations?\s*:/gi)??[]).length===1,'Additional unsupported native rich work-location declaration');need(!closedNotice.test(fullText),'Explicit native vacancy closure notice')
 return true
}
export function readDaloopaDetail(page,id,row){
 need(positive(id)&&row?.reqId===id&&plainIndia(row),'Current complete native listing row required');representation(page,'detail-'+id)
 const original=envelopeView(page),value=original.value,data=value.data,record=data?.reqDetailsBO
 need(exact(data,['requesterTitle','activeApplicationCount','maxActiveApplication','reqDetailsBO'])&&string(data.requesterTitle)&&safe(data.activeApplicationCount)&&safe(data.maxActiveApplication),'Unsupported complete four-data/count model')
 need(exact(record,roleFields)&&record.reqId===id&&record.reqTitle===row.reqTitle&&record.statusId===3&&record.requisitionPublished===true&&record.fresher===false,'Current native role identity/control/availability changed')
 need(record.mandatorySkillList===null&&record.nonMandatorySkillList===null&&Array.isArray(record.requisitionLocationGroup)&&record.requisitionLocationGroup.length===0&&Array.isArray(record.educationList)&&record.educationList.length<=100&&record.educationList.every(plainText)&&numeric(record.expMin)&&numeric(record.expMax),'Unsupported native education/experience/null/control model')
 worksite(record.locationList);need(same(record.locationList,row.locationList),'Native plain/detail worksite contradiction');richIndia(record.jdDisplay)
 return{roleId:id,envelope:value,data,record,rawDataJSON:original.rawDataJSON,rawRoleJSON:original.rawRoleJSON,rawDataSHA256:sha(Buffer.from(original.rawDataJSON)),rawDataBase64:Buffer.from(original.rawDataJSON).toString('base64'),nativeVersion:value.v,rawVersionToken:original.rawVersionToken,nonDiagnosticBodyBase64:original.nonDiagnosticBodyBase64,replicaNeutralBodyBase64:original.replicaNeutralBodyBase64}
}
export function readDaloopaLanding(page,id){pin(page,'landing-'+id);const doc=readNativeDocument(page.text);need(page.url===buildDaloopaPublicJDURL(id)&&doc.nodes(node=>node.tag==='app-root').length===1,'Original literal public JD carrier changed');return{url:page.url,bytes:page.bytes.length,sha256:sha(page.bytes),sourceRoleDataQualified:false,sourceCanonicalQualified:false}}
function observationTime(options){const value=typeof options.now==='function'?options.now():options.now??new Date(),ms=value instanceof Date?value.getTime():typeof value==='string'?Date.parse(value):NaN;need(Number.isFinite(ms),'Invalid native observation clock');return new Date(ms).toISOString()}

export function createDaloopaOriginalReader(options={}){
 const descriptors=new Map(baseDescriptors.map(row=>[row.label,row])),labels=baseDescriptors.map(row=>row.label),openingPages=new Map()
 const caller=options.signal;caller?.throwIfAborted()
 need(options.maxJobs==null,'Native truncation is forbidden')
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'Original Response metadata is required; body-only callbacks are unsupported')
 need(options.fetchImpl===undefined||typeof options.fetchImpl==='function','Invalid original transport callback')
 const reduced=(names,maximum)=>{const values=names.map(name=>options[name]).filter(value=>value!==undefined&&value!==null);need(values.every(value=>Number.isSafeInteger(value)&&value>0&&value<=maximum),'Invalid '+names.join('/')+' ceiling');return Math.min(maximum,...values)}
 const limits=Object.fromEntries(Object.entries(defaults).map(([name,maximum])=>[name,reduced(name==='sourceTimeoutMs'?['timeoutMs',name]:name==='maxPages'?[name,'maxDiscoveryReads']:[name],maximum)]))
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,started=performance.now(),receipts=[],lastStarts=new Map()
 let phase='opening',reservedReads=CLOSING_READS,reservedBytes=CLOSING_BYTES,reservedDiscovery=3,reservedDetails=4,decodedBytes=0,discoveryReads=0,detailReads=0,inFlight=false,closed=false,candidatesBound=false
 let timer
 const expire=()=>{
  if(closed||signal.aborted)return
  clearTimeout(timer)
  const remaining=limits.sourceTimeoutMs-(performance.now()-started)
  if(remaining>0){timer=setTimeout(expire,Math.max(1,Math.ceil(remaining)));return}
  controller.abort(new DOMException('Daloopa native source deadline exceeded','TimeoutError'))
 }
 timer=setTimeout(expire,limits.sourceTimeoutMs)
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=limits.sourceTimeoutMs&&!controller.signal.aborted)expire();signal.throwIfAborted();need(!closed,'Original reader closed');need(phase!=='opening'||performance.now()-started<limits.sourceTimeoutMs/2,'Opening phase exhausted closing time reservation')}
 const pace=async url=>{
  const origin=new URL(url).origin
  while(lastStarts.has(origin)&&performance.now()-lastStarts.get(origin)<500){
   const ms=Math.ceil(500-(performance.now()-lastStarts.get(origin)))
   await new Promise((resolve,reject)=>{const aborted=()=>{clearTimeout(wait);reject(signal.reason)};const wait=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve()},ms);signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted()});check()
  }
  check();lastStarts.set(origin,performance.now())
 }
 return{limits,check,
  bindCandidates(ids){check();need(phase==='opening'&&!inFlight&&!candidatesBound&&receipts.length===3&&openingPages.has('listing'),'Current native discovery required before role binding');const listing=readDaloopaListing(openingPages.get('listing')),state=listState.get(listing);need(ids.length>=1&&ids.length<=2&&same(ids,state.eligible.slice(0,2).map(row=>row.reqId)),'Unbound or insufficient current IndiaRemote candidates');for(const id of ids)for(const type of ['detail','landing']){const current=descriptor(type+'-'+id);descriptors.set(current.label,current);labels.push(current.label)}reservedReads=labels.length;reservedDetails=2*ids.length;reservedBytes=(1+ids.length)*HTML_BYTES+(2+ids.length)*JSON_BYTES;candidatesBound=true},
  beginClosing(){check();need(!inFlight&&phase==='opening'&&candidatesBound&&receipts.length===labels.length&&receipts.every(row=>row.bodyComplete),'All bound opening originals must complete before closing');phase='closing'},
  async read(label){
   check();const descriptor=descriptors.get(label),position=receipts.length-(phase==='closing'?labels.length:0)
   need(descriptor&&!inFlight&&position<labels.length&&labels[position]===label,'Unbound, concurrent or out-of-order native request')
   need(receipts.length<limits.maxRequests,'Original physical request ceiling exceeded')
   const isJSON=descriptor.kind==='json',isDiscovery=descriptor.counter==='discovery',kindCeiling=isJSON?JSON_BYTES:HTML_BYTES,ceiling=Math.min(kindCeiling,limits.maxEntityBytes)
   if(phase==='opening'){
    need(receipts.length+1+reservedReads<=limits.maxRequests&&decodedBytes+reservedBytes<limits.maxTotalBytes,'Closing read/byte reserve unavailable')
    need(discoveryReads+(isDiscovery?1:0)+reservedDiscovery<=limits.maxPages&&detailReads+(isDiscovery?0:1)+reservedDetails<=limits.maxDetails,'Closing discovery/detail reserve unavailable')
   }else{
    need(reservedReads>0&&reservedBytes>=kindCeiling&&(isDiscovery?reservedDiscovery>0:reservedDetails>0),'Closing reserve exhausted')
    reservedReads--;reservedBytes-=kindCeiling;if(isDiscovery)reservedDiscovery--;else reservedDetails--
   }
   inFlight=true;let receipt
   try{
    await pace(descriptor.url)
    const remaining=(phase==='opening'?limits.sourceTimeoutMs/2:limits.sourceTimeoutMs)-(performance.now()-started)
    need(remaining>=1,'No original phase time remains')
    const timeoutMs=Math.max(1,Math.min(limits.requestTimeoutMs,Math.floor(remaining)))
    receipt={label,requestedUrl:descriptor.url,method:descriptor.method,requestBody:descriptor.body??null,phase,startedAt:new Date().toISOString(),requestTimeoutMs:timeoutMs,bodyComplete:false,entityCeiling:ceiling,closingReadReserve:reservedReads,closingByteReserve:reservedBytes}
    receipts.push(receipt);if(isDiscovery)discoveryReads++;else detailReads++
    const page=await boundedDeclaredPublicRead(descriptor.url,{signal,timeoutMs,request:{method:descriptor.method,...(descriptor.method==='POST'?{body:descriptor.body}:{})},overflowError:gap('Original entity byte limit exceeded'),fetchImpl:async(url,init)=>{
     const verify=()=>{check();init.signal.throwIfAborted()};verify();let original
     try{
      original=await(options.fetchImpl??globalThis.fetch)(url,{...init,method:descriptor.method,...(descriptor.method==='POST'?{body:descriptor.body}:{}),redirect:'manual',credentials:'omit',headers:{'User-Agent':USER_AGENT,Accept:isJSON?'application/json':'text/html',...(descriptor.method==='POST'?{'Content-Type':'application/json;charset=UTF-8'}:{})}})
      verify();need(original&&Number.isInteger(original.status)&&typeof original.url==='string'&&typeof original.headers?.get==='function','Original Response HTTP metadata unavailable')
      Object.assign(receipt,{status:original.status,finalUrl:original.url,redirected:original.redirected,contentType:original.headers.get('content-type')??''})
      const stream=original.body;need(stream===null||typeof stream?.getReader==='function','Bounded original stream unavailable');let received=0
      return{status:original.status,url:original.url,headers:original.headers,body:stream===null?null:{cancel:reason=>stream.cancel(reason),getReader(){
       verify();const reader=stream.getReader()
       return{async read(){verify();const chunk=await reader.read();verify();if(!chunk.done){need(types.isUint8Array(chunk.value),'Original chunk must be Uint8Array');const size=byteLength.call(chunk.value);received+=size;decodedBytes+=size;receipt.bytesReceived=received;need(received<=ceiling,'Original per-kind/entity byte limit exceeded');need(decodedBytes+reservedBytes<=limits.maxTotalBytes,'Aggregate bytes or closing reserve exceeded');return{done:false,value:new Uint8Array(arrayBuffer.call(chunk.value),byteOffset.call(chunk.value),size)}}return chunk},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}}
     }catch(error){ignore(()=>original?.body?.cancel(error));throw error}
    }})
    const bytes=Buffer.from(page.bodyBase64,'base64');Object.assign(receipt,{bytes:bytes.length,sha256:sha(bytes),bodyBase64:page.bodyBase64,bodyComplete:true})
    if(page.status!==200)throw gap('Original native HTTP '+page.status,{status:page.status,requestUrl:descriptor.url})
    need(receipt.redirected===false&&page.url===descriptor.url,'Original redirect/final URL changed')
    need((isJSON?/^application\/json(?:;\s*charset=(?:utf-8|"utf-8"))?$/i:/^text\/html(?:;\s*charset=(?:utf-8|"utf-8"))?$/i).test(receipt.contentType),'Original MIME/UTF8 charset changed')
    need(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'Original BOM requires review')
    let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw gap('Invalid original UTF8')}
    need(Buffer.from(text).equals(bytes),'Original UTF8 is not lossless');check()
    const result={label,url:descriptor.url,method:descriptor.method,requestBody:descriptor.body??null,bytes,text}
    if(phase==='opening')openingPages.set(label,result)
    else if(label.startsWith('detail-'))need(sameNativeDetail(envelopeView(openingPages.get(label)),envelopeView(result)),'Complete native non-diagnostic data/v closing changed')
    else need(openingPages.get(label)?.bytes.equals(bytes),'Complete original native closing body changed')
    return result
   }catch(error){
    caller?.throwIfAborted();signal.throwIfAborted()
    if(receipt?.status!==undefined&&receipt.status!==200&&error?.status!==receipt.status)throw gap('Original native HTTP '+receipt.status,{status:receipt.status,requestUrl:descriptor.url,responseBodyError:error})
    throw error
   }finally{if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
  },
  stats:()=>({limits,phase,requests:receipts.length,discoveryReads,detailReads,decodedBytes,reservedClosingReads:reservedReads,reservedClosingBytes:reservedBytes,reservedClosingDiscovery:reservedDiscovery,reservedClosingDetails:reservedDetails,receipts:structuredClone(receipts)}),
  close(){closed=true;clearTimeout(timer);controller.abort()},
 }
}

export async function runCurrentDaloopaData(options={}){
 const reader=createDaloopaOriginalReader(options),opened=[];let listing=null,client=null
 try{
  const observedAt=observationTime(options)
  need(reader.limits.maxRequests>=14&&reader.limits.maxPages>=6&&reader.limits.maxDetails>=8,'Reduced budget cannot close all fourteen original reads')
  const board=readDaloopaBoard(await reader.read('board'));client=readDaloopaClient(await reader.read('client'));listing=readDaloopaListing(await reader.read('listing'))
  const state=listState.get(listing),selected=state.eligible.slice(0,2);need(selected.length>0,'No qualified current IndiaRemote native candidates');reader.bindCandidates(selected.map(row=>row.reqId))
  for(const row of selected){const id=row.reqId,detail=readDaloopaDetail(await reader.read('detail-'+id),id,row),landing=readDaloopaLanding(await reader.read('landing-'+id),id);opened.push({id,detail,landing,listRow:row,rawListRowJSON:state.rawRows.get(id)})}
  reader.beginClosing()
  const closingBoard=readDaloopaBoard(await reader.read('board')),closingClient=readDaloopaClient(await reader.read('client')),closingListing=readDaloopaListing(await reader.read('listing')),closingState=listState.get(closingListing)
  need(client.carrierSHA256===closingClient.carrierSHA256,'Native client carrier changed at closing')
  for(const role of opened){const row=closingListing.reqDetailsBOList.find(row=>row.reqId===role.id),detail=readDaloopaDetail(await reader.read('detail-'+role.id),role.id,row);need(sameNativeDetail({...role.detail,value:role.detail.envelope},{...detail,value:detail.envelope})&&role.detail.rawDataBase64===detail.rawDataBase64,'Complete current data/v token closing changed');const landing=readDaloopaLanding(await reader.read('landing-'+role.id),role.id);role.closing={detail,landing,listRow:row,rawListRowJSON:closingState.rawRows.get(role.id)}}
  const stats=reader.stats(),physicalReads=2*(3+2*opened.length);need(stats.requests===physicalReads&&stats.discoveryReads===6&&stats.detailReads===4*opened.length&&stats.reservedClosingReads===0&&stats.reservedClosingBytes===0,'All bound physical originals must close')
  const jobs=opened.map(role=>({source:SOURCE,company:COMPANY,companyName:COMPANY,jobId:String(role.id),sourceJobId:String(role.id),title:role.detail.record.reqTitle,country:'India',location:'India (Remote)',nativeCountryCode:role.listRow.countryCode,nativeLocationList:structuredClone(role.detail.record.locationList),nativeWorkplace:'Remote',
   sourceUrl:role.landing.url,url:role.landing.url,jobUrl:role.landing.url,nativeJobLandingURL:role.landing.url,sourceCanonicalURL:null,nativeCanonicalURL:null,nativeLandingContainsRoleData:false,applyUrl:null,link:null,nativeApplicationURL:null,nativeApplicationActionVerified:false,activeApplyVerified:false,applicationVisited:false,
   postingDate:null,datePosted:null,postedDate:null,nativeDetailPublicationDate:null,firstEverPublication:null,firstPublicationVerified:false,closingDate:null,validThrough:null,nativeApprovalDate:role.listRow.approvedOn,sourcePublicationProvenance:'Native approvedOn is retained as approval data only; no public posting, first publication or expiry date proved',
   sourceDescription:completeCriteria(role),description:completeCriteria(role),jobDescription:completeCriteria(role),minimumQualification:role.detail.record.educationList.join('; '),sourceExperienceRequired:'Native listing expMin: '+role.listRow.expMin+'; expMax: '+role.listRow.expMax+'. Native detail expMin: '+role.detail.record.expMin+'; expMax: '+role.detail.record.expMax+'. Original rich criteria retained separately.',nativeListingDescription:role.listRow.jdDisplay,nativeEducationList:structuredClone(role.detail.record.educationList),nativeStructuredExperience:{min:role.detail.record.expMin,max:role.detail.record.expMax},nativeQualificationTensions:'Complete independent listing, detail and original rich criteria are preserved without reconciliation',
   nativeSourceRecord:structuredClone(role.detail.record),nativeClosingSourceRecord:structuredClone(role.closing.detail.record),nativeDetailData:structuredClone(role.detail.data),nativeClosingDetailData:structuredClone(role.closing.detail.data),nativeOriginalEnvelope:structuredClone(role.detail.envelope),nativeClosingOriginalEnvelope:structuredClone(role.closing.detail.envelope),nativeRawDataSHA256:role.detail.rawDataSHA256,nativeClosingRawDataSHA256:role.closing.detail.rawDataSHA256,nativeListingRecord:structuredClone(role.listRow),nativeClosingListingRecord:structuredClone(role.closing.listRow),nativeRawListingRecordJSON:role.rawListRowJSON,nativeRawDetailDataJSON:role.detail.rawDataJSON,nativeRawRoleRecordJSON:role.detail.rawRoleJSON,nativeDeclaredEmployerName:client.clientName,nativeLegalHiringOrganization:null,
   sourceDetailComplete:true,nativeCriteriaTextComplete:true,sourceDetailStatus:'complete',sourceCriteriaPresentation:'Complete original native plain/rich and raw44listing/4data/13role records as data only; opaque controls/counters are not additional screening, pay or availability semantics',firstParty:false,sourceCorporateBindingQualified:false,formalLegalEmployerQualified:false,currentCSSCoverage:false,clientDependencyCoverage:false,activationVerified:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:true}))
  attachInventoryEvidence(jobs,{...inventory(physicalReads),verifiedAt:observedAt})
  const observations={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:listing.reqDetailsBOList.length,observedVacancyCount:listing.reqDetailsBOList.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,observations)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...observations,observedAt,nativeObservedRecordCount:listing.reqDetailsBOList.length,qualifiedNativeIndiaIds:opened.map(role=>role.id),unqualifiedCountryIds:listing.reqDetailsBOList.filter(row=>!plainIndia(row)).map(row=>row.reqId),unhydratedCandidateIds:state.eligible.slice(2).map(row=>row.reqId),heldRows:state.held,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,firstParty:false,sourceCorporateBindingQualified:false,formalLegalEmployerQualified:false,currentCSSCoverage:false,clientDependencyCoverage:false,activationVerified:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,nativeOpeningBoard:board,nativeClosingBoard:closingBoard,nativeClient:client,nativeClosingClient:closingClient,nativeOpeningListing:listing,nativeClosingListing:closingListing,nativeCandidates:opened,allOriginalNativeClosingReconciled:true,originalResponses:stats.receipts,limits:stats.limits,originalDecodedBytes:stats.decodedBytes,physicalReads,applicationInteractions:0,opaqueVUnconsumedMetadataOnly:true,allNonDiagnosticDataAndVTokensClosed:opened.every(role=>role.detail.rawVersionToken===role.closing.detail.rawVersionToken),allNonDiagnosticDataClosed:true,allOriginalVersionTokensRetained:true,catalogueExampleCountsAreHistorical:true,fixtureBusinessValuesUsedAsAdmissionPins:false},configurable:true})
  reader.check();return jobs
 }catch(error){
  options.signal?.throwIfAborted()
  const failure=error?.code==='DALOOPA_NATIVE_DATA_GAP'||error?.name==='TimeoutError'?error:gap('Native transport, body or inventory unavailable',{cause:error,nativeAuthorityFailure:false})
  try{Object.assign(failure,{abortRetries:true,softFailure:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,inventoryEvidence:inventory(reader.stats().requests)});Object.defineProperty(failure,'recruitmentObservations',{value:{source:SOURCE,firstParty:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,receipts:reader.stats().receipts,opened,nativeListing:listing,nativeClient:client},configurable:true,enumerable:true})}catch{}
  throw failure
 }finally{reader.close()}
}
export const createDaloopaNativeDataScraper=(options={})=>({source:SOURCE,run:extra=>runCurrentDaloopaData({...options,...extra})})
export {runCurrentDaloopaData as run}
