import {createHash} from 'node:crypto'
import {readNativeAttributeTokens,decodeNativeEntities,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const widgetProgram='https://jobsapi.ceipal.com/APISource/widget.js'
const careers='https://www.comviva.com/careers/explore-opportunity/'
const hash=value=>createHash('sha256').update(value).digest('hex')
const stable=value=>JSON.stringify(value,(_,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row)
const attributes=attrs=>Object.fromEntries(Object.entries(attrs).filter(([key])=>key!=='nonce'))
const absolute=value=>{try{return new URL(value,careers).href}catch{return null}}

// This observes literal declarations, including hidden/template/raw scopes.
// An active-node query alone omits styles that can still change rendering.
export function observeCorporatePublisher(html){
 const root=readNativeDocument(html).nodes(node=>node.tag==='root')[0],handoffAncestries=[],frameAncestries=[]
 function walk(node,parents=[]){
  if(typeof node==='string')return
  const path=[...parents,{tag:node.tag,attrs:attributes(node.attrs),inert:node.inert===true,nativeTagUnqualified:node.nativeTagUnqualified===true}]
  if(node.tag==='script'&&node.attrs.src===widgetProgram)handoffAncestries.push(path)
  if(node.tag==='iframe'&&node.attrs.id==='careers_api_source')frameAncestries.push(path)
  for(const child of node.children)walk(child,path)
 }
 walk(root)
 const styles=[],stylesheets=[],programs=[],inlineStyleAttributes=[],ambiguities=[]
 const tags=/<([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
 for(const match of html.matchAll(tags)){
  const tag=match[1].toLowerCase();let tokens
  try{tokens=readNativeAttributeTokens(match[2])}catch{ambiguities.push('unsupported-raw-attribute-boundary');continue}
  const names=tokens.map(([name])=>name)
  if(new Set(names).size!==names.length)ambiguities.push('duplicate-raw-attribute')
  const attrs=Object.fromEntries(tokens.map(([name,value])=>[name,decodeNativeEntities(value)]))
  for(const [name,value]of tokens)if(name==='style')inlineStyleAttributes.push({tag,style:decodeNativeEntities(value)})
  if(tag==='style'){
   const rest=html.slice(match.index+match[0].length),end=rest.search(/<\/style[\t\n\f\r ]*>/i)
   if(end<0)ambiguities.push('unterminated-raw-style')
   const body=end<0?rest:rest.slice(0,end)
   styles.push({attrs:attributes(attrs),body,sha256:hash(body)})
  }
  if(tag==='link'&&((attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')||attrs.as?.toLowerCase()==='style'||/\.css(?:[?#]|$)/i.test(attrs.href||'')))stylesheets.push({attrs:attributes(attrs),url:absolute(attrs.href)})
  if(tag==='script'){
   const rest=html.slice(match.index+match[0].length),end=rest.search(/<\/script[\t\n\f\r ]*>/i)
   if(end<0)ambiguities.push('unterminated-raw-program')
   const body=end<0?rest:rest.slice(0,end)
   // JSON-LD remains original publisher data, never executable proof.
   programs.push({attrs:attributes(attrs),url:attrs.src?absolute(attrs.src):null,bodySHA256:hash(body),executable:!['application/ld+json','application/json'].includes(attrs.type||'')})
  }
 }
 const observation={handoffAncestries,frameAncestries,styles,stylesheets,programs,inlineStyleAttributes,ambiguities}
 return{...observation,contextSHA256:hash(stable(observation)),originalHTMLSHA256:hash(html)}
}

export function qualifyCorporatePublisher(html,expectedContextSHA256){
 const context=observeCorporatePublisher(html),holds=[]
 const contextMatched=context.contextSHA256===expectedContextSHA256
 if(!contextMatched)holds.push('current-corporate-handoff-ancestry-or-raw-style-program-context-changed')
 if(context.ambiguities.length)holds.push('ambiguous-current-corporate-raw-declarations')
 // Only the actual widget program has an acquired/reviewed byte contract.
 // The current Next programs and five corporate CSS bodies were not acquired.
 // A matching declaration is provenance, not evidence about those bodies.
 const unreviewedPrograms=context.programs.filter(row=>row.executable&&row.url!==widgetProgram)
 if(unreviewedPrograms.length)holds.push('unreviewed-current-corporate-program-context')
 if(context.stylesheets.length)holds.push('unreviewed-current-corporate-stylesheet-bodies')
 return{...context,contextMatched,complete:holds.length===0,holds,unreviewedPrograms,stylesheets:context.stylesheets.map(row=>({...row,bodyAcquired:false,bodySHA256:null,renderingQualified:false})),websiteJavaScriptExecuted:false}
}
