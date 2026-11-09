import {parse} from 'acorn'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'

const check=(ok,message)=>{if(!ok)throw Object.assign(Error('m2nxt native roles: '+message),{abortRetries:true})}
export const norm=value=>String(value??'').replace(/[\u2013\u2014\u2212]/g,'-').replace(/\s+/g,' ').trim()
const all=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>all(n,predicate))]
export const readRoleControls=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true})
 let titles=doc.nodes(n=>n.tag==='button'&&(n.attrs.class||'').includes('text-left')).map(n=>{
  const spans=all(n,s=>s.tag==='span'&&(s.attrs.class||'').includes('font-semibold'))
  check(spans.length===1,'ambiguous role control');return norm(doc.text(spans[0]))
 })
 // The earlier native static representation used headings for collapsed roles.
 if(!titles.length)titles=doc.nodes(n=>['h2','h3'].includes(n.tag)).map(n=>norm(doc.text(n)))
 check(titles.length>0&&titles.every(Boolean)&&new Set(titles).size===titles.length,'missing/duplicate role control')
 return titles
}
export const advertisedRoleClient=html=>{
 const scripts=document(html).nodes(n=>n.tag==='script'&&n.attrs.src&&/\/app\/careers\/page-[\w-]+\.js/.test(n.attrs.src))
 check(scripts.length<=1,'ambiguous advertised careers client')
 if(!scripts.length)return null
 const url=new URL(scripts[0].attrs.src,'https://www.m2nxt.com/')
 check(url.origin==='https://www.m2nxt.com'&&/^\/_next\/static\/chunks\/app\/careers\/page-[\w-]+\.js$/.test(url.pathname)&&!url.search,'foreign/unbound advertised careers client')
 return url.href
}
const object=node=>{
 check(node?.type==='ObjectExpression','nonliteral role object')
 const map={};for(const p of node.properties){check(p.type==='Property'&&!p.computed&&p.kind==='init'&&!p.method,'dynamic role property');const k=p.key.name??p.key.value;check(typeof k==='string'&&!Object.hasOwn(map,k),'duplicate role property');map[k]=p.value}return map
}
const literal=node=>{check(node?.type==='Literal'&&(node.value==null||['string','number','boolean'].includes(typeof node.value)),'dynamic native value');return node.value}
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const children=(node,bindings={})=>{
 if(!node)return ''
 if(node.type==='Identifier'){check(Object.hasOwn(bindings,node.name),'unbound description child');return children(bindings[node.name])}
 if(node.type==='Literal'){check(node.value==null||['string','number','boolean'].includes(typeof node.value),'unsupported child');return typeof node.value==='boolean'||node.value==null?'':escape(node.value)}
 if(node.type==='ArrayExpression')return node.elements.map(n=>children(n,bindings)).join('')
 if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.name==='map'&&node.callee.object.type==='ArrayExpression'){
  const callback=node.arguments[0],items=node.callee.object.elements
  check(node.arguments.length===1&&items.length<100&&callback?.type==='ArrowFunctionExpression'&&!callback.async&&callback.expression&&callback.params.length>=1&&callback.params.length<=2&&callback.params.every(p=>p.type==='Identifier'),'dynamic description iteration')
  return items.map((item,index)=>children(callback.body,{...bindings,[callback.params[0].name]:item,...(callback.params[1]?{[callback.params[1].name]:{type:'Literal',value:index}}:{})})).join('')
 }
 check(node.type==='CallExpression'&&[2,3].includes(node.arguments.length),'dynamic description child')
 if(node.arguments[2])check(node.arguments[2].type==='Literal'||node.arguments[2].type==='Identifier'&&Object.hasOwn(bindings,node.arguments[2].name),'dynamic description key')
 const seq=node.callee,callee=seq.type==='SequenceExpression'&&seq.expressions.length===2&&seq.expressions[0].value===0?seq.expressions[1]:null
 check(callee?.type==='MemberExpression'&&!callee.computed&&callee.object.type==='Identifier'&&['jsx','jsxs'].includes(callee.property.name),'unsupported description renderer')
 const props=object(node.arguments[1]),element=node.arguments[0]
 // The compiled Next Link is a zero-argument interop call. Only the exact
 // employer mail route and literal child text are relevant; never execute it.
 const mailLink=element.type==='CallExpression'&&element.callee.type==='Identifier'&&!element.arguments.length&&props.href?.type==='Literal'&&/^mailto:ahalya\.k@m2nxt\.com$/i.test(props.href.value)
 const tag=element.type==='Literal'?element.value:element.type==='MemberExpression'&&!element.computed&&element.property.name==='Fragment'?'fragment':mailLink?'a':null
 check(['fragment','p','div','span','b','strong','em','i','ul','ol','li','a','br','h2','h3','h4','svg','path','circle','polyline','line'].includes(tag),'unsupported description element')
 check(!Object.hasOwn(props,'dangerouslySetInnerHTML')&&!Object.keys(props).some(k=>/^on[A-Z]/.test(k)),'dynamic description markup')
 if(['svg','path','circle','polyline','line'].includes(tag))return ''
 if(tag==='fragment'){check(Object.keys(props).every(k=>k==='children'),'unreviewed fragment rendering props');return children(props.children,bindings)}
 const attributes=[]
 for(const [key,valueNode]of Object.entries(props)){
  if(key==='children')continue
  if(key==='style'){
   const values=object(valueNode),style=Object.entries(values).map(([name,value])=>name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+String(literal(value)??'')).join(';')
   attributes.push('style="'+escape(style)+'"');continue
  }
  const value=literal(valueNode),name=key==='className'?'class':key
  check(/^[\w:-]+$/.test(name),'invalid native rendering attribute')
  if(value==null)continue
  // React stringifies ARIA/data booleans; HTML boolean props use presence.
  if(/^(?:aria|data)-/i.test(name)){attributes.push(name+'="'+escape(value)+'"');continue}
  if(value===false)continue
  attributes.push(name+'="'+escape(value===true?'':value)+'"')
 }
 const open='<'+tag+(attributes.length?' '+attributes.join(' '):'')+'>'
 return open+children(props.children,bindings)+(tag==='br'?'':'</'+tag+'>')
}
export const readLiteralRoles=(javascript,titles,{visibilityStyles=''}={})=>{
 check(typeof javascript==='string'&&javascript.length<1500000,'unavailable/oversized careers client')
 let ast;try{ast=parse(javascript,{ecmaVersion:'latest'})}catch{check(false,'invalid careers client')}
 const candidates=[]
 const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='ArrayExpression'&&n.elements.length&&n.elements.every(o=>o?.type==='ObjectExpression'&&o.properties.some(p=>p.key?.name==='Description')))candidates.push(n);for(const [k,v]of Object.entries(n))if(!['start','end'].includes(k))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}
 walk(ast);check(candidates.length===1,'missing/ambiguous literal role collection')
 const rows=candidates[0].elements.map(n=>{
  const p=object(n);check(Object.keys(p).every(k=>['title','Department','Location','experience','Employment','Description','image','knowMoreLink','applyLink'].includes(k)),'unreviewed role field')
  const row={};for(const k of ['title','Department','Location','experience','Employment','image','knowMoreLink','applyLink'])if(p[k])row[k]=literal(p[k])
  check(typeof row.title==='string'&&typeof row.Location==='string'&&typeof row.applyLink==='string'&&(!row.applyLink||/^mailto:ahalya\.k@m2nxt\.com$/i.test(row.applyLink)),'missing/foreign role identity or application route')
  const markup=children(p.Description),doc=readVisibleNativeDocument('<style>'+visibilityStyles+'</style><main>'+markup+'</main>',{strict:true})
  row.description=norm(doc.text(doc.nodes(n=>n.tag==='main')[0]));check(row.description.length>100,'missing active native description')
  row.rawRoleLiteral=javascript.slice(n.start,n.end);return row
 })
 check(rows.length===titles.length&&rows.every((r,i)=>norm(r.title)===titles[i]),'visible role controls and literal inventory disagree')
 return rows
}
