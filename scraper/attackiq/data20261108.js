import {parse,parseExpressionAt} from 'acorn'
import {decodeHTML as decode,decodeHTMLAttribute} from 'entities/decode'
// Source-owned nonexecuting reader retains original offsets and authored slices.
function rawDocument(html) {
 if(typeof html!=='string')throw Error('AttackIQ native HTML unavailable')
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
  const node={tag,attrs,children:[],start:token.index,openEnd:cursor,parentTag:parent.tag,authorityInactive:Boolean(parent.authorityInactive||inactive||['template','noscript','iframe','noembed','noframes'].includes(tag)),inactive:parent.inactive||inactive||tag==='template'||raw.has(tag)&&tag!=='script'};parent.children.push(node)
  if(raw.has(tag)){const end=new RegExp(`</${tag}\\s*>`,'ig');end.lastIndex=cursor;const close=tag==='plaintext'?null:end.exec(html);node.raw=html.slice(cursor,close?.index??html.length);node.closeStart=close?.index??html.length;node.end=close?end.lastIndex:html.length;cursor=node.end;tokens.lastIndex=cursor}
  else if(!voids.has(tag))stack.push(node);else{node.closeStart=cursor;node.end=cursor}
 }
 if(cursor<html.length)stack.at(-1).children.push(html.slice(cursor))
 const nodes=(predicate,node=root)=>node.inactive?[]:[...(predicate(node)?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>nodes(predicate,c))]
 const text=node=>!node||node.inactive||node.tag==='script'?'':node.children.map(c=>typeof c==='string'?decode(c):text(c)).join(' ').replace(/\s+/g,' ').trim()
 const inner=node=>{if(!Number.isInteger(node.closeStart))throw Error('AttackIQ native unclosed content');return html.slice(node.openEnd,node.closeStart)}
 const outer=node=>{if(!Number.isInteger(node.end))throw Error('AttackIQ native unclosed element');return html.slice(node.start,node.end)}
 return{root,nodes,text,inner,outer,hasClass:(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)}
}



export const PRIMARY='https://www.attackiq.com/who-we-are/careers/',BOARD=PRIMARY+'openings/',HELPER='https://app.jazz.co/widgets/basic/create/AttackIQ'
const norm=v=>String(v??'').replace(/\s+/g,' ').trim(),children=n=>n.children.filter(v=>typeof v==='object'),all=(n,p)=>[...(p(n)?[n]:[]),...children(n).flatMap(c=>all(c,p))],nodes=d=>all(d.root,()=>true),has=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c),script=n=>n.raw??n.children.filter(v=>typeof v==='string').join('')
const text=n=>typeof n==='string'?norm(decode(n)):['script','style','template','noscript'].includes(n.tag)?'':norm(n.raw===undefined?n.children.map(text).join(' '):decode(n.raw))
const carrier=(d,n)=>({attrs:{...n.attrs},nativeHTML:d.outer(n),authoredText:text(n),...(n.inactive?{inactive:true}:{})})
const head=d=>{const ns=nodes(d);return{titles:ns.filter(n=>n.tag==='title').map(text),canonicals:ns.filter(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical')).map(n=>n.attrs.href??null),metas:ns.filter(n=>n.tag==='meta').map(n=>({...n.attrs})),schemas:ns.filter(n=>n.tag==='script'&&(n.attrs.type??'').split(';')[0].trim().toLowerCase()==='application/ld+json').map(n=>({attrs:{...n.attrs},raw:script(n)}))}}
const rawText=n=>typeof n==='string'?norm(decode(n)):norm(n.raw===undefined?n.children.map(rawText).join(' '):decode(n.raw))
const inactiveContent=n=>all(n,v=>v.inactive&&!['script','style','noscript','title'].includes(v.tag)&&Boolean(rawText(v))).length>0
const message=e=>String(e?.message??e).slice(0,1024)
function strictJSON(raw){
 const value=JSON.parse(raw),tree=parseExpressionAt(raw,0,{ecmaVersion:'latest'});if(raw.slice(tree.end).trim())throw Error('Trailing native JSON expression')
 const pending=[tree];while(pending.length){const n=pending.pop();if(n.type==='ObjectExpression'){const keys=new Set();for(const p of n.properties){if(p.type!=='Property'||p.computed||p.kind!=='init')throw Error('Executable native property');const key=p.key.type==='Identifier'?p.key.name:String(p.key.value);if(keys.has(key))throw Error('Duplicate native JSON property');keys.add(key);pending.push(p.value)}}else if(n.type==='ArrayExpression')pending.push(...n.elements);else if(n.type==='Literal'){if(typeof n.value==='number'&&!Number.isFinite(n.value))throw Error('Nonfinite native number')}else if(n.type==='UnaryExpression'&&n.operator==='-')pending.push(n.argument);else throw Error('Native value is not JSON data')}
 return value
}
// A finite, nonexecuting activation contract; static strings are compared as
// data so quote style and template-vs-literal spelling cannot change authority.
const staticString=n=>n?.type==='Literal'&&typeof n.value==='string'?n.value:n?.type==='TemplateLiteral'&&n.expressions.length===0?n.quasis[0].value.cooked:null
const astShape=value=>{if(value===null||typeof value!=='object')return value;const literal=staticString(value);if(literal!==null)return{type:'StaticString',value:literal};if(Array.isArray(value))return value.map(astShape);return Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','raw'].includes(key)).map(([key,child])=>[key,astShape(child)]))}
const activationReference="var resumatorScript=document.currentScript; if(document.body && document.body?.contains(resumatorScript)){resumatorScript.insertAdjacentHTML('afterend','<div id=\"resumator-wrapper\"></div>');insertResumatorWrapper();}else{window.onload=function(){var body=document.body;body.insertAdjacentHTML('afterbegin','<div id=\"resumator-wrapper\"></div>');insertResumatorWrapper();};}"
const activationSignature=JSON.stringify(astShape(parse(activationReference,{ecmaVersion:'latest'}).body))
const hasSupportedActivation=(tree,functions)=>tree.body[0]?.type==='VariableDeclaration'&&tree.body[1]?.type==='IfStatement'&&functions.length===1&&tree.body.includes(functions[0])&&JSON.stringify(astShape(tree.body.slice(0,2)))===activationSignature&&tree.body.slice(2).every((node,index,list)=>node.type==='FunctionDeclaration'||node.type==='IfStatement'&&index===list.length-1)
function inactiveIdentityHead(d){
 const ns=nodes(d),heads=ns.filter(n=>n.tag==='head'),identity=ns.filter(n=>n.tag==='title'||n.tag==='link'&&(n.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical')||n.tag==='meta'&&(n.attrs.property??'').toLowerCase()==='og:url')
 if(heads.length!==1||heads[0].parentTag!=='html'||heads[0].authorityInactive)return true
 const descendants=new Set(all(heads[0],()=>true));return identity.some(n=>!descendants.has(n)||n.authorityInactive)
}

export function parsePrimary(html,url=PRIMARY){
 const d=rawDocument(html),ns=nodes(d),handoffs=ns.filter(n=>n.tag==='a'&&(n.attrs.href===BOARD||['Explore Open Opportunities','Apply with AttackIQ Today'].includes(text(n)))),nativeHandoffs=handoffs.map(n=>{let target=null;try{if(n.attrs.href)target=new URL(n.attrs.href,url).href}catch{}return{...carrier(d,n),url:target}}),value={sourcePage:url,head:head(d),nativeHeadings:ns.filter(n=>n.tag==='h1').map(n=>({tag:n.tag,...carrier(d,n)})),nativeHandoffs}
 if(handoffs.some(inactiveContent))value.parseFailures=[{name:'handoff',message:'Inactive native company handoff'}];if(inactiveIdentityHead(d))(value.parseFailures??=[]).push({name:'head',message:'Inactive or misplaced native head identity'});return value
}
export function parseBoard(html,url=BOARD){
 const d=rawDocument(html),ns=nodes(d),scripts=ns.filter(n=>n.tag==='script'&&(n.attrs.src??'').includes('jazz.co')),nativeRecruitmentScripts=scripts.map(n=>({attrs:{...n.attrs},nativeHTML:d.outer(n)})),value={sourcePage:url,head:head(d),nativeHeadings:ns.filter(n=>n.tag==='h1').map(n=>({tag:n.tag,...carrier(d,n)})),nativeRecruitmentScripts}
 if(scripts.some(n=>n.inactive||n.attrs.src!==HELPER||!['text/javascript','application/javascript',''].includes((n.attrs.type??'').trim().toLowerCase())))value.parseFailures=[{name:'helper',message:'Inactive or foreign native recruitment declaration'}];if(inactiveIdentityHead(d))(value.parseFailures??=[]).push({name:'head',message:'Inactive or misplaced native head identity'});return value
}
export function parseHelper(source,url=HELPER){
 const value={sourcePage:url,nativeInsertions:[],nativeWidgetCarriers:[],records:[]},errors=[]
 try{
  if(typeof source!=='string'||source.length>524288)throw Error('Native helper size bound')
  const tree=parse(source,{ecmaVersion:'latest'}),functions=[],calls=[],bindings=[],writes=[];let count=0
  const walk=(n,ancestors=[])=>{
   if(!n||typeof n!=='object')return;if(++count>50000||ancestors.length>160)throw Error('Native helper AST bound')
   if(n.type==='FunctionDeclaration'&&n.id?.name==='insertResumatorWrapper')functions.push(n)
   if(n.type==='VariableDeclarator'&&n.id?.name==='resumatorWrapper')bindings.push(n)
   if(n.type==='AssignmentExpression'&&(['resumatorWrapper','insertResumatorWrapper'].includes(n.left?.name)||['resumatorWrapper','insertResumatorWrapper'].includes(n.left?.property?.name)))writes.push(n)
   if(n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&!n.callee.computed&&n.callee.property.name==='insertAdjacentHTML')calls.push({node:n,ancestors})
   for(const child of Object.values(n))if(Array.isArray(child))for(const c of child){if(c?.type)walk(c,[...ancestors,n])}else if(child?.type)walk(child,[...ancestors,n])
  };walk(tree)
  if(!hasSupportedActivation(tree,functions))errors.push({name:'activation',message:'Unsupported or dormant native widget activation'})
  const string=n=>n?.type==='Literal'&&typeof n.value==='string'?n.value:n?.type==='TemplateLiteral'&&n.expressions.length===0?n.quasis[0].value.cooked:null
  for(const{node:n,ancestors}of calls){const receiver=n.callee.object?.name,placement=string(n.arguments[0]),html=string(n.arguments[1]);if(!receiver||n.arguments.length!==2||placement===null||html===null)throw Error('Executable or ambiguous native HTML insertion');value.nativeInsertions.push({receiver,placement,nativeJavaScript:source.slice(n.start,n.end),nativeHTMLLiteral:html});const d=rawDocument(html),widgetNodes=nodes(d).filter(node=>node.attrs.id==='resumator-widget'),ownedNodes=new Set(widgetNodes.flatMap(node=>all(node,()=>true))),insertionOwned=receiver==='resumatorWrapper'&&placement==='beforeend'&&functions.includes(ancestors.findLast(v=>v.type==='FunctionDeclaration'))&&ancestors.at(-2)===functions[0]?.body
   for(const node of nodes(d)){
    if(node.attrs.id==='resumator-widget'){value.nativeWidgetCarriers.push({insertionOrdinal:value.nativeInsertions.length-1,...carrier(d,node)});if(receiver!=='resumatorWrapper'||placement!=='beforeend'||!functions.includes(ancestors.findLast(v=>v.type==='FunctionDeclaration'))||ancestors.at(-2)!==functions[0]?.body||node.inactive)errors.push({name:'widget',message:'Inactive or unreviewed native widget insertion authority'})}
    if(has(node,'resumator-job')){if(widgetNodes.length!==1||!ownedNodes.has(node)||!insertionOwned)errors.push({name:'row-ownership',message:'Native row does not belong to the authorized widget insertion'});const ts=all(node,v=>has(v,'resumator-job-title')),infos=all(node,v=>has(v,'resumator-job-info')),links=all(node,v=>v.tag==='a'&&Object.hasOwn(v.attrs,'href'));if(inactiveContent(node))errors.push({name:'posting',message:'Inactive native posting row'});value.records.push({nativeObservationOrdinal:value.records.length,attrs:{...node.attrs},nativeHTML:d.outer(node),nativeTitleCarriers:ts.map(v=>carrier(d,v)),nativeInfoCarriers:infos.map(v=>carrier(d,v)),links:links.map(v=>({attrs:{...v.attrs},nativeHTML:d.outer(v),text:text(v),url:new URL(v.attrs.href,url).href}))})}
   }
  }
  const fn=functions[0],binding=bindings[0],validBinding=binding?.init?.type==='CallExpression'&&binding.init.callee?.object?.name==='document'&&binding.init.callee?.property?.name==='getElementById'&&binding.init.arguments.length===1&&string(binding.init.arguments[0])==='resumator-wrapper'
  if(functions.length!==1||bindings.length!==1||!validBinding||writes.length||!fn.body.body.every(n=>n.type==='VariableDeclaration'&&n.declarations.length===1&&n.declarations[0]===binding||n.type==='ExpressionStatement'&&calls.some(v=>v.node===n.expression)))errors.push({name:'helper',message:'Unreviewed competing or conditional native widget authority'})
  if(value.nativeWidgetCarriers.length!==1)errors.push({name:'widget',message:'Missing or competing native widget carriers'})
 }catch(e){errors.push({name:'helper-data',message:message(e)})}
 if(errors.length)value.parseFailures=errors;return value
}
export function parseDetail(html,url){
 const d=rawDocument(html),ns=nodes(d),nativeSchemaCarriers=[],nativeOrganizationRecords=[],errors=[]
 if(inactiveIdentityHead(d))errors.push({name:'head',message:'Inactive or misplaced own head identity'})
 for(const n of ns.filter(n=>n.tag==='script'&&(n.attrs.type??'').split(';')[0].trim().toLowerCase()==='application/ld+json')){const rawJSON=script(n),c={attrs:{...n.attrs},nativeHTML:d.outer(n),rawJSON,value:null};try{c.value=strictJSON(rawJSON);if(c.value?.['@type']==='Organization')nativeOrganizationRecords.push(c.value);else errors.push({name:'schema',message:'Unreviewed native structured posting contract'})}catch(e){errors.push({name:'schema-data',message:message(e)})}if(n.inactive||Object.hasOwn(n.attrs,'src'))errors.push({name:'schema-carrier',message:'Inactive native organization claim'});nativeSchemaCarriers.push(c)}
 const headers=ns.filter(n=>has(n,'job-header')),titles=headers.flatMap(n=>all(n,v=>v.tag==='h2')),metadata=ns.filter(n=>has(n,'job-attributes-container')),attributes=metadata.flatMap(n=>children(n).filter(v=>v.tag==='div')),descriptions=ns.filter(n=>n.attrs.id==='job-description'),inactive=[...headers,...titles,...metadata,...descriptions].some(inactiveContent),fullCriteriaText=norm(descriptions.map(text).join(' '))
 if(inactive)errors.push({name:'posting',message:'Inactive native title metadata or criteria'})
 const value={sourcePage:url,head:head(d),nativeSchemaCarriers,nativeOrganizationRecords,nativeBodyClaims:ns.filter(n=>n.tag==='body').map(n=>({attrs:{...n.attrs}})),nativeHeaders:headers.map(n=>carrier(d,n)),nativeTitleCarriers:titles.map(n=>carrier(d,n)),nativeMetadataCarriers:metadata.map(n=>carrier(d,n)),nativeAttributeRecords:attributes.map(n=>carrier(d,n)),nativeDescriptionCarriers:descriptions.map(n=>carrier(d,n)),fullCriteriaText,nativeAuthoredCriteriaAvailable:descriptions.length>0&&descriptions.every(n=>Boolean(text(n)))&&!inactive}
 if(errors.length)value.parseFailures=errors;return value
}
