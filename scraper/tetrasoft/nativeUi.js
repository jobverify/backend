import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {document as sourceDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'

const has=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')
const all=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>all(child,predicate))]
const styleApplicable=node=>node&&!Object.hasOwn(node.attrs,'disabled')&&!/\balternate\b/i.test(node.attrs.rel||'')&&(!node.attrs.media||/^(?:all|screen)$/i.test(node.attrs.media.trim()))&&(!node.attrs.type||node.attrs.type.toLowerCase()==='text/css')
export const advertisedFaqAssets=html=>{
 const doc=readNativeDocument(html),css=doc.nodes(node=>node.tag==='link'&&(node.attrs.rel||'').split(/\s+/).includes('stylesheet')&&node.attrs.href&&new URL(node.attrs.href,'https://www.tetrasoft.us/careers.html').pathname==='/assets/css/main.css'),js=doc.nodes(node=>node.tag==='script'&&node.attrs.src&&new URL(node.attrs.src,'https://www.tetrasoft.us/careers.html').pathname==='/assets/js/main.js')
 if(css.length!==1||js.length!==1||!styleApplicable(css[0])||js[0].attrs.type&&!/^(?:application|text)\/javascript$/i.test(js[0].attrs.type))return null
 const urls=[css[0].attrs.href,js[0].attrs.src].map(value=>new URL(value,'https://www.tetrasoft.us/careers.html'))
 if(urls.some(url=>url.origin!=='https://www.tetrasoft.us'||url.username||url.password||url.search||url.hash))return null
 return {css:urls[0].href,js:urls[1].href}
}

// A small literal stylesheet reader is enough for this declared accordion.
// Positive rendering rules must be unconditional; all other CSS is retained.
const cssRules=css=>{
 const result=[]
 const skipQuote=(at,end)=>{const quote=css[at++];while(at<end){if(css[at]==='\\'){at+=2;continue}if(css[at++]===quote)return at}return end}
 const skipComment=(at,end)=>{const close=css.indexOf('*/',at+2);return close<0?end:close+2}
 const closeBrace=(at,end)=>{let depth=1;while(at<end){if(css.startsWith('/*',at)){at=skipComment(at,end);continue}if(css[at]==='"'||css[at]==="'"){at=skipQuote(at,end);continue}if(css[at]==='{')depth++;if(css[at]==='}'&&!--depth)return at;at++}throw Error('Unclosed native CSS block')}
 const walk=(start,end,conditional)=>{let cursor=start,headerStart=start;while(cursor<end){if(css.startsWith('/*',cursor)){cursor=skipComment(cursor,end);continue}if(css[cursor]==='"'||css[cursor]==="'"){cursor=skipQuote(cursor,end);continue}if(css[cursor]===';'){headerStart=++cursor;continue}if(css[cursor]!=='{'){cursor++;continue}const header=css.slice(headerStart,cursor).replace(/\/\*[\s\S]*?\*\//g,'').trim(),close=closeBrace(cursor+1,end);if(header.startsWith('@'))walk(cursor+1,close,true);else result.push({selector:header.replace(/\s+/g,' '),body:css.slice(cursor+1,close),bodyStart:cursor+1,bodyEnd:close,conditional});cursor=close+1;headerStart=cursor}}
 walk(0,css.length,false);return result
}
const declarations=body=>{const map=new Map();for(const declaration of body.replace(/\/\*[\s\S]*?\*\//g,'').split(';')){if(!declaration.trim())continue;const at=declaration.indexOf(':');if(at<0)throw Error('Invalid native CSS declaration');const key=declaration.slice(0,at).trim().toLowerCase(),value=declaration.slice(at+1).trim();if(map.has(key))throw Error('Ambiguous native CSS declaration');map.set(key,value)}return map}
const cssProof=css=>{
 const rules=cssRules(css),base=rules.filter(rule=>rule.selector==='.faq .faq-item .faq-content'),active=rules.filter(rule=>rule.selector==='.faq .faq-item.faq-active .faq-content')
 if(base.length!==1||active.length!==1||base[0].conditional||active[0].conditional)return null
 const closed=declarations(base[0].body),opened=declarations(active[0].body)
 if([...closed.keys()].sort().join(',')!=='display,grid-template-rows,opacity,transition,visibility'||closed.get('display')!=='grid'||closed.get('grid-template-rows')!=='0fr'||closed.get('visibility')!=='hidden'||closed.get('opacity')!=='0')return null
 if([...opened.keys()].sort().join(',')!=='grid-template-rows,opacity,visibility'||opened.get('grid-template-rows')!=='1fr'||opened.get('visibility')!=='visible'||opened.get('opacity')!=='1')return null
 const replacement=[...closed].filter(([key])=>!['grid-template-rows','visibility','opacity'].includes(key)).map(([key,value])=>key+':'+value+';').join('')
 return css.slice(0,base[0].bodyStart)+replacement+css.slice(base[0].bodyEnd)
}
const functionNode=node=>['FunctionExpression','ArrowFunctionExpression','FunctionDeclaration'].includes(node?.type)
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.name===object&&node.property?.name===property
const expressionBody=node=>node?.body?.type==='BlockStatement'&&node.body.body.length===1&&node.body.body[0].type==='ExpressionStatement'?node.body.body[0].expression:null
// The entire immediate native owner must finish before a click can run.
// Event handlers/function declarations are deferred; arbitrary calls, loops,
// assignments or bindings that replace the DOM cannot establish reachability.
const finiteOwnerWork=(statements,html)=>{
 const protectedNames=new Set(['document','window','GLightbox','PureCounter']),bindings=new Map(),literal=node=>node?.type==='Literal'&&['string','number','boolean'].includes(typeof node.value)
 const nativeTree=sourceDocument(html).root
 const query=node=>node?.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&!node.callee.computed&&node.callee.object?.name==='document'&&['querySelector','querySelectorAll'].includes(node.callee.property?.name)&&node.arguments.length===1&&typeof node.arguments[0]?.value==='string'
 const callback=node=>functionNode(node)||node?.type==='Identifier'&&bindings.get(node.name)==='function'
 const listener=(node,local=null)=>node?.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&!node.callee.computed&&node.callee.property?.name==='addEventListener'&&(node.callee.object?.name===local||['document','window'].includes(node.callee.object?.name)||bindings.get(node.callee.object?.name)==='dom')&&node.arguments.length===2&&typeof node.arguments[0]?.value==='string'&&callback(node.arguments[1])
 const each=node=>{
  if(node?.type!=='CallExpression'||node.callee?.type!=='MemberExpression'||node.callee.computed||node.callee.property?.name!=='forEach'||!query(node.callee.object)||node.callee.object.callee.property.name!=='querySelectorAll'||node.arguments.length!==1)return false
  const fn=node.arguments[0];if(!functionNode(fn)||fn.async||fn.generator||fn.params.length!==1||fn.params[0].type!=='Identifier')return false
  // The declared optional widget callback is not evaluated when its literal
  // class query has no native nodes. Count raw DOM nodes including hidden
  // ancestors; visibility never establishes this empty-query proof.
  const selector=node.callee.object.arguments[0].value,emptyClass=selector.match(/^\.([a-z_][\w-]*)$/i)
  const emptyNativeQuery=emptyClass&&!all(nativeTree,node=>has(node,emptyClass[1])).length
  return Boolean(emptyNativeQuery)||listener(expressionBody(fn),fn.params[0].name)
 }
 const initialize=node=>node?.type==='CallExpression'&&node.callee?.name==='GLightbox'&&node.arguments.length===1&&node.arguments[0].type==='ObjectExpression'&&node.arguments[0].properties.length===1&&node.arguments[0].properties[0].type==='Property'&&!node.arguments[0].properties[0].computed&&node.arguments[0].properties[0].key?.name==='selector'&&typeof node.arguments[0].properties[0].value?.value==='string'
 const statement=node=>{
  if(node.type==='FunctionDeclaration'){if(!node.id||protectedNames.has(node.id.name))return false;bindings.set(node.id.name,'function');return true}
  if(node.type==='VariableDeclaration')return node.declarations.every(declaration=>{if(declaration.id?.type!=='Identifier'||protectedNames.has(declaration.id.name))return false;const kind=literal(declaration.init)?'literal':query(declaration.init)?'dom':initialize(declaration.init)?'initializer':null;if(!kind)return false;bindings.set(declaration.id.name,kind);return true})
  if(node.type==='ExpressionStatement')return literal(node.expression)||listener(node.expression)||each(node.expression)||node.expression?.type==='NewExpression'&&node.expression.callee?.name==='PureCounter'&&node.expression.arguments.length===0
  if(node.type==='BlockStatement')return node.body.every(statement)
  return node.type==='IfStatement'&&node.test?.type==='Identifier'&&bindings.get(node.test.name)==='dom'&&statement(node.consequent)&&(!node.alternate||statement(node.alternate))
 }
 return statements.every(statement)
}
const unshadowedOwner=owner=>{
 const protectedNames=new Set(['document','window','GLightbox','PureCounter'])
 const inspect=node=>{
  if(!node||typeof node!=='object')return true
  if(node.type==='FunctionDeclaration')return Boolean(node.id)&&!protectedNames.has(node.id.name)
  if(functionNode(node))return true
  if(node.type==='VariableDeclarator'&&(node.id.type!=='Identifier'||protectedNames.has(node.id.name)))return false
  return Object.values(node).every(value=>Array.isArray(value)?value.every(inspect):!value||typeof value!=='object'||inspect(value))
 }
 return inspect(owner.body)
}
const clientProof=(javascript,html)=>{
 const ast=parse(javascript,{ecmaVersion:'latest'}),nodes=[],parents=new Map(),walk=(node,parent)=>{if(!node||typeof node!=='object')return;nodes.push(node);if(parent)parents.set(node,parent);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,node));else if(value&&typeof value==='object')walk(value,node)};walk(ast)
 const queries=nodes.filter(node=>node.type==='CallExpression'&&member(node.callee,'document','querySelectorAll')&&node.arguments.length===1&&node.arguments[0]?.type==='Literal'&&typeof node.arguments[0].value==='string'&&node.arguments[0].value.split(',').map(value=>value.trim()).sort().join(',')==='.faq-item .faq-header,.faq-item .faq-toggle,.faq-item h3')
 if(queries.length!==1)return false
 const query=queries[0],forEachMember=parents.get(query),forEach=parents.get(forEachMember),callback=forEach?.arguments?.[0]
 if(forEachMember?.type!=='MemberExpression'||forEachMember.computed||forEachMember.property?.name!=='forEach'||forEach?.type!=='CallExpression'||forEach.arguments.length!==1||callback?.type!=='ArrowFunctionExpression'||callback.async||callback.params.length!==1||callback.params[0].type!=='Identifier')return false
 const name=callback.params[0].name,listen=expressionBody(callback),click=listen?.arguments?.[1]
 if(listen?.type!=='CallExpression'||!member(listen.callee,name,'addEventListener')||listen.arguments.length!==2||listen.arguments[0]?.value!=='click'||click?.type!=='ArrowFunctionExpression'||click.async||click.params.length!==0)return false
 const toggle=expressionBody(click),callee=toggle?.callee,classes=callee?.object,parent=classes?.object
 if(toggle?.type!=='CallExpression'||toggle.arguments.length!==1||toggle.arguments[0]?.value!=='faq-active'||callee?.computed||callee?.property?.name!=='toggle'||classes?.computed||classes?.property?.name!=='classList'||!member(parent,name,'parentNode'))return false
 let owner=parents.get(forEach);while(owner&&!functionNode(owner))owner=parents.get(owner)
 const statement=parents.get(forEach),position=owner?.body?.body?.indexOf(statement),invocation=parents.get(owner)
 if(!owner||owner.async||owner.generator||owner.params.length!==0||['document','window','GLightbox','PureCounter'].includes(owner.id?.name)||owner.body.type!=='BlockStatement'||statement?.type!=='ExpressionStatement'||statement.expression!==forEach||position<0||invocation?.type!=='CallExpression'||invocation.callee!==owner||invocation.arguments.length!==0||ast.body.length!==1||ast.body[0].type!=='ExpressionStatement'||ast.body[0].expression!==invocation)return false
 return unshadowedOwner(owner)&&finiteOwnerWork(owner.body.body,html)
}

export const qualifyFaqRendering=(html,css,javascript)=>{
 try{
  if(!advertisedFaqAssets(html)||!clientProof(javascript,html))return {qualified:false,html,css,reason:'unqualified-native-accordion-client-binding'}
  const openedCSS=cssProof(css);if(openedCSS==null)return {qualified:false,html,css,reason:'unqualified-applicable-native-opened-state-CSS'}
  const doc=sourceDocument(html),scopes=doc.nodes(node=>node.tag==='section'&&node.attrs.id==='faq'&&has(node,'faq'))
  if(scopes.length!==1)return {qualified:false,html,css,reason:'unqualified-native-FAQ-scope'}
  const cards=doc.nodes(node=>has(node,'faq-item'),scopes[0]),changes=[]
  for(const card of cards){const headers=doc.nodes(node=>has(node,'faq-header'),card);if(headers.length!==1||!card.children.includes(headers[0]))return {qualified:false,html,css,reason:'unqualified-native-header-parent-binding'}
   const attrs={...card.attrs,class:[...(card.attrs.class||'').split(/\s+/).filter(Boolean),'faq-active'].filter((value,index,array)=>array.indexOf(value)===index).join(' ')}
   changes.push({start:card.start,end:card.openEnd,value:'<'+card.tag+Object.entries(attrs).map(([key,value])=>' '+key+'="'+escape(value)+'"').join('')+'>'})
  }
  changes.sort((a,b)=>b.start-a.start);let projected=html;for(const change of changes)projected=projected.slice(0,change.start)+change.value+projected.slice(change.end)
  return {qualified:true,html:projected,css:openedCSS,reason:'exact-native-header-toggle-and-applicable-opened-state-rules',qualification:'Reachable native expanded state, not a claim that collapsed text is initially visible'}
 }catch{return {qualified:false,html,css,reason:'unsupported-native-accordion-contract'}}
}
