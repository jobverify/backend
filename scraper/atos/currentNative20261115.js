import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const {parse}=createRequire(import.meta.url)('acorn')
const ORIGIN='https://jobs.atos.net'
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const HEADER_NAMES=['content-type','refresh','content-security-policy','content-security-policy-report-only','x-content-security-policy','x-webkit-csp','content-disposition','link','location','content-location','x-content-type-options','x-frame-options']
const SCRIPT_TYPES=new Set(['','text/javascript','application/javascript'])
const criterionTags=new Set(['span','div','p','strong','b','em','i','u','ul','ol','li','br','a','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','td','th','sup','sub','s','hr'])
const DESCRIPTION_MARKER='CURRENT_COMPLETE_OWN_NATIVE_DESCRIPTION'
const criterionAuthority=[
 // Authority-bearing subjects pin the complete original paragraph regardless
 // of punctuation, intervening words or affirmative sentence grammar. We do
 // not interpret a new country/entity/date from prose or enumerate countries.
 // Review complete application, employer and assignment subject blocks even
 // when a new paragraph uses different deadline verbs or a neutral entity name.
 /\b(?:applications?|apply|cvs?|r[eé]sum[eé]s?|curricul(?:um|a)\s+vitae|cover[- ]letters?|hiring|employing|duty\s+stations?|stationed)(?![\p{L}\p{N}_])|\b(?:work(?:ing)?\s+for|assigned\s+to)\b/iu,
 /\b(?:locations?|countries|country|workplaces?|worksites?|located|based|remote|hybrid|on[- ]?site|employers?|employment|employed|hired|hiring\s+organi[sz]ation|citizenship|residency)\b|\bwork\s+(?:in|from|at|out\s+of)\b/i,
 // Residence and the place of work are authority subjects even without a
 // particular modal, hiring verb, country name or sentence prefix. "Live"
 // technical systems are not a residence declaration without that complement.
 /\b(?:residen(?:ce|cy|ts?|tial)|resid(?:e[sd]?|ing)|domicil(?:e[sd]?|iary)|liv(?:e[sd]?|ing)\s+(?:in|at|within|outside|near))\b|\b(?:places?|addresses?)\s+of\s+work\b/i,
 // Bind complete definite/possessive appointment or contract subjects and
 // standalone contractual headings, regardless of their predicate. An
 // indefinite technical object inside a qualification is still variable.
 /\b(?:your|our|their|his|her|its|my|the|this|that|these|those)\s+(?:[\p{L}\p{N}][\p{L}\p{N}'\u2019_-]*\s+)*(?:appointments?|contracts?|agreements?|engagements?)(?![\p{L}\p{N}_])|(?:^|[.;:!?]\s*)(?:an?\s+)?(?:(?:service|employment|work)\s+)?(?:appointments?|contracts?|agreements?|engagements?)(?![\p{L}\p{N}_])|\b(?:contractual|contracting|appointing|engaging)\s+(?:entit(?:y|ies)|compan(?:y|ies)|organi[sz]ations?)\b/iu,
 /\b(?:deadlines?|closing\s+date|expiry\s+date|expiration\s+date|valid\s+through|date\s+posted|posting\s+date|publication\s+date|(?:job|role|position)\s+title|(?:requisition|reference|job|posting)\s*(?:id|code|number|no\.?))\b/i,
 /\b(?:(?:work(?:ing)?|job|role|office|primary|posting|employment|legal)\s+(?:location|country|countries|employer|organization)|hiring\s+organization|employer|location|country(?:\s+of\s+employment)?)\s*[:=\u2013-]/i,
 /\b(?:based\s+(?:in|at|out\s+of)|remote\s+(?:in|from)|(?:on[- ]?site|hybrid)\s+(?:in|at)|(?:authorized|authorised|eligible|right)\s+to\s+work\s+(?:in|from)|relocat(?:e|ion)\s+to|(?:must|will|shall)\s+(?:be\s+)?(?:work|located|based|reside)\s+(?:in|from|at)|(?:employment|employed|hired)\s+(?:is\s+)?(?:by|through|with))\b/i,
 /\b(?:see|refer|read|download)\b.{0,80}\b(?:full|complete|attached|detailed)\b.{0,50}\b(?:job\s+)?(?:description|requirements|criteria)\b|https?:\/\/\S+\.(?:pdf|docx?|xlsx?)(?:[?#\s]|$)/i,
 /\b(?:(?:application|apply|vacancy)\s+)?(?:deadline|closing\s+date|expiry\s+date|valid\s+through|date\s+posted|posting\s+date|publication\s+date)\s*[:=\u2013-]|\bapplications?\s+(?:close|closes|closing|end|ends|deadline)\s+(?:on|by|at)\b/i,
 /\b(?:(?:job|position|role)\s+title|(?:requisition|reference|job|posting)\s*(?:id|code|number|no\.?))\s*[:=\u2013-]/i,
 /\b(?:apply|application)\s+(?:at|via|using|through|to|here)\b|\bsend\b.{0,60}\b(?:cv|resume|application)\b.{0,40}(?:https?:\/\/|[a-z\d._%+-]+@[a-z\d.-]+)/i,
]
const unavailable=/\b(?:(?:this|the)\s+)?(?:role|position|job(?:\s+posting)?|vacancy|requisition|opportunity)\s+(?:(?:is|was|has|have)\s+)?(?:(?:already|now|currently)\s+)*(?:been\s+)?(?:unavailable|not\s+(?:(?:now|currently)\s+)?(?:available|open|(?:accepting|taking)\s+applications)|closed|filled|removed|withdrawn|expired|cancelled|canceled|no\s+longer\s+(?:available|open|(?:accepting|taking)\s+applications))\b|\b(?:applications?|hiring|recruitment)\s+(?:(?:for\s+(?:this|the)\s+(?:role|position|job))\s+)?(?:(?:has|have|is|are|will)\s+)?(?:(?:now|currently|already)\s+)*(?:been\s+)?(?:closed|ended|suspended|no\s+longer\s+(?:being\s+)?accepted)\b|\b(?:no\s+longer|not\s+(?:currently|now))\s+(?:accepting|taking)\s+(?:new\s+)?applications\b/i
const norm=s=>String(s??'').normalize('NFC').replace(/\s+/g,' ').trim()
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export const currentAtosSHA=value=>createHash('sha256').update(value).digest('hex')
const failure=message=>Object.assign(Error('Atos current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw failure(message)}
const one=(values,name)=>{need(values.length===1,'missing or ambiguous '+name);return values[0]}
const all=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(all)]
const root=d=>one(d.nodes(n=>n.tag==='root'),'native document root')
const hasClass=(n,name)=>(n?.attrs.class??'').split(/\s+/).includes(name)
const rawText=n=>typeof n==='string'?decodeNativeEntities(n):n.children.map(rawText).join(' ')
const walk=(n,visit)=>{if(!n||typeof n!=='object')return;visit(n);for(const v of Object.values(n))if(v&&typeof v==='object'){if(Array.isArray(v))v.forEach(c=>walk(c,visit));else walk(v,visit)}}
const literal=n=>{
 if(n?.type==='Literal')return n.value
 if(n?.type==='ArrayExpression')return n.elements.map(literal)
 if(n?.type==='ObjectExpression'){
  const entries=n.properties.map(p=>{need(p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init','nonliteral native bootstrap');return[p.key.name??p.key.value,literal(p.value)]})
  need(new Set(entries.map(e=>e[0])).size===entries.length,'duplicate native bootstrap key');return Object.fromEntries(entries)
 }
 throw failure('nonliteral native bootstrap value')
}

const criterionTree=(node,description)=>typeof node==='string'?node:node===description?{...node,children:[DESCRIPTION_MARKER]}:{...node,children:node.children.map(child=>criterionTree(child,description))}
const validateCriterionTree=description=>need(all(description).every(node=>criterionTags.has(node.tag)&&!node.inert&&!node.nativeTagUnqualified&&!Object.keys(node.attrs).some(key=>/^on/i.test(key)||['hidden','inert','aria-hidden','itemscope','itemtype'].includes(key))),'unreviewed hidden or executable native criterion carrier')

// Only this same-owner field's authored content is variable. Its complete
// attribute-bearing tree (including ancestry, values, styles and link targets)
// remains part of the pinned document context. Plain criterion paragraphs may
// be added or edited; controllers, hidden carriers and new attributes may not.
function descriptionBinding(document,nodes,html){
 const owner=one(nodes.filter(node=>node.attrs.itemtype==='http://schema.org/JobPosting'),'native description JobPosting owner')
 const field=one(all(owner).filter(node=>node.attrs.itemprop==='description'),'own complete description field')
 need(owner.tag==='div'&&hasClass(owner,'jobDisplayShell')&&owner.attrs.itemscope==='itemscope'&&field.tag==='span'&&field.attrs['data-careersite-propertyid']==='description','unqualified complete native description binding')
 validateCriterionTree(field)
 const marker='data-careersite-propertyid="description"',markerAt=html.indexOf(marker)
 need(markerAt>=0&&html.indexOf(marker,markerAt+marker.length)===-1,'ambiguous original native description carrier')
 const start=html.lastIndexOf('<span',markerAt)
 need(start>=0&&/^<span[\t\n\f\r ]/.test(html.slice(start,start+6)),'original native description start unavailable')
 const tagEnd=at=>{let quote=null;for(let i=at+1;i<html.length;i++){const c=html[i];if(quote){if(c===quote)quote=null}else if(c==='"'||c==="'")quote=c;else if(c==='>')return i+1}throw failure('unterminated native criterion tag')}
 const innerStart=tagEnd(start),tokens=readNativeAttributeTokens(html.slice(start+5,innerStart-1))
 need(markerAt<innerStart&&new Set(tokens.map(([key])=>key)).size===tokens.length&&same(Object.fromEntries(tokens.map(([key,value])=>[key,decodeNativeEntities(value)])),field.attrs),'native description original attribute binding changed')
 const stack=['span'],voids=new Set(['br','hr']);let cursor=innerStart,innerEnd,end,tagCount=0
 while(stack.length){
  need(cursor-innerStart<=200000&&++tagCount<=10000,'native complete description exceeds its bounded field grammar')
  const at=html.indexOf('<',cursor);need(at>=0,'native description has no complete original end')
  need(!['!','?'].includes(html[at+1]),'unreviewed native criterion comment or declaration')
  const match=/^<(\/?)([a-z][a-z\d:_-]*)(?=[\t\n\f\r />])/i.exec(html.slice(at))
  if(!match){cursor=at+1;continue}
  const tag=match[2].toLowerCase(),finish=tagEnd(at),token=html.slice(at,finish)
  need(criterionTags.has(tag),'unreviewed native criterion tag')
  if(match[1]){
   need(new RegExp('^</'+tag+'[\\t\\n\\f\\r ]*>$','i').test(token)&&stack.pop()===tag,'native criterion original nesting changed')
   if(!stack.length){innerEnd=at;end=finish}
  }else{
   const attrs=readNativeAttributeTokens(token.slice(1+match[2].length,-1))
   need(new Set(attrs.map(([key])=>key)).size===attrs.length,'duplicate native criterion attribute')
   if(!voids.has(tag))stack.push(tag)
  }
  cursor=finish
 }
 const isolated=readNativeDocument(html.slice(start,end)),isolatedField=one(isolated.nodes(node=>node.attrs.itemprop==='description'),'isolated original native description')
 need(same(isolatedField,field),'native description boundary/tree disagreement')
 const attributes=[]
 const visit=(node,ancestors)=>{if(typeof node==='string')return;if(Object.keys(node.attrs).length)attributes.push({tag:node.tag,ancestors,attrs:node.attrs});for(const child of node.children)visit(child,[...ancestors,node.tag])}
 visit(field,[])
 const fieldNodes=all(field),parents=new Map()
 for(const node of fieldNodes)for(const child of node.children)if(typeof child!=='string')parents.set(child,node)
 const matching=new Set(fieldNodes.filter(node=>criterionAuthority.some(pattern=>pattern.test(document.text(node))))),carriers=new Set(),blocks=new Set(['p','li','td','th','div','h1','h2','h3','h4','h5','h6'])
 for(const node of matching){
  if(node.children.some(child=>typeof child!=='string'&&matching.has(child)))continue
  let carrier=node
  while(carrier!==field&&!blocks.has(carrier.tag)&&!hasClass(carrier,'jobdescription'))carrier=parents.get(carrier)
  carriers.add(carrier)
 }
 const authorityDeclarations=fieldNodes.filter(node=>carriers.has(node)).map(node=>({tag:node.tag,attrs:node.attrs,text:document.text(node)}))
 return{owner,field,innerStart,innerEnd,attributes,authorityDeclarations,identity:{method:'same-own-typed-JobPosting-exact-description-field',tag:field.tag,attrs:field.attrs,attributeTree:attributes,authorityDeclarations}}
}

export function currentAtosRoleContext(role){
 if(!role.ownerOriginalTree)return currentAtosSHA(JSON.stringify(role))
 const context={...role,criteria:DESCRIPTION_MARKER,criteriaCharacters:null,criteriaSHA256:null,
  descriptionOriginalTree:criterionTree(role.descriptionOriginalTree,role.descriptionOriginalTree),
  ownerOriginalTree:criterionTree(role.ownerOriginalTree,role.descriptionOriginalTree),ownerText:role.ownerContextText,
  links:role.links.filter(link=>!link.insideDescription),nativeProperties:role.nativeProperties.map(property=>property.attrs.itemprop==='description'?{...property,text:DESCRIPTION_MARKER}:property)}
 return currentAtosSHA(JSON.stringify(context))
}

function cspBoundaryWhitespace(value){
 let projected='',quoted=false
 for(const character of value){
  if(character==="'")quoted=!quoted
  if(character===';'&&!quoted)projected=projected.replace(/[\t ]+$/,'')+';'
  else projected+=character
 }
 need(!quoted,'unqualified quoted CSP source expression')
 return projected
}

function corporateScriptSourceBoundary(html,nodes,nonce,headers,replace){
 const carrier=one(nodes.filter(node=>node.attrs.id==='__NEXT_DATA__'),'current corporate JSON carrier')
 need(carrier.tag==='script'&&!carrier.inert&&!carrier.nativeTagUnqualified&&same(Object.keys(carrier.attrs).sort(),['id','nonce','type'])&&carrier.attrs.type==='application/json'&&carrier.attrs.nonce===nonce,'unqualified active corporate JSON carrier')
 const body=carrier.raw;let ast
 try{parseEightfoldJson(body);ast=parse('('+body+')',{ecmaVersion:'latest',sourceType:'script'}).body[0].expression}catch{throw failure('unqualified strict corporate JSON carrier')}
 const property=(node,name)=>{need(node?.type==='ObjectExpression','unqualified corporate JSON source-list path');return one(node.properties.filter(p=>p.type==='Property'&&p.key.type==='Literal'&&p.key.value===name),'corporate JSON source-list '+name).value}
 let field=ast
 for(const name of['props','pageProps','flags','system__scriptSrc'])field=property(field,name)
 need(field.type==='Literal'&&typeof field.value==='string'&&field.value.replace(/[\t ]+$/,'').length>0,'unqualified corporate JSON source-list value')
 const value=field.value,raw=body.slice(field.start-1,field.end-1)
 need(raw===JSON.stringify(value),'unreviewed corporate JSON source-list literal representation')
 const directive=one(headers['content-security-policy'].split(';').filter(value=>/^[\t ]*script-src[\t ]+/.test(value)),'current corporate CSP script-src directive').replace(/^[\t ]+/,'')
 const prefix="script-src 'self' 'nonce-"+nonce+"' 'sha256-2cinHGNPNaJaHYQ9IEfZ4Uj1xfWZO4HN6zIq7ZsCA7A=' 'strict-dynamic' https://www.googletagmanager.com https://googletagmanager.com https://tagmanager.google.com https://*.googletagmanager.com "
 need(cspBoundaryWhitespace(directive+';')===cspBoundaryWhitespace(prefix+value+';'),'current corporate JSON/CSP complete source-list mismatch')
 const trailing=value.match(/[\t ]+$/)?.[0]
 if(trailing){
  const at=html.indexOf(body);need(at>=0&&html.indexOf(body,at+body.length)===-1,'ambiguous complete corporate JSON carrier')
  const suffix=JSON.stringify(trailing).slice(1,-1),end=at+field.end-2
  need(html.slice(end-suffix.length,end)===suffix,'unbound original corporate JSON source-list whitespace')
  replace(end-suffix.length,end,'')
 }
}

function cspNonce(headers){
 const csp=headers['content-security-policy']??null
 const matches=typeof csp==='string'?[...csp.matchAll(/'nonce-([^']+)'/g)]:[]
 if(!matches.length)return null
 const value=one(matches,'current CSP nonce')[1]
 need(/^[A-Za-z0-9+/]{22}==$/.test(value)&&Buffer.from(value,'base64').length===16&&Buffer.from(value,'base64').toString('base64')===value,'invalid native CSP nonce representation')
 return value
}
export function currentAtosHeaders(headers){
 const nonce=cspNonce(headers)
 return Object.fromEntries(HEADER_NAMES.map(name=>[name,name==='content-security-policy'&&nonce?cspBoundaryWhitespace(headers[name].replace("'nonce-"+nonce+"'","'nonce-CURRENT_CORPORATE_NONCE'")):headers[name]??null]))
}

// Whole surrounding HTML remains authoritative. The exact own description
// field admits current plain criteria; every attributed descendant and native
// identity/workplace/employer/date/application declaration stays guarded.
// Only paired CSP/anonymous UUID values and passive native IDs/cache values
// otherwise vary. External programs/styles are not executed or role authority.
export function currentAtosDocument(html,{url,headers={}}){
 const document=readNativeDocument(html),nodes=all(root(document)),replacements=[],programs=[],native=new URL(url).origin===ORIGIN
 const replace=(start,end,value)=>{need(start>=0&&end>start,'invalid native projection span');replacements.push({start,end,value})}
 const programLiteral=(body,n,value)=>{
  const at=html.indexOf(body);need(at>=0&&html.indexOf(body,at+body.length)===-1,'ambiguous complete native inline program')
  replace(at+n.start+1,at+n.end-1,value)
 }
 const nonce=cspNonce(headers),nonceNodes=nodes.filter(n=>Object.hasOwn(n.attrs,'nonce')),cssNonceNodes=nodes.filter(n=>Object.hasOwn(n.attrs,'data-n-css'))
 if(nonce){
  need(!native&&nonceNodes.length>0&&nonceNodes.every(n=>['link','script'].includes(n.tag)&&n.attrs.nonce===nonce),'native CSP/HTML nonce binding changed')
  const cssCarrier=one(cssNonceNodes,'current corporate Next stylesheet nonce carrier')
  need(cssCarrier.tag==='noscript'&&Object.keys(cssCarrier.attrs).length===1&&cssCarrier.attrs['data-n-css']===nonce&&cssCarrier.children.every(c=>typeof c==='string'&&!norm(c)),'native CSP/Next stylesheet nonce binding changed')
  let count=0
  for(const [attribute,expected]of[['nonce',nonceNodes.length],['data-n-css',1]]){
   const prefix=attribute+'="',needle=prefix+nonce+'"',occurrences=html.split(needle).length-1
   need(occurrences===expected,'ambiguous original CSP nonce carrier');count+=occurrences
   for(let at=0;(at=html.indexOf(needle,at))!==-1;at+=needle.length)replace(at+prefix.length,at+prefix.length+nonce.length,'CURRENT_CORPORATE_NONCE')
  }
  need(html.split(nonce).length-1===count,'unbound original CSP nonce occurrence')
  need(new URL(url).origin==='https://www.atos.ai','corporate JSON carrier is outside its original own publisher')
  corporateScriptSourceBoundary(html,nodes,nonce,headers,replace)
 }else need(nonceNodes.length===0&&cssNonceNodes.length===0,'HTML nonce has no paired original CSP')
 let ownDescription=null
 if(native&&/^\/job\/[^/]+\/\d+\/$/.test(new URL(url).pathname)&&nodes.some(node=>node.attrs.itemtype==='http://schema.org/JobPosting')){
  ownDescription=descriptionBinding(document,nodes,html)
  replace(ownDescription.innerStart,ownDescription.innerEnd,DESCRIPTION_MARKER)
 }
 let token=null,options=null,bootstrap=null
 if(native){
  const csrf=[],ctids=[],declarations=[],initializers=[]
  for(const script of document.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'src')&&!Object.hasOwn(n.attrs,'nomodule')&&SCRIPT_TYPES.has((n.attrs.type??'').toLowerCase()))){
   const body=script.raw??'';let ast
   try{ast=parse(body,{ecmaVersion:'latest',sourceType:'script'})}catch{throw failure('current native inline program syntax changed')}
   programs.push({attrs:script.attrs,body})
   for(const n of ast.body){
    const e=n.expression
    if(e?.type==='CallExpression'&&e.callee?.type==='MemberExpression'&&!e.callee.computed&&e.callee.object?.name==='$'&&e.callee.property?.name==='ajaxSetup'){
     const settings=literal(one(e.arguments,'native AJAX setup argument')),object=one(e.arguments,'native AJAX setup object')
     const hp=one(object.properties.filter(p=>(p.key.name??p.key.value)==='headers'),'native AJAX headers'),tp=one(hp.value.properties.filter(p=>(p.key.name??p.key.value)==='X-CSRF-Token'),'native anonymous CSRF property')
     need(UUID.test(settings.headers?.['X-CSRF-Token']??'')&&tp.value.type==='Literal'&&body.slice(tp.value.start,tp.value.end)===JSON.stringify(settings.headers['X-CSRF-Token']),'invalid native anonymous CSRF declaration')
     csrf.push({value:settings.headers['X-CSRF-Token'],body,node:tp.value})
    }
    if(e?.type==='AssignmentExpression'&&e.operator==='='&&e.left.type==='MemberExpression'&&!e.left.computed&&e.left.property.name==='options'&&e.left.object?.type==='MemberExpression'&&!e.left.object.computed&&e.left.object.property.name==='search'&&e.left.object.object?.name==='j2w')declarations.push(literal(e.right))
    if(e?.type==='CallExpression'&&e.callee?.type==='MemberExpression'&&!e.callee.computed&&e.callee.object?.name==='j2w'&&e.callee.property?.name==='init')initializers.push(literal(one(e.arguments,'native account initialization')))
   }
   walk(ast,n=>{
    if(n.type==='VariableDeclarator'&&n.id?.type==='Identifier'&&n.id.name==='ctid'){
     need(n.init?.type==='Literal'&&UUID.test(n.init.value??'')&&body.slice(n.init.start,n.init.end)==="'"+n.init.value+"'",'invalid native anonymous tracking literal')
     ctids.push({value:n.init.value,body,node:n.init})
    }
   })
  }
  const csrfValue=one(csrf,'native anonymous CSRF literal'),ctid=one(ctids,'native anonymous tracking literal')
  need(html.split(csrfValue.value).length===2&&html.split(ctid.value).length===2,'unbound native anonymous UUID occurrence')
  programLiteral(csrfValue.body,csrfValue.node,'CURRENT_NATIVE_CSRF');programLiteral(ctid.body,ctid.node,'CURRENT_NATIVE_TRACKING_ID')
  token=csrfValue.value;options=declarations.length?one(declarations,'current native options declaration'):null;bootstrap=one(initializers,'current native original account bootstrap')
  need(bootstrap.ssoCompanyId==='Atos'&&bootstrap.ssoUrl==='https://career5.successfactors.eu'&&bootstrap.useSSL===true&&bootstrap.isUsingSSL===true&&bootstrap.hasATSUserID===false,'original native public account or anonymous state changed')
  const scripts=nodes.filter(n=>n.tag==='script'&&n.attrs.src&&/^\/js\/override\.js\?locale=en_US&i=\d{1,10}$/.test(n.attrs.src))
  const override=one(scripts,'native passive override cache declaration')
  need(!Object.hasOwn(override.attrs,'nomodule')&&SCRIPT_TYPES.has(override.attrs.type??''),'native override declaration mode changed')
  const escaped=override.attrs.src.replaceAll('&','&amp;'),needle='src="'+escaped+'"',at=html.indexOf(needle)
  need(at>=0&&html.indexOf(needle,at+needle.length)===-1,'ambiguous native override declaration')
  const start=at+needle.lastIndexOf('=')+1,end=at+needle.length-1
  replace(start,end,'CURRENT_PASSIVE_CACHE_ID')
  const parents=new Map();for(const n of nodes)for(const c of n.children)if(typeof c!=='string')parents.set(c,n)
  const owners=nodes.filter(n=>n.attrs.itemtype==='http://schema.org/JobPosting'),owned=new Set(owners.flatMap(all)),frequency=nodes.filter(n=>n.tag==='input'&&n.attrs.name==='frequency')
  need(frequency.length===0||frequency.length===2,'native passive alert control count changed')
  for(const [i,input]of frequency.entries()){
   const id=input.attrs.id,parent=parents.get(input),labels=nodes.filter(n=>n.tag==='label'&&n.attrs.for===id)
   need(/^j_idt\d{1,6}$/.test(id??'')&&nodes.filter(n=>n.attrs.id===id).length===1&&!owned.has(input)&&input.attrs.type==='number'&&hasClass(input,'frequencySpinBtn')&&hasClass(parent,'subscribe-frequency-label')&&labels.length===1&&parents.get(labels[0])===parent&&labels[0].attrs.id===input.attrs['aria-labelledby'],'native passive alert input/label binding changed')
   need(html.split(id).length===3,'unbound native passive alert ID reference')
   for(const attr of ['id','for']){
    const needle=attr+'="'+id+'"',at=html.indexOf(needle)
    need(at>=0&&html.indexOf(needle,at+needle.length)===-1,'ambiguous native passive alert attribute')
    replace(at+attr.length+2,at+attr.length+2+id.length,'CURRENT_PASSIVE_ALERT_'+i)
   }
  }
 }
 replacements.sort((a,b)=>b.start-a.start)
 let context=html,last=html.length
 for(const r of replacements){need(r.end<=last,'overlapping native projection spans');context=context.slice(0,r.start)+r.value+context.slice(r.end);last=r.start}
 return{document,nodes,token,options,bootstrap,programs,descriptionBinding:ownDescription,contextSHA256:currentAtosSHA(context+(ownDescription?'\nCURRENT_NATIVE_DESCRIPTION_AUTHORITY\n'+JSON.stringify({attributes:ownDescription.attributes,declarations:ownDescription.authorityDeclarations}):'')),headerContext:currentAtosHeaders(headers),originalHTML:html,resources:nodes.filter(n=>n.tag==='script'&&n.attrs.src||n.tag==='link'&&n.attrs.href).map(n=>({tag:n.tag,attrs:n.attrs}))}
}

export function currentAtosUTC(value){
 const match=typeof value==='string'&&/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(value)
 need(match,'native UTC calendar representation changed')
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
 const month=months.indexOf(match[2]),year=Number(match[7]),day=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]),date=new Date(Date.UTC(year,month,day,hour,minute,second))
 need(date.getUTCFullYear()===year&&date.getUTCMonth()===month&&date.getUTCDate()===day&&date.getUTCHours()===hour&&date.getUTCMinutes()===minute&&date.getUTCSeconds()===second&&days[date.getUTCDay()]===match[1],'invalid native UTC calendar components')
 return date.toISOString()
}
const monthDay=value=>{
 const m=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(value)
 need(m,'native displayed publication day changed')
 const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[1]),date=new Date(Date.UTC(Number(m[3]),month,Number(m[2])))
 need(date.getUTCFullYear()===Number(m[3])&&date.getUTCMonth()===month&&date.getUTCDate()===Number(m[2]),'invalid displayed native publication calendar')
 return date.toISOString().slice(0,10)
}
export function currentAtosRows(proof){
 const d=proof.document,rows=proof.nodes.filter(n=>n.tag==='tr'&&hasClass(n,'data-row'))
 return rows.map(row=>{
  const nodes=all(row),links=nodes.filter(n=>n.tag==='a'&&n.attrs.href&&/^\/job\/[^?#]+\/\d+\/$/.test(n.attrs.href)),hrefs=[...new Set(links.map(n=>n.attrs.href))]
  const href=one(hrefs,'original native selected role route'),title=one([...new Set(links.map(n=>d.text(n)))],'original native selected title'),url=new URL(href,ORIGIN).href,routeID=one([...url.matchAll(/\/(\d+)\/$/g)],'native role route identity')[1]
  const locationNodes=nodes.filter(n=>n.tag==='span'&&hasClass(n,'jobLocation')),locations=[...new Set(locationNodes.map(n=>d.text(n)).filter(Boolean))]
  const dates=[...new Set(nodes.filter(n=>n.tag==='span'&&hasClass(n,'jobDate')).map(n=>d.text(n)).filter(Boolean))]
  need(title&&locations.length>0&&locations.every(s=>/(?:^|,\s*)IN$/.test(s)),'selected role work-country alternatives unavailable')
  const publishDate=one(dates,'original native card publication date');monthDay(publishDate)
  return{url,routeID,title,locations,publishDate,originalText:d.text(row),originalTree:row}
 })
}
export function currentAtosRole(proof,url){
 const d=proof.document,nodes=proof.nodes,owners=nodes.filter(n=>n.attrs.itemtype==='http://schema.org/JobPosting'),body=one(nodes.filter(n=>n.tag==='body'),'native role body'),bodyText=d.text(body)
 const routeID=one([...url.matchAll(/\/(\d+)\/$/g)],'native detail route identity')[1]
 if(owners.length===0){need(bodyText.includes('Sorry, this position has been filled.'),'native role lacks original current JobPosting or explicit filled notice');return{routeID,url,nativeObservationKind:'explicit-unavailable-without-JobPosting',held:true,holdReason:'current-native-explicit-filled-notice-and-no-JobPosting',bodyText}}
 const owner=one(owners,'complete native own JobPosting'),own=all(owner),properties=name=>own.filter(n=>n.attrs.itemprop===name),property=name=>one(properties(name),'native '+name)
 need(owner.tag==='div'&&hasClass(owner,'jobDisplayShell')&&owner.attrs.itemscope==='itemscope','native JobPosting owner changed')
 const titleNode=property('title'),title=d.text(titleNode),h1=one(own.filter(n=>n.tag==='h1'&&all(n).includes(titleNode)),'native visible own title')
 need(title&&d.text(h1)===title,'native title/header conflict')
 const employer=property('hiringOrganization');need(employer.tag==='meta'&&employer.attrs.content==='Atos','original native legal employer is not Atos')
 const canonical=one(nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical').attrs.href
 need(new URL(canonical).origin===ORIGIN&&canonical.endsWith('/'+routeID+'/'),'native canonical role identity changed')
 const description=property('description'),descriptionNodes=all(description),criteria=d.text(description)
 need(description.tag==='span'&&description.attrs['data-careersite-propertyid']==='description'&&criteria.length>=500,'complete original native criteria unavailable')
 validateCriterionTree(description)
 need(proof.descriptionBinding?.field===description&&proof.descriptionBinding.owner===owner,'complete native description is outside the guarded own field')
 need(!unavailable.test(bodyText),'native role contradicts current availability')
 const propertyNames=new Set(['jobLocation','address','streetAddress','datePosted','validThrough','hiringOrganization','title','description'])
 need(own.filter(n=>n.attrs.itemprop).every(n=>propertyNames.has(n.attrs.itemprop)),'unreviewed native original qualification property')
 const places=properties('jobLocation');need(places.length>0,'native original work-location alternatives missing')
 const addresses=places.map(place=>{
  need(place.attrs.itemtype==='http://schema.org/Place'&&!place.inert,'invalid original native Place')
  const address=one(all(place).filter(n=>n.attrs.itemprop==='address'),'native work address')
  need(address.attrs.itemtype==='http://schema.org/PostalAddress','invalid original native PostalAddress')
  const fields=all(address).filter(n=>n.attrs.itemprop&&n!==address)
  need(fields.length===1&&fields[0].tag==='meta'&&fields[0].attrs.itemprop==='streetAddress'&&typeof fields[0].attrs.content==='string'&&/(?:^|,\s*)IN$/.test(fields[0].attrs.content),'native work-country alternative disagrees with typed selected India country')
  return{placeAttributes:place.attrs,addressAttributes:address.attrs,fields:fields.map(n=>({tag:n.tag,attrs:n.attrs})),nativeStreetAddress:fields[0].attrs.content,originalTree:place}
 })
 const dates=properties('datePosted'),expiry=properties('validThrough')
 need(dates.length===1&&dates[0].tag==='meta'&&expiry.length<=1&&expiry.every(n=>n.tag==='meta'),'native publication/expiry field inventory changed')
 const datePosted=dates[0].attrs.content,validThrough=expiry[0]?.attrs.content??null,datePostedISO=currentAtosUTC(datePosted),expirationISO=validThrough===null?null:currentAtosUTC(validThrough)
 const displayedDate=d.text(one(own.filter(n=>n.attrs['data-careersite-propertyid']==='date'),'native displayed publication day'))
 need(monthDay(displayedDate)===datePostedISO.slice(0,10),'native displayed and typed publication days disagree')
 const ref=one(own.filter(n=>n.attrs['data-careersite-propertyid']==='customfield5'),'native authored reference number'),referenceNo=d.text(ref)
 need(/^\d+$/.test(referenceNo),'original native reference number missing')
 const applications=own.filter(n=>n.tag==='a'&&hasClass(n,'dialogApplyBtn'))
 const applyPath='/talentcommunity/apply/'+routeID+'/?locale=en_US'
 need(applications.length===2&&applications.every(n=>n.attrs.href===applyPath&&d.text(n)==='Apply now »'&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'&&!hasClass(n,'disabled')),'current native own application declaration unavailable')
 const links=own.filter(n=>n.tag==='a'&&n.attrs.href).map(n=>({text:d.text(n),href:n.attrs.href,attrs:n.attrs,insideDescription:descriptionNodes.includes(n)}))
 need(links.every(l=>! /\.(?:pdf|docx?|xlsx?)(?:[?#]|$)|sharepoint\.com|(?:full|complete).{0,20}job\s+description/i.test(l.href+' '+l.text)),'linked complete native criteria require qualification')
 const unconfirmed=/\bwork\s+location\s*:\s*to\s+be\s+confirmed\b/i.test(criteria)
 return{routeID,url,canonical,title,nativeObservationKind:'native-JobPosting',nativeEmployerLabel:'Atos',legalEmployer:null,referenceNo,datePosted,displayedDate,datePostedISO,validThrough,expirationISO,criteria,criteriaCharacters:criteria.length,criteriaSHA256:currentAtosSHA(criteria),descriptionFieldBinding:proof.descriptionBinding.identity,descriptionOriginalTree:description,ownerText:d.text(owner),ownerContextText:d.text(criterionTree(owner,description)),ownerOriginalTree:owner,addresses,links,applyURL:ORIGIN+applyPath,originalApplicationAnchors:applications.map(n=>({attrs:n.attrs,text:d.text(n)})),nativeProperties:own.filter(n=>n.attrs.itemprop).map(n=>({tag:n.tag,attrs:n.attrs,text:d.text(n)})),held:unconfirmed,holdReason:unconfirmed?'authored-native-work-location-unconfirmed':null}
}

// A filled document can only contribute a negative observation. Four genuine
// whole native pages have this same complete shell; their role metadata stays
// bound to each original listing/page and never becomes positive vacancy data.
// Reproduce the unchanged core projection before projecting those exact bound
// head fields and the two passive route carriers. Every other byte is pinned.
export function currentAtosFilledContext(proof,binding){
 const {url,routeID,headFields}=binding,source=proof.originalHTML,count=(text,value)=>text.split(value).length-1
 need(typeof routeID==='string'&&/^\d+$/.test(routeID)&&new URL(url).origin===ORIGIN&&new URL(url).pathname.endsWith('/'+routeID+'/'),'unbound native filled route')
 need(proof.descriptionBinding===null&&!proof.nodes.some(node=>node.attrs.itemtype==='http://schema.org/JobPosting'),'filled shell has a native vacancy owner')
 const role=currentAtosRole(proof,url)
 need(role.held&&role.nativeObservationKind==='explicit-unavailable-without-JobPosting','filled shell lacks the active original negative notice')
 need(!proof.nodes.some(node=>hasClass(node,'dialogApplyBtn')||['a','form'].includes(node.tag)&&/^(?:https:\/\/jobs\.atos\.net)?\/talentcommunity\/apply(?:\/|[?#]|$)/.test(node.attrs.href??node.attrs.action??'')),'filled shell still declares a native role application')
 let context=source
 const replace=(original,value)=>{need(typeof original==='string'&&original.length>0&&count(context,original)===1,'ambiguous complete native filled projection');context=context.replace(original,value)}
 const tracking=[]
 for(const program of proof.programs)walk(parse(program.body,{ecmaVersion:'latest',sourceType:'script'}),node=>{if(node.type==='VariableDeclarator'&&node.id?.name==='ctid')tracking.push(node.init.value)})
 replace(proof.token,'CURRENT_NATIVE_CSRF');replace(one(tracking,'filled native tracking literal'),'CURRENT_NATIVE_TRACKING_ID')
 const override=one(proof.nodes.filter(node=>node.tag==='script'&&/^\/js\/override\.js\?locale=en_US&i=\d{1,10}$/.test(node.attrs.src??'')),'filled native override declaration'),escaped=override.attrs.src.replaceAll('&','&amp;')
 replace('src="'+escaped+'"','src="'+escaped.replace(/i=\d+$/,'i=CURRENT_PASSIVE_CACHE_ID')+'"')
 for(const [index,input]of proof.nodes.filter(node=>node.tag==='input'&&node.attrs.name==='frequency').entries()){
  need(count(context,input.attrs.id)===2,'unbound filled native alert control');context=context.replaceAll(input.attrs.id,'CURRENT_PASSIVE_ALERT_'+index)
 }
 need(currentAtosSHA(context)===proof.contextSHA256,'filled shell does not reproduce the unchanged core projection')
 const specs=[{key:'title',tag:'title'},...['keywords','description'].map(name=>({key:name,tag:'meta',name})),{key:'canonical',tag:'link',rel:'canonical'},...['og:title','og:description'].map(property=>({key:property,tag:'meta',property})),...['twitter:title','twitter:description'].map(name=>({key:name,tag:'meta',name}))]
 need(headFields&&same(Object.keys(headFields),specs.map(spec=>spec.key)),'unreviewed original native filled metadata inventory')
 for(const spec of specs){
  const matches=node=>node.tag===spec.tag&&['name','property','rel'].every(key=>!spec[key]||node.attrs[key]===spec[key]),node=one(proof.nodes.filter(matches),'filled native head '+spec.key),original=headFields[spec.key]
  need(typeof original==='string'&&count(source,original)===1,'filled head differs from its original native page')
  const originalNode=one(all(root(readNativeDocument(original))).filter(matches),'reviewed original native head '+spec.key)
  need(same(node.attrs,originalNode.attrs)&&(spec.tag!=='title'||node.raw===originalNode.raw),'filled native head authority changed')
  if(spec.key==='canonical')need(node.attrs.href===url,'filled canonical differs from its exact published route')
  const projected=spec.tag==='title'?'<title>CURRENT_FILLED_ROLE_TITLE</title>':original.replace(/((?:content|href)=")[^"]*(")/,'$1CURRENT_FILLED_'+spec.key.toUpperCase().replaceAll(':','_')+'$2')
  need(projected!==original,'missing original native filled metadata value');replace(original,projected)
 }
 const form=one(proof.nodes.filter(node=>node.tag==='form'&&node.attrs.name==='emailsubscribe'),'filled native passive subscription form')
 need(form.attrs.action==='/talentcommunity/subscribe/?locale=en_US&jobid='+routeID,'filled passive subscription route changed')
 const rawForm=one([...source.matchAll(/<form\b[^>]*>/g)].map(match=>match[0]).filter(tag=>tag.includes('name="emailsubscribe"')),'complete filled passive subscription tag')
 need(count(rawForm,routeID)===1,'ambiguous filled passive subscription route');replace(rawForm,rawForm.replace(routeID,'CURRENT_FILLED_ROLE_ROUTE_ID'))
 const sso=[]
 for(const program of proof.programs)for(const statement of parse(program.body,{ecmaVersion:'latest',sourceType:'script'}).body){
  const call=statement.expression,callee=call?.callee
  if(call?.type==='CallExpression'&&callee?.type==='MemberExpression'&&!callee.computed&&callee.property.name==='init'&&callee.object?.type==='MemberExpression'&&!callee.object.computed&&callee.object.property.name==='SSO'&&callee.object.object?.name==='j2w')sso.push({program,call})
 }
 const init=one(sso,'filled native disabled SSO initializer'),settings=literal(one(init.call.arguments,'filled native SSO argument'))
 need(same(settings,{email:'',enabled:false,jobID:routeID,locale:'en_US',tcaction:'job',logoutDefaultPath:'jobs.atos.net',usingRD:true}),'filled native disabled SSO authority changed')
 const property=one(init.call.arguments[0].properties.filter(property=>(property.key.name??property.key.value)==='jobID'),'filled native SSO route property'),body=init.program.body
 need(body.slice(property.value.start,property.value.end)==="'"+routeID+"'"&&count(context,routeID)===1,'unbound filled native SSO route')
 replace(body,body.slice(0,property.value.start+1)+'CURRENT_FILLED_ROLE_ROUTE_ID'+body.slice(property.value.end-1))
 need(!context.includes(routeID),'unprojected filled native route occurrence')
 return currentAtosSHA(context)
}

export async function runCurrentAtos(options={}){
 const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url),'utf8'))
 need(profile.source==='atos'&&profile.company==='Atos','current source profile unavailable')
 options.signal?.throwIfAborted()
 need(!(options.fetchText||options.fetchPage||options.fetchJson)||typeof options.fetchImpl==='function','original native response metadata required')
 const duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid public host pacing')
 const clock=()=>{const value=options.now?options.now():new Date(),iso=value instanceof Date?value.toISOString():value;need(typeof iso==='string'&&Number.isFinite(Date.parse(iso)),'invalid native observation clock');return iso}
 const observedAt=clock(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(failure('native source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const allowed=new Set([profile.root]),receipts=[],paceTails=new Map(),last=new Map(),byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
 let reads=0,total=0
 const pace=origin=>{const previous=paceTails.get(origin)||Promise.resolve(),next=previous.then(async()=>{signal.throwIfAborted();const wait=interval-(performance.now()-(last.get(origin)??-Infinity));if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last.set(origin,performance.now())});paceTails.set(origin,next.catch(()=>{}));return next}
 const read=async(url,request={method:'GET'},token)=>{
  signal.throwIfAborted();need(allowed.has(url)&&Object.hasOwn(profile.responseContracts,url)&&++reads<=68,'unbound current publication or native request cap')
  need(request.method==='GET'&&Object.keys(request).length===1||url===profile.query.url&&same(request,{method:'POST',body:profile.query.body})&&UUID.test(token??''),'unqualified current public native method/body')
  await pace(new URL(url).origin);let size=0
  const p=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,request,overflowError:failure('intrinsic native streaming byte bound'),fetchImpl:async(value,init)=>{
   const headers={'User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',...(request.method==='POST'?{'Content-Type':'application/json','X-CSRF-Token':token}:{})}
   const r=await(options.fetchImpl||globalThis.fetch)(value,{...init,headers,credentials:'omit',cache:'no-store'})
   return{status:r.status,url:r.url,headers:r.headers,body:r.body===null?null:{cancel:reason=>r.body.cancel(reason),getReader(){const reader=r.body.getReader();return{async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native response did not contain original bytes');const n=byteLength.call(part.value);need(n<=4000000-size&&n<=16000000-total,'intrinsic native streaming byte bound');size+=n;total+=n}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}}
  }})
  const bytes=Buffer.from(p.bodyBase64,'base64'),expected=profile.responseContracts[url]
  receipts.push({requestedURL:url,request:{...request,...(token?{anonymousDeclaredCSRF:token}:{})},...p,bytes:bytes.length,sha256:currentAtosSHA(bytes)})
  need(p.status===expected.status&&p.url===expected.finalURL,'current native HTTP status/final URL changed')
  need(same(currentAtosHeaders(p.headers),expected.headerContext),'native effective header/navigation/MIME/CSP context changed')
  let html;try{html=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw failure('original native UTF8 bytes unavailable')}
  return{html,headers:p.headers,url:p.url,status:p.status}
 }
 const document=async url=>{
  const p=await read(url),proof=currentAtosDocument(p.html,p),expected=profile.documents[url],filledBinding=profile.filledDocumentContract?.originalNativeRoleBindings.find(binding=>binding.url===url)
  if(filledBinding&&!proof.nodes.some(node=>node.attrs.itemtype==='http://schema.org/JobPosting')){
   need(currentAtosFilledContext(proof,filledBinding)===profile.filledDocumentContract.contextSHA256,'whole current native filled-document contract changed');proof.qualifiedFilledDocument=true
  }else need(expected?.contextSHA256.includes(proof.contextSHA256),'whole current authored publication/control/style context changed')
  return proof
 }
 const pass=async()=>{
  const redirect=await read(profile.root);need(redirect.status===301&&redirect.headers.location===profile.corporate,'original current corporate delegation changed')
  allowed.add(redirect.headers.location);const corporate=await document(redirect.headers.location)
  need(corporate.document.nodes(n=>n.tag==='a'&&n.attrs.href==='/en/careers').length>0&&corporate.document.nodes(n=>n.tag==='a'&&n.attrs.href===profile.board).length>0,'current original corporate careers/job delegation missing')
  allowed.add(profile.careers);const careers=await document(profile.careers)
  need(careers.document.nodes(n=>n.tag==='a'&&['https://jobs.atos.net','https://jobs.atos.net/'].includes(n.attrs.href)).length>0,'current own careers does not bind original native account')
  allowed.add(profile.board);const board=await document(profile.board)
  need(same(board.options,{isOpen:false,facets:['country','city','customfield2'],showPicklistAllLocales:false}),'current native country options bootstrap changed')
  const script=one(board.document.nodes(n=>n.tag==='script'&&n.attrs.src&&n.attrs.src.includes('/options-search.')),'current native country client declaration'),clientURL=new URL(script.attrs.src,profile.board).href
  need(clientURL===profile.optionsClientURL,'current declared country client URL changed');allowed.add(clientURL)
  const client=await read(clientURL);need(currentAtosSHA(client.html)===profile.optionsClientSHA256,'whole current declared country client changed')
  allowed.add(profile.query.url);const response=await read(profile.query.url,{method:'POST',body:profile.query.body},board.token),countryModel=parseEightfoldJson(response.html)
  need(currentAtosSHA(JSON.stringify(countryModel))===profile.countryModelSHA256,'complete current original native country facet model changed')
  const india=one(countryModel.facets?.map?.country?.filter(c=>c.name==='IN')||[],'current original India country record')
  need(india.translated==='India'&&india.count===profile.nativeCardCount&&india.count>0,'native IN is not the current typed selected India country')
  const form=one(board.nodes.filter(n=>n.tag==='form'&&n.attrs.name==='keywordsearch'),'original native public search form')
  need(form.attrs.method==='get','native public search form method changed')
  const controls=all(form).filter(n=>['input','select'].includes(n.tag)&&n.attrs.name&&!Object.hasOwn(n.attrs,'disabled')&&!['submit','button'].includes(n.attrs.type))
  const country=one(controls.filter(n=>n.tag==='select'&&n.attrs.name==='optionsFacetsDD_country'),'original native country selector'),label=one(board.nodes.filter(n=>n.tag==='label'&&n.attrs.for===country.attrs.id),'original native country label')
  need(norm(rawText(label))==='Country/Region'&&country.attrs.id==='optionsFacetsDD_country','native selector is not typed as country')
  const url=new URL(form.attrs.action,profile.board)
  for(const n of controls)url.searchParams.append(n.attrs.name,n===country?india.name:n.attrs.value||'')
  need(url.href===profile.selectedURL,'current native selected GET form descriptor changed');allowed.add(url.href)
  const listing=await document(url.href),rows=currentAtosRows(listing)
  need(rows.length===india.count&&same(rows,profile.rows)&&listing.document.text(one(listing.document.nodes(n=>n.tag==='body'),'native selected listing body')).includes('Results 1 – '+rows.length+' of '+rows.length+' Page 1 of 1'),'current original country membership or terminal listing changed')
  const roles=Array(rows.length);let next=0,firstFailure
  const worker=async()=>{while(!firstFailure){const index=next++;if(index>=rows.length)return;try{const row=rows[index],expected=profile.roles[index];need(row.url===expected.url,'native role row/profile mismatch');allowed.add(row.url);const page=await document(row.url),role=currentAtosRole(page,row.url);if(role.nativeObservationKind==='explicit-unavailable-without-JobPosting')need(page.qualifiedFilledDocument===true&&role.held,'unqualified filled native negative observation');else need(currentAtosRoleContext(role)===expected.modelContextSHA256,'complete current native role/employer/country/criterion/application model changed');if(!role.held)need(Date.parse(role.datePostedISO)<=Date.parse(observedAt)&&monthDay(row.publishDate)<=observedAt.slice(0,10),'native publication calendar is in the future');roles[index]={row,role,originalHTML:page.originalHTML,contextSHA256:page.contextSHA256}}catch(error){if(!firstFailure){firstFailure=error;controller.abort(error)}}}}
  await Promise.allSettled([worker(),worker()]);if(firstFailure)throw firstFailure
  return{countryModel,india,rows,roles}
 }
 try{
  const opening=await pass(),closing=await pass(),closedAt=clock()
  need(Date.parse(closedAt)>=Date.parse(observedAt),'closing observation clock precedes opening')
  need(same(opening.rows,closing.rows)&&same(opening.roles.map(r=>r.role),closing.roles.map(r=>r.role)),'fresh current original full native closing changed')
  const holds=[],selected=[]
  for(const entry of opening.roles){const r=entry.role
   if(r.held){holds.push({routeID:r.routeID,url:r.url,reason:r.holdReason,originalNativeRecord:r});continue}
   if(r.expirationISO&&Date.parse(r.expirationISO)<=Date.parse(closedAt)){holds.push({routeID:r.routeID,url:r.url,reason:'original-native-publication-expired',originalNativeRecord:r});continue}
   selected.push(entry)
  }
  need(selected.length>0,'no qualified current original India role; zero and complete scope remain unqualified')
  const maximum=options.maxJobs??null;need(maximum===null||Number.isSafeInteger(maximum)&&maximum>=0,'invalid current result bound')
  const retained=maximum?selected.slice(0,maximum):selected
  for(const entry of selected.slice(retained.length))holds.push({routeID:entry.role.routeID,url:entry.role.url,reason:'caller-current-result-budget',originalNativeRecord:entry.role})
  const jobs=retained.map(entry=>{
   const r=entry.role,row=entry.row,postedDay=r.datePostedISO.slice(0,10),listingDay=monthDay(row.publishDate),postingDate=postedDay===listingDay?r.datePostedISO:null
   const links=[...new Map(r.links.map(l=>[l.text+'\n'+l.href,l])).values()],description=r.ownerText+'\n\n'+links.map(l=>(l.text||l.href)+': '+new URL(l.href,ORIGIN).href).join('\n')
   return{source:'atos',company:'Atos',companyDomain:'atos.net',companyCareerPage:profile.careers,title:r.title,jobId:r.referenceNo,requisitionId:r.referenceNo,nativeLegalEmployer:r.legalEmployer,nativeEmployerLabel:r.nativeEmployerLabel,sourceNativeIdentity:{kind:'current-own-canonical-and-role-Apply-route',routeID:r.routeID,nativeReferenceNumber:r.referenceNo},sourceUrl:r.canonical,sourceCanonicalRoleURL:r.canonical,link:r.canonical,applyUrl:r.applyURL,
    country:'India',location:r.addresses.map(a=>a.nativeStreetAddress).join(' / '),city:null,state:null,employmentType:null,remoteStatus:null,postingDate,closingDate:null,firstEverPostedAt:null,jobDescription:description,sourceDescription:description,
    sourceNativeFullCriteria:r.criteria,sourceNativeCompleteOwnerText:r.ownerText,sourceNativeDescriptionTree:r.descriptionOriginalTree,sourceNativeAuthoredLinks:r.links,sourceNativeRecord:r,sourceNativeClosingRecord:closing.roles.find(e=>e.role.routeID===r.routeID).role,sourceNativeOriginalHTML:entry.originalHTML,
    sourceNativeDateRepresentations:{listingPublishDate:row.publishDate,detailDisplayedDate:r.displayedDate,datePosted:r.datePosted,validThrough:r.validThrough,nativePublicationISO:r.datePostedISO,nativeExpirationISO:r.expirationISO,publicationDayConflict:postedDay!==listingDay,expirationIsNotAssertedAsClosingDeadline:true},sourceDateSemanticsUnresolved:postedDay!==listingDay,
    sourceNativeCountryProof:{method:'current-original-typed-country-facet-and-independently-selected-role-membership',nativeCountryCode:opening.india.name,nativeCountryTranslation:opening.india.translated,originalNativeCountryRecord:opening.india,currentSelectedURL:profile.selectedURL,allOriginalAddressAlternatives:r.addresses,allOriginalSelectedLocations:row.locations,countryInferredFromCity:false},
    sourceNativePublishedApplication:{url:r.applyURL,originalAnchors:r.originalApplicationAnchors,originalNativeRouteID:r.routeID,declaredByOwnHTML:true,renderedEnabledQualified:false,operationQualified:false},sourceDetailComplete:true,sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,sourceNativeMetadataAuthorityOnly:true,scrapedAt:observedAt}
  })
  const observedVacancyCount=opening.roles.filter(entry=>entry.role.nativeObservationKind==='native-JobPosting').length
  const evidence={source:'atos',observedAt,closingObservedAt:closedAt,recordKind:'mixed',observedRecordCount:opening.rows.length,observedVacancyCount,companyGlobalTotal:null,companyIndiaTotal:null,observationCountSemantics:`original native record shapes before country/eligibility/expiry/caller limits: ${observedVacancyCount} native JobPostings include eligibility/country holds; ${opening.rows.length-observedVacancyCount} filled/no-JobPosting observations are nonvacancy`,nativeRows:opening.rows,closingNativeRows:closing.rows,openingModels:opening.roles.map(e=>e.role),closingModels:closing.roles.map(e=>e.role),originalResponses:receipts,holds,nativeCountrySelectorRecord:opening.india,originalCountryFacetModel:opening.countryModel,currentNativeSelectedListingTerminal:true,
   independentNativeClosingReconciled:true,completeNativeCriteriaPreserved:true,metadataAuthorityOnly:true,externalProgramsExecuted:false,externalResourceBytesUsedAsRoleData:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedZero:false,renderedApplicationQualified:false,applicationSubmitted:false}
  attachSourceObservationEvidence(jobs,{source:'atos',recordKind:'mixed',observedRecordCount:opening.rows.length,observedVacancyCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  signal.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.selectedURL,firstParty:true,listingComplete:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:closedAt,reason:'current-own-corporate-and-Atos-native-country-selection+complete-original-criteria+freshclosing;native-filled/unconfirmed/expired-rows-held;companyscope/zero/renderedapplication-unqualified;cleanup-forbidden'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))Object.assign(error,{softFailure:true,abortRetries:true,failureKind:error.failureKind||'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceAudit:{source:'atos',originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
  throw error
 }finally{clearTimeout(timer)}
}
