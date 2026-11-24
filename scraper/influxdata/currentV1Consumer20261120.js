import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativePrograms} from './currentV1Lexical20261120.js'

const functionTypes=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Current declared v1 consumer: '+message),{abortRetries:true,nativeContradiction:true,failureKind:'parser_or_contract_error'})}
const one=(rows,label)=>{need(rows.length===1,'missing or ambiguous '+label);return rows[0]}
const member=(p,node,name)=>node?.type==='MemberExpression'&&p.member(node)===name
const builtin=(p,node,name)=>p.builtin(node,name)||member(p,p.resolve(node),name)&&p.global(p.resolve(node).object)
const same=(p,a,b)=>p.resolve(a)===p.resolve(b)||a?.type==='Identifier'&&b?.type==='Identifier'&&p.binding(a)!=null&&p.binding(a)===p.binding(b)
const inside=(p,node,owner)=>{for(let at=node;at;at=p.parents.get(at))if(at===owner)return true;return false}
const enclosing=(p,node,predicate)=>{for(let at=p.parents.get(node);at;at=p.parents.get(at))if(predicate(at))return at;return null}
const fnOf=(p,node)=>enclosing(p,node,n=>functionTypes.has(n.type))
const ownNodes=(p,fn)=>p.nodes.filter(n=>n!==fn&&inside(p,n,fn)&&fnOf(p,n)===fn)
const declaration=(p,node,label)=>one(p.nodes.filter(n=>n.type==='VariableDeclarator'&&n.init===p.resolve(node)),label)
const call=(p,node,owner,name)=>node?.type==='CallExpression'&&member(p,node.callee,name)&&same(p,node.callee.object,owner)
const docCall=(p,node,name)=>node?.type==='CallExpression'&&member(p,node.callee,name)&&builtin(p,node.callee.object,'document')
// HTML prepare-script steps10-15 and MIME Sniffing section4.6. These describe
// browser script carriers, not a particular publisher release or script body.
const javascriptEssences=new Set(['application/ecmascript','application/javascript','application/x-ecmascript','application/x-javascript','text/ecmascript','text/javascript','text/javascript1.0','text/javascript1.1','text/javascript1.2','text/javascript1.3','text/javascript1.4','text/javascript1.5','text/jscript','text/livescript','text/x-ecmascript','text/x-javascript'])
const asciiLower=value=>value.replace(/[A-Z]/g,char=>char.toLowerCase()),asciiTrim=value=>value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g,'')
function scriptKind(node){
 const a=node.attrs,hasType=Object.hasOwn(a,'type'),type=hasType?(a.type===''?'text/javascript':a.type):!Object.hasOwn(a,'language')||a.language===''?'text/javascript':'text/'+a.language,lower=asciiLower(type)
 const kind=javascriptEssences.has(lower)||hasType&&javascriptEssences.has(asciiLower(asciiTrim(a.type)))?'classic':lower==='module'?'module':null
 if(kind==='classic'&&Object.hasOwn(a,'nomodule'))return null
 if(kind==='classic'&&Object.hasOwn(a,'for')&&Object.hasOwn(a,'event')&&!(asciiLower(asciiTrim(a.for))==='window'&&['onload','onload()'].includes(asciiLower(asciiTrim(a.event)))))return null
 return kind
}
const nullLiteral=(p,node)=>p.resolve(node)?.type==='Literal'&&p.resolve(node).value===null
const direct=(p,node,body)=>{let at=node;while(p.parents.get(at)&&p.parents.get(at)!==body)at=p.parents.get(at);need(p.parents.get(at)===body&&!functionTypes.has(at.type),'native dependency is conditional or disconnected');return at}
const directExpression=(p,node,body)=>need(p.parents.get(node)?.type==='ExpressionStatement'&&p.parents.get(p.parents.get(node))===body,'native operation is not a reachable direct statement')
function reaches(p,fn,endpoint,allowedAbrupt=[]){
 const permitted=new Set(allowedAbrupt)
 for(const node of p.nodes.filter(n=>n!==fn&&inside(p,n,fn)&&fnOf(p,n)===(fn.type==='Program'?null:fn)&&n.start<endpoint.end)){
  if(['ReturnStatement','ThrowStatement','BreakStatement','ContinueStatement'].includes(node.type))need(permitted.has(node),'native consumer has an earlier abrupt completion')
  if(['WhileStatement','DoWhileStatement','ForStatement','ForInStatement','ForOfStatement','SwitchStatement','TryStatement','WithStatement','AwaitExpression','YieldExpression'].includes(node.type))need(false,'native consumer has an unqualified earlier control dependency')
 }
}

function guardMutations(programs,g){
 const{p,baseWrite,timer,frame,container,builder,url,params,base,roleGuard,source,append,guarded,loadBinding,setters}=g,domNames=['Element','Node','Document','HTMLElement','HTMLIFrameElement'],globalNames=new Set(['__ashbyBaseJobBoardUrl','__ashbyAutoLoadIframeTimerID','document','location','URL','URLSearchParams','Object','Reflect','Function','addEventListener','setInterval','encodeURIComponent','__proto__','$','jQuery',...domNames,loadBinding.id.name,builder.id?.name].filter(Boolean)),domKeys=new Set(['getElementById','querySelector','querySelectorAll','createElement','getAttribute','setAttribute','appendChild','scrollIntoView','addEventListener','readyState','__proto__']),urlKeys=new Set(['href','search','searchParams','hash','host','hostname','origin','protocol','pathname','port','username','password','toString','toJSON','__proto__']),paramKeys=new Set(['set','append','delete','get','sort','getAll','has','__proto__']),criticalBindings=new Set([frame.id,container.id,builder.params[0],url.id,params.id,base.id,loadBinding.id,builder.id].filter(Boolean).map(n=>p.binding(n)).filter(Boolean)),timerWrite=p.parents.get(timer),userEvents=new Set(['click','dblclick','keypress','keydown','keyup','input','change','submit','pointerdown','pointerup','mousedown','mouseup','touchstart','touchend']),callableMethods=new Set(['assign','defineProperty','defineProperties','setPrototypeOf','set','deleteProperty','apply','getElementById','querySelector','querySelectorAll','createElement','getAttribute','setAttribute','appendChild','on','ready','toString','toJSON','get','append','delete','sort','call','bind']),checkedArrays=new WeakSet();let argumentArrays=0
 const jquery=(current,input)=>{const value=current.resolve(input);return value?.type==='CallExpression'&&['$','jQuery'].some(name=>builtin(current,value.callee,name))}
 function domElement(current,input){
  const value=current.resolve(input)
  if(current.global(value)||builtin(current,value,'document')||['getElementById','querySelector'].some(name=>docCall(current,value,name)))return true
  const binding=current.binding(value),each=fnOf(current,binding?.defs[0]?.pattern),iteration=current.parents.get(each)
  return binding?.defs.length===1&&!binding.writes.length&&each?.params[0]===binding.defs[0].pattern&&iteration?.type==='CallExpression'&&iteration.arguments[0]===each&&member(current,iteration.callee,'forEach')&&docCall(current,iteration.callee.object,'querySelectorAll')
 }
 function deferredUserNavigation(current,node){
  for(let fn=fnOf(current,node);fn;fn=fnOf(current,fn)){
   const registration=current.parents.get(fn)
   if(registration?.type!=='CallExpression'||registration.arguments[1]!==fn||registration.callee.type!=='MemberExpression')continue
   const events=current.literal(registration.arguments[0]);if(typeof events!=='string'||!events.trim().split(/\s+/).every(name=>userEvents.has(name.split('.')[0])))continue
   if(member(current,registration.callee,'addEventListener')&&domElement(current,registration.callee.object)||member(current,registration.callee,'on')&&jquery(current,registration.callee.object))return true
  }
  return false
 }
 function owner(current,input){
  const value=current.resolve(input)
  if(current.global(value))return{kind:'global',keys:globalNames}
  if(builtin(current,value,'document'))return{kind:'document',keys:domKeys}
  if(builtin(current,value,'location')||member(current,value,'location')&&current.global(value.object))return{kind:'location',keys:urlKeys}
  if(['$','jQuery'].some(name=>builtin(current,value,name)))return{kind:'namespace',keys:new Set(['fn','prototype','__proto__'])}
  if(['fn','prototype'].some(name=>member(current,value,name))&&['$','jQuery'].some(name=>builtin(current,value.object,name)))return{kind:'namespace',keys:new Set(['on','ready','trigger','triggerHandler','__proto__'])}
  if(jquery(current,value))return{kind:'jquery',keys:new Set(['on','ready','trigger','triggerHandler','__proto__'])}
  if(builtin(current,value,'Object'))return{kind:'namespace',keys:new Set(['assign','defineProperty','defineProperties','setPrototypeOf'])}
  if(builtin(current,value,'Reflect'))return{kind:'namespace',keys:new Set(['apply','set','defineProperty','deleteProperty','setPrototypeOf'])}
  if(builtin(current,value,'URL')||builtin(current,value,'URLSearchParams')||builtin(current,value,'Function'))return{kind:'namespace',keys:new Set(['prototype'])}
  if(member(current,value,'prototype')){if(domNames.some(name=>builtin(current,value.object,name)))return{kind:'prototype',keys:domKeys};if(builtin(current,value.object,'Function'))return{kind:'prototype',keys:new Set(['call','apply','bind','__proto__'])};if(builtin(current,value.object,'Object'))return{kind:'prototype',keys:new Set([...globalNames,...domKeys,...urlKeys,...paramKeys])};if(builtin(current,value.object,'URL')||builtin(current,value.object,'URLSearchParams'))return{kind:'prototype',keys:new Set([...urlKeys,...paramKeys])}}
  if(current===p){
   if(same(p,value,frame.id))return{kind:'frame',keys:new Set([...domKeys,'src','srcdoc','id','__proto__'])}
   if(same(p,value,container.id)||same(p,value,builder.params[0]))return{kind:'container',keys:new Set([...domKeys,'innerHTML','outerHTML','__proto__'])}
   if(same(p,value,url.id))return{kind:'url',keys:urlKeys}
   if(same(p,value,params.id))return{kind:'inputParams',keys:paramKeys}
   if(member(p,value,'searchParams')&&same(p,value.object,url.id))return{kind:'urlParams',keys:paramKeys}
  }
  if(value?.type==='MemberExpression'&&callableMethods.has(current.member(value))&&owner(current,value.object))return{kind:'criticalFunction',keys:new Set(['call','apply','bind','__proto__'])}
  return null
 }
 function written(current,target,operation){
  if(!target)return
  if(target.type==='ObjectPattern'){for(const property of target.properties)written(current,property.type==='RestElement'?property.argument:property.value,operation);return}
  if(target.type==='ArrayPattern'){for(const element of target.elements)written(current,element,operation);return}
  if(target.type==='AssignmentPattern'){written(current,target.left,operation);return}
  if(target.type==='RestElement'){written(current,target.argument,operation);return}
  if(target?.type==='Identifier'){
   const binding=current.binding(target);if(binding&&criticalBindings.has(binding))need(current===p&&binding===p.binding(base.id)&&inside(p,operation,roleGuard.consequent),'actual constructor or consumer binding overwritten')
   const browserBinding=binding?.scope.type==='global'&&binding.defs.some(def=>programs.some(program=>{for(let at=program.parents.get(def.pattern);at;at=program.parents.get(at)){if(at.type==='FunctionDeclaration')return true;if(at.type==='VariableDeclaration')return at.kind==='var';if(functionTypes.has(at.type))return false}return false}))
   if((!binding||browserBinding)&&globalNames.has(target.name))need(false,'native global namespace or callback overwritten');return
  }
  if(target?.type!=='MemberExpression')return
  const scope=owner(current,target.object);if(!scope)return
  const key=current.member(target);need(key!=null,'unqualified computed critical owner write')
  if(!scope.keys.has(key))return
  if(scope.kind==='location'&&key==='href'&&deferredUserNavigation(current,operation))return
  if(current===p&&operation===baseWrite.node)return
  if(current===p&&operation===timerWrite&&operation.type==='AssignmentExpression'&&operation.right===timer)return
  if(current===p&&scope.kind==='container'&&key==='innerHTML'&&operation.type==='AssignmentExpression'&&p.literal(operation.right)===''&&inside(p,operation,guarded.consequent)&&operation.start<source.start)return
  need(false,'known native namespace, callback or method overwritten: '+scope.kind+'.'+key)
 }
 function objectKeys(current,input,depth=0){need(depth<=8,'finite native object mutation scope exceeded');const value=current.resolve(input);need(value?.type==='ObjectExpression','unqualified native critical object mutation source');return value.properties.flatMap(property=>{if(property.type==='SpreadElement')return objectKeys(current,property.argument,depth+1);need(property.type==='Property','native critical mutation property malformed');const name=property.computed?current.literal(property.key):property.key.type==='Identifier'?property.key.name:property.key.value;need(typeof name==='string','unqualified computed critical mutation key');return[name]})}
 function criticalCallable(current,input){const value=current.resolve(input);if(value?.type==='CallExpression'&&member(current,current.resolve(value.callee),'bind'))return criticalCallable(current,current.resolve(value.callee).object);return value?.type==='MemberExpression'&&owner(current,value.object)!=null}
 function referencesArray(current,input,array){const value=current.resolve(input);if(value===array)return true;if(value?.type==='SpreadElement')return referencesArray(current,value.argument,array);if(value?.type==='ObjectExpression')return value.properties.some(n=>referencesArray(current,n.type==='SpreadElement'?n.argument:n.value,array));if(value?.type==='ArrayExpression')return value.elements.some(n=>referencesArray(current,n,array));return false}
 function arrayContents(current,input,critical){
  const array=current.resolve(input);if(array?.type!=='ArrayExpression'){need(!critical,'unqualified spread native mutation arguments');return null}
  if(critical)need(array.elements.every(Boolean),'sparse native mutation arguments')
  if(critical&&!checkedArrays.has(array)){
   need(++argumentArrays<=128,'finite native argument dependency scope exceeded');checkedArrays.add(array)
   for(const program of programs)for(const node of program.nodes){
    if(node.type==='VariableDeclarator'&&referencesArray(program,node.init,array))need(node.id.type==='Identifier'&&!program.binding(node.id)?.writes.length,'native argument tuple has a written alias')
    const target=node.type==='AssignmentExpression'?node.left:['UpdateExpression','UnaryExpression'].includes(node.type)?node.argument:null
    if(target?.type==='MemberExpression'&&program.resolve(target.object)===array)need(false,'native argument tuple member changed')
    if(node.type==='AssignmentExpression'&&referencesArray(program,node.right,array))need(false,'native argument tuple escaped through an assignment')
    if(node.type==='ReturnStatement'&&referencesArray(program,node.argument,array))need(false,'native argument tuple escaped through a return')
    if(node.type!=='CallExpression')continue
    const callee=program.resolve(node.callee)
    if(callee?.type==='MemberExpression'&&program.resolve(callee.object)===array)need(false,'native argument tuple method may change values')
    for(let index=0;index<node.arguments.length;index++)if(node.arguments[index]?.type!=='SpreadElement'&&referencesArray(program,node.arguments[index],array)){
     const applied=callee?.type==='MemberExpression'&&program.member(callee)==='apply'&&(builtin(program,callee.object,'Reflect')&&index===2||criticalCallable(program,callee.object)&&index===1)
     need(applied,'native argument tuple escaped to an unknown consumer')
    }
   }
  }
  return array.elements
 }
 function spreadArguments(current,args,critical,depth=0){
  need(depth<=8&&args.length<=256,'finite native argument scope exceeded')
  return args.flatMap(argument=>{if(argument?.type!=='SpreadElement')return[argument];const values=arrayContents(current,argument.argument,critical);return values?spreadArguments(current,values,critical,depth+1):[argument]})
 }
 function invocation(current,callee,args,receiver=null,depth=0){
  need(depth<=8,'finite bound native method scope exceeded');const target=current.resolve(callee)
  args=spreadArguments(current,args,criticalCallable(current,target))
  if(target?.type==='CallExpression'){const binder=current.resolve(target.callee);if(member(current,binder,'bind'))return invocation(current,binder.object,[...target.arguments.slice(1),...args],target.arguments[0],depth+1);return{target,args,receiver}}
  if(target?.type!=='MemberExpression')return{target,args,receiver}
  const method=current.member(target),namespace=current.resolve(target.object)
  if(builtin(current,namespace,'Reflect')&&method==='apply'){const values=arrayContents(current,args[2],criticalCallable(current,args[0]));if(!values)return{target,args,receiver};return invocation(current,args[0],values,args[1],depth+1)}
  if(['call','apply'].includes(method)&&['MemberExpression','CallExpression'].includes(namespace?.type)){if(method==='call')return invocation(current,namespace,args.slice(1),args[0],depth+1);const values=arrayContents(current,args[1],criticalCallable(current,namespace));if(!values)return{target,args,receiver};return invocation(current,namespace,values,args[0],depth+1)}
  return{target,args,receiver,bindingOnly:method==='bind'}
 }
 function mutation(current,target,args){
  if(target?.type!=='MemberExpression')return false
  const method=current.member(target),namespace=current.resolve(target.object)
  const scope=owner(current,args[0]);if(!scope)return
  if(builtin(current,namespace,'Object')&&['assign','defineProperties'].includes(method)){for(const value of args.slice(1))need(objectKeys(current,value).every(key=>!scope.keys.has(key)),'critical native owner changed by object mutation');return true}
  if(builtin(current,namespace,'Object')&&method==='defineProperty'||builtin(current,namespace,'Reflect')&&['set','defineProperty','deleteProperty'].includes(method)){const key=current.literal(args[1]);need(typeof key==='string'&&!scope.keys.has(key),'critical native owner changed by property mutation');return true}
  if(['setPrototypeOf'].includes(method)&&(builtin(current,namespace,'Object')||builtin(current,namespace,'Reflect')))need(false,'critical native owner prototype changed')
  return false
 }
 const localKinds=new Set(['frame','container','url','urlParams','inputParams'])
 function escaped(current,input){const value=current.resolve(input);if(localKinds.has(owner(current,value)?.kind))return true;if(value?.type==='ObjectExpression')return value.properties.some(n=>escaped(current,n.type==='SpreadElement'?n.argument:n.value));if(value?.type==='ArrayExpression')return value.elements.some(n=>escaped(current,n));return false}
 function globalDeclaration(current,pattern,initialized){
  if(!pattern)return
  if(pattern.type==='Identifier'){const binding=current.binding(pattern);if(initialized&&binding?.scope.type==='global'&&globalNames.has(pattern.name))need(current===p&&pattern===loadBinding.id,'native critical browser property initialized by another global declaration');return}
  if(pattern.type==='ObjectPattern')for(const property of pattern.properties)globalDeclaration(current,property.type==='RestElement'?property.argument:property.value,initialized)
  if(pattern.type==='ArrayPattern')for(const element of pattern.elements)globalDeclaration(current,element,initialized)
  if(pattern.type==='AssignmentPattern')globalDeclaration(current,pattern.left,true)
  if(pattern.type==='RestElement')globalDeclaration(current,pattern.argument,initialized)
 }
 for(const current of programs){
  for(const node of current.nodes){
   if(node.type==='VariableDeclarator'&&current.parents.get(node)?.kind==='var')globalDeclaration(current,node.id,node.init!=null)
   if(node.type==='FunctionDeclaration'&&!current.module&&!fnOf(current,node)&&globalNames.has(node.id.name))need(current===p&&node===builder,'native critical browser property overwritten by a global function declaration')
   if(node.type==='VariableDeclarator'&&escaped(current,node.init))need(node.id.type==='Identifier'&&!current.binding(node.id)?.writes.length,'written actual native owner alias is unqualified')
   if(node.type==='AssignmentExpression'){need(!escaped(current,node.right),'actual native owner escaped through an assignment');written(current,node.left,node)}
   else if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')written(current,node.argument,node)
   if(['ForInStatement','ForOfStatement'].includes(node.type)){if(node.left.type==='VariableDeclaration'){for(const declaration of node.left.declarations){if(node.left.kind==='var')globalDeclaration(current,declaration.id,true);written(current,declaration.id,node)}}else written(current,node.left,node)}
   if(node.type==='ReturnStatement')need(!escaped(current,node.argument),'actual native owner escaped through a return')
   if(node.type!=='CallExpression')continue
   const{target,args,receiver,bindingOnly}=invocation(current,node.callee,node.arguments)
   if(bindingOnly)continue
   const changed=mutation(current,target,args)
   if(target?.type==='MemberExpression'){
    const scope=owner(current,target.object),name=current.member(target)
    if(scope&&localKinds.has(scope.kind))need(typeof name==='string','unknown actual native object method')
    if(scope?.kind==='frame')need(['setAttribute','getAttribute'].includes(name),'unqualified actual native frame operation')
    if(scope?.kind==='container')need(['getAttribute','appendChild','scrollIntoView'].includes(name),'unqualified actual native container operation')
    if(scope?.kind==='url')need(['toString','toJSON'].includes(name),'unqualified actual constructed URL operation')
    if(scope?.kind==='frame'&&name==='setAttribute'){const key=current.literal(args[0]);need(typeof key==='string'&&key.toLowerCase()!=='srcdoc'&&!key.toLowerCase().startsWith('on'),'unknown or replacement native frame attribute');if(['src','id'].includes(key.toLowerCase()))need(current===p&&(node===source||key.toLowerCase()==='id'&&inside(p,node,guarded.consequent)&&node.start<source.start)&&(!receiver||same(p,receiver,frame.id)),'later native frame identity or source differs')}
    if(scope?.kind==='container'&&name==='appendChild')need(node===append&&(!receiver||same(p,receiver,container.id)),'native current container appender differs')
    if(scope?.kind==='urlParams')need(current===p&&setters.includes(node),'native constructed query changed outside qualified setters')
    if(scope?.kind==='inputParams')need(name==='get'&&['ashby_jid','utm_source'].includes(current.literal(args[0])),'native current own query reader changed')
   }
   if(args.some((arg,index)=>escaped(current,arg)&&!(changed&&index===0)))need(node===append||current===p&&target===builder&&args.length===1&&same(p,args[0],container.id),'actual native constructor or consumer reference escaped')
  }
 }
}

function qualify(input){
 const{homeHTML,program,homeURL,boardURL,clientURL}=input
 need(typeof homeHTML==='string'&&homeHTML.length>0&&Buffer.byteLength(homeHTML)<=4*1024*1024,'finite original own authority required')
 need(typeof program==='string'&&program.length>0&&Buffer.byteLength(program)<=128*1024,'finite original native consumer programme required')
 const home=new URL(homeURL),board=new URL(boardURL),client=new URL(clientURL)
 need(home.protocol==='https:'&&!home.username&&!home.password&&!home.port&&!home.hash,'own authority URL differs')
 need(board.protocol==='https:'&&board.hostname==='jobs.ashbyhq.com'&&!board.username&&!board.password&&!board.port&&!board.search&&!board.hash&&/^\/[a-zA-Z0-9_-]+$/.test(board.pathname),'unfiltered native account URL differs')
 need(client.href===board.href+'/embed','native v1 client/account differs')
 const d=readNativeDocument(homeHTML),clientNode=one(d.nodes(n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,home).href===client.href),'actual own declared native client'),kind=scriptKind(clientNode);need(kind,'actual declared native client is not an active programme carrier')
 const virtual={...clientNode,attrs:{...clientNode.attrs,type:kind==='module'?'module':''},raw:program},scripts=[]
 for(const node of d.nodes(n=>n.tag==='script')){const kind=scriptKind(node);if(node===clientNode)scripts.push(virtual);else if(!node.attrs.src&&kind)scripts.push({...node,attrs:{...node.attrs,type:kind==='module'?'module':''}})}
 const programs=nativePrograms(scripts),p=one(programs.filter(p=>p.script===virtual),'actual current native programme')
 need(programs.reduce((n,p)=>n+p.nodes.length,0)<=150000,'finite programme graph exceeded')
 const source=one(p.nodes.filter(n=>n.type==='CallExpression'&&member(p,n.callee,'setAttribute')&&p.literal(n.arguments[0])==='src'&&n.arguments[1]?.type==='CallExpression'),'actual constructed frame source'),builder=p.resolve(source.arguments[1].callee)
 need(functionTypes.has(builder?.type)&&builder.params.length===1&&builder.params[0].type==='Identifier','actual source URL builder disconnected')
 const frame=declaration(p,source.callee.object,'actual constructed frame binding'),create=p.resolve(source.callee.object)
 need(docCall(p,create,'createElement')&&p.literal(create.arguments[0])==='iframe','actual frame is not a native iframe')
 const add=fnOf(p,source);need(add&&add.type==='FunctionDeclaration','actual frame consumer function disconnected')
 const container=declaration(p,source.arguments[1].arguments[0],'actual owned container binding'),get=p.resolve(source.arguments[1].arguments[0])
 need(docCall(p,get,'getElementById')&&typeof p.literal(get.arguments[0])==='string','actual current container selector differs')
 need(fnOf(p,container)===add&&fnOf(p,frame)===add,'actual container/frame ownership disconnected')
 const containerID=p.literal(get.arguments[0]),owned=one(d.nodes(n=>n.attrs.id===containerID),'actual own container'),append=one(ownNodes(p,add).filter(n=>call(p,n,container.id,'appendChild')&&same(p,n.arguments[0],frame.id)),'same-frame native appender')
 need(append.start>source.start&&source.arguments[1].arguments.length===1,'native source/appender order differs')
 const guarded=enclosing(p,source,n=>n.type==='IfStatement'),test=guarded?.test
 need(test?.type==='LogicalExpression'&&test.operator==='&&'&&['!=','!=='].includes(test.left?.operator)&&same(p,test.left.left,container.id)&&nullLiteral(p,test.left.right)&&['==','==='].includes(test.right?.operator)&&docCall(p,test.right.left,'getElementById')&&nullLiteral(p,test.right.right),'native container/frame availability guard differs')
 need(inside(p,append,guarded.consequent)&&inside(p,source,guarded.consequent),'native source/appender guards disconnected')
 need(p.parents.get(guarded)===add.body&&guarded.consequent.type==='BlockStatement'&&!guarded.alternate,'native availability guard is conditional or disconnected')
 need(direct(p,container,add.body).type==='VariableDeclaration'&&direct(p,frame,guarded.consequent).type==='VariableDeclaration','native actual owner declarations are conditional')
 directExpression(p,source,guarded.consequent);directExpression(p,append,guarded.consequent);reaches(p,add,append)
 for(const node of[source,append])for(let at=p.parents.get(node);at&&at!==add;at=p.parents.get(at))if(['IfStatement','ForStatement','WhileStatement','DoWhileStatement','ConditionalExpression','SwitchStatement'].includes(at.type))need(at===guarded,'native frame consumer is conditional or dead')
 const frameID=p.literal(test.right.left.arguments[0]);need(typeof frameID==='string'&&d.nodes(n=>n.attrs.id===frameID).length===0,'current frame already exists or identity is unknown')
 const identity=one(ownNodes(p,add).filter(n=>call(p,n,frame.id,'setAttribute')&&p.literal(n.arguments[0])==='id'&&p.literal(n.arguments[1])===frameID),'same native frame identity')
 directExpression(p,identity,guarded.consequent);need(frame.end<identity.start&&identity.end<source.start,'native frame identity order differs')
 const loader=fnOf(p,add);need(loader?.type==='FunctionExpression','actual loader binding disconnected')
 const loadBinding=one(p.nodes.filter(n=>n.type==='VariableDeclarator'&&n.init===loader),'actual loader declaration')
 need(p.binding(loadBinding.id)?.writes.length===0,'actual loader overwritten')
 const directAdd=one(loader.body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&p.resolve(n.expression.callee)===add),'actual direct frame consumer call')
 const timerGuard=one(loader.body.body.filter(n=>n.type==='IfStatement'&&['!=','!=='].includes(n.test.operator)&&member(p,n.test.left,'__ashbyAutoLoadIframeTimerID')&&p.global(n.test.left.object)&&nullLiteral(p,n.test.right)),'actual initialization state guard')
 need(!timerGuard.alternate&&timerGuard.consequent.type==='BlockStatement'&&timerGuard.consequent.body.length===1&&timerGuard.consequent.body[0].type==='ReturnStatement'&&!timerGuard.consequent.body[0].argument,'native initialization guard differs')
 reaches(p,loader,directAdd,[timerGuard.consequent.body[0]])
 const timer=one(ownNodes(p,loader).filter(n=>n.type==='CallExpression'&&member(p,n.callee,'setInterval')&&p.global(n.callee.object)),'actual native consumer timer')
 const polling=p.literal(timer.arguments[1]);need(Number.isSafeInteger(polling)&&polling>0&&polling<=2147483647&&functionTypes.has(timer.arguments[0]?.type),'native consumer timer differs')
 const timedAdd=one(timer.arguments[0].body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&p.resolve(n.expression.callee)===add),'actual timed consumer callback')
 reaches(p,timer.arguments[0],timedAdd)
 const timerWrite=p.parents.get(timer);need(timerWrite.type==='AssignmentExpression'&&timerWrite.operator==='='&&member(p,timerWrite.left,'__ashbyAutoLoadIframeTimerID')&&p.global(timerWrite.left.object),'native initialization timer ownership differs')
 directExpression(p,timerWrite,loader.body);need(timer.start<directAdd.start&&timerGuard.end<timer.start,'native initialization order differs')
 const entries=p.tree.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&functionTypes.has(n.expression.callee.type)),entry=one(entries.filter(n=>ownNodes(p,n.expression.callee).some(node=>node.type==='CallExpression'&&p.resolve(node.callee)===loader)),'actual top-level native initializer')
 const initializer=entry.expression.callee,ready=one(initializer.body.body.filter(n=>n.type==='IfStatement'&&n.test.type==='BinaryExpression'&&n.test.operator==='==='&&member(p,n.test.left,'readyState')&&builtin(p,n.test.left.object,'document')&&p.literal(n.test.right)==='complete'),'actual native ready state branch')
 need(ready.consequent.type==='BlockStatement'&&ready.alternate?.type==='BlockStatement','native ready state arms differ')
 const readyLoad=one(ready.consequent.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&p.resolve(n.expression.callee)===loader),'reachable current native ready callback')
 need(readyLoad.expression.arguments.length===0,'native ready callback arguments differ')
 const eventCalls=ownNodes(p,entry.expression.callee).filter(n=>n.type==='CallExpression'&&(builtin(p,n.callee,'addEventListener')||member(p,n.callee,'addEventListener')&&p.global(n.callee.object))&&p.resolve(n.arguments[1])===loader)
 need(eventCalls.length===2&&eventCalls.some(n=>p.literal(n.arguments[0])==='DOMContentLoaded')&&eventCalls.some(n=>p.literal(n.arguments[0])==='load'),'actual ready/load callbacks disconnected')
 for(const eventCall of eventCalls){directExpression(p,eventCall,ready.alternate);need(eventCall.arguments.length===2,'native ready event registration differs')}
 reaches(p,initializer,ready);reaches(p,p.tree,entry)
 const globals=programs.flatMap(current=>current.nodes.filter(n=>n.type==='AssignmentExpression'&&member(current,n.left,'__ashbyBaseJobBoardUrl')&&current.global(n.left.object)).map(node=>({p:current,node}))),baseWrite=one(globals,'guarded current global base assignment')
 need(baseWrite.p===p&&baseWrite.node.operator==='='&&p.literal(baseWrite.node.right)===board.href,'native current global account differs')
 const baseGuard=enclosing(p,baseWrite.node,n=>n.type==='IfStatement')
 need(p.tree.body.includes(baseGuard)&&baseGuard.test.type==='UnaryExpression'&&baseGuard.test.operator==='!'&&member(p,baseGuard.test.argument,'__ashbyBaseJobBoardUrl')&&p.global(baseGuard.test.argument.object),'native global base initializer is dead or disconnected')
 need(!baseGuard.alternate&&baseGuard.consequent.type==='BlockStatement','native global initializer alternatives differ');directExpression(p,baseWrite.node,baseGuard.consequent)
 const bnodes=ownNodes(p,builder),base=one(bnodes.filter(n=>n.type==='VariableDeclarator'&&member(p,n.init,'__ashbyBaseJobBoardUrl')&&p.global(n.init.object)),'actual builder global base consumption'),url=one(bnodes.filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='NewExpression'&&builtin(p,n.init.callee,'URL')&&same(p,n.init.arguments[0],base.id)),'actual same-base URL construction')
 const params=one(bnodes.filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='NewExpression'&&builtin(p,n.init.callee,'URLSearchParams')),'actual current own query reader')
 need(member(p,params.init.arguments[0],'search')&&member(p,params.init.arguments[0].object,'location')&&p.global(params.init.arguments[0].object.object),'native own query consumption differs')
 const role=one(bnodes.filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='LogicalExpression'&&n.init.operator==='||'&&call(p,n.init.left,builder.params[0],'getAttribute')&&p.literal(n.init.left.arguments[0])==='data-jid'&&call(p,n.init.right,params.id,'get')&&p.literal(n.init.right.arguments[0])==='ashby_jid'),'actual native optional role selector')
 need(!owned.attrs['data-jid']&&!home.searchParams.get('ashby_jid'),'own selector is scoped to a native role')
 const roleGuard=one(bnodes.filter(n=>n.type==='IfStatement'&&same(p,n.test,role.id)),'known optional role branch')
 need(p.binding(base.id).writes.every(n=>inside(p,n,roleGuard.consequent)),'native active URL base overwritten')
 const returned=one(builder.body.body.filter(n=>n.type==='ReturnStatement'&&member(p,n.argument,'href')&&same(p,n.argument.object,url.id)),'actual same constructed URL result')
 for(const declaration of[base,url,params,role])need(direct(p,declaration,builder.body).type==='VariableDeclaration','native constructor dependency is conditional')
 need(p.parents.get(roleGuard)===builder.body&&!roleGuard.alternate&&params.start<role.start&&base.start<url.start&&roleGuard.end<url.start,'native constructor dependency order differs')
 reaches(p,builder,{end:returned.start})
 const consumer=new URL(board.href),setters=bnodes.filter(n=>n.type==='CallExpression'&&member(p,n.callee,'set')&&member(p,n.callee.object,'searchParams')&&same(p,n.callee.object.object,url.id))
 need(setters.length===3,'native URL query construction changed')
 const utm=one(bnodes.filter(n=>n.type==='VariableDeclarator'&&call(p,n.init,params.id,'get')&&p.literal(n.init.arguments[0])==='utm_source'),'native optional UTM source reader'),chrome=one(bnodes.filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='BinaryExpression'&&n.init.operator==='==='&&call(p,n.init.left,builder.params[0],'getAttribute')&&p.literal(n.init.left.arguments[0])==='data-noChrome'&&p.literal(n.init.right)==='true'),'native optional chrome reader')
 for(const declaration of[utm,chrome])need(direct(p,declaration,builder.body).type==='VariableDeclaration','native optional URL dependency is conditional')
 for(const setter of setters){
  const key=p.literal(setter.arguments[0]);need(['embed','utm_source','noChrome'].includes(key)&&setter.arguments.length===2&&url.end<setter.start&&setter.end<returned.start,'native URL has an unqualified filter or order')
  if(key==='embed'){need(p.literal(setter.arguments[1])==='js','native embed value differs');directExpression(p,setter,builder.body);consumer.searchParams.set('embed','js')}
  else{
   const dependency=key==='utm_source'?utm:chrome,branch=enclosing(p,setter,n=>n.type==='IfStatement')
   need(branch&&p.parents.get(branch)===builder.body&&same(p,branch.test,dependency.id)&&!branch.alternate&&dependency.end<branch.start&&branch.consequent.type==='BlockStatement','native optional URL condition differs')
   directExpression(p,setter,branch.consequent)
   need(key==='utm_source'?same(p,setter.arguments[1],utm.id):p.literal(setter.arguments[1])==='true','native optional URL value differs')
   if(key==='utm_source'&&home.searchParams.get('utm_source'))consumer.searchParams.set(key,home.searchParams.get('utm_source'))
   if(key==='noChrome'&&owned.attrs['data-nochrome']==='true')consumer.searchParams.set('noChrome','true')
  }
 }
 need(new Set(setters.map(n=>p.literal(n.arguments[0]))).size===3,'native URL query keys differ')
 guardMutations(programs,{p,baseWrite,timer,frame,container,builder,url,params,base,roleGuard,source,append,guarded,loadBinding,setters})
 const originalModel={guardedBase:program.slice(baseGuard.start,baseGuard.end),builder:program.slice(builder.start,builder.end),consumer:program.slice(add.start,add.end),initializer:program.slice(entry.start,entry.end),clientAttributes:structuredClone(clientNode.attrs),containerAttributes:structuredClone(owned.attrs)}
 return{baseURL:board.href,consumerURL:consumer.href,model:{kind:'connected-native-v1-declared-consumer',containerID,frameID,currentOwnRoleSelector:false,constructorBindingConnected:true,frameAndContainerBindingConnected:true,nativeProgramsExecuted:false},originalModel,nativeProgramsExecuted:false,rendererOrUIActivationVerified:false}
}

export function qualifyV1Consumer(input){try{return qualify(input)}catch(cause){if(cause?.nativeContradiction===true)throw cause;throw Object.assign(Error('Current declared v1 consumer: invalid or unqualified native programme',{cause}),{abortRetries:true,nativeContradiction:true,failureKind:'parser_or_contract_error'})}}
