import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseBoundedProgram,parseRemoteLiteral} from '../../scraper-support/utils/remoteScriptData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(fs.readFileSync(new URL('./currentScope20261115.json',import.meta.url),'utf8'))
export const CURRENT_CORPORATE='https://www.sociowash.com/about'
export const CURRENT_BOARD='https://sociowash.zohorecruit.com/jobs/Careers'
const ORG='414709000000177005',PAGE='414709000000833001'
const SWIPER='https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css'
const sha=value=>createHash('sha256').update(value).digest('hex'),norm=value=>String(value??'').replace(/\u200b/g,'').replace(/\s+/g,' ').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const problem=message=>Object.assign(Error('Sociowash current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(condition,message)=>{if(!condition)throw problem(message)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const own=(value,keys,label)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),[...keys].sort()),'unreviewed complete '+label+' fields')
const all=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(all)]
const rootOf=d=>one(d.nodes(n=>n.tag==='root'),'native document root')
const nodesOf=d=>all(rootOf(d))
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const astOf=source=>{try{return parseBoundedProgram(source)}catch{throw problem('unsupported or oversized native initializer program')}}
const literal=(source,node)=>{try{return parseRemoteLiteral(source.slice(node.start,node.end))}catch{throw problem('duplicate decoded or unsupported native literal')}}
export function strictSociowashJSON(source){
 try{JSON.parse(source);return parseRemoteLiteral(source)}catch{throw problem('malformed or duplicate decoded native JSON')}
}
const declarations=ast=>ast.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[])
const declaration=(ast,name)=>one(declarations(ast).filter(n=>n.id.type==='Identifier'&&n.id.name===name),'native '+name+' declaration')
const jsonDeclaration=(source,node)=>{
 const call=node.init
 need(call?.type==='CallExpression'&&!call.optional&&call.callee.type==='MemberExpression'&&!call.callee.computed&&!call.callee.optional&&call.callee.object.name==='JSON'&&call.callee.property.name==='parse'&&call.arguments.length===1&&call.arguments[0].type==='Literal'&&typeof call.arguments[0].value==='string','native data is not a literal JSON.parse declaration')
 return strictSociowashJSON(literal(source,call.arguments[0]))
}
export function currentSociowashInitializers(html,kind){
 const document=readNativeDocument(html),nodes=nodesOf(document)
 if(kind==='corporate')return{document,nodes}
 const script=one(nodes.filter(n=>n.tag==='script'&&(n.raw??'').includes('var csrfParamName = ')),'current '+kind+' initializer')
 need(!script.inert&&Object.keys(script.attrs).length===0,'native initializer execution mode/context changed')
 const source=script.raw,ast=astOf(source),csrf=declaration(ast,'csrfToken'),parameter=declaration(ast,'csrfParamName')
 need(literal(source,parameter.init)==='crmcsrfparam'&&csrf.init?.type==='Literal'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(literal(source,csrf.init)),'native anonymous token declaration changed')
 if(kind==='board'){
  const hidden={}
  for(const id of ['jobs','meta','moduleMeta','pageJson']){
   const carrier=one(nodes.filter(n=>n.tag==='input'&&n.attrs.id===id),'native '+id+' carrier')
   own(carrier.attrs,['type','value','id'],id+' carrier');need(carrier.attrs.type==='hidden','native hidden model carrier type changed')
   hidden[id]=strictSociowashJSON(carrier.attrs.value)
  }
  return{document,nodes,script,source,ast,csrf,hidden,rows:hidden.jobs,meta:hidden.meta,moduleMeta:hidden.moduleMeta,pageJson:hidden.pageJson}
 }
 need(kind==='role','unsupported document kind')
 const jobs=declaration(ast,'jobs'),rows=jsonDeclaration(source,jobs),meta=literal(source,declaration(ast,'meta').init)
 return{document,nodes,script,source,ast,csrf,dataNode:jobs.init,rows,meta,moduleMeta:literal(source,declaration(ast,'moduleMeta').init),pageJson:literal(source,declaration(ast,'portalPageJson').init),attachments:literal(source,declaration(ast,'public_attachments_info').init)}
}
const modifiers='(?:(?:now|currently|already|permanently|temporarily)\\s+)*'
const closure=new RegExp('\\b(?:(?:(?:this|the)\\s+)?(?:job|role|position|vacancy|opening|opportunity)\\s+(?:(?:is|was|are|were|has|have)\\s+'+modifiers+'(?:been\\s+)?)?'+modifiers+'(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|not\\s+(?:currently\\s+)?available|no\\s+longer\\s+(?:available|active|open))|(?:no\\s+longer|not(?:\\s+currently)?)\\s+accepting\\s+(?:(?:any|new)\\s+)?applications|(?:applications|recruitment|hiring)\\s+(?:for\\s+(?:(?:this|the)\\s+)?(?:role|position|job|vacancy)\\s+)?(?:(?:is|was|are|were|has|have)\\s+'+modifiers+'(?:been\\s+)?)?'+modifiers+'(?:closed|ended|stopped|suspended|unavailable))\\b','i')
const closureOnly=new RegExp('^(?:'+closure.source+')[.!]?$','i')
const rawText=node=>typeof node==='string'?decodeNativeEntities(node):['script','style','meta','link'].includes(node.tag)?'':node.raw!==undefined?decodeNativeEntities(node.raw):node.children.map(rawText).join(' ')
function inactiveClosure(node){
 if(typeof node==='string'||!closureOnly.test(norm(rawText(node))))return false
 const definite=['template','noscript'].includes(node.tag)||Object.hasOwn(node.attrs,'hidden')||/^display\s*:\s*none\s*(?:!important)?\s*;?$/i.test(node.attrs.style??'')
 return definite&&all(node).every(n=>['div','p','span','template','noscript'].includes(n.tag)&&Object.entries(n.attrs).every(([k,v])=>k==='hidden'&&['','hidden'].includes(v)||k==='style'&&/^display\s*:\s*none\s*(?:!important)?\s*;?$/i.test(v)))
}
export function currentSociowashDocumentContract(html,kind){
 const initial=currentSociowashInitializers(html,kind),{nodes,script,source,csrf,dataNode}=initial
 let normalized=source
 if(script){
  const replacements=[{...csrf.init,value:'<ANONYMOUS-UUIDV4-TOKEN>'},...(dataNode?[{...dataNode,value:'<COMPLETE-NATIVE-ROLE-DATA>'}]:[])]
  normalized=replacements.sort((a,b)=>b.start-a.start).reduce((value,item)=>value.slice(0,item.start)+item.value+value.slice(item.end),source)
 }
 const tree=node=>typeof node==='string'?node:inactiveClosure(node)?null:{tag:node.tag,attrs:Object.fromEntries(Object.entries(node.attrs).map(([key,value])=>[key,kind==='board'&&node.tag==='input'&&node.attrs.id==='jobs'&&key==='value'?'<COMPLETE-NATIVE-BOARD-DATA>':value])),inert:!!node.inert,...(node.raw===undefined?{children:node.children.map(tree).filter(value=>value!==null)}:{rawSHA256:sha(node===script?normalized:node.raw)})}
 // Every original text/control/property carrier, including inactive ones, is
 // bound. Only fully parsed native data and the exact token slot are projected.
 return{treeSHA256:sha(JSON.stringify(tree(rootOf(initial.document)))),commentsSHA256:sha(JSON.stringify([...html.matchAll(/<!--[\s\S]*?-->/g)].map(m=>m[0]))),doctype:html.match(/<!doctype[^>]*>/i)?.[0]??null}
}
const criticalHeaders=['content-type','content-disposition','content-security-policy','content-security-policy-report-only','refresh','link','location','content-location','x-content-type-options','x-frame-options','report-to','reporting-endpoints','nel','access-control-allow-origin','cross-origin-resource-policy']
export function currentSociowashHeaders(headers,url){
 const lower=Object.fromEntries(Object.entries(headers).map(([key,value])=>[key.toLowerCase(),value])),result=Object.fromEntries(criticalHeaders.map(key=>[key,lower[key]??null]))
 if((new URL(url).hostname==='cdnjs.cloudflare.com'||url===SWIPER)&&(result['report-to']!==null||result.nel!==null)){
  need(typeof result['report-to']==='string'&&typeof result.nel==='string','native Cloudflare NEL pair incomplete')
  const report=strictSociowashJSON(result['report-to'])
  own(report,['group','max_age','endpoints'],'Cloudflare NEL reporting model')
  need(report.group==='cf-nel'&&report.max_age===604800&&Array.isArray(report.endpoints)&&report.endpoints.length===1,'native Cloudflare NEL group/model changed')
  own(report.endpoints[0],['url'],'Cloudflare NEL endpoint')
  const endpoint=new URL(report.endpoints[0].url),nel=strictSociowashJSON(result.nel)
  need(endpoint.origin==='https://a.nel.cloudflare.com'&&endpoint.pathname==='/report/v4'&&!endpoint.username&&!endpoint.password&&!endpoint.hash&&[...endpoint.searchParams.keys()].length===1&&endpoint.searchParams.has('s')&&/^[A-Za-z0-9+/]{80,240}={0,2}$/.test(endpoint.searchParams.get('s')),'native Cloudflare NEL endpoint/path/token changed')
  own(nel,['report_to','success_fraction','max_age'],'Cloudflare NEL binding')
  need(nel.report_to==='cf-nel'&&nel.success_fraction===0.01&&nel.max_age===604800,'native Cloudflare NEL header group binding changed')
  report.endpoints[0].url='https://a.nel.cloudflare.com/report/v4?s=<NATIVE-ANONYMOUS-REPORTING-TOKEN>'
  result['report-to']=JSON.stringify(report)
 }
 return result
}
function qualifyMeta(meta,kind,url){
 need(meta&&meta.source==='CareerSite'&&meta.employee_portal===false&&meta.page_id===PAGE&&meta.page_name==='Careers'&&meta.list_url===CURRENT_BOARD&&meta.date_format==='dd/MM/yyyy'&&meta.portal_user?.is_loggedin===false,'current exact anonymous native page/source/date context changed')
 need(meta.org_info?.id===ORG&&meta.org_info.company_name==='Sociowash'&&meta.org_info.type==='internal'&&meta.org_info.hide_company_name===false&&meta.org_info.website==='www.sociowash.com','native original employer/reciprocal corporate domain changed')
 if(kind==='role')need(meta.detail_url===url&&meta.webform_id==='414709000000072351','native public role/application identity changed')
}
const dateOf=value=>{
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,'invalid native date/calendar')
 return value
}
export function currentSociowashRichText(html){
 const d=readNativeDocument(html),nodes=nodesOf(d)
 const tags=['root','p','span','strong','b','i','em','u','ul','ol','li','br','a','div','h1','h2','h3','h4','h5','h6']
 need(typeof html==='string'&&html.length<=100000&&nodes.every(n=>!n.inert&&tags.includes(n.tag))&&!html.includes('<!--'),'unknown non-text/inactive original criterion carrier')
 for(const node of nodes)need(Object.keys(node.attrs).length===0||profile.descriptionAttributes?.some(value=>value.tag===node.tag&&same(value.attrs,node.attrs)),'unreviewed original criterion attribute/value')
 return norm(d.text(rootOf(d)))
}
// These patterns identify authority-bearing assertions for review. They never
// turn prose into a country, employer, date or geographic alias. An assertion
// absent from the reviewed original complete model holds even if it mentions
// India or Sociowash; ordinary added qualifications remain fully publishable.
function nativeAuthorityBlocks(text,html){
 let blocks=[norm(text)]
 if(typeof html==='string'){
  const document=readNativeDocument(html),blockTags=new Set(['p','li','div','h1','h2','h3','h4','h5','h6']);blocks=[]
  const walk=node=>{
   let group=[]
   const flush=()=>{const value=norm(group.join(' '));if(value)blocks.push(value);group=[]}
   for(const child of node.children){
    if(typeof child!=='string'&&all(child).some(node=>blockTags.has(node.tag))){flush();walk(child)}
    else group.push(typeof child==='string'?decodeNativeEntities(child):document.text(child))
   }
   flush()
  }
  walk(rootOf(document))
 }
 const applicationSubject=/\b(?:applications?|apply)\b/i
 const applicationMaterialTopic=/(?<![\p{L}\p{N}_])(?:cvs?|r[eé]sum[eé]s?|curricul(?:um|a)\s+vitae|cover[\s-]+letters?)(?![\p{L}\p{N}_])/iu
 const employmentAssignmentTopic=/\b(?:work(?:ing)?\s+for|duty\s+station|assigned\s+to|stationed)\b/i
 const residenceAssignmentTopic=/\b(?:resid(?:e|es|ing|ence|ency)|domicil(?:e|ed))\b|\b(?:live|lives|living|work|works|working)\s+(?:in|at|from|within|outside|out\s+of)\b/i
 const employmentTermsTopic=/\b(?:appointments?|contract(?:s|ual|ed|ing|ors?)?|offers?|offered|payroll|engagements?|employ(?:ment|ers?|ed|ing))\b/i
 const propertySubject=/\b(?:work(?:ing)?\s+(?:location|country|place)|place\s+of\s+work|country\s+of\s+employment|workplace|worksite|employer|(?:hiring|employing)\s+(?:entity|company|organization|organisation)|employed\s+by)\b/i
 const locationAssertion=/\b(?:based|located|situated)\s+(?:in|at)\b/i
 const locationSubject=/(?:^|[.!?]\s+)(?:(?:the|your|our|this)\s+)?(?:location|country)\b/i
 const roleSubject=/\b(?:role|job|position|vacancy|employment|assignment)\b/i,workplaceMeaning=/\b(?:location|country|workplace|worksite|based|located|situated|remote|hybrid|onsite|on-site|in-office|relocation)\b/i
 const employerLabel=/(?:^|[.!?]\s+)(?:(?:the|your|our|this)\s+)?(?:company|employer)\s*:/i
 const deadlineSubject=/(?:^|[.!?]\s+)(?:(?:the|your|our|this)\s+)?(?:deadline|closing\s+date|expiry(?:\s+date)?|expiration(?:\s+date)?|last\s+date)\b|\bvalid\s+(?:until|through)\b/i
 const pureNegation=/^applications?\s+(?:(?:are|is|have|has|will|shall|be|been|now|currently)\s+)*not\s+(?:(?:be|now|currently|yet|being)\s+)*(?:closed|unavailable|suspended|stopped|ended|expired)[.!]?$/i
 // Residence, engagement and application topics bind their whole authored
 // block regardless of subject prefix or predicate. These only require review;
 // no country, employing entity or date is extracted from unreviewed prose.
 return blocks.filter(block=>applicationMaterialTopic.test(block)||employmentAssignmentTopic.test(block)||residenceAssignmentTopic.test(block)||employmentTermsTopic.test(block)||propertySubject.test(block)||locationAssertion.test(block)||locationSubject.test(block)||roleSubject.test(block)&&workplaceMeaning.test(block)||employerLabel.test(block)||deadlineSubject.test(block)||applicationSubject.test(block)&&!pureNegation.test(block)).map(block=>'native-role-authority-block: '+block)
}
export function currentSociowashAuthorityClaims(text,html){
 return[...new Set(nativeAuthorityBlocks(text,html))].sort()
}
function vacancyObservation(row){
 return same(Object.keys(row).sort(),profile.vacancyRowKeys)&&typeof row.Publish==='boolean'&&typeof row.Is_Locked==='boolean'&&typeof row.Keep_on_Career_Site==='boolean'&&typeof row.Posting_Title==='string'&&norm(row.Posting_Title)&&row.Job_Opening_Name===row.Posting_Title&&typeof row.Job_Description==='string'&&norm(row.Job_Description)&&typeof row.Job_Type==='string'&&typeof row.Industry==='string'&&typeof row.Date_Opened==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.Date_Opened)&&['City','State','Country','Work_Experience'].every(key=>row[key]===null||typeof row[key]==='string')
}
function fullDescription(model,meta,moduleMeta,form){
 let html=model.Job_Description+'<h2>Job Information</h2><dl>'
 const fields=moduleMeta[0].layouts.flatMap(layout=>layout.sections.flatMap(section=>section.fields))
 for(const field of fields){
  const value=model[field.api_name]
  if(field.api_name==='Job_Description'||value===null||value===undefined)continue
  const display=typeof value==='object'?value.name:String(value)
  need(typeof display==='string'&&norm(display),'native authored field cannot be silently omitted')
  html+='<dt>'+escape(field.field_label)+':</dt><dd>'+escape(display)+'</dd>'
 }
 html+='</dl><h2>About Us</h2>'+meta.org_info.description+'<h2>Application questions</h2><ul>'
 const questions=form.webforms.flatMap(webform=>webform.sections.flatMap(section=>[...(section.fields??[]),...(section.attachmenttypes??[])]))
 for(const field of questions){
  if(!field.field_label)continue
  const choices=field.pick_list_values?.map(value=>value.display_value).join(' | ')
  html+='<li>'+escape(field.field_label)+(field.required===true?' (required)':field.required===false?' (optional)':'')+(choices?': '+escape(choices):'')+(field.$accept?' Accepted file types: '+escape(field.$accept):'')+(field.$limit?' Maximum file size: '+escape(field.$limit)+' bytes':'')+'</li>'
 }
 html+='</ul>'
 const d=readNativeDocument(html),text=norm(d.text(rootOf(d)))
 need(text.length>=1500&&!closure.test(text),'incomplete or explicitly unavailable original criteria')
 return{html,text}
}
export async function runCurrentSociowash(options={}){
 options.signal?.throwIfAborted();need(!(options.fetchText||options.fetchPage||options.fetchJson),'original byte/HTTP metadata transport required')
 let now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();if(now instanceof Date)now=now.toISOString()
 const duration=options.sourceTimeoutMs??90000,interval=options.requestIntervalMs??500
 need(Number.isFinite(Date.parse(now))&&Number.isSafeInteger(duration)&&duration>0&&duration<=90000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native clock/source deadline/per-host pacing')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const receipts=[],last=new Map(),byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
 let reads=0,total=0,opening,closing
 async function read(url,kind,depth=0){
  signal.throwIfAborted();need(Object.hasOwn(profile.headers,url)&&++reads<=80&&depth<=3,'unbound native URL/finite read bound exceeded')
  const origin=new URL(url).origin,wait=interval-(performance.now()-(last.get(origin)??-Infinity));if(wait>0)await delay(wait,undefined,{signal});last.set(origin,performance.now())
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native response byte cap'),fetchImpl:async(value,init)=>{
   const response=await(options.fetchImpl??globalThis.fetch)(value,{...init,credentials:'omit',headers:{...init.headers,Accept:kind==='form'?'application/json':kind==='asset'?'*/*':'text/html','User-Agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}});let size=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{async read(){const item=await reader.read();if(!item.done){need(types.isUint8Array(item.value),'native response chunks must be bytes');const length=byteLength.call(item.value);need(length<=4_000_000-size&&length<=32_000_000-total,'native streaming entity/total byte cap');size+=length;total+=length}return item},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(packet.bodyBase64,'base64');receipts.push({requestedURL:url,kind,...packet,bodySHA256:sha(bytes)})
  const effective=currentSociowashHeaders(packet.headers,url),expected=profile.headers[url]
  need(packet.url===url&&packet.status===expected.status&&[expected.headers,...(expected.observedAlternatives??[])].some(model=>same(effective,model)),'native effective headers/full MIME, navigation, execution or final identity changed')
  if(kind==='asset')need(profile.assets[url]?.sha256===sha(bytes)&&profile.assets[url].bytes===bytes.length,'complete declared authoritative client/style bytes changed')
  if([301,302,303,307,308].includes(packet.status)){
   need(kind==='asset'&&profile.assets[url]?.redirectTo===new URL(packet.headers.location,url).href,'unreviewed native declared redirect')
   return read(profile.assets[url].redirectTo,kind,depth+1)
  }
  need(packet.status===200,'current anonymous native document unavailable')
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw problem('native invalid UTF-8')}
 }
 async function pass(){
  const assets=new Set()
  async function document(url,kind){
   const html=await read(url,kind),initial=currentSociowashInitializers(html,kind)
   need(same(currentSociowashDocumentContract(html,kind),profile.contracts[url]),'unreviewed full native document/program/style/context/control authority')
   need(!initial.nodes.some(n=>n.tag==='base'),'native base context changed')
   // The native Zoho shell contains two literal BODY openings. Bind that
   // complete unchanged tree and inspect all active document text, rather
   // than selecting one of those source carriers as the current owner.
   need(!closure.test(initial.document.text(rootOf(initial.document))),'current visible native vacancy/applications unavailable')
   for(const node of initial.nodes.filter(n=>n.tag==='script'&&Object.hasOwn(n.attrs,'src')||n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('stylesheet'))){
    const target=new URL(node.attrs.src??node.attrs.href,url).href
    if(profile.passiveDeclarations.includes(target)||assets.has(target))continue
    need(!Object.hasOwn(node.attrs,'disabled')&&!node.attrs.media&&Object.hasOwn(profile.assets,target),'current declared native client/style changed')
    await read(target,'asset');assets.add(target)
   }
   return initial
  }
  const corporate=await document(CURRENT_CORPORATE,'corporate')
  const handoff=one(corporate.nodes.filter(n=>n.tag==='a'&&!n.inert&&n.attrs.href===CURRENT_BOARD),'own current corporate native handoff')
  need(corporate.document.text(handoff)==='See Open Positions'&&corporate.nodes.some(n=>n.tag==='title'&&n.raw==='About Us | SW Network | Sociowash'),'current own Sociowash publisher identity changed')
  const board=await document(CURRENT_BOARD,'board');qualifyMeta(board.meta,'board',CURRENT_BOARD)
  need(Array.isArray(board.rows)&&board.rows.length>0&&board.rows.length<=100,'bounded native observations unavailable; zero/scope unqualified')
  const seen=new Set(),jobs=[],held=[]
  for(const row of board.rows){need(row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.id==='string'&&/^\d{15,20}$/.test(row.id)&&typeof row.Posting_Title==='string'&&norm(row.Posting_Title),'native full row identity unavailable');need(!seen.has(row.id),'repeated native public vacancy identity');seen.add(row.id)}
  const selected=new Set(profile.roles.map(role=>role.id))
  for(const row of board.rows)if(!selected.has(row.id))held.push({row,holdReason:vacancyObservation(row)?'native-detail-uninspected-in-bounded-current-profile':'native-observation-model-unqualified',nativeVacancyObservationQualified:!!vacancyObservation(row)})
  for(const binding of profile.roles){
   const row=board.rows.find(value=>value.id===binding.id)
   if(!row)continue
   own(row,binding.boardRowKeys,'selected board row')
   need(vacancyObservation(row),'selected native vacancy observation schema changed')
   if(row.Publish!==true||row.Is_Locked!==false){held.push({row,holdReason:'native-selected-row-not-currently-published-unlocked'});continue}
   const detail=await document(binding.url,'role');qualifyMeta(detail.meta,'role',binding.url)
   const model=one(detail.rows,'complete native selected role');own(model,binding.modelKeys,'selected role model')
   own(model.Department_Name,['id','name'],'native department value')
   need(typeof model.Department_Name.id==='string'&&/^\d{15,20}$/.test(model.Department_Name.id)&&typeof model.Department_Name.name==='string'&&norm(model.Department_Name.name),'unreviewed native department scalar value')
   need(['Posting_Title','City','Agency_Experience','Industry','Job_Description','Job_Type','Job_Opening_Name','State','Country','Zip_Code','id','Date_Opened'].every(key=>typeof model[key]==='string'&&norm(model[key]))&&(model.Work_Experience===null||typeof model.Work_Experience==='string'&&norm(model.Work_Experience)),'unreviewed native authored scalar field')
   need(model.id===row.id&&model.Posting_Title===row.Posting_Title&&model.Posting_Title===binding.title&&model.Job_Opening_Name===model.Posting_Title&&model.Publish===true&&model.Is_Locked===false&&typeof model.Keep_on_Career_Site==='boolean','native original identity/title/current publication changed')
   need(model.Country==='India'&&row.Country==='India'&&same(Object.fromEntries(['City','State','Country','Zip_Code'].map(key=>[key,model[key]])),binding.address)&&model.City===row.City&&model.State===row.State,'complete native typed India/all address representation changed')
   need(dateOf(model.Date_Opened)===dateOf(row.Date_Opened)&&Date.parse(model.Date_Opened)<=Date.parse(now)&&model.Job_Type==='Full time'&&model.Work_Experience===row.Work_Experience&&same(model.Department_Name,row.Department_Name)&&detail.attachments===null,'native date/type/experience/department/attachment context changed')
   const nativeText=currentSociowashRichText(model.Job_Description)
   need(same(currentSociowashAuthorityClaims(nativeText,model.Job_Description),binding.criteriaAuthorityClaims),'unreviewed native full criteria authority assertion')
   need(nativeText.length>=1500&&nativeText===norm(row.Job_Description)&&profile.employerIntroductions.includes(nativeText.split('.')[0]+'.'),'complete current board/detail original employer/full criteria mismatch')
   need(same(detail.moduleMeta,profile.moduleMeta)&&same(detail.pageJson,profile.pageJson),'native full field/layout/application qualification changed')
   const form=strictSociowashJSON(await read(binding.form,'form'))
   need(same(form,profile.applicationModel),'complete current native application fields/conditions/status changed')
   const description=fullDescription(model,detail.meta,detail.moduleMeta,form)
   jobs.push({source:'sociowash',company:'Sociowash',title:model.Posting_Title,jobId:model.id,nativePublicJobId:model.id,requisitionId:null,nativeLegalEmployer:null,
    sourceUrl:binding.url,link:binding.url,applyUrl:binding.url,country:'India',city:model.City,state:model.State,location:[model.City,model.State,model.Country].join(', '),locations:[[model.City,model.State,model.Country].join(', ')],nativeLocations:binding.address,
    department:model.Department_Name.name,employmentType:model.Job_Type,remoteStatus:null,postedAt:model.Date_Opened,postingDate:model.Date_Opened,closingDate:null,
    jobDescription:description.text,sourceDescription:description.html,sourceNativeDescription:model.Job_Description,sourceNativeModel:model,sourceNativeBoardRow:row,sourceNativeRoleMetadata:detail.meta,sourceNativeApplicationMetadata:form,
    sourceNativeApplicationAction:{component:'career-website-detail',action:'apply',nativePublicJobId:model.id,webformId:detail.meta.webform_id,pageName:detail.meta.page_name,source:detail.meta.source,anonymousReadOnlyMetadataURL:binding.form},
    sourceDetailComplete:true,sourceWholeOriginalCriteriaRetained:true,sourceScopeComplete:false,sourceListingComplete:false,sourceCompanyCoverageComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,sourcePublicApplicationMetadataQualified:true,sourceNativeClosingReconciled:true,scrapedAt:now})
  }
  need(jobs.length>0,'no current qualified positive; whole-company/zero scope unqualified')
  return{rows:board.rows,held,jobs,observedVacancyCount:board.rows.filter(vacancyObservation).length}
 }
 try{
  opening=await pass();closing=await pass();need(same(opening,closing),'fresh closing complete membership/original criteria/employer/geography/application changed');signal.throwIfAborted()
  const jobs=opening.jobs,audit={source:'sociowash',opening,closing,originalResponses:receipts,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,applicationSubmissions:0,independentNativeClosingReconciled:true}
  attachSourceObservationEvidence(jobs,{source:'sociowash',recordKind:opening.observedVacancyCount===opening.rows.length?'vacancy-rows':'mixed',observedRecordCount:opening.rows.length,observedVacancyCount:opening.observedVacancyCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CURRENT_CORPORATE,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'bounded-two-current-native-India-details;all-modern-board-rows-retained;full-original-criteria-and-readonly-application-metadata-independently-close;legacy-whole-company-zero-and-rendered-application-unqualified'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.defineProperty(error,'sourceAudit',{value:{source:'sociowash',opening,closing,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
