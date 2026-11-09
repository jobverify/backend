import {parse,parseExpressionAt} from 'acorn'
﻿import {decodeHTML as decode,decodeHTMLAttribute} from 'entities/decode'
// Source-owned nonexecuting reader retains original offsets and authored slices.
function rawDocument(html) {
 if(typeof html!=='string')throw Error('Astra Security native HTML unavailable')
 const root={tag:'root',attrs:{},children:[],start:0,end:html.length},stack=[root]
 const raw=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript']),voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
 const tokens=/<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
 let cursor=0,token
 while((token=tokens.exec(html))){const parent=stack.at(-1)
  if(token.index>cursor)parent.children.push(html.slice(cursor,token.index));cursor=tokens.lastIndex
  if(!token[1])continue
  const tag=token[1].toLowerCase()
  if(token[0].startsWith('</')){const at=stack.findLastIndex(n=>n.tag===tag),boundary=stack.findLastIndex(n=>n.tag==='template');if(at>0&&at>=boundary){const node=stack[at];node.closeStart=token.index;node.end=cursor;stack.length=at}continue}
  const attrs={};for(const a of token[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){const key=a[1].toLowerCase();if(!Object.hasOwn(attrs,key))Object.defineProperty(attrs,key,{value:decodeHTMLAttribute(a[2]??a[3]??a[4]??''),enumerable:true,writable:true,configurable:true})}
  const style=(attrs.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
  const inactive=Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||attrs['aria-hidden']==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/i.test(style)
  const node={tag,attrs,children:[],start:token.index,openEnd:cursor,inactive:parent.inactive||inactive||tag==='template'||raw.has(tag)&&tag!=='script'};parent.children.push(node)
  if(raw.has(tag)){const end=new RegExp(`</${tag}\\s*>`,'ig');end.lastIndex=cursor;const close=tag==='plaintext'?null:end.exec(html);node.raw=html.slice(cursor,close?.index??html.length);node.closeStart=close?.index??html.length;node.end=close?end.lastIndex:html.length;cursor=node.end;tokens.lastIndex=cursor}
  else if(!voids.has(tag))stack.push(node);else{node.closeStart=cursor;node.end=cursor}
 }
 if(cursor<html.length)stack.at(-1).children.push(html.slice(cursor))
 const nodes=(predicate,node=root)=>node.inactive?[]:[...(predicate(node)?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>nodes(predicate,c))]
 const text=node=>!node||node.inactive||node.tag==='script'?'':node.children.map(c=>typeof c==='string'?decode(c):text(c)).join(' ').replace(/\s+/g,' ').trim()
 const inner=node=>{if(!Number.isInteger(node.closeStart))throw Error('Astra Security native unclosed content');return html.slice(node.openEnd,node.closeStart)}
 const outer=node=>{if(!Number.isInteger(node.end))throw Error('Astra Security native unclosed element');return html.slice(node.start,node.end)}
 return{root,nodes,text,inner,outer,hasClass:(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)}
}


export const ROUTE_HELPER_SOURCE="Lyte.Component.registerHelper(\"getJobViewUrl\",(function(e,t,o,a){if(a)return o.internal_list_url+\"?id=\"+e;var i=encodeURIComponent(t.replace(/[\"\\~`!@#$%^&\\*\\(\\)=+\\[\\]\\{\\}\\|:;<>\\\\\\/,\\.\\?'\\s]+/g,\"-\")),r=(o.external_url?o.external_url:o.list_url)+\"/\"+e+\"/\"+i;return o.source&&(r+=\"?source=\"+encodeURIComponent(o.source)),r})),"
export const PRIMARY='https://www.getastra.com/team-and-culture',BOARD='https://jobs.getastra.com/jobs/Careers',SOURCE='astrasecurity',ORG_ID='91259000000272485',PAGE_ID='91259000000273534'
const norm=v=>String(v??'').replace(/\s+/g,' ').trim(),children=n=>n.children.filter(v=>typeof v==='object'),all=(n,p)=>[...(p(n)?[n]:[]),...children(n).flatMap(c=>all(c,p))],script=n=>n.raw??n.children.filter(v=>typeof v==='string').join('')
const text=n=>typeof n==='string'?norm(decode(n)):['script','style','template','noscript'].includes(n.tag)?'':norm(n.raw===undefined?n.children.map(text).join(' '):decode(n.raw))
const rawHTML=(doc,n)=>{try{return doc.outer(n)}catch{return null}},nodes=doc=>all(doc.root,()=>true)
const head=doc=>{const ns=nodes(doc);return{titles:ns.filter(n=>n.tag==='title').map(text),canonicals:ns.filter(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')).map(n=>n.attrs.href??null),metas:ns.filter(n=>n.tag==='meta').map(n=>({...n.attrs})),schemas:ns.filter(n=>n.tag==='script'&&(n.attrs.type??'').split(';')[0].trim().toLowerCase()==='application/ld+json').map(n=>({attrs:{...n.attrs},raw:script(n)}))}}
const property=(object,key,value)=>Object.defineProperty(object,key,{value,enumerable:true,writable:true,configurable:true})
function literal(node,depth=0,allowParse=true){
 if(depth>100)throw Error('Native data nesting exceeds reviewed bound')
 if(node.type==='Literal'&&!node.regex&&!node.bigint&&(node.value===null||['string','boolean'].includes(typeof node.value)||typeof node.value==='number'&&Number.isFinite(node.value)))return node.value
 if(node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='Literal'&&typeof node.argument.value==='number'&&Number.isFinite(node.argument.value))return-node.argument.value
 if(node.type==='ArrayExpression')return node.elements.map(value=>{if(!value)throw Error('Native sparse array');return literal(value,depth+1,allowParse)})
 if(node.type==='ObjectExpression'){
  const out={};for(const p of node.properties){if(p.type!=='Property'||p.kind!=='init'||p.computed||p.method||p.shorthand)throw Error('Native executable object property');const key=p.key.type==='Identifier'?p.key.name:p.key.type==='Literal'?String(p.key.value):null;if(key===null||Object.hasOwn(out,key))throw Error('Native duplicate or dynamic property');property(out,key,literal(p.value,depth+1,allowParse))}return out
 }
 if(allowParse&&node.type==='CallExpression'&&!node.optional&&node.arguments.length===1&&node.arguments[0].type==='Literal'&&typeof node.arguments[0].value==='string'&&node.callee.type==='MemberExpression'&&!node.callee.computed&&!node.callee.optional&&node.callee.object.type==='Identifier'&&node.callee.object.name==='JSON'&&node.callee.property.type==='Identifier'&&node.callee.property.name==='parse')return strictJSON(node.arguments[0].value)
 throw Error('Native value is not inert literal data')
}
function strictJSON(raw){const result=JSON.parse(raw),tree=parseExpressionAt(raw,0,{ecmaVersion:'latest'});if(raw.slice(tree.end).trim())throw Error('Trailing native JSON expression');literal(tree,0,false);return result}

const nativeNames=new Set(['jobs','page_id','portalPageJson','moduleMeta','public_attachments_info','meta','country'])
const isFunction=n=>['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)
function syntaxWalk(root,visit){
 const pending=[{node:root,ancestors:[]}]
 while(pending.length){const{node,ancestors}=pending.pop();visit(node,ancestors);const parents=[...ancestors,node]
  for(const value of Object.values(node)){if(Array.isArray(value)){for(let i=value.length-1;i>=0;i--)if(value[i]&&typeof value[i].type==='string')pending.push({node:value[i],ancestors:parents})}else if(value&&typeof value.type==='string')pending.push({node:value,ancestors:parents})}
 }
}
function bindingNames(n,out=new Set()){
 if(!n)return out
 if(n.type==='Identifier')out.add(n.name)
 else if(n.type==='RestElement')bindingNames(n.argument,out)
 else if(n.type==='AssignmentPattern')bindingNames(n.left,out)
 else if(n.type==='ArrayPattern')for(const item of n.elements)bindingNames(item,out)
 else if(n.type==='ObjectPattern')for(const item of n.properties)bindingNames(item.type==='RestElement'?item.argument:item.value,out)
 return out
}
const scopeCache=new WeakMap()
function scopeBindings(n){
 if(scopeCache.has(n))return scopeCache.get(n)
 const names=new Set();scopeCache.set(n,names)
 if(isFunction(n)){
  bindingNames(n.id,names);for(const p of n.params)bindingNames(p,names)
  const pending=[n.body];while(pending.length){const current=pending.pop();if(!current)continue;if(isFunction(current)){if(current.type==='FunctionDeclaration')bindingNames(current.id,names);continue}if(current.type==='VariableDeclaration'&&current.kind==='var')for(const d of current.declarations)bindingNames(d.id,names);for(const value of Object.values(current)){if(Array.isArray(value)){for(const child of value)if(child?.type)pending.push(child)}else if(value?.type)pending.push(value)}}
 }
 const statements=n.type==='BlockStatement'?n.body:['ForStatement','ForInStatement','ForOfStatement'].includes(n.type)?[n.init??n.left]:[]
 for(const statement of statements){if(statement?.type==='VariableDeclaration'&&statement.kind!=='var')for(const d of statement.declarations)bindingNames(d.id,names);else if(['ClassDeclaration','FunctionDeclaration'].includes(statement?.type))bindingNames(statement.id,names)}
 if(n.type==='CatchClause')bindingNames(n.param,names)
 return names
}
const shadowed=(name,ancestors)=>ancestors.some(n=>n.type!=='Program'&&scopeBindings(n).has(name))
function memberPath(n){
 if(n?.type==='ChainExpression')return memberPath(n.expression)
 if(n?.type==='Identifier')return[n.name]
 if(n?.type!=='MemberExpression')return null
 const base=memberPath(n.object),key=n.computed?n.property.type==='Literal'&&typeof n.property.value==='string'?n.property.value:null:n.property.name
 return base&&key!==null?[...base,key]:null
}
function nativeTargets(n,ancestors){
 if(!n)return[]
 if(n.type==='Identifier')return nativeNames.has(n.name)&&!shadowed(n.name,ancestors)?[n.name]:[]
 if(n.type==='MemberExpression'||n.type==='ChainExpression'){
  let base=n.type==='ChainExpression'?n.expression:n;while(base?.type==='MemberExpression')base=base.object
  if(base?.type==='Identifier'&&nativeNames.has(base.name)&&!shadowed(base.name,ancestors))return[base.name]
  const path=memberPath(n);return path&&['window','globalThis','self'].includes(path[0])&&!shadowed(path[0],ancestors)&&nativeNames.has(path[1])?[path[1]]:[]
 }
 if(n.type==='RestElement')return nativeTargets(n.argument,ancestors)
 if(n.type==='AssignmentPattern')return nativeTargets(n.left,ancestors)
 if(n.type==='ArrayPattern')return n.elements.flatMap(v=>nativeTargets(v,ancestors))
 if(n.type==='ObjectPattern')return n.properties.flatMap(v=>nativeTargets(v.type==='RestElement'?v.argument:v.value,ancestors))
 return[]
}
function scriptProblem(n,inline=false){
 if(n.inactive)return'Inactive native script carrier'
 if(Object.hasOwn(n.attrs,'nomodule'))return'Conditional nomodule native carrier'
 if(!['','text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes((n.attrs.type??'').split(';')[0].trim().toLowerCase()))return'Native script type is not reviewed classic JavaScript'
 if(inline&&Object.hasOwn(n.attrs,'src'))return'Inline native literal program has an external source'
 return null
}

export function parsePrimary(html){const doc=rawDocument(html);return{sourcePage:PRIMARY,head:head(doc),careersLinks:nodes(doc).filter(n=>n.tag==='a'&&n.attrs.href===BOARD).map(n=>({attrs:{...n.attrs},text:text(n),nativeHTML:rawHTML(doc,n),...(n.inactive?{inactive:true}:{})}))}}
export function parseBoard(html){
 const doc=rawDocument(html),nativeInputs=[],nativeData={},errors=[]
 for(const n of nodes(doc).filter(n=>n.tag==='input'&&['pageJson','moduleMeta','jobs','meta'].includes(n.attrs.id))){const name=n.attrs.id;if(n.inactive)errors.push({name,message:'Inert native input carrier'});let value=null;try{value=strictJSON(n.attrs.value);if(Object.hasOwn(nativeData,name))throw Error('Duplicate native input');property(nativeData,name,value)}catch(e){errors.push({name,message:String(e.message).slice(0,1024)})}nativeInputs.push({name,attrs:{...n.attrs},nativeHTML:rawHTML(doc,n),value})}
 const value={sourcePage:BOARD,head:head(doc),nativeInputs,nativeData,records:Array.isArray(nativeData.jobs)?nativeData.jobs:[]};if(errors.length)value.parseFailures=errors;return value
}
export function declaredClient(html){
 const doc=rawDocument(html),matches=nodes(doc).filter(n=>n.tag==='script'&&/^https:\/\/static\.zohocdn\.com\/recruit\/javascript\/career-website-common\.[a-f0-9]+\.js$/.test(n.attrs.src??''))
 return matches.map(n=>{const problem=scriptProblem(n);return{url:n.attrs.src,attrs:{...n.attrs},nativeHTML:rawHTML(doc,n),...(problem?{authorityUnavailable:problem}:{})}})
}
export function parseClient(raw,url){
 const matches=[],errors=[];let program
 try{program=parse(raw,{ecmaVersion:'latest',sourceType:'script'})}catch(e){errors.push({name:'client',message:String(e.message).slice(0,1024)})}
 if(program)syntaxWalk(program,(node,ancestors)=>{
  const path=memberPath(node.callee)
  if(node.type==='CallExpression'&&path?.join('.')==='Lyte.Component.registerHelper'){
   const key=node.arguments[0]
   if(key?.type!=='Literal'||typeof key.value!=='string'){errors.push({name:'helper',message:'Dynamic native helper registration'});return}
   if(key.value==='getJobViewUrl'){
    const source=raw.slice(node.start,node.end),topLevel=ancestors.every(n=>['Program','ExpressionStatement','SequenceExpression'].includes(n.type))
    matches.push(source+',');if(!topLevel||node.optional||source+','!==ROUTE_HELPER_SOURCE)errors.push({name:'helper',message:'Unreviewed or conditional native route helper implementation'})
   }
  }
  if(['AssignmentExpression','UpdateExpression'].includes(node.type)&&memberPath(node.left??node.argument)?.join('.')==='Lyte.Component.registerHelper')errors.push({name:'helper',message:'Native helper registrar is reassigned'})
 })
 const value={sourcePage:url,routeHelperSource:matches[0]??null,registrationCount:matches.length,helperAuthorityValidated:matches.length>0&&!errors.length&&matches.every(v=>v===ROUTE_HELPER_SOURCE)}
 if(errors.length)value.parseFailures=errors;return value
}
// A source-owned translation of the inspected getJobViewUrl helper; no publisher code runs.
export function detailURL(record,meta){const title=record.Posting_Title,id=record.id;if(typeof title!=='string'||!title||typeof id!=='string'||!/^\d+$/.test(id)||meta.list_url!==BOARD||meta.external_url&&meta.external_url!==BOARD||meta.source!=='CareerSite')throw Error('Unqualified native detail route');const slug=encodeURIComponent(title.replace(/["\~`!@#$%^&\*\(\)=+\[\]\{\}\|:;<>\\/,\.\?'\s]+/g,'-'));return BOARD+'/'+id+'/'+slug+'?source='+encodeURIComponent(meta.source)}
const criteria=raw=>{if(typeof raw!=='string')return{nativeDescriptionHTML:raw??null,fullCriteriaText:null,nativeAuthoredCriteriaAvailable:false};const doc=rawDocument(raw),fullCriteriaText=text(doc.root),inactive=nodes(doc).some(n=>n.inactive&&!['script','style','noscript','title'].includes(n.tag)&&text(n));return{nativeDescriptionHTML:raw,fullCriteriaText,nativeAuthoredCriteriaAvailable:Boolean(fullCriteriaText)&&!inactive}}
export function parseDetail(html,url){
 const doc=rawDocument(html),nativeData={},literalCarriers=[],errors=[],conflicts=[],programs=[]
 // Inspect syntax only. Alternative declarations and later writes must not disappear
 // merely because they use a different spelling or a separate inline script.
 for(const[index,n]of nodes(doc).filter(n=>n.tag==='script').entries()){
  const source=script(n);if(!source.trim())continue
  try{const program=parse(source,{ecmaVersion:'latest',sourceType:'script'}),declarations=program.body.flatMap(v=>v.type==='VariableDeclaration'?v.declarations:[]).filter(v=>v.id.type==='Identifier'),names=new Set(declarations.map(v=>v.id.name));programs.push({n,index,source,program,selected:names.has('jobs')&&(names.has('meta')||names.has('page_id'))})}
  catch(e){if(/^\s*(?:var|let|const)\s+(?:jobs|meta|page_id)\s*=/m.test(source))errors.push({name:'script',message:String(e.message).slice(0,1024),nativeSource:source,scriptIndex:index})}
 }
 const selected=programs.filter(v=>v.selected),allowed=new WeakSet(),metaAdditions=new Set(['favicon_url','callback_url','listpage_callback_url']),seenMetaAdditions=new Set()
 if(selected.length!==1)errors.push({name:'script',message:'Ambiguous or missing native literal program'})
 for(const entry of selected){const{n,source,program}=entry,problem=scriptProblem(n,true);if(problem)errors.push({name:'script',message:problem})
  const add=(name,node)=>{const carrier={name,nativeSource:source.slice(node.start,node.end)};try{const value=literal(node);carrier.value=value;if(name.startsWith('meta.')){const key=name.slice(5);if(!metaAdditions.has(key)||seenMetaAdditions.has(key))throw Error('Unreviewed or repeated native meta assignment');if(!nativeData.meta||typeof nativeData.meta!=='object'||Array.isArray(nativeData.meta))throw Error('Native meta assignment without object');seenMetaAdditions.add(key);property(nativeData.meta,key,value)}else{if(Object.hasOwn(nativeData,name))throw Error('Duplicate native variable');property(nativeData,name,value)}}catch(e){errors.push({name,message:String(e.message).slice(0,1024)})}literalCarriers.push(carrier)}
  for(const statement of program.body){if(statement.type==='VariableDeclaration')for(const d of statement.declarations){if(d.id.type==='Identifier'&&nativeNames.has(d.id.name)){allowed.add(d);if(d.init)add(d.id.name,d.init);else errors.push({name:d.id.name,message:'Native declaration without literal initializer'})}}else if(statement.type==='ExpressionStatement'){const e=statement.expression;if(e.type==='AssignmentExpression'&&e.operator==='='&&e.left.type==='MemberExpression'&&!e.left.computed&&e.left.object.type==='Identifier'&&e.left.object.name==='meta'&&e.left.property.type==='Identifier'){add('meta.'+e.left.property.name,e.right);if(metaAdditions.has(e.left.property.name))allowed.add(e)}}}
 }
 const recordConflict=(entry,node,names,kind)=>{
  const claim={names:[...new Set(names)],kind,scriptIndex:entry.index,nativeSource:entry.source.slice(node.start,node.end)}
  const rhs=node.type==='VariableDeclarator'?node.init:node.type==='AssignmentExpression'?node.right:null
  if(rhs)try{claim.literalValue=literal(rhs)}catch{}
  conflicts.push(claim);errors.push({name:claim.names.join(','),message:'Competing native declaration or unreviewed native mutation',scriptIndex:entry.index})
 }
 for(const entry of programs)syntaxWalk(entry.program,(node,ancestors)=>{
  if(allowed.has(node))return
  if(node.type==='VariableDeclarator'){const names=[...bindingNames(node.id)].filter(v=>nativeNames.has(v)&&!shadowed(v,ancestors));if(names.length)recordConflict(entry,node,names,'declaration')}
  else if(node.type==='AssignmentExpression'||node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete'){const names=nativeTargets(node.left??node.argument,ancestors);if(names.length)recordConflict(entry,node,names,'mutation')}
  else if(node.type==='CallExpression'){
   const path=memberPath(node.callee),mutator=path?.slice(0,-1).join('.'),method=path?.at(-1),names=node.callee.type==='MemberExpression'&&['copyWithin','fill','pop','push','reverse','shift','sort','splice','unshift','set','add','delete','clear'].includes(method)?nativeTargets(node.callee.object,ancestors):['Object','Reflect'].includes(mutator)&&['assign','defineProperty','defineProperties','set','deleteProperty','setPrototypeOf','freeze','seal','preventExtensions'].includes(method)?nativeTargets(node.arguments[0],ancestors):[]
   if(names.length)recordConflict(entry,node,names,'mutating-call')
  }
 })
 const records=(Array.isArray(nativeData.jobs)?nativeData.jobs:[]).map(j=>({nativeRecord:j,...criteria(j?.Job_Description)})),value={sourcePage:url,head:head(doc),nativeData,literalCarriers,records}
 if(conflicts.length)value.nativeProgramConflicts=conflicts;if(errors.length)value.parseFailures=errors;return value
}
