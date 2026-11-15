import fs from 'node:fs'
import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities/decode'

const profile=JSON.parse(fs.readFileSync(new URL('./currentPassive20261115.json',import.meta.url),'utf8'))
const gap=message=>Object.assign(Error('Providence India: '+message),{source:'providence',failureKind:'coverage_gap',softFailure:true,abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(condition,message)=>{if(!condition)throw gap(message)}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const sha=value=>createHash('sha256').update(value).digest('hex')
const closure=/\b(?:(?:this|the)\s+)?(?:role|position|job|vacancy)\s+(?:(?:is|was|has|have)\s+)?(?:(?:already|now|currently)\s+)*(?:been\s+)?(?:unavailable|not\s+available|closed|filled|withdrawn|expired|cancelled|canceled|no\s+longer\s+(?:available|open))\b|\b(?:applications?|hiring|recruitment)\s+(?:(?:for\s+(?:this|the)\s+(?:role|position|job))\s+)?(?:(?:has|have|is|are|will)\s+)?(?:(?:now|currently|already)\s+)*(?:been\s+)?(?:closed|ended|suspended|no\s+longer\s+(?:being\s+)?accepted)\b/i
export const currentProvidenceClosureNotice=value=>value.match(closure)?.[0]??null
const headerNames=['content-type','refresh','content-disposition','location','content-location','link','content-security-policy','content-security-policy-report-only','x-content-security-policy','x-webkit-csp','x-content-type-options','x-frame-options']
export const currentProvidenceHeaderContext=headers=>Object.fromEntries(headerNames.map(name=>{
 let value=typeof headers?.get==='function'?headers.get(name):headers?.[name]??null
 if(name==='content-type'&&typeof value==='string'&&/^text\/html(?:\s*;\s*charset\s*=\s*(?:utf-?8|"utf-?8"))?\s*$/i.test(value))value=/charset/i.test(value)?'text/html;charset=utf-8':'text/html'
 return[name,value]
}))
export const isReviewedCurrentProvidenceHeaderContext=(url,context)=>profile.responseHeaderContexts?.[url]?.some(expected=>JSON.stringify(expected)===JSON.stringify(context))===true
const visit=node=>node&&typeof node==='object'?[node,...Object.values(node).filter(value=>value&&typeof value==='object').flatMap(value=>Array.isArray(value)?value.flatMap(visit):visit(value))]:[]
const sites={
 board:{count:47,tracking:32,csrf:38},
 listing:{count:50,tracking:34,csrf:40},
 detail:{count:62,tracking:45,csrf:42}
}
const csrfPath=['body',2,'expression','arguments',0,'properties',1,'value','properties',0,'value']
const detailSites=[
 {index:44,path:['body',0,'expression','arguments',0,'properties',0,'value'],type:'public-number'},
 {index:44,path:['body',0,'expression','arguments',0,'properties',6,'value','properties',3,'value'],type:'opaque-internal'},
 {index:58,path:['body',0,'expression','arguments',0,'properties',2,'value'],type:'public-string'}
]
export const hasCurrentProvidenceBuild=d=>d.nodes.some(node=>['script','link'].includes(node.tag)&&/\/platform\//.test(node.attrs.src??node.attrs.href??'')&&(node.attrs.src??node.attrs.href??'').endsWith('?h='+profile.nativeBuild))
export const isReviewedCurrentProvidenceAuthorityContext=(kind,context)=>profile.authorityLinkProfiles?.[kind]?.includes(context)===true

const within=(node,owner)=>{while(node){if(node===owner)return true;node=node.parent}return false}
function outsideOwnerFrame(d,outer){
 const owners=d.nodes.filter(node=>node.attrs.itemtype==='http://schema.org/JobPosting')
 need(owners.length===1,'unbound complete current native owner for document context')
 const owner=owners[0],plainTags=new Set(['div','p','span','strong','b','em']),fallbacks=[]
 const plain=node=>plainTags.has(node.tag)&&Object.keys(node.attrs).length===0&&node.children.every(child=>typeof child==='string'||plain(child))
 const passiveText=node=>node.children.map(child=>typeof child==='string'?decodeHTML(child):passiveText(child)).join(' ').replace(/\s+/g,' ').trim()
 const passiveClosure=node=>{
  if(!node.inactive||node.parent?.inactive||within(node,owner))return false
  const keys=Object.keys(node.attrs),rootAllowed=node.tag==='template'&&keys.length===0||['div','p','span'].includes(node.tag)&&keys.length===1&&keys[0]==='hidden'
  if(!rootAllowed||!node.children.every(child=>typeof child==='string'||plain(child)))return false
  const value=passiveText(node),match=closure.exec(value)
  return Boolean(match&&match.index===0&&/^[.!?\s]*$/.test(value.slice(match[0].length)))
 }
 for(const node of d.nodes.filter(passiveClosure))fallbacks.push(node)
 const spans=[{start:owner.start,end:owner.end,value:'<INDEPENDENTLY-VALIDATED-COMPLETE-NATIVE-JOBPOSTING>'},...fallbacks.map(node=>({start:node.start,end:node.end,value:''}))]
 for(const[node,value]of outer)if(!within(node,owner)&&!fallbacks.some(fallback=>within(node,fallback)))spans.push({start:node.start,end:node.end,value})
 let context=d.outer(d.root),last=context.length
 for(const span of spans.sort((a,b)=>b.start-a.start)){need(span.end<=last,'overlapping current outside-owner context bindings');context=context.slice(0,span.start)+span.value+context.slice(span.end);last=span.start}
 return{sha256:sha(context),context,passiveInactiveClosureFallbacks:fallbacks.map(node=>({originalHTML:d.outer(node),vacancyAuthority:false,programsExecuted:false}))}
}

// This model is a read-only description of unexecuted authored carriers. Only
// exact AST-bound anonymous literals and an unused override resource cache key
// are projected. Complete native role/criteria models are parsed separately.
export function describeCurrentProvidencePassiveTree(d,kind,publicId,frameOf){
 const plan=sites[kind];need(plan&&hasCurrentProvidenceBuild(d),'unreviewed current passive build/kind')
 const nodes=d.nodes.filter(node=>node.tag==='script'||node.tag==='style'||node.tag==='link'&&(node.attrs.rel||'').split(/\s+/).includes('stylesheet'))
 need(nodes.length===plan.count,'unreviewed current complete passive carrier count')
 const programs=new Map(),outer=new Map(),attrs=new Map();let opaqueInternalId
 const program=index=>{
  if(programs.has(index))return programs.get(index)
  const node=nodes[index];need(node?.tag==='script'&&!node.attrs.src&&!node.inactive,'unreviewed current native data carrier')
  let ast;try{ast=parse(node.raw,{ecmaVersion:'latest',sourceType:'script'})}catch{throw gap('malformed current native data program')}
  const value={node,ast,spans:[]};programs.set(index,value);return value
 }
 const literal=(index,path,kind)=>{
  const group=program(index),value=path.reduce((node,key)=>node?.[key],group.ast)
  need(value?.type==='Literal','unreviewed current '+kind+' native literal');return{group,value,raw:group.node.raw.slice(value.start,value.end)}
 }
 const tracking=program(plan.tracking),declarations=visit(tracking.ast).filter(node=>node.type==='VariableDeclarator'&&node.id?.type==='Identifier'&&node.id.name==='ctid')
 need(declarations.length===1&&declarations[0].init?.type==='Literal','unreviewed current tracking owner/count')
 const trackingLiteral=declarations[0].init
 need(typeof trackingLiteral.value==='string'&&uuid.test(trackingLiteral.value)&&tracking.node.raw.slice(trackingLiteral.start,trackingLiteral.end)==="'"+trackingLiteral.value+"'",'unreviewed current anonymous tracking UUID')
 tracking.spans.push({start:trackingLiteral.start,end:trackingLiteral.end,marker:'"<TRACKING_UUID>"'})
 const csrf=literal(plan.csrf,csrfPath,'csrf')
 need(typeof csrf.value.value==='string'&&uuid.test(csrf.value.value)&&csrf.raw==='"'+csrf.value.value+'"','unreviewed current anonymous csrf UUID')
 csrf.group.spans.push({start:csrf.value.start,end:csrf.value.end,marker:'"<CSRF_UUID>"'})
 if(kind==='detail'){
  need(typeof publicId==='string'&&/^\d{7,9}$/.test(publicId),'unbound current native public role ID')
  for(const spec of detailSites){const item=literal(spec.index,spec.path,spec.type),value=item.value.value
   if(spec.type==='public-number')need(Number.isSafeInteger(value)&&String(value)===publicId&&item.raw===publicId,'current public numeric role identity conflict')
   else if(spec.type==='public-string')need(value===publicId&&item.raw==="'"+publicId+"'",'current public string role identity conflict')
   else{need(typeof value==='string'&&/^\d{4}-en_US$/.test(value)&&item.raw===JSON.stringify(value),'unreviewed current opaque internal role value');opaqueInternalId=value}
   item.group.spans.push({start:item.value.start,end:item.value.end,marker:spec.type==='public-number'?'0':spec.type==='public-string'?'"<PUBLIC_JOB_ID>"':'"<OPAQUE_INTERNAL_ID>"'})
  }
 }
 for(const {node,spans}of programs.values()){
  let source=node.raw
  for(const span of spans.sort((a,b)=>b.start-a.start))source=source.slice(0,span.start)+span.marker+source.slice(span.end)
  const original=d.outer(node);outer.set(node,original.slice(0,node.openEnd-node.start)+source+original.slice(node.closeStart-node.start))
 }
 const override=nodes.filter(node=>node.tag==='script'&&typeof node.attrs.src==='string'&&node.attrs.src.startsWith('/js/override.js?'))
 need(override.length===1,'unreviewed current native override declaration count')
 const node=override[0],match=/^\/js\/override\.js\?locale=en_US&i=([1-9]\d{0,9})$/.exec(node.attrs.src)
 need(!node.inactive&&match&&Number(match[1])<=2147483647,'unreviewed current unused override resource declaration')
 const declaration=d.outer(node),cache=/([?&](?:amp;)?i=)([1-9]\d{0,9})(?=["'])/g
 need([...declaration.matchAll(cache)].length===1,'unreviewed exact override cache-key representation')
 attrs.set(node,{...node.attrs,src:'/js/override.js?locale=en_US&i=<UNEXECUTED-NATIVE-RESOURCE-CACHE-KEY>'})
 outer.set(node,declaration.replace(cache,'$1<UNEXECUTED-NATIVE-RESOURCE-CACHE-KEY>'))
 if(kind==='detail'){
  const controls=d.nodes.filter(node=>node.tag==='input'&&node.attrs.name==='frequency'),html=d.outer(d.root)
  need(controls.length===2,'unreviewed current passive alert control inventory')
  for(const[index,input]of controls.entries()){
   const id=input.attrs.id,labels=d.nodes.filter(node=>node.tag==='label'&&node.attrs.for===id),parent=input.parent
   need(/^j_idt\d{1,6}$/.test(id??'')&&d.nodes.filter(node=>node.attrs.id===id).length===1&&labels.length===1,'unreviewed current passive alert identity or label count')
   const label=labels[0]
   need(input.attrs.type==='number'&&(input.attrs.class??'').split(/\s+/).includes('frequencySpinBtn')&&(parent?.attrs.class??'').split(/\s+/).includes('subscribe-frequency-label')&&label.parent===parent&&label.attrs.id===input.attrs['aria-labelledby'],'unreviewed current passive alert owner/binding')
   need(label.children.every(child=>typeof child==='string')&&label.children.map(value=>decodeHTML(value)).join('').replace(/\s+/g,' ').trim()==='Select how often (in days) to receive an alert:','current passive alert is not the exact native notification-frequency control')
   need(html.split(id).length===3,'unbound current passive alert ID use')
   for(const[target,key]of[[input,'id'],[label,'for']]){
    need(new Set(target.attributeTokens.map(([name])=>name)).size===target.attributeTokens.length,'duplicate current passive alert attribute')
    const original=d.outer(target),needle=key+'="'+id+'"'
    need(original.split(needle).length===2,'unreviewed original passive alert attribute representation')
    outer.set(target,original.replace(needle,key+'="<CURRENT-NATIVE-PASSIVE-ALERT-'+index+'>"'))
   }
  }
 }
 const outside=kind==='detail'?outsideOwnerFrame(d,outer):null
 return{frame:frameOf(d,outer,attrs),...(outside?{outsideOwnerFrameSHA256:outside.sha256,outsideOwnerContext:outside.context}:{}),evidence:{currentMetadataAuthorityRevision:profile.revision,...(kind==='detail'?{opaqueInternalId,outsideOwnerFrameSHA256:outside.sha256,passiveInactiveClosureFallbacks:outside.passiveInactiveClosureFallbacks}:{}),programsExecuted:false,externalProgramsFetched:false,renderedOperationQualified:false,anonymousLiteralsForwardedOrReplayed:false}}
}
export function acceptCurrentProvidencePassiveTree(d,kind,publicId,frameOf){
 const result=describeCurrentProvidencePassiveTree(d,kind,publicId,frameOf)
 need(profile.frames[kind]?.includes(result.frame.sha256),'unreviewed current complete native passive context '+kind+':'+result.frame.sha256)
 if(kind==='detail')need(profile.detailOutsideOwnerFrames?.[publicId]?.includes(result.outsideOwnerFrameSHA256),'unreviewed complete current document outside native owner: '+publicId)
 return result
}
