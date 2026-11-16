import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='tataconsultingengineers',COMPANY='Tata Consulting Engineers Limited',ORIGIN='https://careers.tataconsultingengineers.com'
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const SCRIPT_TYPES=new Set(['','text/javascript','application/javascript'])
const HEADER_NAMES=['content-type','refresh','content-security-policy','content-security-policy-report-only','x-content-security-policy','x-webkit-csp','content-disposition','link','location','content-location','x-content-type-options','x-frame-options','referrer-policy','permissions-policy','cross-origin-opener-policy','cross-origin-embedder-policy','cross-origin-resource-policy']
const PUBLIC_HEADERS={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}
const norm=s=>String(s??'').normalize('NFC').replace(/\s+/g,' ').trim()
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export const currentTceSHA=value=>createHash('sha256').update(value).digest('hex')
const failure=message=>Object.assign(Error('Tata Consulting Engineers current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw failure(message)}
const one=(values,name)=>{need(values.length===1,'missing or ambiguous '+name);return values[0]}
const all=node=>[node,...node.children.filter(c=>typeof c!=='string').flatMap(all)]
const hasClass=(node,name)=>(node?.attrs.class??'').split(/\s+/).includes(name)
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(value&&typeof value==='object'){if(Array.isArray(value))value.forEach(c=>walk(c,visit));else walk(value,visit)}}
const literal=node=>{if(node?.type==='Literal')return node.value;if(node?.type==='ArrayExpression')return node.elements.map(literal);if(node?.type==='ObjectExpression'){const entries=node.properties.map(p=>{need(p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init','nonliteral native bootstrap');return[p.key.name??p.key.value,literal(p.value)]});need(new Set(entries.map(e=>e[0])).size===entries.length,'duplicate native bootstrap property');return Object.fromEntries(entries)}throw failure('nonliteral native bootstrap value')}
export function currentTceHeaders(headers){return Object.fromEntries(HEADER_NAMES.filter(name=>Object.hasOwn(headers,name)).map(name=>[name,headers[name]]))}


const criterionTags=new Set(['span','div','p','strong','b','em','i','u','ul','ol','li','br','a','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','td','th','sup','sub','s','hr'])

const DESCRIPTION_MARKER='CURRENT_COMPLETE_OWN_NATIVE_DESCRIPTION'

const criterionAuthority=[
 // Any application/apply paragraph may change acceptance, deadline or method.
 // Pin its complete authored block without interpreting a date or verb list.
 /\b(?:applications?|apply)\b/i,
 // These complete topics can override employer, workplace or submission
 // authority even without a labelled field. Names, places and dates stay raw.
 /\b(?:hiring|employing)\b|\bwork(?:ing)?[\s-]+for\b/i,
 /\bduty[\s-]+stations?\b|\b(?:assigned[\s-]+to|stationed)\b/i,
 /\b(?:CVs?|curricul(?:um|a)\s+vitae|cover[\s-]+letters?)\b|\br[eé]sum[eé]s?(?!\p{L})/iu,
 // Authority-bearing subjects pin the complete original paragraph regardless
 // of punctuation, intervening words or affirmative sentence grammar. We do
 // not interpret a new country/entity/date from prose or enumerate countries.
 /\b(?:locations?|countries|country|workplaces?|worksites?|located|based|remote|hybrid|on[- ]?site|employers?|employment|employed|hired|hiring\s+organi[sz]ation|citizenship|residency)\b|\bwork\s+(?:in|from|at|out\s+of)\b/i,
 /\b(?:deadlines?|closing\s+date|expiry\s+date|expiration\s+date|valid\s+through|date\s+posted|posting\s+date|publication\s+date|(?:job|role|position)\s+title|(?:requisition|reference|job|posting)\s*(?:id|code|number|no\.?))\b/i,
 /\b(?:(?:work(?:ing)?|job|role|office|primary|posting|employment|legal)\s+(?:location|country|countries|employer|organization)|hiring\s+organization|employer|location|country(?:\s+of\s+employment)?)\s*[:=\u2013-]/i,
 /\b(?:based\s+(?:in|at|out\s+of)|remote\s+(?:in|from)|(?:on[- ]?site|hybrid)\s+(?:in|at)|(?:authorized|authorised|eligible|right)\s+to\s+work\s+(?:in|from)|relocat(?:e|ion)\s+to|(?:must|will|shall)\s+(?:be\s+)?(?:work|located|based|reside)\s+(?:in|from|at)|(?:employment|employed|hired)\s+(?:is\s+)?(?:by|through|with))\b/i,
 /\b(?:see|refer|read|download)\b.{0,80}\b(?:full|complete|attached|detailed)\b.{0,50}\b(?:job\s+)?(?:description|requirements|criteria)\b|https?:\/\/\S+\.(?:pdf|docx?|xlsx?)(?:[?#\s]|$)/i,
 /\b(?:(?:application|apply|vacancy)\s+)?(?:deadline|closing\s+date|expiry\s+date|valid\s+through|date\s+posted|posting\s+date|publication\s+date)\s*[:=\u2013-]|\bapplications?\s+(?:close|closes|closing|end|ends|deadline)\s+(?:on|by|at)\b/i,
 /\b(?:(?:job|position|role)\s+title|(?:requisition|reference|job|posting)\s*(?:id|code|number|no\.?))\s*[:=\u2013-]/i,
 /\b(?:apply|application)\s+(?:at|via|using|through|to|here)\b|\bsend\b.{0,60}\b(?:cv|resume|application)\b.{0,40}(?:https?:\/\/|[a-z\d._%+-]+@[a-z\d.-]+)/i,
]

const unavailable=/\b(?:(?:this|the)\s+)?(?:role|position|job(?:\s+posting)?|vacancy|requisition|opportunity)\s+(?:(?:is|was|has|have)\s+)?(?:(?:already|now|currently)\s+)*(?:been\s+)?(?:unavailable|not\s+(?:(?:now|currently)\s+)?(?:available|open|(?:accepting|taking)\s+applications)|closed|filled|removed|withdrawn|expired|cancelled|canceled|no\s+longer\s+(?:available|open|(?:accepting|taking)\s+applications))\b|\b(?:applications?|hiring|recruitment)\s+(?:(?:for\s+(?:this|the)\s+(?:role|position|job))\s+)?(?:(?:has|have|is|are|will)\s+)?(?:(?:now|currently|already)\s+)*(?:been\s+)?(?:closed|ended|suspended|no\s+longer\s+(?:being\s+)?accepted)\b|\b(?:no\s+longer|not\s+(?:currently|now))\s+(?:accepting|taking)\s+(?:new\s+)?applications\b/i

const criterionTree=(node,description)=>typeof node==='string'?node:node===description?{...node,children:[DESCRIPTION_MARKER]}:{...node,children:node.children.map(child=>criterionTree(child,description))}

const validateCriterionTree=description=>need(all(description).every(node=>criterionTags.has(node.tag)&&!node.inert&&!node.nativeTagUnqualified&&!Object.keys(node.attrs).some(key=>/^on/i.test(key)||['hidden','inert','aria-hidden','itemscope','itemtype'].includes(key))),'unreviewed hidden or executable native criterion carrier')

function descriptionBinding(document,nodes,html){
 const owner=one(nodes.filter(node=>node.attrs.itemtype==='http://schema.org/JobPosting'),'native description JobPosting owner')
 const field=one(all(owner).filter(node=>node.attrs.itemprop==='description'),'own complete description field')
 need(owner.tag==='div'&&hasClass(owner,'jobDisplayShell')&&owner.attrs.itemscope==='itemscope'&&field.tag==='span'&&hasClass(field,'jobdescription')&&field.attrs.itemprop==='description','unqualified complete native description binding')
 validateCriterionTree(field)
 const marker='itemprop="description"',markerAt=html.indexOf(marker)
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

export function currentTceRoleContext(role){
 if(!role.ownerOriginalTree)return currentTceSHA(JSON.stringify(role))
 const context={...role,criteria:DESCRIPTION_MARKER,criteriaCharacters:null,criteriaSHA256:null,
  descriptionOriginalTree:criterionTree(role.descriptionOriginalTree,role.descriptionOriginalTree),
  ownerOriginalTree:criterionTree(role.ownerOriginalTree,role.descriptionOriginalTree),ownerText:role.ownerContextText,
  links:role.links.filter(link=>!link.insideDescription),nativeProperties:role.nativeProperties.map(property=>property.attrs.itemprop==='description'?{...property,text:DESCRIPTION_MARKER}:property)}
 return currentTceSHA(JSON.stringify(context))
}

export function currentTceUTC(value){
 const match=typeof value==='string'&&/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(value)
 need(match,'native UTC calendar representation changed')
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
 const month=months.indexOf(match[2]),year=Number(match[7]),day=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]),date=new Date(Date.UTC(year,month,day,hour,minute,second))
 need(date.getUTCFullYear()===year&&date.getUTCMonth()===month&&date.getUTCDate()===day&&date.getUTCHours()===hour&&date.getUTCMinutes()===minute&&date.getUTCSeconds()===second&&days[date.getUTCDay()]===match[1],'invalid native UTC calendar components')
 return date.toISOString()
}


export function currentTceDocument(html,{url,headers={}}){
 const document=readNativeDocument(html),root=one(document.nodes(n=>n.tag==='root'),'document root'),nodes=all(root),active=document.nodes(()=>true),native=new URL(url).origin===ORIGIN,replacements=[]
 const replace=(start,end,value)=>{need(start>=0&&end>=start&&end<=html.length,'unqualified native projection');replacements.push({start,end,value})}
 const programLiteral=(body,node,marker)=>{const start=html.indexOf(body);need(start>=0&&html.indexOf(body,start+body.length)===-1,'ambiguous original native inline body');replace(start+node.start,start+node.end,JSON.stringify(marker))}
 let binding=null,bootstrap=null
 if(native){
  const csrf=[],ctids=[],initializers=[]
  for(const script of active.filter(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'src')&&!Object.hasOwn(n.attrs,'nomodule')&&SCRIPT_TYPES.has((n.attrs.type??'').toLowerCase()))){
   const body=script.raw??'';need(body.length<=200000,'native inline program bound');let ast
   try{ast=parse(body,{ecmaVersion:'latest',sourceType:'script'})}catch{throw failure('native inline program syntax changed')}
   for(const statement of ast.body){const e=statement.expression
    if(e?.type==='CallExpression'&&e.callee?.type==='MemberExpression'&&!e.callee.computed&&e.callee.object?.name==='$'&&e.callee.property?.name==='ajaxSetup'){
     const object=one(e.arguments,'native anonymous setup'),value=literal(object),hp=one(object.properties.filter(p=>(p.key.name??p.key.value)==='headers'),'native anonymous headers'),tp=one(hp.value.properties.filter(p=>(p.key.name??p.key.value)==='X-CSRF-Token'),'native anonymous CSRF')
     need(UUID.test(value.headers?.['X-CSRF-Token']??'')&&tp.value.type==='Literal'&&body.slice(tp.value.start,tp.value.end)===JSON.stringify(value.headers['X-CSRF-Token']),'invalid original native CSRF literal');csrf.push({body,node:tp.value,value:tp.value.value})
    }
    if(e?.type==='CallExpression'&&e.callee?.type==='MemberExpression'&&!e.callee.computed&&e.callee.object?.name==='j2w'&&e.callee.property?.name==='init')initializers.push(literal(one(e.arguments,'native account initializer')))
   }
   walk(ast,node=>{if(node.type==='VariableDeclarator'&&node.id?.name==='ctid'){need(node.init?.type==='Literal'&&UUID.test(node.init.value??'')&&body.slice(node.init.start,node.init.end)==="'"+node.init.value+"'",'invalid original native tracking UUID');ctids.push({body,node:node.init,value:node.init.value})}})
  }
  const token=one(csrf,'native anonymous CSRF literal'),ctid=one(ctids,'native tracking literal')
  need(html.split(token.value).length===2&&html.split(ctid.value).length===2,'unbound native UUID occurrence')
  programLiteral(token.body,token.node,'CURRENT_NATIVE_CSRF');programLiteral(ctid.body,ctid.node,'CURRENT_NATIVE_TRACKING_ID')
  bootstrap=one(initializers,'native original account initializer')
  need(bootstrap.ssoCompanyId==='tatacons02'&&bootstrap.ssoUrl==='https://career44.sapsf.com'&&bootstrap.useSSL===true&&bootstrap.isUsingSSL===true&&bootstrap.hasATSUserID===false,'current own public native account changed')
  const override=one(active.filter(n=>n.tag==='script'&&/^\/js\/override\.js\?locale=(?:en_US|en_GB)&i=\d{1,10}$/.test(n.attrs.src??'')),'native passive cache declaration')
  const cache=one([...override.attrs.src.matchAll(/^\/js\/override\.js\?locale=(en_US|en_GB)&i=(\d{1,10})$/g)],'native passive cache literal')
  const currentLocale=new URL(url).pathname==='/search'?'en_US':'en_GB'
  need(cache[1]===currentLocale&&(bootstrap.locale===undefined||bootstrap.locale===currentLocale)&&!Object.hasOwn(override.attrs,'nomodule')&&SCRIPT_TYPES.has(override.attrs.type??'')&&!override.raw,'native passive declaration context changed')
  const cacheNeedle='src="'+override.attrs.src.replaceAll('&','&amp;')+'"',cacheAt=html.indexOf(cacheNeedle)
  need(cacheAt>=0&&html.indexOf(cacheNeedle,cacheAt+cacheNeedle.length)===-1,'ambiguous original native cache declaration')
  const cacheStart=cacheAt+cacheNeedle.length-1-cache[2].length
  replace(cacheStart,cacheStart+cache[2].length,'CURRENT_PASSIVE_CACHE_ID')
  const parents=new Map();for(const node of nodes)for(const child of node.children)if(typeof child!=='string')parents.set(child,node)
  const owned=new Set(nodes.filter(n=>n.attrs.itemtype==='http://schema.org/JobPosting').flatMap(all)),frequency=nodes.filter(n=>n.tag==='input'&&n.attrs.name==='frequency')
  need(frequency.length===0||frequency.length===2,'native alert control count changed')
  for(const [index,input]of frequency.entries()){
   const id=input.attrs.id,parent=parents.get(input),labels=nodes.filter(n=>n.tag==='label'&&n.attrs.for===id)
   need(/^j_idt\d{1,6}$/.test(id??'')&&nodes.filter(n=>n.attrs.id===id).length===1&&!owned.has(input)&&input.attrs.type==='number'&&hasClass(input,'frequencySpinBtn')&&hasClass(parent,'subscribe-frequency-label')&&labels.length===1&&parents.get(labels[0])===parent&&labels[0].attrs.id===input.attrs['aria-labelledby'],'native passive alert ID/label binding changed')
   need(html.split(id).length===3,'unbound native passive alert ID')
   for(const attribute of['id','for']){const needle=attribute+'="'+id+'"',at=html.indexOf(needle);need(at>=0&&html.indexOf(needle,at+needle.length)===-1,'ambiguous original alert ID reference');replace(at+attribute.length+2,at+attribute.length+2+id.length,'CURRENT_PASSIVE_ALERT_'+index)}
  }
  if(/^\/job\/[^/]+\/\d+\/$/.test(new URL(url).pathname)){binding=descriptionBinding(document,nodes,html);replace(binding.innerStart,binding.innerEnd,DESCRIPTION_MARKER)}
 }
 replacements.sort((a,b)=>b.start-a.start);let context=html,last=html.length
 for(const r of replacements){need(r.end<=last,'overlapping native projections');context=context.slice(0,r.start)+r.value+context.slice(r.end);last=r.start}
 const authority=binding?'\nCURRENT_OWN_NATIVE_DESCRIPTION_AUTHORITY\n'+JSON.stringify({attributes:binding.attributes,declarations:binding.authorityDeclarations}):''
 return{document,nodes,bootstrap,descriptionBinding:binding,contextSHA256:currentTceSHA(context+authority),headerContext:currentTceHeaders(headers),originalHTML:html,resourceDeclarations:nodes.filter(n=>n.tag==='script'||n.tag==='style'||n.tag==='link').map(n=>({tag:n.tag,attrs:n.attrs,raw:n.raw??null}))}
}

export function currentTceRows(proof){
 const document=proof.document,cards=proof.nodes.filter(n=>n.tag==='li'&&hasClass(n,'job-tile')),rows=cards.map(card=>{
  const nodes=all(card),links=nodes.filter(n=>n.tag==='a'&&n.attrs.href&&/^\/job\/[^/]+\/\d+\/$/.test(n.attrs.href)),href=one([...new Set(links.map(n=>n.attrs.href))],'native card route'),title=one([...new Set(links.map(n=>document.text(n)))],'native card title'),url=new URL(href,ORIGIN).href,routeID=url.split('/').at(-2)
  need(card.attrs['data-url']===href&&hasClass(card,'job-id-'+routeID)&&title,'current native tile identity conflict')
  return{url,routeID,title,originalText:document.text(card),originalTree:card}
 })
 need(rows.length===25&&new Set(rows.map(r=>r.routeID)).size===25,'current bounded native tile membership changed')
 return rows
}

export function currentTceRole(proof,url){
 const d=proof.document,nodes=proof.nodes,owner=one(nodes.filter(n=>n.attrs.itemtype==='http://schema.org/JobPosting'),'current own JobPosting'),own=all(owner),property=name=>one(own.filter(n=>n.attrs.itemprop===name),'native '+name),body=one(nodes.filter(n=>n.tag==='body'),'native role body'),routeID=url.split('/').at(-2)
 need(owner.tag==='div'&&hasClass(owner,'jobDisplayShell')&&owner.attrs.itemscope==='itemscope'&&!owner.inert,'unqualified native JobPosting owner')
 const titleNode=property('title'),title=d.text(titleNode),h1=one(own.filter(n=>n.tag==='h1'&&all(n).includes(titleNode)),'own current visible title')
 need(title&&d.text(h1)===title,'native title/header disagreement')
 const employer=property('hiringOrganization');need(employer.tag==='meta'&&employer.attrs.content==='tatacons02','unqualified native employer account label')
 const canonical=one(nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'own native canonical').attrs.href
 need(canonical===url&&new URL(canonical).origin===ORIGIN,'native canonical identity changed')
 const description=property('description'),descriptionNodes=all(description),criteria=d.text(description)
 need(proof.descriptionBinding?.owner===owner&&proof.descriptionBinding.field===description&&criteria.length>=1000,'full own original criterion field missing')
 need(criteria.includes('Tata Consulting Engineers Limited (TCE) is the largest Indian private sector engineering and project consultancy')&&['About Us','Design your Future with us','Purpose & Scope of Position','Experience','Qualification','Key Responsibilities','Competencies'].every(section=>criteria.includes(section)),'current full original employer/criteria sections unavailable')
 need(!unavailable.test(d.text(body)),'native current availability contradiction')
 const names=new Set(['jobLocation','address','addressLocality','addressRegion','postalCode','addressCountry','datePosted','validThrough','hiringOrganization','title','description'])
 need(own.filter(n=>n.attrs.itemprop).every(n=>names.has(n.attrs.itemprop)),'unreviewed original native criterion property')
 const places=own.filter(n=>n.attrs.itemprop==='jobLocation');need(places.length===1,'unreviewed current work-location alternatives')
 const addresses=places.map(place=>{
  need(place.tag==='span'&&place.attrs.itemtype==='http://schema.org/Place'&&!place.inert,'unqualified native Place')
  const address=one(all(place).filter(n=>n.attrs.itemprop==='address'),'own native address');need(address.tag==='span'&&address.attrs.itemtype==='http://schema.org/PostalAddress','unqualified native PostalAddress')
  const fields=all(address).filter(n=>n.attrs.itemprop&&n!==address),field=name=>one(fields.filter(n=>n.attrs.itemprop===name),'native address '+name)
  need(fields.length===4&&fields.every(n=>n.tag==='meta'&&typeof n.attrs.content==='string'),'native address field shape changed')
  const country=field('addressCountry').attrs.content,city=field('addressLocality').attrs.content,state=field('addressRegion').attrs.content,postalCode=field('postalCode').attrs.content
  need(country==='IN'&&city&&state&&postalCode,'own native country is not explicitly typed India')
  return{countryCode:country,city,state,postalCode,placeAttributes:place.attrs,addressAttributes:address.attrs,originalFields:fields.map(n=>({tag:n.tag,attrs:n.attrs})),originalTree:place}
 })
 const posted=property('datePosted'),expires=property('validThrough');need(posted.tag==='meta'&&expires.tag==='meta','native date property representation changed')
 const datePosted=posted.attrs.content,validThrough=expires.attrs.content,datePostedISO=currentTceUTC(datePosted),expirationISO=currentTceUTC(validThrough)
 const applications=own.filter(n=>n.tag==='a'&&hasClass(n,'dialogApplyBtn')),applyPath='/talentcommunity/apply/'+routeID+'/?locale=en_GB'
 need(applications.length===2&&applications.every(n=>n.attrs.href===applyPath&&d.text(n)==='Apply now »'&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'&&!hasClass(n,'disabled')),'current own published application declaration unavailable')
 const links=own.filter(n=>n.tag==='a'&&n.attrs.href).map(n=>({text:d.text(n),href:n.attrs.href,attrs:n.attrs,insideDescription:descriptionNodes.includes(n)}))
 need(links.every(link=>! /\.(?:pdf|docx?|xlsx?)(?:[?#]|$)|sharepoint\.com|(?:full|complete).{0,20}job\s+description/i.test(link.href+' '+link.text)),'linked complete criterion destination needs review')
 return{routeID,url,canonical,title,nativeObservationKind:'native-JobPosting',nativeEmployerLabel:'tatacons02',legalEmployer:null,originalPublisherStatement:'Tata Consulting Engineers Limited (TCE) is the largest Indian private sector engineering and project consultancy',datePosted,validThrough,datePostedISO,expirationISO,criteria,criteriaCharacters:criteria.length,criteriaSHA256:currentTceSHA(criteria),descriptionFieldBinding:proof.descriptionBinding.identity,descriptionOriginalTree:description,ownerText:d.text(owner),ownerContextText:d.text(criterionTree(owner,description)),ownerOriginalTree:owner,addresses,links,applyURL:ORIGIN+applyPath,originalApplicationAnchors:applications.map(n=>({attrs:n.attrs,text:d.text(n)})),nativeProperties:own.filter(n=>n.attrs.itemprop).map(n=>({tag:n.tag,attrs:n.attrs,text:d.text(n)}))}
}



export async function runCurrentTce(options={}){
 options.signal?.throwIfAborted()
 const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url),'utf8'))
 need(profile.source===SOURCE&&profile.company===COMPANY,'current source profile unavailable')
 need(!(options.fetchText||options.fetchPage||options.fetchJson)||typeof options.fetchImpl==='function','full current original HTTP metadata required')
 const duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline');need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native public pacing')
 const clock=()=>{const value=options.now?options.now():new Date(),iso=value instanceof Date?value.toISOString():value;need(typeof iso==='string'&&Number.isFinite(Date.parse(iso)),'invalid native observation clock');return iso}
 const observedAt=clock(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(failure('source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const receipts=[],allowed=new Set([profile.root]),paceTails=new Map(),last=new Map(),byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
 let reads=0,total=0
 const pace=origin=>{const prior=paceTails.get(origin)||Promise.resolve(),next=prior.then(async()=>{signal.throwIfAborted();const wait=interval-(performance.now()-(last.get(origin)??-Infinity));if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last.set(origin,performance.now())});paceTails.set(origin,next.catch(()=>{}));return next}
 const read=async url=>{
  signal.throwIfAborted();need(allowed.has(url)&&Object.hasOwn(profile.responseContracts,url)&&++reads<=10,'unbound native URL or finite request bound');await pace(new URL(url).origin);let size=0
  const p=await boundedDeclaredPublicRead(url,{signal,request:{method:'GET'},timeoutMs:15000,overflowError:failure('intrinsic public streaming byte bound'),fetchImpl:async(value,init)=>{
   const r=await(options.fetchImpl||globalThis.fetch)(value,{...init,headers:{...PUBLIC_HEADERS},credentials:'omit',cache:'no-store'})
   return{status:r.status,url:r.url,headers:r.headers,body:r.body===null?null:{cancel:reason=>r.body.cancel(reason),getReader(){const reader=r.body.getReader();return{async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native chunk lacks original bytes');const count=byteLength.call(part.value);need(count<=4000000-size&&count<=16000000-total,'intrinsic public streaming byte bound');size+=count;total+=count}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}}
  }})
  const bytes=Buffer.from(p.bodyBase64,'base64'),expected=profile.responseContracts[url]
  receipts.push({requestedURL:url,request:{method:'GET',headers:{...PUBLIC_HEADERS},credentials:'omit',redirect:'manual',cache:'no-store'},...p,bytes:bytes.length,sha256:currentTceSHA(bytes)})
  need(p.status===expected.status&&p.url===expected.finalURL,'native HTTP status/final URL changed');need(same(currentTceHeaders(p.headers),expected.headerContext),'native effective header/navigation/MIME/CSP context changed')
  let html;try{html=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw failure('original native UTF8 bytes unavailable')}
  return{html,headers:p.headers,url:p.url,status:p.status}
 }
 const document=async url=>{const packet=await read(url),proof=currentTceDocument(packet.html,packet);need(profile.documents[url]?.contextSHA256===proof.contextSHA256,'whole current authored HTML/declaration/control/style context changed');return proof}
 const pass=async()=>{
  const redirect=await read(profile.root);need(redirect.status===301&&redirect.headers.location===profile.corporate,'original own corporate redirect changed')
  allowed.add(profile.corporate);const corporate=await document(profile.corporate)
  const handoff=corporate.document.nodes(n=>n.tag==='a'&&n.attrs.href===profile.board&&corporate.document.text(n)==='Explore Opportunities')
  need(handoff.length===1&&corporate.document.text(one(corporate.nodes.filter(n=>n.tag==='body'),'own corporate body')).includes('© Tata Consulting Engineers Limited.'),'current original corporate publisher/handoff missing')
  allowed.add(profile.board);const board=await document(profile.board),rows=currentTceRows(board)
  need(same(rows,profile.rows)&&same(rows.slice(0,2).map(r=>r.url),profile.selectedRoleURLs),'current full observed native card models or selected identities changed')
  const roles=Array(2);let firstFailure
  const hydrate=async(index)=>{try{const row=rows[index];allowed.add(row.url);const page=await document(row.url),role=currentTceRole(page,row.url);need(role.title===row.title&&currentTceRoleContext(role)===profile.roles[index].modelContextSHA256,'complete current role/employer/country/criterion/application context changed');need(Date.parse(role.datePostedISO)<=Date.parse(observedAt),'native publication is in the future');roles[index]={row,role,originalHTML:page.originalHTML}}catch(error){if(!firstFailure){firstFailure=error;controller.abort(error)}}}
  await Promise.allSettled([hydrate(0),hydrate(1)]);if(firstFailure)throw firstFailure
  return{rows,roles,corporateContextSHA256:corporate.contextSHA256,boardContextSHA256:board.contextSHA256}
 }
 try{
  const opening=await pass(),closing=await pass(),closedAt=clock()
  need(Date.parse(closedAt)>=Date.parse(observedAt),'closing clock precedes opening');need(same(opening.rows,closing.rows)&&same(opening.roles.map(e=>e.role),closing.roles.map(e=>e.role)),'independent fresh full current criterion/native model closing changed')
  const observedVacancyCount=opening.roles.filter(e=>e.role.nativeObservationKind==='native-JobPosting').length,holds=opening.rows.slice(2).map(row=>({routeID:row.routeID,url:row.url,reason:'bounded-role-detail-budget;listing-only-record-unclassified',originalNativeRecord:row})),selected=[]
  for(const entry of opening.roles){if(Date.parse(entry.role.expirationISO)<=Date.parse(closedAt))holds.push({routeID:entry.role.routeID,url:entry.role.url,reason:'original-native-publication-expired',originalNativeRecord:entry.role});else selected.push(entry)}
  need(selected.length>0,'no current qualified role; zero and complete scope remain unqualified')
  const maximum=options.maxJobs??null;need(maximum===null||Number.isSafeInteger(maximum)&&maximum>=0,'invalid native result bound');const retained=maximum?selected.slice(0,maximum):selected
  for(const entry of selected.slice(retained.length))holds.push({routeID:entry.role.routeID,url:entry.role.url,reason:'caller-current-result-budget',originalNativeRecord:entry.role})
  const jobs=retained.map(entry=>{
   const role=entry.role,address=role.addresses[0],links=[...new Map(role.links.map(link=>[link.text+'\n'+link.href,link])).values()],description=role.ownerText+'\n\n'+links.map(link=>(link.text||link.href)+': '+new URL(link.href,ORIGIN).href).join('\n')
   return{source:SOURCE,company:COMPANY,companyDomain:'tataconsultingengineers.com',companyCareerPage:profile.corporate,title:role.title,jobId:role.routeID,requisitionId:null,nativeEmployerLabel:role.nativeEmployerLabel,nativeLegalEmployer:null,sourceNativeIdentity:{kind:'published-own-role-route-and-same-ID-Apply-anchor',routeID:role.routeID,formalRequisitionID:null},sourceUrl:role.canonical,sourceCanonicalRoleURL:role.canonical,link:role.canonical,applyUrl:role.applyURL,
    country:'India',location:address.city+', '+address.state+', '+address.countryCode+', '+address.postalCode,city:address.city,state:address.state,employmentType:null,remoteStatus:null,postingDate:role.datePostedISO,closingDate:null,firstEverPostedAt:null,jobDescription:description,sourceDescription:description,
    sourceNativeFullCriteria:role.criteria,sourceNativeCompleteOwnerText:role.ownerText,sourceNativeDescriptionTree:role.descriptionOriginalTree,sourceNativeAuthoredLinks:role.links,sourceNativeRecord:role,sourceNativeClosingRecord:closing.roles.find(e=>e.role.routeID===role.routeID).role,sourceNativeOriginalHTML:entry.originalHTML,
    sourceNativeDateRepresentations:{datePosted:role.datePosted,validThrough:role.validThrough,nativePublicationISO:role.datePostedISO,nativeExpirationISO:role.expirationISO,expirationIsNotAssertedAsClosingDeadline:true},
    sourceNativeEmployerBinding:{kind:'current-exact-own-corporate-active-careers-handoff+same-native-account+full-original-publisher-statement',corporateURL:profile.corporate,nativeURL:profile.board,originalAccountToken:'tatacons02',originalNativePublisherStatement:role.originalPublisherStatement,formalLegalEmployer:null},
    sourceNativeCountryProof:{kind:'current-own-JobPosting-Place-PostalAddress-addressCountry',countryCode:address.countryCode,countryName:'India',originalAddressAlternatives:role.addresses,countryInferredFromCity:false},
    sourceNativePublishedApplication:{url:role.applyURL,originalAnchors:role.originalApplicationAnchors,originalNativeRouteID:role.routeID,declaredByOwnHTML:true,renderedEnabledQualified:false,operationQualified:false},
    sourceDetailComplete:true,sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,sourceNativeMetadataAuthorityOnly:true,scrapedAt:observedAt}
  })
  const evidence={source:SOURCE,observedAt,closingObservedAt:closedAt,recordKind:'mixed',observedRecordCount:opening.rows.length,observedVacancyCount,companyGlobalTotal:null,companyIndiaTotal:null,observationCountSemantics:'25 original titled native role-card models; exactly2 independently hydrated original typed JobPostings before eligibility/caller limits;23 card-only records remain unclassified, not asserted non-vacancies',nativeRows:opening.rows,closingNativeRows:closing.rows,openingModels:opening.roles.map(e=>e.role),closingModels:closing.roles.map(e=>e.role),originalResponses:receipts,holds,independentNativeClosingReconciled:true,completeNativeCriteriaPreserved:true,metadataAuthorityOnly:true,externalProgramsExecuted:false,externalResourcesFetched:false,externalResourceBytesUsedAsRoleData:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedZero:false,renderedApplicationQualified:false,applicationSubmitted:false,unqualifiedAdvertisedNativeTotal:profile.rawAdvertisedTotal,otherPublishedRecruitmentSurface:profile.otherPublishedRecruitmentSurface}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'mixed',observedRecordCount:opening.rows.length,observedVacancyCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  signal.throwIfAborted();return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.board,firstParty:true,listingComplete:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:closedAt,reason:'current-own-corporate/native-account+two-full-typed-India-postings+independent-full-closing;23card-only-details-and-other-native-surface-unclassified;zero/companyscope/renderedapplication-unqualified;cleanup-forbidden'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&(typeof error==='object'||typeof error==='function'))try{if(Object.isExtensible(error))Object.assign(error,{softFailure:true,abortRetries:true,failureKind:error.failureKind||'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceAudit:{source:SOURCE,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
