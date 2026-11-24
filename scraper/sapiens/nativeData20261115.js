import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual,types} from 'node:util'
import {decodeHTML} from 'entities'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence,normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import CATALOG from './catalog.js'

const PROFILE=JSON.parse(readFileSync(new URL('./reviewedNativeData20261115.json',import.meta.url),'utf8'))
export const SOURCE='sapiens',COMPANY='Sapiens',BOARD_URL=PROFILE.nativeBoardUrl,PROVIDER_METADATA=CATALOG
const same=isDeepStrictEqual,sha=value=>createHash('sha256').update(value).digest('hex')
const defaults={sourceTimeoutMs:45000,requestTimeoutMs:15000,maxRequests:16,maxPages:6,maxDetails:8,maxEntityBytes:4000000,maxTotalBytes:24000000}
const HTML_BYTES=524288,JSON_BYTES=1048576,CLOSING_BYTES=3*HTML_BYTES+4*JSON_BYTES,CLOSING_READS=7,USER_AGENT=PROFILE.reviewedUserAgent
const baseDescriptors=PROFILE.readDescriptors.slice(0,3)
const fields=Object.keys(PROFILE.feed.jobAdDetails[0]),filterNames=Object.keys(PROFILE.feed.filterGroups)
const referenceForm=PROFILE.roles[0].form,referenceIntake=referenceForm.data.jobAd.applicationForm
const intakePaths=referenceIntake['/applicationForm/fields'].value.map(field=>field['/applicationFormField/fieldPath'].value)
const richFields=['description','requirements','responsibilities','benefits','payTransparencySalaryAdditionalInfo']
const salaryFields=['payTransparencyMinSalary','payTransparencyMaxSalary','payTransparencySalaryCurrency','payTransparencySalaryPayPeriod']
const formDescriptionPrefix='/jobAd/descriptionId./jobDescription/'
const inventory=(pagesFetched=0)=>normalizeInventoryEvidence({status:'coverage-gap',surface:BOARD_URL,firstParty:false,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'native-criteria-and-intake-data-only;unhydrated-and-company-render-application-scope-unqualified'})
const gap=(message,extra={})=>firstPartyFailure(SOURCE,message,{code:'SAPIENS_NATIVE_DATA_GAP',partial:true,nativeAuthorityFailure:true,firstParty:false,sourceCorporateBindingQualified:false,sourceListingComplete:false,sourceScopeComplete:false,inventoryEvidence:inventory(),...extra})
const need=(condition,message)=>{if(!condition)throw gap(message)}
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const exact=(value,keys)=>record(value)&&same(Object.keys(value).sort(),[...keys].sort())
const string=value=>typeof value==='string'&&value.isWellFormed()&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
const label=value=>string(value)&&value.trim().length>0&&!/[<>]/.test(value)
const positive=value=>Number.isSafeInteger(value)&&value>0
const ordinal=value=>Number.isSafeInteger(value)&&value>=0
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const typedArray=Object.getPrototypeOf(Uint8Array.prototype),intrinsic=name=>Object.getOwnPropertyDescriptor(typedArray,name).get
const byteLength=intrinsic('byteLength'),byteOffset=intrinsic('byteOffset'),arrayBuffer=intrinsic('buffer')

// A bounded lexical pass precedes JSON.parse, retaining the complete body while
// rejecting duplicate decoded keys (including escaped duplicates), nonfinite
// numbers, trailing syntax and unsupported depth. No business values are masked.
export function readSapiensStrictJSON(text){
 need(typeof text==='string'&&Buffer.byteLength(text)<=JSON_BYTES,'Native JSON size/representation changed')
 let offset=0,nodes=0
 const space=()=>{while(/[\t\n\r ]/.test(text[offset]??'!'))offset++}
 const quoted=()=>{
  const start=offset;need(text[offset++]==='"','Native JSON string expected')
  while(offset<text.length){
   const char=text[offset++]
   if(char==='"'){let value;try{value=JSON.parse(text.slice(start,offset))}catch{throw gap('Native JSON string encoding changed')};need(value.isWellFormed(),'Unpaired native Unicode surrogate');return value}
   need(char.charCodeAt(0)>=32,'Native JSON control byte changed')
   if(char==='\\'){const escape=text[offset++];if(escape==='u'){need(/^[a-f0-9]{4}$/i.test(text.slice(offset,offset+4)),'Native JSON Unicode escape changed');offset+=4}else need(typeof escape==='string'&&'"\\/bfnrt'.includes(escape),'Native JSON escape changed')}
  }
  throw gap('Unterminated native JSON string')
 }
 const value=depth=>{
  need(depth<=64&&++nodes<=100000,'Native JSON depth/node limit exceeded');space()
  if(text[offset]==='"'){quoted();return}
  if(text[offset]==='{'){
   offset++;space();const keys=new Set();if(text[offset]==='}'){offset++;return}
   for(;;){space();const key=quoted();need(!keys.has(key),'Duplicate decoded native JSON key');keys.add(key);space();need(text[offset++]===':','Native JSON colon changed');value(depth+1);space();const end=text[offset++];if(end==='}')return;need(end===',','Native JSON object changed')}
  }
  if(text[offset]==='['){offset++;space();if(text[offset]===']'){offset++;return}for(;;){value(depth+1);space();const end=text[offset++];if(end===']')return;need(end===',','Native JSON array changed')}}
  for(const literal of ['true','false','null'])if(text.startsWith(literal,offset)){offset+=literal.length;return}
  const number=/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;number.lastIndex=offset;const found=number.exec(text)
  need(found&&Number.isFinite(Number(found[0])),'Native JSON number/value changed');offset=number.lastIndex
 }
 value(0);space();need(offset===text.length,'Trailing native JSON data')
 try{return JSON.parse(text)}catch{throw gap('Native JSON syntax changed')}
}
function descriptor(label){
 const base=baseDescriptors.find(row=>row.label===label);if(base)return base
 const match=/^(form|landing)-(.+)$/.exec(label);need(match&&uuid(match[2]),'Unreviewed native role route')
 return{label,kind:match[1]==='form'?'json':'html',counter:'detail',method:'GET',url:BOARD_URL+(match[1]==='form'?'api/job-ad/'+match[2]+'/application-form':'jobs/'+match[2])}
}
function representation(page,label){
 const expected=descriptor(label)
 need(page.label===label&&page.url===expected.url&&page.method==='GET'&&page.requestBody===null,'Original native literal descriptor changed')
 need(Buffer.isBuffer(page.bytes)&&typeof page.text==='string'&&Buffer.from(page.text).equals(page.bytes),'Original native UTF8/byte representation changed')
}
function staticPin(page,label,referenceLabel=label){
 representation(page,label)
 if(referenceLabel!=='board')return null // JSON tenant facts are checked semantically below.
 const raw=readNativeDocument(page.text),nodes=raw.nodes(()=>true),one=(values,name)=>{need(values.length===1,'Native shell '+name+' owner changed');return values[0]},elements=node=>node.children.filter(child=>typeof child!=='string'),root=one(nodes.filter(node=>node.tag==='root'),'root'),html=one(elements(root).filter(node=>node.tag==='html'),'html'),head=one(elements(html).filter(node=>node.tag==='head'),'head'),body=one(elements(html).filter(node=>node.tag==='body'),'body')
 need(['html','head','body'].every(tag=>nodes.filter(node=>node.tag===tag).length===1)&&![html,head,body].some(node=>node.inert),'Native shell active document changed')
 const title=one(nodes.filter(node=>node.tag==='title'),'title'),base=one(nodes.filter(node=>node.tag==='base'),'base'),mount=one(nodes.filter(node=>node.tag==='careers-app-root'),'application mount')
 need(elements(head).includes(title)&&title.raw==='Careers'&&elements(head).includes(base)&&base.attrs.href==='/'&&!base.inert,'Native shell title/base changed')
 need(elements(body).includes(mount)&&!mount.inert&&Object.keys(mount.attrs).length===0&&mount.children.every(child=>typeof child==='string'&&!child.trim()),'Native shell mount owner changed')
 const scripts=nodes.filter(node=>node.tag==='script'),programs=[];need(scripts.length===4,'Native shell program inventory changed')
 let deployment=null
 for(const [index,node]of scripts.entries()){
  need(!node.inert&&!node.raw.trim()&&typeof node.attrs.src==='string'&&Object.keys(node.attrs).every(key=>['src','id','defer','type'].includes(key)),'Native shell program owner changed')
  const match=/^(https:\/\/front[.]hibob[.]com\/master-[a-f0-9]{40})\/(deployment-info[.]js|careers\/(runtime|polyfills|main)[.][a-f0-9]{16}[.]js)$/.exec(node.attrs.src)
  need(match&&(!deployment||deployment===match[1]),'Native shell declared program publisher/deployment changed');deployment=match[1]
  need(index===0?match[2]==='deployment-info.js'&&node.attrs.id==='bob-deployment-info'&&Object.hasOwn(node.attrs,'defer'):match[3]===['runtime','polyfills','main'][index-1]&&node.attrs.type==='module','Native shell program declaration changed')
  programs.push({...node.attrs})
 }
 need(!nodes.some(node=>['iframe','frame','frameset','object','embed'].includes(node.tag)||Object.hasOwn(node.attrs,'srcdoc')||Object.keys(node.attrs).some(key=>key.startsWith('on'))),'Native shell delegated owner changed')
 return{originalHTML:page.text,declaredPrograms:programs,nativeApplicationQualified:false}
}
export function readSapiensBoard(page){const shell=staticPin(page,'board');return{url:page.url,bytes:page.bytes.length,sha256:sha(page.bytes),roleSSRQualified:false,...shell}}
export function readSapiensClient(page){staticPin(page,'client');const value=readSapiensStrictJSON(page.text);need(same(value,PROFILE.nativeClient)&&value.companyName===COMPANY&&value.isPublished===true&&value.isBobCareerSite===true,'Own native tenant/company publication changed');return value}
export function readSapiensLanding(page,id){need(uuid(id),'Invalid native role UUID');const shell=staticPin(page,'landing-'+id,'board');return{url:page.url,bytes:page.bytes.length,sha256:sha(page.bytes),roleSSRQualified:false,canonicalQualified:false,...shell}}

const closedNotice=/\b(?:(?:position|role|job|vacancy|opening|posting)\s+(?:(?:is|was|has\s+been)\s+(?:closed|filled|expired|unavailable|no\s+longer\s+(?:available|open))|has\s+expired)|no\s+longer\s+accepting\s+applications|applications\s+(?:for\s+(?:(?:this|the)\s+)?(?:position|role|job|vacancy|opening|posting)\s+)?are\s+closed)\b/i
// Availability uses the text produced by the already-supported BR envelope
// and standard HTML entities. Admission and output retain the original rich
// bytes; this view neither admits additional markup nor rewrites criteria.
const supportedRich=value=>string(value)&&!value.replace(/<br\s*\/?>/gi,'').includes('<')&&!closedNotice.test(decodeHTML(value.replace(/<br\s*\/?>/gi,' ')))
const substantive=value=>supportedRich(value)&&value.replace(/<br\s*\/?>/gi,' ').trim().length>=100
function nativeDate(value){
 need(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value),'Native six-fraction publication date changed')
 const ms=Date.parse(value);need(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,19)===value.slice(0,19),'Invalid native publication calendar');return value
}
function locations(value,filters){
 need(Array.isArray(value)&&value.length<=2000,'Native postingLocations type/bound changed');const ids=new Set(),facetOmissions=[]
 for(const location of value){
  need(exact(location,['sourceType','locationId','name','country','region','city','displayFormat','displayValue','showCity','showRegion']),'Native worksite schema changed')
  need(location.sourceType==='site'&&location.displayFormat==='name'&&positive(location.locationId)&&!ids.has(location.locationId),'Native worksite control/identity changed');ids.add(location.locationId)
  need(['name','country','city','displayValue'].every(key=>string(location[key]))&&(location.region===null||string(location.region))&&typeof location.showCity==='boolean'&&typeof location.showRegion==='boolean','Native worksite value types changed')
  const facetLabel=filters.get('sites').get(String(location.locationId));need(facetLabel===undefined||facetLabel===location.name,'Native worksite site ID/name relationship changed');if(facetLabel===undefined)facetOmissions.push({locationId:location.locationId,nativeWorksite:location,reason:'secondary-worksite-not-in-current-site-facet'})
  need(location.displayValue===location.name,'Native worksite name display relationship changed')
  // These are current native ID/label relationships, not geographic inference.
  // A worksite may differ from its role's primary site and country. Empty or
  // null native geography remains unknown data; it never establishes India.
  for(const[group,key]of [['countries','country'],['cities','city'],['regions','region']])if(location[key]!==null&&location[key]!=='')need(filters.get(group).get(location[key])===location[key],'Native worksite '+group+' relationship changed')
 }
 return facetOmissions
}
export function readSapiensFeed(page){
 representation(page,'feed');const value=readSapiensStrictJSON(page.text)
 need(exact(value,['filterGroups','jobAdDetails','jobOpeningMetadata'])&&exact(value.filterGroups,filterNames)&&same(value.jobOpeningMetadata,PROFILE.feed.jobOpeningMetadata),'Native feed protocol/control schema changed')
 const filters=new Map()
 for(const name of filterNames){const entries=value.filterGroups[name];need(Array.isArray(entries)&&entries.length<=2000,'Native filter group bound changed');const values=new Map();for(const entry of entries){need(exact(entry,['serverId','value'])&&label(entry.serverId)&&label(entry.value)&&!values.has(entry.serverId),'Native filter item schema/identity changed');values.set(entry.serverId,entry.value)}filters.set(name,values)}
 need(Array.isArray(value.jobAdDetails)&&value.jobAdDetails.length<=2000,'Native complete feed bound changed')
 const ids=new Set(),eligible=[],held=[],countryConflicts=[],worksiteFacetOmissions=[]
 for(const row of value.jobAdDetails){
  need((exact(row,fields)||exact(row,[...fields,'hideLocationInformation']))&&uuid(row.id)&&!ids.has(row.id),'Native24-field row schema/identity changed');ids.add(row.id)
  need(['title','departmentId','department','employmentTypeId','employmentType','site','language','workspaceTypeId','workspaceType'].every(key=>label(row[key]))&&string(row.country)&&positive(row.siteId),'Native row label/ID type changed')
  need(typeof row.description==='string'&&richFields.slice(1).every(key=>row[key]===null||string(row[key])),'Native authored section types changed')
  need(record(row.sectionLabels)&&Object.keys(row.sectionLabels).every(key=>richFields.includes(key)&&string(row.sectionLabels[key])),'Native section-label schema changed')
  need(salaryFields.slice(0,2).every(key=>row[key]===null||typeof row[key]==='number'&&Number.isFinite(row[key])&&row[key]>=0&&!Object.is(row[key],-0))&&salaryFields.slice(2).every(key=>row[key]===null||label(row[key])),'Native salary type changed')
  need(!Object.hasOwn(row,'hideLocationInformation')||row.hideLocationInformation===null||typeof row.hideLocationInformation==='boolean','Native location concealment value changed')
  nativeDate(row.publishedAt);const facetOmissions=locations(row.postingLocations,filters);if(facetOmissions.length)worksiteFacetOmissions.push({id:row.id,omissions:facetOmissions})
  for(const[group,key,text]of [['departments','departmentId','department'],['sites','siteId','site'],['jobTypes','employmentTypeId','employmentType'],['workspaceTypes','workspaceTypeId','workspaceType']])need(filters.get(group).get(String(row[key]))===row[text],'Native row/filter relationship changed')
  const conflicting=row.postingLocations.some(location=>location.country!==row.country)
  if(conflicting)countryConflicts.push({id:row.id,primaryCountry:row.country,postingLocations:structuredClone(row.postingLocations)})
  let reason=null
  if(row.hideLocationInformation===true)reason='publisher-hides-location-information'
  else if(facetOmissions.length)reason='secondary-worksite-not-in-current-site-facet'
  else if(row.country!=='India')reason='country-not-qualified-India'
  else if(row.postingLocations.some(location=>location.country!=='India'))reason='missing-or-conflicting-native-worksite-country'
  else if(!substantive(row.description)||richFields.some(key=>row[key]!==null&&!supportedRich(row[key])))reason='unsupported-or-incomplete-native-rich-criteria'
  if(reason)held.push({id:row.id,reason});else eligible.push(row)
 }
 return{value,rows:value.jobAdDetails,eligible,held,countryConflicts,worksiteFacetOmissions,declaredIndiaIds:value.jobAdDetails.filter(row=>row.country==='India').map(row=>row.id)}
}
const wrapped=(value,name)=>{need(exact(value,['value']),'Native '+name+' wrapper changed');return value.value}
export function readSapiensForm(page,row){
 need(uuid(row?.id),'Unbound native form identity');representation(page,'form-'+row.id);const value=readSapiensStrictJSON(page.text)
 need(exact(value,['metadata','data'])&&same(value.metadata,referenceForm.metadata),'Native generic17 metadata/control definitions changed')
 need(exact(value.data,['jobAd','companyLists','agency','supportedFileTypes'])&&value.data.agency===null&&same(value.data.companyLists,referenceForm.data.companyLists),'Native public form authority/lookup controls changed')
 const job=value.data.jobAd;need((exact(job,Object.keys(referenceForm.data.jobAd))||exact(job,[...Object.keys(referenceForm.data.jobAd),'hideLocationInformation']))&&Object.hasOwn(job,'hideLocationInformation')===Object.hasOwn(row,'hideLocationInformation')&&job.hideLocationInformation===row.hideLocationInformation&&job.hideLocationInformation!==true&&job.type==='api'&&job.title===row.title&&job.site===row.site+', '+row.country&&job.languageCode===row.language&&job.employmentType===row.employmentType&&job.workspaceType===row.workspaceType&&same(job.postingLocations,row.postingLocations),'Current native form/feed identity or country relationship changed')
 const actual=job.applicationForm;need(exact(actual,Object.keys(referenceIntake))&&positive(actual.id),'Native form ID/schema changed')
 const actualFields=wrapped(actual['/applicationForm/fields'],'fields'),documents=wrapped(actual['/applicationForm/documents'],'documents'),questions=wrapped(actual['/applicationForm/questions'],'questions')
 need(Array.isArray(actualFields)&&actualFields.length===intakePaths.length&&Array.isArray(documents)&&documents.length<=100&&Array.isArray(questions)&&questions.length===0,'Unsupported native intake/question control')
 const childIds=new Set(),paths=new Set(),fieldOrdinals=new Set(),documentOrdinals=new Set()
 for(const field of actualFields){
  need(exact(field,['id','/applicationFormField/applicationFormId','/applicationFormField/ordinal','/applicationFormField/fieldPath','/applicationFormField/isMandatory'])&&positive(field.id)&&!childIds.has(field.id),'Native field control/child identity changed');childIds.add(field.id)
  const parent=wrapped(field['/applicationFormField/applicationFormId'],'field parent'),order=wrapped(field['/applicationFormField/ordinal'],'field ordinal'),fieldPath=wrapped(field['/applicationFormField/fieldPath'],'field path'),mandatory=wrapped(field['/applicationFormField/isMandatory'],'field mandatory')
  need(parent===actual.id&&ordinal(order)&&!fieldOrdinals.has(order)&&intakePaths.includes(fieldPath)&&!paths.has(fieldPath)&&typeof mandatory==='boolean','Native field path/parent/ordinal/mandatory control changed');fieldOrdinals.add(order);paths.add(fieldPath)
 }
 for(const doc of documents){
  need(exact(doc,['id','/applicationFormDocument/instructions','/applicationFormDocument/ordinal','/applicationFormDocument/type','/applicationFormDocument/isMandatory','/applicationFormDocument/applicationFormId','/applicationFormDocument/name'])&&positive(doc.id)&&!childIds.has(doc.id),'Native document control/child identity changed');childIds.add(doc.id)
  const parent=wrapped(doc['/applicationFormDocument/applicationFormId'],'document parent'),order=wrapped(doc['/applicationFormDocument/ordinal'],'document ordinal')
  need(parent===actual.id&&ordinal(order)&&!documentOrdinals.has(order)&&wrapped(doc['/applicationFormDocument/type'],'document type')==='resume'&&typeof wrapped(doc['/applicationFormDocument/isMandatory'],'document mandatory')==='boolean'&&string(wrapped(doc['/applicationFormDocument/name'],'document name'))&&string(wrapped(doc['/applicationFormDocument/instructions'],'document instructions')),'Native document parent/type/constraint changed');documentOrdinals.add(order)
 }
 need(Array.isArray(value.data.supportedFileTypes)&&value.data.supportedFileTypes.length>0&&value.data.supportedFileTypes.length<=1000&&new Set(value.data.supportedFileTypes).size===value.data.supportedFileTypes.length&&value.data.supportedFileTypes.every(type=>typeof type==='string'&&/^\.[a-z0-9]{1,32}$/.test(type)),'Native supported file constraints changed')
 const descriptions=job.jobDescription,allowed=['sectionLabels',...richFields,...salaryFields]
 need(record(descriptions)&&Object.keys(descriptions).every(path=>allowed.some(key=>path===formDescriptionPrefix+key)),'Unknown native description/control field')
 const presence=[]
 for(const key of allowed){const path=formDescriptionPrefix+key,has=Object.hasOwn(descriptions,path);if(!has){need(key!=='description'&&key!=='sectionLabels'&&row[key]===null,'Missing populated native criteria/pay carrier');presence.push({field:key,formHasOwn:false,feedValueIsNull:true});continue}const original=wrapped(descriptions[path],key);need(same(original,row[key]),'Native form/feed '+key+' contradiction');presence.push({field:key,formHasOwn:true,feedValueIsNull:row[key]===null})}
 need(substantive(row.description)&&richFields.every(key=>row[key]===null||supportedRich(row[key])),'Unsupported native rich criteria markup/closure')
 return{value,row,formId:actual.id,descriptionPresence:presence}
}

const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const completeDescription=role=>role.row.description+'\n<h2>Original native feed record</h2><pre>'+escape(JSON.stringify(role.row,null,2))+'</pre>\n<h2>Original public form data: actual intake and lookup options</h2><p>Lookup dictionaries contain reference options, not additional screening requirements.</p><pre>'+escape(JSON.stringify(role.form.value.data,null,2))+'</pre>'
function observationTime(options){const value=typeof options.now==='function'?options.now():options.now??new Date(),ms=value instanceof Date?value.getTime():typeof value==='string'?Date.parse(value):NaN;need(Number.isFinite(ms),'Invalid native observation clock');return new Date(ms).toISOString()}

export function createSapiensOriginalReader(options={}){
 const descriptors=new Map(baseDescriptors.map(row=>[row.label,row])),labels=baseDescriptors.map(row=>row.label),openingPages=new Map()
 const caller=options.signal;caller?.throwIfAborted()
 need(options.maxJobs==null,'Native truncation is forbidden')
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'Original Response metadata is required; body-only callbacks are unsupported')
 need(options.fetchImpl===undefined||typeof options.fetchImpl==='function','Invalid original transport callback')
 const reduced=(names,maximum)=>{const values=names.map(name=>options[name]).filter(value=>value!==undefined&&value!==null);need(values.every(value=>Number.isSafeInteger(value)&&value>0&&value<=maximum),'Invalid '+names.join('/')+' ceiling');return Math.min(maximum,...values)}
 const limits=Object.fromEntries(Object.entries(defaults).map(([name,maximum])=>[name,reduced(name==='sourceTimeoutMs'?['timeoutMs',name]:name==='maxPages'?[name,'maxDiscoveryReads']:[name],maximum)]))
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,started=performance.now(),receipts=[],lastStarts=new Map()
 let phase='opening',reservedReads=CLOSING_READS,reservedBytes=CLOSING_BYTES,reservedDiscovery=3,reservedDetails=4,decodedBytes=0,discoveryReads=0,detailReads=0,inFlight=false,closed=false
 let timer
 const expire=()=>{
  if(closed||signal.aborted)return
  clearTimeout(timer)
  const remaining=limits.sourceTimeoutMs-(performance.now()-started)
  if(remaining>0){timer=setTimeout(expire,Math.max(1,Math.ceil(remaining)));return}
  controller.abort(new DOMException('Sapiens native source deadline exceeded','TimeoutError'))
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
  bindCandidates(ids){
   check();need(phase==='opening'&&!inFlight&&receipts.length===3&&openingPages.has('feed'),'Native role binding requires three current opening originals')
   const current=readSapiensFeed(openingPages.get('feed'))
   need(ids.length===2&&same(ids,current.eligible.slice(0,2).map(row=>row.id)),'Fewer than two safe native candidates or unbound current role selection')
   for(const id of ids)for(const type of ['form','landing']){const row=descriptor(type+'-'+id);descriptors.set(row.label,row);labels.push(row.label)}
  },
  beginClosing(){check();need(!inFlight&&phase==='opening'&&receipts.length===7&&receipts.every(row=>row.bodyComplete),'All seven opening originals must complete before closing');phase='closing'},
  async read(label){
   check();const descriptor=descriptors.get(label),position=receipts.length-(phase==='closing'?7:0)
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
      original=await(options.fetchImpl??globalThis.fetch)(url,{...init,method:descriptor.method,...(descriptor.method==='POST'?{body:descriptor.body}:{}),redirect:'manual',credentials:'omit',headers:{'User-Agent':USER_AGENT,Accept:isJSON?'application/json':'text/html',...(isJSON?{companyIdentifier:SOURCE}:{})}})
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

export async function runCurrentSapiensData(options={}){
 const reader=createSapiensOriginalReader(options),opened=[],originals=new Map();let feed=null,client=null
 const read=async label=>{const page=await reader.read(label);if(!originals.has(label))originals.set(label,page);return page}
 try{
  const observedAt=observationTime(options)
  need(reader.limits.maxRequests>=14&&reader.limits.maxPages>=6&&reader.limits.maxDetails>=8,'Reduced budget cannot close all fourteen native originals')
  const board=readSapiensBoard(await read('board'));client=readSapiensClient(await read('client'));feed=readSapiensFeed(await read('feed'))
  need(feed.eligible.length>=2,'Fewer than two safely qualified native India candidates')
  const selected=feed.eligible.slice(0,2);reader.bindCandidates(selected.map(row=>row.id))
  const formIds=new Set()
  for(const row of selected){
   const form=readSapiensForm(await read('form-'+row.id),row);need(!formIds.has(form.formId),'Distinct native roles reused one form ID');formIds.add(form.formId)
   const landing=readSapiensLanding(await read('landing-'+row.id),row.id);opened.push({row,form,landing})
  }
  reader.beginClosing()
  const closingBoard=readSapiensBoard(await read('board')),closingClient=readSapiensClient(await read('client')),closingFeed=readSapiensFeed(await read('feed'))
  for(const role of opened){const row=closingFeed.rows.find(row=>row.id===role.row.id),form=readSapiensForm(await read('form-'+role.row.id),row),landing=readSapiensLanding(await read('landing-'+role.row.id),role.row.id);role.closing={row,form,landing}}
  const stats=reader.stats();need(stats.requests===14&&stats.discoveryReads===6&&stats.detailReads===8&&stats.reservedClosingReads===0&&stats.reservedClosingBytes===0,'All fourteen current originals must independently close')
  const jobs=opened.map(role=>{
   const description=completeDescription(role),row=role.row
   return{source:SOURCE,company:COMPANY,companyName:COMPANY,jobId:row.id,sourceJobId:row.id,requisitionId:null,title:row.title,country:'India',location:role.form.value.data.jobAd.site,city:null,state:null,employmentType:row.employmentType,department:row.department,remoteStatus:row.workspaceType,
    sourceUrl:role.landing.url,jobUrl:role.landing.url,url:role.landing.url,nativeJobLandingURL:role.landing.url,applyUrl:null,link:null,nativeApplicationURL:null,nativeCanonicalURL:null,sourceCanonicalURL:null,applicationVisited:false,activeApplyVerified:false,nativeApplicationActionVerified:false,nativeLandingContainsRoleData:false,
    postingDate:row.publishedAt,datePosted:row.publishedAt,postedDate:row.publishedAt,sourceNativeDates:{publishedAt:row.publishedAt,validThrough:null,closingDate:null},sourcePublicationProvenance:'Exact native publishedAt including six microsecond digits; no first-ever publication proved',firstEverPublication:null,firstPublicationVerified:false,closingDate:null,validThrough:null,
    sourceDescription:description,description,jobDescription:description,nativeOriginalRichDescription:row.description,nativeSourceRecord:structuredClone(row),nativeClosingSourceRecord:structuredClone(role.closing.row),nativePublicForm:structuredClone(role.form.value),nativeClosingPublicForm:structuredClone(role.closing.form.value),nativeActualApplicationFormId:role.form.formId,nativeDescriptionPresence:role.form.descriptionPresence,
    nativeCriteriaTextComplete:true,sourceDetailComplete:true,sourceDetailStatus:'complete',sourceCriteriaPresentation:'Complete original native feed and actual public form/intake data only; generic metadata and lookup options are not additional screening requirements',genericMetadataQualifiedAsScreeningRequirements:false,
    firstParty:false,sourceCorporateBindingQualified:false,formalLegalEmployerQualified:false,nativeLegalHiringOrganization:null,activationVerified:false,currentCSSCoverage:false,clientDependencyCoverage:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:true}
  })
  attachInventoryEvidence(jobs,{...inventory(14),verifiedAt:observedAt})
  const observation={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:feed.rows.length,observedVacancyCount:feed.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,observation)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...observation,observedAt,sourceListingComplete:false,lifecycleCleanupAllowed:false,firstParty:false,sourceCorporateBindingQualified:false,formalLegalEmployerQualified:false,currentCSSCoverage:false,clientDependencyCoverage:false,activationVerified:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,
   nativeObservedRecordCount:feed.rows.length,declaredNativeIndiaCount:feed.declaredIndiaIds.length,qualifiedNativeIndiaIds:selected.map(row=>row.id),unhydratedIndiaIds:feed.declaredIndiaIds.filter(id=>!selected.some(row=>row.id===id)),otherObservedIds:feed.rows.filter(row=>row.country!=='India').map(row=>row.id),heldRows:feed.held,nativeCountryConflicts:feed.countryConflicts,nativeWorksiteFacetOmissions:feed.worksiteFacetOmissions,
   nativeOpeningBoard:board,nativeClosingBoard:closingBoard,nativeClient:client,nativeClosingClient:closingClient,nativeOpeningFeed:feed.value,nativeClosingFeed:closingFeed.value,nativeCandidates:opened,originalResponses:stats.receipts,physicalReads:14,originalDecodedBytes:stats.decodedBytes,limits:stats.limits,allSevenWholeCurrentBodiesClosed:true,allOriginalNativeClosingReconciled:true,applicationInteractions:0,volatileFixtureValuesUsedAsAdmissionPins:false,exampleCountsAndIdsAreNotPermanentConstants:true},configurable:true})
  reader.check();return jobs
 }catch(error){
  options.signal?.throwIfAborted()
  const failure=error?.code==='SAPIENS_NATIVE_DATA_GAP'||error?.name==='TimeoutError'?error:gap('Native transport, body or inventory unavailable',{cause:error,nativeAuthorityFailure:false})
  try{Object.assign(failure,{abortRetries:true,softFailure:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,inventoryEvidence:inventory(reader.stats().requests)});Object.defineProperty(failure,'recruitmentObservations',{value:{source:SOURCE,firstParty:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,originalResponses:reader.stats().receipts,nativeFeed:feed?.value??null,nativeClient:client,opened},configurable:true,enumerable:true})}catch{}
  throw failure
 }finally{reader.close()}
}
export const createSapiensNativeDataScraper=(options={})=>({source:SOURCE,run:extra=>runCurrentSapiensData({...options,...extra})})
export {runCurrentSapiensData as run}

