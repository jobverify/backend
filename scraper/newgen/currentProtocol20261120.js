import {parse} from 'acorn'
import {analyzeNativeScopes} from './currentLexicalScope20261120.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {need,one} from './currentFacts20261120.js'
const ORIGIN='https://omnirecruit.newgen.co.in',TOKEN='NATIVE_ROLE_KEY_TOKEN',nodeList=(n,p)=>!n||typeof n!=='object'?[]:[...(p(n)?[n]:[]),...Object.entries(n).filter(([k])=>!['start','end','range','loc'].includes(k)).flatMap(([,v])=>Array.isArray(v)?v.flatMap(x=>nodeList(x,p)):nodeList(v,p))]
const parseJS=raw=>{try{return parse(raw,{ecmaVersion:'latest',sourceType:'script',ranges:true})}catch(cause){throw Object.assign(Error('Current native application programme syntax differs',{cause}),{abortRetries:true,nativeContradiction:true,failureKind:'parser_or_contract_error'})}}
function handlerModel(onclick){need(typeof onclick==='string'&&onclick.length<=500,'native application handler absent/excessive');const fn=one(parseJS('function nativeHandler(){'+onclick+'}').body,'authored native handler wrapper'),statement=one(fn.body.body,'native handler action'),call=statement.argument;need(statement.type==='ReturnStatement'&&call?.type==='CallExpression'&&call.callee.type==='Identifier'&&call.arguments.length===1,'native Apply handler disconnected');const encoded=call.arguments[0];need(encoded.type==='CallExpression'&&encoded.callee.type==='Identifier'&&encoded.callee.name==='encodeURIComponent'&&encoded.arguments.length===1,'native role key is not explicitly URI encoded');const role=encoded.arguments[0];need(role.type==='Literal'&&typeof role.value==='string'&&role.value.length>0&&role.value.length<=120&&!/[\s\u0000-\u001f]/.test(role.value),'native literal application role key malformed');return{handlerName:call.callee.name,applicationRoleKey:role.value,originalOnclick:onclick}}
function program(raw,ast=parseJS(raw),lexical=analyzeNativeScopes(ast)){
 const{bindings,manager}=lexical
 const initializer=n=>{const v=n?.type==='Identifier'?bindings.get(n):null;if(!v||v.defs.length!==1||v.references.some(r=>r.isWrite()&&!r.init))return null;return v.defs[0].node.type==='VariableDeclarator'?v.defs[0].node.init:null}
 const resolve=(n,depth=0)=>depth>8?null:initializer(n)?resolve(initializer(n),depth+1):n
 const literal=n=>{const value=resolve(n);return value?.type==='Literal'?value.value:value?.type==='TemplateLiteral'&&value.expressions.length===0?value.quasis[0].value.cooked:null}
 const member=n=>n?.type==='MemberExpression'?(n.computed?literal(n.property):n.property.name):null
 const global=n=>{const value=resolve(n);return value?.type==='ThisExpression'?lexical.at.get(value)?.thisGlobal===true:value?.type==='Identifier'&&['window','globalThis','self'].includes(value.name)&&!bindings.has(value)}
 return{ast,manager,bindings,resolve,literal,member,global,raw}
}
function semantic(fn,p){need(fn.params.length===1&&fn.params[0].type==='Identifier','native application function parameter changed');const param=p.bindings.get(fn.params[0]),catchNode=nodeList(fn,n=>n.type==='CatchClause')[0],caught=catchNode?.param?.type==='Identifier'?p.bindings.get(catchNode.param):null,own=p.bindings.get(fn.id);need(param&&caught&&own&&!param.references.some(r=>r.isWrite()&&!r.init),'native application key binding changed');const strings=nodeList(fn,n=>n.type==='Literal'&&typeof n.value==='string');need(strings.length===2,'native application constructor literal shape changed');const [prefix,suffix]=strings,fragment=document(prefix.value+TOKEN+suffix.value),anchor=one(fragment.nodes(n=>n.tag==='a'),'native declared application anchor');need(fragment.nodes(n=>n.tag!=='root').length===1&&!anchor.attrs.onclick,'native application constructor ownership differs');const url=new URL(anchor.attrs.href,ORIGIN);need(url.origin===ORIGIN&&url.pathname==='/CandidateRegistration/CandidateRegistration.aspx'&&!url.username&&!url.password&&!url.hash&&[...url.searchParams].length===1&&url.searchParams.get('JobExternalUsers')===TOKEN,'native application account/path/query changed');const normalize=n=>{if(Array.isArray(n))return n.map(v=>normalize(v));if(!n||typeof n!=='object')return n;if(n===prefix)return{type:'Literal',value:'NATIVE_ANCHOR_PREFIX'};if(n===suffix)return{type:'Literal',value:'NATIVE_ANCHOR_SUFFIX'};if(n.type==='Identifier'){const v=p.bindings.get(n);return{type:'Identifier',name:v===param?'ROLE_KEY':v===caught?'CAUGHT_ERROR':v===own?'APPLICATION_CALLBACK':n.name}}return Object.fromEntries(Object.entries(n).filter(([k])=>!['start','end','range','loc','raw'].includes(k)).map(([k,v])=>[k,normalize(v)]))};return{model:normalize(fn),prefix:prefix.value,suffix:suffix.value,originalAnchorAttributes:structuredClone(anchor.attrs),template:url.href,originalFunction:p.raw.slice(fn.start,fn.end)}}
const expectedProgram=program('function nativeApply(role){try{$(\'<a href="/CandidateRegistration/CandidateRegistration.aspx?JobExternalUsers=\'+role+\'" target="blank"></a>\')[0].click();}catch(error){}}'),expected=semantic(expectedProgram.ast.body[0],expectedProgram).model
function qualifyGlobalCalls(current,protectedNames){
 const owner=node=>{const value=current.resolve(node);if(value?.type==='Identifier'&&!current.bindings.has(value)&&['Object','Reflect'].includes(value.name))return value.name;if(value?.type==='MemberExpression'&&current.global(value.object)&&['Object','Reflect'].includes(current.member(value)))return current.member(value);return null}
 const keys=(input,depth=0)=>{need(depth<=8,'finite native global object spread budget exceeded');const value=current.resolve(input);need(value?.type==='ObjectExpression','unqualified native global object mutation source');return value.properties.flatMap(property=>{if(property.type==='SpreadElement')return keys(property.argument,depth+1);need(property.type==='Property','native global object mutation property malformed');const name=property.computed?current.literal(property.key):property.key.type==='Identifier'?property.key.name:property.key.value;need(typeof name==='string','unqualified computed native global object key');return[name]})}
 function qualify(callee,args,depth=0){
  need(depth<=8,'finite native global method indirection budget exceeded');callee=current.resolve(callee)
  if(callee?.type==='CallExpression'){const binder=current.resolve(callee.callee);if(binder?.type==='MemberExpression'&&current.member(binder)==='bind')qualify(binder.object,[...callee.arguments.slice(1),...args],depth+1);return}
  if(callee?.type!=='MemberExpression')return
  const namespace=owner(callee.object),method=current.member(callee)
  if(namespace==='Reflect'&&method==='apply'){
   const values=current.resolve(args[2]);if(values?.type==='ArrayExpression'&&values.elements.every(Boolean)&&!values.elements.some(value=>value.type==='SpreadElement'))qualify(args[0],values.elements,depth+1)
   return
  }
  if(['call','apply'].includes(method)&&['MemberExpression','CallExpression'].includes(current.resolve(callee.object)?.type)){
   if(method==='call')qualify(callee.object,args.slice(1),depth+1)
   else{const values=current.resolve(args[1]);if(values?.type==='ArrayExpression'&&values.elements.every(Boolean)&&!values.elements.some(value=>value.type==='SpreadElement'))qualify(callee.object,values.elements,depth+1)}
   return
  }
  if(!namespace||!current.global(args[0]))return
  if(namespace==='Object'&&['assign','defineProperties'].includes(method))for(const value of args.slice(1))need(keys(value).every(name=>!protectedNames.has(name)),'native callback/dependency overwritten by global object mutation')
  if(namespace==='Object'&&method==='defineProperty'||namespace==='Reflect'&&['set','defineProperty','deleteProperty'].includes(method)){
   const name=current.literal(args[1]);need(typeof name==='string'&&!protectedNames.has(name),'native callback/dependency overwritten by global property mutation')
  }
 }
 for(const call of nodeList(current.ast,node=>node.type==='CallExpression'))qualify(call.callee,call.arguments)
}
export function readApplicationContract(html){
 const d=readNativeDocument(html),scripts=d.nodes(n=>n.tag==='script'&&!n.attrs.src&&!n.inactive&&!n.inert&&/^(?:|(?:application|text)\/javascript)$/i.test(n.attrs.type??'')),programs=[]
 for(const script of scripts){try{programs.push({...program(script.raw??''),script})}catch(error){if(/fRedirect|JobExternalUsers|CandidateRegistration/.test(script.raw??''))throw error}}
 const lexical=analyzeNativeScopes({type:'Program',body:programs.flatMap(value=>value.ast.body)})
 for(let index=0;index<programs.length;index++){const previous=programs[index];programs[index]={...program(previous.raw,previous.ast,lexical),script:previous.script}}
 function declaration(name){const matches=programs.flatMap(p=>p.ast.body.filter(n=>n.type==='FunctionDeclaration'&&n.id?.name===name).map(fn=>({fn,p}))),{fn,p}=one(matches,'unconditional native application callback definition'),variable=p.bindings.get(fn.id);need(variable?.defs.length===1&&!variable.references.some(r=>r.isWrite()&&!r.init),'native application callback overwritten');const model=semantic(fn,p);need(JSON.stringify(model.model)===JSON.stringify(expected),'native connected application function semantics changed')
  const protectedNames=new Set([name,'$','encodeURIComponent'])
  for(const current of programs){const active=current.ast;for(const v of current.manager.scopes.filter(s=>s.type==='global').flatMap(s=>s.variables))if(protectedNames.has(v.name))need(v.name===name&&v===variable,'native current global callback/dependency redeclared');for(const ref of current.manager.globalScope.through)if(protectedNames.has(ref.identifier.name))need(!ref.isWrite(),'native current global callback/dependency reassigned');for(const mutation of nodeList(active,n=>n.type==='AssignmentExpression'||n.type==='UpdateExpression'||n.type==='UnaryExpression'&&n.operator==='delete')){const target=mutation.left??mutation.argument;if(target?.type==='MemberExpression'&&current.global(target.object)){const name=current.member(target);need(name!=null&&!protectedNames.has(name),'native current callback/dependency owner overwritten or unqualified')}}
   qualifyGlobalCalls(current,protectedNames)
  }return{...model,scriptAttributes:structuredClone(p.script.attrs),originalProgram:p.raw,handlerName:name}
 }
 const cache=new Map()
 return{nativeProgramsExecuted:false,applicationFor(onclick){const handler=handlerModel(onclick);if(!cache.has(handler.handlerName))cache.set(handler.handlerName,declaration(handler.handlerName));const contract=cache.get(handler.handlerName),encoded=encodeURIComponent(handler.applicationRoleKey),url=contract.template.replace(TOKEN,encoded);return{...handler,url,nativeProgramsExecuted:false,originalFunction:contract.originalFunction,originalProgram:contract.originalProgram,originalScriptAttributes:contract.scriptAttributes,originalConstructedAnchorAttributes:contract.originalAnchorAttributes,declaredNativeURLTemplate:contract.template,semanticContractQualified:true,uiControlActivationVerified:false,backendActivationVerified:false}}}
}
