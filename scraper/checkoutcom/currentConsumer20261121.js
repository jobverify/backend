import {nativePrograms} from './currentLexical20261120.js'
import {scriptKind} from './currentScriptKind20261120.js'
import {normalizeInvocation} from './currentInvocations20261121.js'
import {need,one,all} from './currentFacts20261120.js'
import {carrier} from './currentConstraints20261121.js'
import {qualifyCurrentTemplateConsumer} from './currentTemplateConsumer20261127.js'

const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const children=node=>Object.entries(node??{}).filter(([name])=>!['start','end','raw','loc','range'].includes(name)).flatMap(([,value])=>(Array.isArray(value)?value:[value]).filter(value=>value&&typeof value==='object'&&typeof value.type==='string'))
const walk=node=>node?[node,...children(node).flatMap(walk)]:[]
const owned=node=>node?[node,...children(node).filter(child=>!functions.has(child.type)).flatMap(owned)]:[]
const arrayMutators=new Set(['push','pop','shift','unshift','splice','sort','reverse','copyWithin','fill'])
const reflection=new Set(['assign','defineProperty','defineProperties','set','deleteProperty','setPrototypeOf','freeze','seal','preventExtensions'])
const criticalGlobals=new Set(['fetch','document','Response','URLSearchParams','Array','String','Boolean','Number','Math','Function','Object','Reflect','Element','HTMLElement','Node','Document','EventTarget','window','globalThis','self'])
const unknown=Symbol('unqualified'),emptyArray=Symbol('empty-array'),textValue=Symbol('nonempty-text')

// This is a static, source-specific connected-flow witness. Original JavaScript
// is parsed, never imported, compiled, evaluated, or run in a browser/VM. It
// qualifies the successful default construction path and preserves the separate
// inactive input/click handlers as original source, without activating them.
export function qualifyCurrentConsumer(page,at,listingURL,proxyURL){
 const scripts=all(page.d.root,node=>node.tag==='script'&&!node.attrs.src&&scriptKind(node)&&!node.inactive&&!node.inert)
 const programs=nativePrograms(scripts.map(node=>({...node,originalNode:node,attrs:scriptKind(node)==='module'?{...node.attrs,type:'module'}:node.attrs})))
 const candidates=programs.filter(p=>p.nodes.some(node=>node.type==='Literal'&&node.value===proxyURL))
 const p=one(candidates,'actual own inline public-proxy programme');carrier(page,p.script.originalNode,at,{allowed:[listingURL]})
 const binding=node=>node?.type==='Identifier'?p.binding(node):null,resolve=node=>p.resolve(node),literal=node=>p.literal(node),member=node=>p.member(resolve(node))
 const same=(left,right)=>left===right||Boolean(binding(left)&&binding(left)===binding(right))
 const builtin=(node,name)=>{const value=resolve(node);return p.builtin(value,name)||value?.type==='MemberExpression'&&p.global(value.object)&&member(value)===name}
 const adapted={...p,builtin}
 const invocationArrays=new Set()
 const invoke=node=>node?.type==='CallExpression'?normalizeInvocation(adapted,node.callee,node.arguments,{onArray:array=>invocationArrays.add(array)}):null
 const property=(node,name)=>node?.type==='MemberExpression'&&member(node)===name
 const method=(node,name)=>{const call=invoke(node);return call&&property(call.callee,name)?call:null}
 const fn=node=>{const value=resolve(node);return functions.has(value?.type)?value:null}
 const owner=node=>{for(let cursor=p.parents.get(node);cursor;cursor=p.parents.get(cursor))if(functions.has(cursor.type))return cursor;return null}
 const initial=node=>{const value=binding(node);need(value?.defs.length===1,'current consumer binding is ambiguous');return value.defs[0].init}
 const fields=node=>{const value=resolve(node);need(value?.type==='ObjectExpression'&&value.properties.every(prop=>prop.type==='Property'&&!prop.computed&&prop.kind==='init'&&!prop.method),'current literal state has an unknown field/descriptor');const entries=value.properties.map(prop=>[prop.key.name??prop.key.value,prop.value]);need(new Set(entries.map(([key])=>key)).size===entries.length,'current literal state has duplicate fields');return Object.fromEntries(entries)}
 const declarations=parent=>owned(parent.body).filter(node=>node.type==='VariableDeclarator'&&node.id.type==='Identifier')
 const returns=parent=>parent.body.type==='BlockStatement'?owned(parent.body).filter(node=>node.type==='ReturnStatement'):[{argument:parent.body}]
 const result=parent=>one(returns(parent),'connected original function return').argument
 const defined=(parent,predicate,label)=>one(declarations(parent).filter(node=>predicate(node.init)),label)
 const calls=parent=>owned(parent.body??parent).filter(node=>node.type==='CallExpression').map(node=>({node,call:invoke(node)})).filter(row=>row.call)
 const localCall=(parent,target)=>one(calls(parent).filter(row=>fn(row.call.callee)===target),'connected original function invocation')
 const receiver=call=>call.thisValue??call.callee?.object
 const requireCall=(call,count)=>need(call&&!call.unknown&&call.args.length===count&&call.args.every(Boolean),'current critical invocation arguments are unresolved/sparse')
 const sameValue=(left,right,depth=0)=>{if(depth>16)return false;if(same(left,right))return true;const a=resolve(left),b=resolve(right);if(a===b)return true;if(a?.type==='MemberExpression'&&b?.type==='MemberExpression')return member(a)!=null&&member(a)===member(b)&&sameValue(a.object,b.object,depth+1);return['document','Array','String','URLSearchParams'].some(name=>builtin(a,name)&&builtin(b,name))}
 const nativeReceiver=call=>need(!call.thisValue||sameValue(call.thisValue,call.callee.object),'current native method uses an unrelated receiver')
 const propertyChain=(node,names)=>{let value=node;for(const name of [...names].reverse()){if(!property(value,name))return null;value=value.object}return value}
 const statePath=(node,root)=>{const names=[];let value=node;while(value?.type==='MemberExpression'){names.unshift(member(value));value=value.object}return same(value,root)?names:null}

 const fetchNode=one(p.nodes.filter(node=>{const call=invoke(node);return call&&builtin(call.callee,'fetch')&&call.args.length===1&&literal(call.args[0])===proxyURL}),'actual connected declared proxy fetch')
 const request=invoke(fetchNode);requireCall(request,1)
 const init=owner(fetchNode)
 if(init&&!init.async)return qualifyCurrentTemplateConsumer(page,at,listingURL,proxyURL,{programs,p,fetchNode,init})
 need(init?.async&&init.params.length===0,'current declared proxy initializer differs')
 const wrapper=owner(init);need(wrapper&&wrapper.params.length===0,'current original initializer is outside its own closure')
 const immediate=one(p.nodes.filter(node=>{const call=invoke(node);return call&&fn(call.callee)===wrapper}),'actual invoked own programme closure');requireCall(invoke(immediate),0)
 const response=defined(init,node=>node?.type==='AwaitExpression'&&node.argument===fetchNode,'original awaited proxy Response')
 const decoding=defined(init,node=>{if(node?.type!=='AwaitExpression')return false;const call=method(node.argument,'json');return call&&same(call.callee.object,response.id)},'original awaited same-Response JSON')
 requireCall(method(decoding.init.argument,'json'),0);nativeReceiver(method(decoding.init.argument,'json'))
 const jobsWrite=one(owned(init.body).filter(node=>node.type==='AssignmentExpression'&&property(node.left,'jobs')),'original complete proxy-record assignment')
 need(jobsWrite.operator==='='&&jobsWrite.left.object.type==='Identifier','current complete proxy state assignment differs')
 const state=jobsWrite.left.object,stateFields=fields(initial(state)),initialFilters=fields(stateFields.filters)
 need(stateFields.jobs?.type==='ArrayExpression'&&!stateFields.jobs.elements.length&&stateFields.filteredJobs?.type==='ArrayExpression'&&!stateFields.filteredJobs.elements.length,'current complete initial collection differs')
 need(initialFilters.locations?.type==='ArrayExpression'&&!initialFilters.locations.elements.length&&initialFilters.departments?.type==='ArrayExpression'&&!initialFilters.departments.elements.length&&literal(initialFilters.input)==='','current initial filters are active')
 const mapping=method(jobsWrite.right,'map');requireCall(mapping,1);nativeReceiver(mapping)
 const inputRecords=mapping.callee.object
 need(inputRecords?.type==='LogicalExpression'&&inputRecords.operator==='||'&&property(inputRecords.left,'jobs')&&same(inputRecords.left.object,decoding.id)&&inputRecords.right.type==='ArrayExpression'&&!inputRecords.right.elements.length,'current mapped jobs are not the original complete proxy data')
 const mapCallback=fn(mapping.args[0]);need(mapCallback?.params.length===1&&mapCallback.params[0].type==='Identifier','current proxy map callback differs')
 const mapped=result(mapCallback)
 need(mapped?.type==='ObjectExpression'&&mapped.properties.length===2&&mapped.properties[0].type==='SpreadElement'&&same(mapped.properties[0].argument,mapCallback.params[0])&&mapped.properties[1].type==='Property'&&!mapped.properties[1].computed&&(mapped.properties[1].key.name??mapped.properties[1].key.value)==='locations','current same-record mapping replaces a native role field')
 const locationProjection=resolve(mapped.properties[1].value),locationFilter=method(locationProjection,'filter');requireCall(locationFilter,1);nativeReceiver(locationFilter)
 need(builtin(locationFilter.args[0],'Boolean'),'current derived locations filter changes record metadata')
 const locationItems=resolve(locationFilter.callee.object)
 need(locationItems?.type==='ArrayExpression'&&locationItems.elements.length===2&&property(locationItems.elements[0],'location')&&same(locationItems.elements[0].object,mapCallback.params[0]),'current derived primary location is disconnected')
 const secondary=locationItems.elements[1]
 need(secondary?.type==='SpreadElement'&&secondary.argument.type==='LogicalExpression'&&secondary.argument.operator==='||'&&property(secondary.argument.left,'secondaryLocations')&&same(secondary.argument.left.object,mapCallback.params[0])&&secondary.argument.right.type==='ArrayExpression'&&!secondary.argument.right.elements.length,'current derived secondary locations are disconnected')

 const params=defined(init,node=>node?.type==='NewExpression'&&builtin(node.callee,'URLSearchParams'),'default configured URL parameters')
 need(params.init.arguments.length===1&&property(params.init.arguments[0],'search')&&property(params.init.arguments[0].object,'location')&&p.global(params.init.arguments[0].object.object)&&new URL(listingURL).search==='','current initial filter parameter source differs')
 const filterWrites=owned(init.body).filter(node=>node.type==='AssignmentExpression'&&statePath(node.left,state)?.[0]==='filters')
 need(filterWrites.length===3,'current initial filter settings are replaced/ambiguous')
 for(const[name,key]of[['locations','location'],['departments','department'],['input','search']]){
  const write=one(filterWrites.filter(node=>statePath(node.left,state)?.join('.')==='filters.'+name),'current default '+name+' assignment');need(write.operator==='=','current default filter assignment differs')
  const expression=name==='input'?write.right.left:write.right,call=method(expression,name==='input'?'get':'getAll');requireCall(call,1)
  nativeReceiver(call);need(same(call.callee.object,params.id)&&literal(call.args[0])===key,'current default parameter selection differs')
  if(name==='input')need(write.right.type==='LogicalExpression'&&write.right.operator==='||'&&literal(write.right.right)==='','current input fallback activates a filter')
 }
 const filterWrite=one(p.nodes.filter(node=>node.type==='AssignmentExpression'&&statePath(node.left,state)?.join('.')==='filteredJobs'),'connected filtered collection assignment')
 const apply=owner(filterWrite),filter=method(filterWrite.right,'filter');need(apply&&filterWrite.operator==='='&&statePath(filter?.callee.object,state)?.join('.')==='jobs','current rendered collection is not filtered from complete proxy jobs');requireCall(filter,1);nativeReceiver(filter)
 const predicate=fn(filter.args[0]);need(predicate?.params.length===1&&predicate.params[0].type==='Identifier','current default filter predicate differs')
 const query=defined(apply,node=>{const call=method(node,'toLowerCase');return call&&statePath(resolve(call.callee.object),state)?.join('.')==='filters.input'},'current original default search query')
 const known=(node,seen=new Set())=>{
  if(!node||seen.has(node))return unknown;const next=new Set(seen);next.add(node)
  if(node.type==='Literal')return node.value
  if(node.type==='ArrayExpression'&&!node.elements.length)return emptyArray
  if(same(node,query.id))return''
  const path=statePath(node,state)??statePath(resolve(node),state)
  if(path?.join('.')==='filters.input')return''
  if(['filters.locations','filters.departments'].includes(path?.join('.')))return emptyArray
  if(node.type==='MemberExpression'){
   const value=known(node.object,next);if(member(node)==='length'&&value===emptyArray)return 0
   if(property(node,'title')&&same(node.object,predicate.params[0]))return textValue
   return unknown
  }
  if(node.type==='Identifier'){const value=resolve(node);return value!==node?known(value,next):unknown}
  if(node.type==='UnaryExpression'&&node.operator==='!'){const value=known(node.argument,next);return value===unknown?unknown:!value}
  if(node.type==='LogicalExpression'){
   const left=known(node.left,next);if(left===unknown)return unknown
   return node.operator==='&&'?(left?known(node.right,next):left):node.operator==='||'?(left?left:known(node.right,next)):unknown
  }
  const call=invoke(node)
  if(call&&!call.unknown&&property(call.callee,'toLowerCase')&&call.args.length===0){const value=known(call.callee.object,next);return value===''?'':value===textValue?textValue:unknown}
  if(call&&!call.unknown&&property(call.callee,'includes')&&call.args.length===1){const value=known(call.callee.object,next),search=known(call.args[0],next);return(value===textValue||typeof value==='string')&&search===''?true:unknown}
  return unknown
 }
 need(known(result(predicate))===true,'current default predicate does not retain every original role')

 const renderLoops=p.nodes.filter(node=>{const call=method(node,'forEach');return call&&statePath(call.callee.object,state)?.join('.')==='filteredJobs'})
 const renderLoop=one(renderLoops,'connected every-current-role DOM loop'),render=owner(renderLoop),rendering=method(renderLoop,'forEach');requireCall(rendering,1);nativeReceiver(rendering)
 const role=fn(rendering.args[0]);need(role?.params.length===1&&role.params[0].type==='Identifier','current same-role DOM callback differs')
 const create=(node,tag)=>{const call=method(node,'createElement');if(!call||!builtin(call.callee.object,'document')||literal(call.args[0])!==tag)return false;requireCall(call,1);need(!call.thisValue||builtin(call.thisValue,'document'),'current DOM factory receiver differs');return true}
 const anchor=defined(role,node=>create(node,'a'),'original same-role native application anchor')
 const roleWrites=owned(role.body).filter(node=>node.type==='AssignmentExpression')
 const href=one(roleWrites.filter(node=>property(node.left,'href')&&same(node.left.object,anchor.id)),'current unique application URI effect')
 need(href.operator==='='&&href.right.type==='LogicalExpression'&&href.right.operator==='||'&&property(href.right.left,'applyUrl')&&same(href.right.left.object,role.params[0])&&literal(href.right.right)==='#','current application anchor is not the same original role handoff')
 const title=one(roleWrites.filter(node=>property(node.left,'textContent')&&property(node.right,'title')&&same(node.right.object,role.params[0])),'original same-role title effect')
 need(title.operator==='='&&create(initial(title.left.object),'div'),'current title element is not a declared DOM element')
 const titleBinding=title.left.object
 const location=one(roleWrites.filter(node=>property(node.left,'textContent')&&node.right.type==='LogicalExpression'&&node.right.operator==='||'&&property(node.right.left,'location')&&same(node.right.left.object,role.params[0])&&literal(node.right.right)===''),'same-record advertised workplace effect')
 need(location.operator==='='&&create(initial(location.left.object),'div'),'current advertised workplace element differs')
 const id=one(roleWrites.filter(node=>property(node.left,'id')&&same(node.left.object,anchor.id)),'same-record native public role identity');need(id.operator==='='&&property(id.right,'id')&&same(id.right.object,role.params[0]),'current DOM native role ID differs')
 const selection=(parent)=>defined(parent,node=>{const call=method(node,'querySelector');return call&&builtin(call.callee.object,'document')},'actual current job-list selector')
 // The render also selects a distinct empty-state node. Select the one which
 // actually receives the same anchor, rather than depending on variable names.
 const appended=one(calls(role).filter(({call})=>property(call.callee,'appendChild')&&same(call.args[0],anchor.id)),'connected same-role anchor append')
 requireCall(appended.call,1);need(!appended.call.thisValue||same(appended.call.thisValue,appended.call.callee.object),'current job-list append receiver differs')
 const list=appended.call.callee.object,listInit=initial(list),listSelection=method(listInit,'querySelector');requireCall(listSelection,1);nativeReceiver(listSelection);need(builtin(listSelection.callee.object,'document'),'current list selection owner differs')
 const selector=literal(listSelection.args[0]);need(typeof selector==='string','current list selector is unresolved')
 const selectDOM=(value)=>{
  need(typeof value==='string','current declared DOM selector is unresolved');const match=/^([a-z][a-z\d-]*)?(?:#([\w-]+))?((?:\.[\w-]+)*)$/i.exec(value);need(match&&(match[1]||match[2]||match[3]),'current DOM selector needs new qualification');const classes=match[3].split('.').filter(Boolean)
  return one(all(page.d.root,node=>(!match[1]||node.tag===match[1].toLowerCase())&&(!match[2]||node.attrs.id===match[2])&&classes.every(value=>(node.attrs.class??'').split(/\s+/).includes(value))),'actual own declared DOM container')
 }
 const listNode=selectDOM(selector);carrier(page,listNode,at,{allowed:[listingURL]})
 const virtual=[]
 for(const[element,tag]of[[anchor.id,'a'],[titleBinding,'div'],[location.left.object,'div']]){
  const classWrite=one(roleWrites.filter(node=>property(node.left,'className')&&same(node.left.object,element)),'current declared DOM class');const className=literal(classWrite.right)
  need(classWrite.operator==='='&&typeof className==='string'&&!/(?:^|\s)(?:hidden|invisible|d-none|sr-only)(?:\s|$)/i.test(className),'current rendered role/title/workplace is hidden')
  virtual.push({tag,attrs:{class:className},children:[]})
 }
 const domAncestors=[];const findAncestors=(node,path=[])=>{if(node===listNode){domAncestors.push(...path,node);return true}return node.children.filter(child=>typeof child!=='string').some(child=>findAncestors(child,[...path,node]))};findAncestors(page.d.root)
 const matches=(node,value)=>{let token=value.trim(),tag=/^(\*|[a-z][a-z\d-]*)/i.exec(token);if(tag){if(tag[1]!=='*'&&node.tag!==tag[1].toLowerCase())return false;token=token.slice(tag[0].length)}let seen=Boolean(tag);while(token){const part=/^(?:#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([\w-]+)))?\])/.exec(token);if(!part)return false;seen=true;if(part[1]&&node.attrs.id!==part[1])return false;if(part[2]&&!(node.attrs.class??'').split(/\s+/).includes(part[2]))return false;if(part[3]){if(!Object.hasOwn(node.attrs,part[3]))return false;const expected=part[4]??part[5]??part[6];if(expected!=null&&node.attrs[part[3]]!==expected)return false}token=token.slice(part[0].length)}return seen}
 const criticalDOM=[...domAncestors,...virtual]
 const styles=[];const findStyles=(node,inert=false)=>{const blocked=inert||['template','noscript','iframe','object'].includes(node.tag);if(node.tag==='style'&&!blocked&&(!node.attrs.type||node.attrs.type.trim().toLowerCase()==='text/css')&&node.attrs.media!=='print')styles.push(node);for(const child of node.children)if(typeof child!=='string')findStyles(child,blocked)};findStyles(page.d.root)
 for(const style of styles)for(const rule of String(style.raw??'').replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  if(!/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(rule[2]))continue
  need(!rule[1].split(',').some(value=>{const terms=value.trim().split(/\s*>?\s+/);return criticalDOM.some(node=>matches(node,terms.at(-1)))&&(terms.length===1||terms.slice(0,-1).every(term=>criticalDOM.some(node=>matches(node,term))))}),'current declared role/title/list is withdrawn by an actual CSS rule')
 }
 const initSelection=selection(init),initSelected=method(initSelection.init,'querySelector');requireCall(initSelected,1);nativeReceiver(initSelected);need(literal(initSelected.args[0])===selector,'current initializer and renderer select different containers')
 const titleAppend=one(calls(role).filter(({call})=>property(call.callee,'appendChild')&&same(call.callee.object,anchor.id)&&same(call.args[0],titleBinding)),'connected original title append');requireCall(titleAppend.call,1);need(!titleAppend.call.thisValue||same(titleAppend.call.thisValue,anchor.id),'current title append receiver differs')
 const applyCall=localCall(init,apply),renderCall=localCall(init,render);requireCall(applyCall.call,0);requireCall(renderCall.call,0)
 need(jobsWrite.start<applyCall.node.start&&filterWrites.every(node=>node.start<applyCall.node.start)&&applyCall.node.start<renderCall.node.start&&title.start<titleAppend.node.start&&titleAppend.node.start<appended.node.start,'current original collection/filter/title/append order differs')

 const present=new Set([initSelection.id,list,titleBinding,anchor.id].map(binding))
 const truth=node=>{
  const knownValue=known(node);if(knownValue!==unknown)return knownValue
  if(node?.type==='Identifier'&&present.has(binding(node)))return true
  if(node?.type==='UnaryExpression'&&node.operator==='!'){const value=truth(node.argument);return value===unknown?unknown:!value}
  if(node?.type==='LogicalExpression'){const left=truth(node.left);return left===unknown?unknown:node.operator==='&&'?(left?truth(node.right):left):node.operator==='||'?(left?left:truth(node.right)):unknown}
  return unknown
 }
 const aborts=node=>{
  if(['ReturnStatement','ThrowStatement','BreakStatement','ContinueStatement'].includes(node.type))return true
  if(node.type==='BlockStatement')return node.body.some(aborts)
  if(node.type==='IfStatement'){const value=truth(node.test);return value===unknown?aborts(node.consequent)||Boolean(node.alternate&&aborts(node.alternate)):Boolean(value?aborts(node.consequent):node.alternate&&aborts(node.alternate))}
  if(['ForStatement','ForOfStatement','ForInStatement','WhileStatement','DoWhileStatement','SwitchStatement'].includes(node.type))return walk(node).some(child=>['ReturnStatement','ThrowStatement'].includes(child.type))
  return false
 }
 const reachable=(parent,target)=>{
  for(let child=target,ancestor=p.parents.get(child);ancestor&&child!==parent;child=ancestor,ancestor=p.parents.get(ancestor)){
   if(ancestor.type==='BlockStatement'||ancestor.type==='Program'){const index=ancestor.body.indexOf(child);if(index>=0)need(!ancestor.body.slice(0,index).some(aborts),'current connected operation is aborted before its effect')}
   if(ancestor.type==='IfStatement'&&child!==ancestor.test){const value=truth(ancestor.test);need(value!==unknown&&Boolean(value)===(child===ancestor.consequent),'current connected effect is conditional or unreachable')}
   if(ancestor.type==='LogicalExpression'){const value=truth(ancestor.left);need(child===ancestor.left||value!==unknown&&(ancestor.operator==='&&'?Boolean(value):!value),'current connected call is in a dead/unresolved conjunction')}
   if(ancestor.type==='ConditionalExpression'){const value=truth(ancestor.test);need(child===ancestor.test||value!==unknown&&Boolean(value)===(child===ancestor.consequent),'current connected call is conditional')}
   need(!['WhileStatement','ForStatement','ForInStatement','ForOfStatement','DoWhileStatement','SwitchCase'].includes(ancestor.type),'current connected effect has an unqualified loop/switch owner')
   if(ancestor.type==='TryStatement')need(child===ancestor.block&&!ancestor.finalizer,'current connected operation has an unqualified try/finally path')
  }
 }
 for(const[parent,target]of[[p.tree,immediate],[init,fetchNode],[init,decoding],[init,jobsWrite],[mapCallback,mapped],[apply,filterWrite],[predicate,one(returns(predicate),'original predicate return')],[init,applyCall.node],[init,renderCall.node],[render,renderLoop],[role,anchor],[role,href],[role,title],[role,titleAppend.node],[role,appended.node]])reachable(parent,target)
 const ready=one(owned(wrapper.body).filter(node=>node.type==='IfStatement'&&node.test.type==='BinaryExpression'&&['===','=='].includes(node.test.operator)&&((property(node.test.left,'readyState')&&builtin(node.test.left.object,'document')&&literal(node.test.right)==='loading')||(property(node.test.right,'readyState')&&builtin(node.test.right.object,'document')&&literal(node.test.left)==='loading'))),'actual current DOM-ready initialization path')
 const readyRegistration=one(calls(ready.consequent).filter(({call})=>property(call.callee,'addEventListener')&&builtin(call.callee.object,'document')&&literal(call.args[0])==='DOMContentLoaded'&&fn(call.args[1])===init),'actual registered same initializer')
 requireCall(readyRegistration.call,2);need(!readyRegistration.call.thisValue||builtin(readyRegistration.call.thisValue,'document'),'current DOM-ready registration receiver differs')
 const alreadyReady=one(calls(ready.alternate).filter(({call})=>fn(call.callee)===init),'actual already-ready initializer invocation');requireCall(alreadyReady.call,0)
 reachable(wrapper,ready);reachable(ready.consequent,readyRegistration.node);reachable(ready.alternate,alreadyReady.node)

 // Establish potentially active local callbacks, respecting dormant user input
 // events. A lexical function alone is not a construction effect. Parameters
 // passed critical objects are tracked separately from immutable local aliases.
 const active=new Map(programs.map(q=>[q,new Set()])),parameters=new Map(),thisReceivers=new Map(),programOf=new Map(),reflectionArrays=new Map(programs.map(q=>[q,new Set()]))
 for(const q of programs)for(const node of q.nodes)programOf.set(node,q)
 const qOwner=(q,node)=>{for(let cursor=q.parents.get(node);cursor;cursor=q.parents.get(cursor))if(functions.has(cursor.type))return cursor;return null}
 const qFn=(q,node)=>{const value=q.resolve(node);return functions.has(value?.type)?value:null}
 const qBuiltin=(q,node,name)=>q.builtin(node,name)||q.resolve(node)?.type==='MemberExpression'&&q.global(q.resolve(node).object)&&q.member(q.resolve(node))===name
 const qInvoke=(q,node)=>{const arrays=new Set(),call=normalizeInvocation({...q,builtin:(node,name)=>qBuiltin(q,node,name)},node.callee,node.arguments,{onArray:value=>arrays.add(value)});if(call&&reflection.has(q.member(call.callee))&&['Object','Reflect'].some(name=>qBuiltin(q,call.callee?.object,name)))for(const array of arrays)reflectionArrays.get(q).add(array);return call}
 const fixedTruth=(q,node)=>{if(!node)return unknown;if(q===p){const value=truth(node);if(value!==unknown)return value}const value=q.resolve(node);if(value?.type==='Literal')return value.value;if(value?.type==='UnaryExpression'&&value.operator==='!'){const child=fixedTruth(q,value.argument);return child===unknown?unknown:!child}return unknown}
 const impossible=(q,node)=>{
  for(let child=node,parent=q.parents.get(child);parent;child=parent,parent=q.parents.get(parent)){
   if(functions.has(parent.type))break
   if(parent.type==='IfStatement'&&child!==parent.test){const value=fixedTruth(q,parent.test);if(value!==unknown&&Boolean(value)!==(child===parent.consequent))return true}
   if(parent.type==='LogicalExpression'&&child===parent.right){const value=fixedTruth(q,parent.left);if(value!==unknown&&(parent.operator==='&&'?!value:Boolean(value)))return true}
   if(['WhileStatement','ForStatement'].includes(parent.type)&&child===parent.body&&parent.test){const value=fixedTruth(q,parent.test);if(value!==unknown&&!value)return true}
   if(parent.type==='BlockStatement'||parent.type==='Program'){const index=parent.body.indexOf(child);if(index>=0&&parent.body.slice(0,index).some(node=>['ReturnStatement','ThrowStatement'].includes(node.type)))return true}
   if(q===p&&parent.type==='CatchClause')return true
  }return false
 }
 const activeNode=(q,node)=>(!qOwner(q,node)||active.get(q).has(qOwner(q,node)))&&!impossible(q,node)
 const addParameter=(q,parameter,value)=>{if(parameter?.type!=='Identifier'||!value)return false;const key=q.binding(parameter);if(!parameters.has(key))parameters.set(key,new Set());const values=parameters.get(key);if(values.has(value))return false;need(values.size<64,'finite current parameter aliases exceeded');values.add(value);return true}
 for(let pass=0;pass<24;pass++){
  let changed=false
  for(const q of programs)for(const node of q.nodes){
   if(node.type!=='CallExpression'||!activeNode(q,node))continue;const call=qInvoke(q,node);if(!call)continue
   const target=qFn(q,call.callee)
   const add=target=>{const set=active.get(programOf.get(target)??q);if(!set.has(target)){set.add(target);changed=true}}
   if(target){add(target);target.params.forEach((parameter,index)=>{if(addParameter(q,parameter,call.args[index]))changed=true});if(!thisReceivers.has(target))thisReceivers.set(target,new Set());const values=thisReceivers.get(target),receiver=call.thisValue??null;if(!values.has(receiver)){values.add(receiver);changed=true}}
   const name=q.member(call.callee),event=call.args[0]&&q.literal(call.args[0])
   if(name==='addEventListener'&&typeof event==='string'&&!['DOMContentLoaded','load'].includes(event))continue
   for(const argument of call.args){const callback=qFn(q,argument);if(callback&&callback!==target){const collection=call.thisValue??call.callee?.object,value=q.resolve(collection);if(['map','filter','forEach','sort'].includes(name)&&(q===p&&known(collection)===emptyArray||value?.type==='ArrayExpression'&&!value.elements.length))continue;add(callback);if(['map','filter','forEach','sort'].includes(name)&&callback.params[0]){if(value?.type==='ArrayExpression'){for(const element of value.elements.filter(Boolean))if(addParameter(q,callback.params[0],element))changed=true}else{let elements=callback.currentStaticElements;if(!elements){elements={type:'MemberExpression',object:collection,property:{type:'Literal',value:0},computed:true};Object.defineProperty(callback,'currentStaticElements',{value:elements});programOf.set(elements,q)}if(addParameter(q,callback.params[0],elements))changed=true}}}}
  }
  if(!changed)break;need(pass<23,'finite current construction call graph exceeded')
 }
 const documentDependencies=new Set(['querySelector','querySelectorAll','getElementById','createElement','addEventListener','readyState','title','innerHTML','outerHTML','textContent','__proto__','prototype','constructor'])
 const domDependencies=new Set(['appendChild','append','prepend','remove','removeChild','replaceWith','replaceChildren','replaceChild','insertBefore','insertAdjacentHTML','setAttribute','setAttributeNS','removeAttribute','className','hidden','inert','href','textContent','innerHTML','outerHTML','__proto__','prototype','constructor'])
 const criticalPath=path=>{if(!path)return false;if(!path.length)return true;if(path[0]==='declared-list')return true;if(path[0]==='other-dom')return false;if(path[0]==='unresolved-dom')return path.slice(1).some(name=>name==null||domDependencies.has(name));if(path[0]==='document')return path.length===1||path.slice(1).some(name=>name==null||documentDependencies.has(name));if(path[0]==='location')return path.length===1||[null,'search','href','assign','replace','reload','__proto__','prototype','constructor'].includes(path[1]);return path[0]==null||criticalGlobals.has(path[0])||path[0]==='history'}
 const possibleLiterals=(q,node,seen=new Set())=>{
  if(!node||seen.has(node))return[];const next=new Set(seen);next.add(node);const direct=q.literal(node);if(direct!=null)return[direct]
  if(node.type==='Identifier'){const values=parameters.get(q.binding(node));if(values)return[...new Set([...values].flatMap(value=>possibleLiterals(programOf.get(value)??q,value,next)))];const value=q.resolve(node);return value!==node?possibleLiterals(programOf.get(value)??q,value,next):[]}
  if(node.type==='TemplateLiteral'){let values=[node.quasis[0].value.cooked];for(let index=0;index<node.expressions.length;index++){const parts=possibleLiterals(q,node.expressions[index],next);if(!parts.length)return[];values=values.flatMap(prefix=>parts.map(part=>prefix+part+node.quasis[index+1].value.cooked));need(values.length<=64,'finite current template dependency exceeded')}return values}
  if(node.type==='MemberExpression'&&node.computed){const value=q.resolve(node.object),keys=possibleLiterals(q,node.property,next);if(value?.type==='ArrayExpression')return keys.flatMap(key=>possibleLiterals(q,value.elements[key],next))}
  return[]
 }
 const parameterLiteral=(q,node)=>{const values=possibleLiterals(q,node);return values.length===1?values[0]:null}
 const queryTouches=value=>typeof value==='string'&&(value===selector||criticalDOM.some(node=>matches(node,value))||[...criticalDOM].some(node=>(node.attrs.class??'').split(/\s+/).filter(Boolean).some(name=>new RegExp('\\.'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:[^\\w-]|$)').test(value)))||listNode.attrs.id&&value.includes('#'+listNode.attrs.id))
 const globalPath=(q,node,seen=new Set())=>{
  if(!node||seen.has(node))return null;const next=new Set(seen);next.add(node)
  if(node.type==='Identifier'){
   const value=q.binding(node),aliases=parameters.get(value);if(aliases){const paths=[...aliases].map(parameter=>globalPath(programOf.get(parameter)??q,parameter,next));return paths.find(criticalPath)??paths.find(Boolean)??null}
   if(q.global(node))return[]
   if(!value&&criticalGlobals.has(node.name))return[node.name]
   const resolved=q.resolve(node);return resolved!==node?globalPath(programOf.get(resolved)??q,resolved,next):null
  }
  if(q.global(node))return[]
  if(node.type==='ThisExpression'){
   let parent=q.parents.get(node);while(parent&&(!functions.has(parent.type)||parent.type==='ArrowFunctionExpression'))parent=q.parents.get(parent)
   if(!parent)return q.module?null:[]
   const values=thisReceivers.get(parent);if(!values)return null
   const paths=[...values].map(value=>value?globalPath(programOf.get(value)??q,value,next):!q.module&&parent.body.type==='BlockStatement'&&!parent.body.body.some(statement=>statement.directive==='use strict')?[]:null);return paths.find(criticalPath)??paths.find(Boolean)??null
  }
  if(node.type==='MemberExpression'){const path=globalPath(q,node.object,next);return path?[...path,node.computed?parameterLiteral(q,node.property):node.property.name]:null}
  if(node.type==='CallExpression'){
   const call=qInvoke(q,node);if(!call)return null;const name=q.member(call.callee),receiverPath=globalPath(q,call.thisValue??call.callee?.object,next)
   if(['querySelector','querySelectorAll','getElementById'].includes(name)&&receiverPath){
    if(receiverPath[0]==='declared-list')return['declared-list']
    if(receiverPath[0]==='other-dom')return['other-dom']
    if(receiverPath[0]==='document'){const values=possibleLiterals(q,call.args[0]);if(!values.length)return['unresolved-dom'];return values.some(value=>name==='getElementById'?listNode.attrs.id&&value===listNode.attrs.id:queryTouches(value))?['declared-list']:['other-dom']}
   }
   if(name==='createElement'&&qBuiltin(q,call.callee?.object,'document'))return['other-dom']
   const local=qFn(q,call.callee)
   if(local){const ownProgram=programOf.get(local)??q,values=local.body.type==='BlockStatement'?owned(local.body).filter(node=>node.type==='ReturnStatement').map(node=>node.argument):[local.body],paths=values.map(value=>globalPath(ownProgram,value,next));return paths.find(criticalPath)??paths.find(Boolean)??null}
  }
  return null
 }
 const globalCritical=(q,node)=>criticalPath(globalPath(q,node))
 const targets=node=>node?.type==='ObjectPattern'?node.properties.flatMap(prop=>targets(prop.type==='RestElement'?prop.argument:prop.value)):node?.type==='ArrayPattern'?node.elements.flatMap(targets):node?.type==='AssignmentPattern'?targets(node.left):node?.type==='RestElement'?targets(node.argument):node?[node]:[]
 const criticalBindings=new Set([state,response.id,decoding.id,params.id,query.id,list,initSelection.id,titleBinding,location.left.object,anchor.id,mapCallback.params[0],predicate.params[0],role.params[0]].map(binding).filter(Boolean))
 const criticalInitializers=new Set([initial(state),initial(list),initial(titleBinding),anchor.init])
 const affected=(node,seen=new Set())=>{
  if(!node||seen.has(node))return false;const next=new Set(seen);next.add(node)
  if(node.type==='Identifier'&&criticalBindings.has(binding(node)))return true
  if(criticalInitializers.has(node)||invocationArrays.has(node))return true
  if(node.type==='MemberExpression'){const path=statePath(node,state);if(path?.[0]==='dropdowns')return false;return affected(node.object,next)}
  const value=resolve(node);return value!==node&&affected(value,next)
 }
 for(let pass=0;pass<16;pass++){let changed=false;for(const[key,values]of parameters)if(!criticalBindings.has(key)&&[...values].some(value=>(programOf.get(value)??p)===p&&affected(value))){criticalBindings.add(key);changed=true}if(!changed)break;need(pass<15,'finite current role/DOM argument dependencies exceeded')}
 const primitiveFields=new Set(['id','title','applyUrl','jobUrl','location','addressCountry','parentDepartment','team','length'])
 const objectEscape=node=>{const value=known(node);return value===null||['string','number','boolean'].includes(typeof value)||value===textValue||node?.type==='MemberExpression'&&primitiveFields.has(member(node))?false:affected(node)}
 const permitted=new Set([jobsWrite,filterWrite,...filterWrites,...roleWrites.filter(node=>{
  if(same(node.left,anchor.id)||same(node.left,titleBinding)||same(node.left,role.params[0]))return false
  const path=[];let base=node.left;while(base?.type==='MemberExpression'){path.unshift(member(base));base=base.object}
  if(same(base,anchor.id))return node===id||node===href||['className','target'].includes(path.join('.'))
  if(same(base,titleBinding))return node===title||['className','style.justifySelf','style.alignSelf'].includes(path.join('.'))
  if(same(base,location.left.object))return node===location||['className','style.justifySelf','style.alignSelf'].includes(path.join('.'))
  return false
 })])
 // Same identifiers still require stable values. This includes title text,
 // native href, state/filter records and any finite call/apply argument array.
 for(const node of p.nodes){
  if(!activeNode(p,node))continue
  if(node.type==='ThrowStatement')need(false,'current active role/construction callback throws before all records complete')
  if(node.type==='AssignmentExpression')for(const target of targets(node.left))need(!affected(target)||permitted.has(node),'current record/state/DOM dependency is overwritten')
  if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')for(const target of targets(node.argument))need(!affected(target),'current record/state/DOM dependency is updated/deleted')
  if(['ForOfStatement','ForInStatement'].includes(node.type)&&node.left.type!=='VariableDeclaration')for(const target of targets(node.left))need(!affected(target),'current record/state/DOM loop target is overwritten')
  if(node.type!=='CallExpression')continue
  const call=invoke(node);if(!call)continue;const name=member(call.callee),target=call.thisValue??call.callee?.object
  if(reflection.has(name)&&['Object','Reflect'].some(value=>builtin(call.callee?.object,value)))need(!call.unknown&&!affected(call.args[0]),'current critical state/DOM reflection replacement')
  if(arrayMutators.has(name))need(!affected(target),'current original record/argument array is mutated')
  if(['setAttribute','setAttributeNS','remove','replaceWith','replaceChildren','insertAdjacentHTML'].includes(name))need(!affected(target),'current critical DOM consumer is replaced')
  if(fn(call.callee))continue
  const parameterSource=resolve(call.callee?.object),paramsMethod=['get','getAll'].includes(name)&&(sameValue(call.callee?.object,params.id)||parameterSource?.type==='NewExpression'&&builtin(parameterSource.callee,'URLSearchParams')&&parameterSource.arguments.length===1&&property(parameterSource.arguments[0],'search')&&property(parameterSource.arguments[0].object,'location')&&p.global(parameterSource.arguments[0].object.object))
  const nativeSafe=reflection.has(name)||['map','filter','forEach','appendChild','querySelector','querySelectorAll','getElementById','createElement','addEventListener','json','toLowerCase','includes','isArray','keys','values','entries','hasOwn','getOwnPropertyDescriptor','getOwnPropertyDescriptors'].includes(name)||paramsMethod||builtin(call.callee,'Boolean')||builtin(call.callee,'fetch')
  if(call.args.some(objectEscape))need(nativeSafe&&!call.unknown,'current critical role/state value escapes to an unqualified consumer: '+p.script.raw.slice(node.start,node.end).slice(0,180))
  const knownMethod=new Set(['map','filter','forEach','appendChild','querySelector','querySelectorAll','getElementById','createElement','addEventListener','remove','json','get','getAll','toLowerCase','includes','push','replace','pushState','from','sort','localeCompare','add','contains','indexOf','join','keys','values','entries','hasOwn','getOwnPropertyDescriptor','getOwnPropertyDescriptors'])
  const knownPrimitive=['fetch','Boolean','String','Number','encodeURIComponent'].some(name=>builtin(call.callee,name))||builtin(call.callee?.object,'Math')
  need(knownMethod.has(name)||knownPrimitive||reflection.has(name),'current construction invokes an unqualified helper: '+p.script.raw.slice(node.start,node.end).slice(0,120))
  if(['get','getAll'].includes(name))need(paramsMethod||Boolean(globalPath(p,call.callee?.object)),'current getter method has an unresolved native owner')
 }
 const clearing=one(calls(render).filter(({call,node})=>property(call.callee,'forEach')&&property(call.callee.object,'querySelectorAll')===false&&node.start<renderLoop.start&&method(call.callee.object,'querySelectorAll')&&same(method(call.callee.object,'querySelectorAll').callee.object,list)),'original placeholder-anchor removal loop')
 const clearQuery=method(clearing.call.callee.object,'querySelectorAll');requireCall(clearQuery,1);need(literal(clearQuery.args[0])==='a','current placeholder cleanup changes its declared scope')
 const clearCallback=fn(clearing.call.args[0]);need(clearCallback?.params.length===1,'current placeholder cleanup callback differs');const clearEffect=one(calls(clearCallback).filter(({call})=>property(call.callee,'remove')&&same(call.callee.object,clearCallback.params[0])),'original placeholder removal effect');requireCall(clearEffect.call,0)
 const permittedDOMCalls=new Set([appended.node,titleAppend.node,clearEffect.node])
 const arrayDepends=(q,node,seen=new Set())=>{if(!node||seen.has(node))return false;const next=new Set(seen);next.add(node);if(reflectionArrays.get(q).has(node))return true;if(node.type==='Identifier'){const values=parameters.get(q.binding(node));if(values&&[...values].some(value=>arrayDepends(programOf.get(value)??q,value,next)))return true}if(node.type==='MemberExpression')return arrayDepends(q,node.object,next);const value=q.resolve(node);return value!==node&&arrayDepends(programOf.get(value)??q,value,next)}
 for(const q of programs){
  for(const value of q.root.values.values())if(value.scope.type==='global'&&criticalGlobals.has(value.name))need(false,'current global browser primitive has a classic declaration replacement')
  for(const node of q.nodes){
   if(!activeNode(q,node))continue
   if(node.type==='AssignmentExpression')for(const target of targets(node.left))need(!globalCritical(q,target)&&!arrayDepends(q,target),'current global browser/argument dependency is overwritten: '+q.script.raw.slice(node.start,node.end).slice(0,180))
   if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')for(const target of targets(node.argument))need(!globalCritical(q,target),'current global browser dependency is updated/deleted')
   if(['ForOfStatement','ForInStatement'].includes(node.type)&&node.left.type!=='VariableDeclaration')for(const target of targets(node.left))need(!globalCritical(q,target),'current global browser loop target is overwritten')
   if(node.type!=='CallExpression')continue;const call=qInvoke(q,node);if(!call)continue
   const name=q.member(call.callee),isReflection=reflection.has(name)&&['Object','Reflect'].some(value=>qBuiltin(q,call.callee?.object,value))
   if(isReflection)need(!call.unknown&&!globalCritical(q,call.args[0]),'current global browser dependency reflection replacement')
   if(isReflection)need(!arrayDepends(q,call.args[0]),'current critical invocation tuple has a reflection replacement')
   if(arrayMutators.has(name))need(!arrayDepends(q,call.thisValue??call.callee?.object),'current critical invocation tuple is mutated')
   if(domDependencies.has(name)&&globalCritical(q,call.thisValue??call.callee?.object))need(q===p&&permittedDOMCalls.has(node),'current declared list/title DOM is mutated by another connected consumer')
  }
 }
 return{proxyURL,listingURL,connected:true,defaultUnfiltered:true,nativeProgramsExecuted:false,originalProgram:p.script.raw,originalScriptAttributes:structuredClone(p.script.originalNode.attrs),originalContainerAttributes:structuredClone(listNode.attrs),defaultFilterEvidence:{locations:[],departments:[],input:'',source:'actual configured query and original URLSearchParams/default assignments'},sameRecordFields:{id:'id',title:'title',application:'applyUrl'},legalEmployer:null,companyIndiaTotal:null,companyGlobalTotal:null}
}
