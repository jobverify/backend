import {isDeepStrictEqual as same} from 'node:util'
import {need,one} from './currentFacts20261120.js'
import {nativePrograms} from './currentLexical20261120.js'
import {scriptKind} from './currentScriptKind20261120.js'
import {currentOwnNextModel} from './currentNextState20261121.js'
import {currentRouteBootstrap} from './currentRouteBootstrap20261121.js'
import {guardCurrentProgrammeGlobals} from './currentProgrammeGlobals20261121.js'

const ROUTE='/careers/[slug]',HOME_ROUTE='/careers',functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const children=n=>Object.values(n??{}).flatMap(v=>Array.isArray(v)?v:[v]).filter(v=>v&&typeof v==='object'&&typeof v.type==='string')
const walk=(n,{nested=true}={})=>!n?[]:[n,...(functions.has(n.type)&&!nested?[]:children(n).flatMap(c=>walk(c,{nested})))]
const unwrap=n=>n?.type==='SequenceExpression'?unwrap(n.expressions.at(-1)):n
const fn=n=>functions.has(n?.type)
const UNKNOWN=Symbol('unresolved current expression')
function constant(p,input,depth=0){
 need(depth<=32,'finite current expression dependency exceeded');const node=p.resolve(input)
 if(node?.type==='Literal'&&(node.value==null||['string','number','boolean'].includes(typeof node.value)))return node.value
 if(node?.type==='UnaryExpression'&&node.operator==='!'){const value=constant(p,node.argument,depth+1);return value===UNKNOWN?UNKNOWN:!value}
 if(node?.type==='SequenceExpression')return constant(p,node.expressions.at(-1),depth+1)
 if(node?.type==='LogicalExpression'){const left=constant(p,node.left,depth+1);if(left===UNKNOWN)return UNKNOWN;if(node.operator==='&&')return left?constant(p,node.right,depth+1):left;if(node.operator==='||')return left?left:constant(p,node.right,depth+1);if(node.operator==='??')return left==null?constant(p,node.right,depth+1):left}
 if(node?.type==='ConditionalExpression'){const test=constant(p,node.test,depth+1);return test===UNKNOWN?UNKNOWN:constant(p,test?node.consequent:node.alternate,depth+1)}
 return UNKNOWN
}
function returnedValue(p,input,depth=0){
 need(depth<=32,'finite current returned dependency exceeded');const node=p.resolve(input)
 if(node?.type==='SequenceExpression')return returnedValue(p,node.expressions.at(-1),depth+1)
 if(node?.type==='LogicalExpression'){const left=constant(p,node.left);if(left!==UNKNOWN){if(node.operator==='&&')return returnedValue(p,left?node.right:node.left,depth+1);if(node.operator==='||')return returnedValue(p,left?node.left:node.right,depth+1);if(node.operator==='??')return returnedValue(p,left==null?node.right:node.left,depth+1)}}
 if(node?.type==='ConditionalExpression'){const test=constant(p,node.test);if(test!==UNKNOWN)return returnedValue(p,test?node.consequent:node.alternate,depth+1)}
 if(node?.type==='UnaryExpression'&&node.operator==='void')return null
 return node
}
function possible(p,root,target){
 for(let at=target;at&&at!==root;){const parent=p.parents.get(at);if(!parent)return false
  if(parent.type==='LogicalExpression'&&parent.right===at){const left=constant(p,parent.left);if(left!==UNKNOWN&&(parent.operator==='&&'&&!left||parent.operator==='||'&&left||parent.operator==='??'&&left!=null))return false}
  if(['ConditionalExpression','IfStatement'].includes(parent.type)&&at!==parent.test){const test=constant(p,parent.test);if(test!==UNKNOWN&&(at===parent.consequent&&!test||at===parent.alternate&&test))return false}
  if(['WhileStatement','ForStatement'].includes(parent.type)&&at===parent.body&&parent.test){const test=constant(p,parent.test);if(test!==UNKNOWN&&!test)return false}
  if(parent.type==='UnaryExpression'&&parent.operator==='void')return false
  at=parent
 }
 return true
}
function enclosing(p,node){for(let at=p.parents.get(node);at;at=p.parents.get(at))if(fn(at))return at;return null}
function liveBody(p,factory,target){need(factory?.body?.type==='BlockStatement','known current module body absent');need(possible(p,factory.body,target),'current consumer is behind an unreachable branch');const statements=factory.body.body,contains=s=>s.start<=target.start&&s.end>=target.end,index=statements.findIndex(contains);need(index>=0,'current consumer disconnected from module body');for(const statement of statements.slice(0,index))need(!walk(statement,{nested:false}).some(n=>['ReturnStatement','ThrowStatement'].includes(n.type)&&possible(p,statement,n)),'current consumer exits before initialization/export')}
function returned(p,f){need(fn(f),'actual connected component absent');if(f.body.type!=='BlockStatement')return returnedValue(p,f.body);const result=one(f.body.body.filter(n=>n.type==='ReturnStatement'),'actual component return');liveBody(p,f,result);return returnedValue(p,result.argument)}
function property(p,object,name){const value=p.resolve(object);need(value?.type==='ObjectExpression'&&value.properties.every(n=>n.type==='Property'&&!n.method&&n.kind==='init'),'current consumer object shape/spread differs');const entries=value.properties.filter(n=>(n.computed?p.literal(n.key):n.key.name??n.key.value)===name);return one(entries,'current consumer '+name).value}
function optionalProperty(p,object,name){const value=p.resolve(object);if(value?.type!=='ObjectExpression')return null;return value.properties.find(n=>n.type==='Property'&&(n.computed?p.literal(n.key):n.key.name??n.key.value)===name)?.value??null}
function bindingSame(p,a,b){return a?.type==='Identifier'&&b?.type==='Identifier'&&p.binding(a)!=null&&p.binding(a)===p.binding(b)}
function currentIdentityFields(p,node,seen=new Set()){
 if(!node||seen.has(node))return null
 const next=new Set(seen);next.add(node);need(next.size<=64,'finite current framework container dependency exceeded')
 const resolved=p.resolve(node);if(resolved!==node)return currentIdentityFields(p,resolved,next)
 if(node.type==='MemberExpression'){
  const selected=currentIdentityValues(p,node,seen),parts=selected.filter(value=>value!==node).map(value=>currentIdentityFields(p,value,next)).filter(Boolean)
  return parts.length?{array:parts.every(part=>part.array),fields:parts.flatMap(part=>part.fields)}:null
 }
 if(node.type==='ObjectExpression'){
  const fields=[]
  for(const property of node.properties){
   if(property.type==='SpreadElement'){const spread=currentIdentityFields(p,property.argument,next);fields.push(...(spread?.fields??[{key:null,values:[property.argument]}]));continue}
   const key=property.computed?p.literal(property.key):property.key.name??property.key.value
   fields.push({key,values:property.kind==='init'&&!property.method?[property.value]:walk(property.value).filter(value=>value.type==='Identifier')})
  }
  return{array:false,fields}
 }
 if(node.type==='ArrayExpression'){
  const fields=[];let index=0
  for(const value of node.elements){
   if(value?.type==='SpreadElement'){
    const spread=currentIdentityFields(p,value.argument,next)
    if(spread?.array&&index!==null&&spread.fields.every(field=>Number.isSafeInteger(field.key))){fields.push(...spread.fields.map(field=>({...field,key:index+field.key})));index+=spread.fields.length}
    else{fields.push({key:null,values:[value.argument]});index=null}
   }else{fields.push({key:index,values:value?[value]:[]});if(index!==null)index++}
  }
  return{array:true,fields}
 }
 return null
}
function currentIdentityValues(p,node,seen=new Set()){
 if(!node||seen.has(node))return[]
 const next=new Set(seen);next.add(node);need(next.size<=64,'finite current framework identity dependency exceeded')
 const resolved=p.resolve(node);if(resolved!==node)return currentIdentityValues(p,resolved,next)
 if(node.type==='SequenceExpression')return currentIdentityValues(p,node.expressions.at(-1),next)
 if(node.type==='ConditionalExpression')return[...currentIdentityValues(p,node.consequent,next),...currentIdentityValues(p,node.alternate,next)]
 if(node.type==='LogicalExpression')return[...currentIdentityValues(p,node.left,next),...currentIdentityValues(p,node.right,next)]
 if(node.type!=='MemberExpression')return[node]
 const key=p.member(node),container=currentIdentityFields(p,node.object,next);if(!container)return[node]
 let selected=[]
 for(const field of container.fields){if(key===null||field.key===null)selected.push(...field.values);else if(String(field.key)===String(key))selected=[...field.values]}
 return selected.length?selected.flatMap(value=>currentIdentityValues(p,value,next)):[node]
}
function transfersCurrentIdentity(p,node,predicate,seen=new Set()){
 if(!node||seen.has(node))return false;seen.add(node)
 if(predicate(node))return true
 const resolved=p.resolve(node);if(resolved!==node)return transfersCurrentIdentity(p,resolved,predicate,seen)
 if(node.type==='ArrayExpression')return node.elements.some(value=>transfersCurrentIdentity(p,value,predicate,seen))
 if(node.type==='ObjectExpression')return node.properties.some(property=>transfersCurrentIdentity(p,property.type==='SpreadElement'?property.argument:property.value,predicate,seen))
 if(node.type==='SpreadElement')return transfersCurrentIdentity(p,node.argument,predicate,seen)
 if(node.type==='SequenceExpression')return transfersCurrentIdentity(p,node.expressions.at(-1),predicate,seen)
 if(node.type==='ConditionalExpression')return transfersCurrentIdentity(p,node.consequent,predicate,seen)||transfersCurrentIdentity(p,node.alternate,predicate,seen)
 if(node.type==='LogicalExpression')return transfersCurrentIdentity(p,node.left,predicate,seen)||transfersCurrentIdentity(p,node.right,predicate,seen)
 return false
}
function memberOf(p,node,object,name){return node?.type==='MemberExpression'&&p.member(node)===name&&bindingSame(p,node.object,object)}
function staticString(p,node,depth=0){need(depth<=24,'finite current account string dependency exceeded');const value=p.resolve(node);if(value?.type==='Literal'&&typeof value.value==='string')return value.value;if(value?.type==='TemplateLiteral'){let result=value.quasis[0].value.cooked;for(let i=0;i<value.expressions.length;i++)result+=staticString(p,value.expressions[i],depth+1)+value.quasis[i+1].value.cooked;return result}if(value?.type==='BinaryExpression'&&value.operator==='+')return staticString(p,value.left,depth+1)+staticString(p,value.right,depth+1);need(false,'current connected account string is not immutable literal data')}
function boolean(p,node){const value=p.resolve(node);if(value?.type==='Literal')return Boolean(value.value);if(value?.type==='UnaryExpression'&&value.operator==='!'){const arg=p.resolve(value.argument);need(arg?.type==='Literal','actual boolean setting dependency unresolved');return !arg.value}need(false,'actual boolean setting is unresolved')}
function pattern(p,f,name){const object=f.params[0];need(object?.type==='ObjectPattern','connected current component props absent');const entry=one(object.properties.filter(n=>n.type==='Property'&&(n.computed?p.literal(n.key):n.key.name??n.key.value)===name),'current actual '+name+' parameter');need(entry.value.type==='Identifier'&&p.binding(entry.value)?.writes.length===0,'current actual component parameter is replaced');return entry.value}
function packetReceiver(p,node){if(node?.type!=='LogicalExpression'||node.operator!=='||')return false;const a=node.left,b=node.right;return a.type==='MemberExpression'&&p.global(a.object)&&p.member(a)==='TURBOPACK'&&b.type==='AssignmentExpression'&&b.operator==='='&&b.left.type==='MemberExpression'&&p.global(b.left.object)&&p.member(b.left)==='TURBOPACK'&&b.right.type==='ArrayExpression'&&b.right.elements.length===0}
function registry(programs,allowedAssignments,allowedReferences,bootstrap){
 const modules=new Map()
 for(const p of programs)for(const statement of p.tree.body){
  const call=statement.type==='ExpressionStatement'?statement.expression:null
  if(call?.type!=='CallExpression'||p.member(call.callee)!=='push'||!packetReceiver(p,call.callee.object))continue
  need(call.arguments.length===1,'current module packet malformed')
  const receiver=call.callee.object;allowedAssignments.add(receiver.right);allowedReferences.add(receiver.left);allowedReferences.add(receiver.right.left)
  const packet=call.arguments[0]
  if(packet.type==='ObjectExpression'){
   let config;try{config=JSON.parse(p.script.raw.slice(packet.start,packet.end))}catch{need(false,'current own runtime bootstrap is not literal data')}
   need([ROUTE,'/_app'].some(route=>same(config,structuredClone(bootstrap[route]))),'current own runtime bootstrap was replaced');continue
  }
  need(packet.type==='ArrayExpression','current module packet malformed')
  let pending=[]
  for(const value of packet.elements.slice(1)){
   if(value?.type==='Literal'&&Number.isSafeInteger(value.value)){pending.push(value.value);continue}
   need(fn(value)&&pending.length>0,'current actual module factory grouping malformed')
   for(const id of pending){need(!modules.has(id),'ambiguous/replaced current own module');modules.set(id,{p,factory:value,ids:[...pending]})}
   pending=[]
  }
  need(pending.length===0,'current module packet has no factory')
 }
 need(modules.size>0,'current own connected module registry missing');return modules
}
function contextCall(p,node,factory,method){const target=unwrap(node?.callee);return node?.type==='CallExpression'&&target?.type==='MemberExpression'&&p.member(target)===method&&bindingSame(p,target.object,factory.params[0])}
function exported(modules,id,name){const owner=modules.get(id);need(owner,'connected current module unavailable');const{p,factory,ids}=owner,values=[];for(const call of p.nodes.filter(n=>enclosing(p,n)===factory&&contextCall(p,n,factory,'s'))){const targetID=call.arguments[1]?p.literal(call.arguments[1]):ids.length===1?ids[0]:null;if(targetID!==id)continue;liveBody(p,factory,call);const exports=p.resolve(call.arguments[0]);need(exports?.type==='ArrayExpression'&&exports.elements.length%3===0,'current actual export declaration differs');for(let at=0;at<exports.elements.length;at+=3)if(p.literal(exports.elements[at])===name){need(p.literal(exports.elements[at+1])===0,'current connected export is not a direct value');values.push(p.resolve(exports.elements[at+2]))}}return{...owner,value:one(values,'current module export '+name)}}
function imported(p,node,factory){need(node?.type==='MemberExpression','current connected imported export differs');const call=p.resolve(node.object);need(contextCall(p,call,factory,'i')&&call.arguments.length===1,'current imported component owner differs');const id=p.literal(call.arguments[0]);need(Number.isSafeInteger(id),'current imported module identity is not literal');return{id,name:p.member(node)}}
function jsxCalls(p,expression){return walk(expression,{nested:false}).filter(node=>{const target=unwrap(node.callee);return node.type==='CallExpression'&&target?.type==='MemberExpression'&&['jsx','jsxs'].includes(p.member(target))&&node.arguments.length===2&&node.arguments[1].type==='ObjectExpression'&&possible(p,expression,node)})}

// Resolve the current declared module graph rather than treating an import's
// numeric label or a familiar member name as framework authority. Only the
// supported CommonJS forwarding and React element/effect semantics qualify.
function missingModule(id){throw Object.assign(Error('Current connected framework module unavailable'),{currentProgrammeModuleUnavailable:true,currentProgrammeModuleID:id})}
function commonExport(modules,id,name,seen=new Set()){
 need(seen.size<=16&&!seen.has(id),'finite/cyclic current framework export dependency');const owner=modules.get(id);if(!owner)missingModule(id)
 const{p,factory}=owner;need(factory.params.length===3&&factory.params.every(n=>n.type==='Identifier'),'actual framework CommonJS owner differs')
 const module=factory.params[1],namespace=factory.params[2],within=p.nodes.filter(n=>enclosing(p,n)===factory),forward=within.filter(n=>n.type==='AssignmentExpression'&&memberOf(p,n.left,module,'exports'))
 if(forward.length){const assignment=one(forward,'actual current framework forwarding export');need(assignment.operator==='='&&contextCall(p,assignment.right,factory,'r')&&assignment.right.arguments.length===1,'actual current framework forwarding dependency differs');liveBody(p,factory,assignment);const target=p.literal(assignment.right.arguments[0]);need(Number.isSafeInteger(target),'actual framework dependency identity unresolved');guardFrameworkNamespace(p,factory,module,new Set([assignment]));const next=new Set(seen);next.add(id);return commonExport(modules,target,name,next)}
 const values=within.filter(n=>n.type==='AssignmentExpression'&&n.operator==='='&&memberOf(p,n.left,namespace,name)),assignment=one(values,'actual framework '+name+' export');liveBody(p,factory,assignment);guardFrameworkNamespace(p,factory,namespace,new Set(within.filter(n=>n.type==='AssignmentExpression'&&n.operator==='='&&n.left.type==='MemberExpression'&&bindingSame(p,n.left.object,namespace))))
 return{...owner,namespace,value:p.resolve(assignment.right),assignment}
}
function guardFrameworkNamespace(p,factory,object,allowed){
 need(!p.binding(object)?.writes.length,'current framework namespace binding replaced')
 const original=p.resolve(object)
 const rooted=node=>{const value=p.resolve(node);return bindingSame(p,node,object)||bindingSame(p,value,object)||value!=null&&value===original||value?.type==='MemberExpression'&&rooted(value.object)}
 for(const node of p.nodes.filter(n=>enclosing(p,n)===factory)){
  const target=node.type==='AssignmentExpression'?node.left:node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete'?node.argument:null
  if(target?.type==='MemberExpression'&&rooted(target.object))need(allowed.has(node),'current framework namespace export was replaced')
  if(node.type==='CallExpression')need(!node.arguments.some(n=>rooted(n.type==='SpreadElement'?n.argument:n)),'current framework namespace escaped to an unqualified consumer')
  if(node.type==='ReturnStatement')need(!rooted(node.argument),'current framework namespace escaped through a return')
 }
}
function symbol(p,node,value){const call=p.resolve(node);return call?.type==='CallExpression'&&p.member(call.callee)==='for'&&p.builtin(call.callee.object,'Symbol')&&call.arguments.length===1&&p.literal(call.arguments[0])===value}
function qualifyFrameworkEffect(modules,source,hook,factory){
 const reference=imported(source,hook,factory);need(reference.name==='useEffect','actual connected effect export differs');const current=commonExport(modules,reference.id,reference.name),{p,value,namespace}=current
 need(fn(value)&&value.params.length===2&&value.params.every(n=>n.type==='Identifier')&&value.body.type==='BlockStatement'&&value.body.body.length===1&&value.body.body[0].type==='ReturnStatement','actual current effect is not supported dispatcher forwarding')
 const call=returned(p,value),target=unwrap(call?.callee),dispatcher=target?.object
 need(call?.type==='CallExpression'&&p.member(target)==='useEffect'&&dispatcher?.type==='MemberExpression'&&p.member(dispatcher)==='H'&&call.arguments.length===2&&call.arguments.every((n,i)=>bindingSame(p,n,value.params[i])),'actual current effect callback/dependencies are discarded')
 const state=p.resolve(dispatcher.object);need(state?.type==='ObjectExpression'&&p.literal(property(p,state,'H'))===null,'actual current effect dispatcher is unresolved')
 const exposed=p.nodes.filter(n=>enclosing(p,n)===current.factory&&n.type==='AssignmentExpression'&&n.operator==='='&&n.left.type==='MemberExpression'&&bindingSame(p,n.left.object,namespace)&&String(p.member(n.left)).startsWith('__CLIENT_INTERNALS_')&&p.resolve(n.right)===state),exposure=one(exposed,'actual current framework dispatcher export')
 guardFrameworkNamespace(p,current.factory,dispatcher.object,new Set())
 const identity=node=>currentIdentityValues(p,node).some(value=>bindingSame(p,value,dispatcher.object)||p.resolve(value)===state),transfer=node=>transfersCurrentIdentity(p,node,identity),path=(node,seen=new Set())=>{if(!node||seen.has(node))return null;seen.add(node);if(identity(node))return[];const resolved=p.resolve(node);if(resolved!==node)return path(resolved,seen);if(node.type!=='MemberExpression')return null;const parent=path(node.object,seen);return parent?[...parent,p.member(node)]:null}
 for(const node of p.nodes){
  if(node.type==='VariableDeclarator'&&transfer(node.init))need(node.id.type==='Identifier'&&!p.binding(node.id)?.writes.length,'actual current dispatcher escaped through a mutable alias')
  if(node.type==='AssignmentExpression'&&node!==exposure)need(!transfer(node.right),'actual current dispatcher escaped through a mutable transfer')
  if(node.type==='ReturnStatement')need(!transfer(node.argument),'actual current dispatcher escaped through an unqualified return')
  const target=node.type==='AssignmentExpression'?node.left:node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete'?node.argument:null,fields=path(target)
  if(fields?.length)need(fields[0]!==null&&fields[0]!=='H','actual current effect dispatcher owner is replaced in a connected closure')
  if(node.type==='CallExpression'||node.type==='NewExpression')need(!node.arguments.some(transfer),'actual current dispatcher escaped to an unqualified consumer')
 }
 return{moduleID:reference.id,exportName:reference.name}
}
function qualifyFrameworkJSX(modules,source,call,factory){
 const target=unwrap(call?.callee);need(call?.type==='CallExpression'&&target?.type==='MemberExpression'&&['jsx','jsxs'].includes(source.member(target)),'actual component return has no supported JSX owner');const reference=imported(source,target,factory),current=commonExport(modules,reference.id,reference.name),{p,value}=current
 need(fn(value)&&value.params.length===3&&value.params.every(n=>n.type==='Identifier'),'actual current JSX factory is unresolved');const result=returned(p,value);need(result?.type==='ObjectExpression','actual current JSX factory discards its element')
 const[type,props]=value.params;need(!p.binding(type)?.writes.length,'actual current JSX component identity is replaced');need(bindingSame(p,property(p,result,'type'),type),'actual current JSX factory discards component identity');const marker=property(p,result,'$$typeof');need(symbol(p,marker,'react.transitional.element')||symbol(p,marker,'react.element'),'actual current JSX factory element marker differs')
 const output=property(p,result,'props'),copy=value.params[2];need(bindingSame(p,output,props)||bindingSame(p,output,copy),'actual current JSX factory discards component props')
 const copyWrites=new Set(),propertyWrites=new Set()
 if(bindingSame(p,output,copy)){
  const branch=one(value.body.body.filter(n=>n.type==='IfStatement'),'actual current JSX props-copy branch'),test=unwrap(branch.test),otherwise=branch.alternate?.expression,loop=branch.consequent
  need(test?.type==='BinaryExpression'&&test.operator==='in'&&p.literal(test.left)==='key'&&bindingSame(p,test.right,props)&&otherwise?.type==='AssignmentExpression'&&otherwise.operator==='='&&bindingSame(p,otherwise.left,copy)&&bindingSame(p,otherwise.right,props),'actual current JSX ordinary props are disconnected')
  need(loop?.type==='ForInStatement'&&loop.left.type==='VariableDeclaration'&&loop.left.declarations.length===1&&loop.left.declarations[0].id.type==='Identifier','actual current JSX copied props iterator differs');const iterator=loop.left.declarations[0].id,right=loop.right,initialize=right?.type==='SequenceExpression'?right.expressions[0]:null
  need(right?.type==='SequenceExpression'&&right.expressions.length===2&&initialize?.type==='AssignmentExpression'&&bindingSame(p,initialize.left,copy)&&initialize.operator==='='&&initialize.right.type==='ObjectExpression'&&initialize.right.properties.length===0&&bindingSame(p,right.expressions[1],props),'actual current JSX copied props source differs')
  const body=loop.body,logical=body?.type==='ExpressionStatement'&&body.expression.type==='LogicalExpression'&&body.expression.operator==='&&'?body.expression:null,condition=logical?logical.left:body?.test,assignment=logical?logical.right:body?.consequent?.expression
  need((logical||body?.type==='IfStatement')&&condition?.type==='BinaryExpression'&&condition.operator==='!=='&&p.literal(condition.left)==='key'&&bindingSame(p,condition.right,iterator)&&assignment?.type==='AssignmentExpression'&&assignment.operator==='='&&assignment.left.type==='MemberExpression'&&assignment.left.computed&&bindingSame(p,assignment.left.object,copy)&&bindingSame(p,assignment.left.property,iterator)&&assignment.right.type==='MemberExpression'&&assignment.right.computed&&bindingSame(p,assignment.right.object,props)&&bindingSame(p,assignment.right.property,iterator),'actual current JSX copied props are discarded')
  copyWrites.add(initialize.left);copyWrites.add(otherwise.left);propertyWrites.add(assignment)
 }
 const ref=optionalProperty(p,result,'ref'),refWrites=new Set(walk(ref,{nested:false}).filter(node=>node.type==='AssignmentExpression'&&node.operator==='='&&bindingSame(p,node.left,props)&&memberOf(p,node.right,copy,'ref')).map(node=>node.left))
 need((p.binding(props)?.writes??[]).every(node=>bindingSame(p,output,copy)&&refWrites.has(node)),'actual current JSX input props are replaced before publication')
 need((p.binding(copy)?.writes??[]).every(node=>copyWrites.has(node)),'actual current JSX copied props are replaced before publication')
 const critical=node=>currentIdentityValues(p,node).some(value=>[type,props,copy].some(input=>bindingSame(p,value,input)))
 for(const node of walk(value.body)){
  if(node.type==='VariableDeclarator'&&transfersCurrentIdentity(p,node.init,critical))need(node.id.type==='Identifier'&&!p.binding(node.id)?.writes.length,'actual current JSX input/copy escaped through a mutable alias')
  if(node.type==='AssignmentExpression'&&transfersCurrentIdentity(p,node.right,critical))need(copyWrites.has(node.left)||propertyWrites.has(node),'actual current JSX input/copy escaped through a mutable transfer')
  const target=node.type==='AssignmentExpression'?node.left:node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete'?node.argument:null
  if(target?.type==='MemberExpression'&&critical(target.object))need(propertyWrites.has(node),'actual current JSX input/copy property is replaced')
  if(node.type==='CallExpression'||node.type==='NewExpression')need(!node.arguments.some(value=>transfersCurrentIdentity(p,value,critical))&&!(node.callee.type==='MemberExpression'&&transfersCurrentIdentity(p,node.callee.object,critical)),'actual current JSX input/copy escaped to an unqualified consumer')
 }
 const partner=commonExport(modules,reference.id,reference.name==='jsx'?'jsxs':'jsx');need(partner.value===value,'actual current JSX entry points have contradictory implementations')
 return{moduleID:reference.id,exportName:reference.name}
}

export function declaredRoleProgrammes(home,role,manifestText,at,carrier){
 const bootstrap=currentRouteBootstrap(manifestText).originalModel,config=bootstrap[ROUTE],homeConfig=bootstrap[HOME_ROUTE]
 for(const value of[config,homeConfig])need(value&&Array.isArray(value.otherChunks)&&value.otherChunks.length>0&&value.otherChunks.length<=64&&value.otherChunks.every(v=>typeof v==='string')&&Array.isArray(value.runtimeModuleIds)&&value.runtimeModuleIds.length>0&&value.runtimeModuleIds.length<=32&&value.runtimeModuleIds.every(Number.isSafeInteger),'current own route bootstrap shape differs')
 const registrations=[]
 for(const node of role.page.nodes.filter(n=>n.tag==='script'&&!n.attrs.src&&scriptKind(n))){const[p]=nativePrograms([{...node,attrs:{...node.attrs,type:scriptKind(node)==='module'?'module':''}}]);for(const statement of p.tree.body){const call=statement.type==='ExpressionStatement'?statement.expression:null;if(call?.type!=='CallExpression'||p.member(call.callee)!=='push'||!packetReceiver(p,call.callee.object)||call.arguments.length!==1||call.arguments[0].type!=='ObjectExpression')continue;const source=node.raw.slice(call.arguments[0].start,call.arguments[0].end);let object;try{object=JSON.parse(source)}catch{continue}if(same(object,structuredClone(config))){carrier(role.page,node,at,{allowed:[role.applyLink,role.applyLink+'/application']});registrations.push(object)}}}
 need(registrations.length===1,'actual role runtime bootstrap is disconnected from current manifest')
 const shared=new Set(homeConfig.otherChunks),preferred=config.otherChunks.filter(value=>!shared.has(value)&&value.endsWith('.js'));need(preferred.length>0&&preferred.length<=32,'current own route dependency discovery unavailable')
 const entries=preferred.map(value=>{need(/^static\/[A-Za-z0-9_./-]+\.js$/.test(value)&&!value.split('/').includes('..'),'current actual role chunk URI differs');const url=new URL('/_next/'+value,home.url).href,node=one(role.page.nodes.filter(n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,role.url).href===url),'current declared own route programme');need(scriptKind(node),'current own role script is a data block');carrier(role.page,node,at,{allowed:[role.applyLink,role.applyLink+'/application']});return{url,attributes:structuredClone(node.attrs)}})
 const appConfig=bootstrap['/_app'];need(appConfig&&Array.isArray(appConfig.otherChunks)&&appConfig.otherChunks.length>0&&appConfig.otherChunks.length<=64,'current declared application dependencies unavailable')
 const dependencyEntries=appConfig.otherChunks.filter(value=>typeof value==='string'&&value.endsWith('.js')).map(value=>{need(/^static\/[A-Za-z0-9_./-]+\.js$/.test(value)&&!value.split('/').includes('..'),'current actual shared chunk URI differs');const url=new URL('/_next/'+value,home.url).href,node=one(role.page.nodes.filter(n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,role.url).href===url),'current declared shared framework programme');need(scriptKind(node),'current shared framework script is a data block');carrier(role.page,node,at,{allowed:[role.applyLink,role.applyLink+'/application']});return{url,attributes:structuredClone(node.attrs)}})
 need(new Set([...entries,...dependencyEntries].map(e=>e.url)).size===entries.length+dependencyEntries.length,'current declared framework programme is repeated')
 return{entries,dependencyEntries,runtimeModuleIds:config.runtimeModuleIds,bootstrap,originalManifest:manifestText}
}

export function qualifyRoleProgramme(home,role,declaration,originals,board,dependencies=[]){
 need(originals.length===declaration.entries.length&&originals.length<=32,'actual complete own programme dependencies unavailable')
 need(dependencies.length<=declaration.dependencyEntries.length,'finite actual shared framework dependency prefix exceeded');const entries=[...declaration.entries,...declaration.dependencyEntries.slice(0,dependencies.length)]
 const scripts=[...originals,...dependencies].map((original,index)=>{need(original.url===entries[index].url,'actual own programme order/identity differs');return{raw:original.text,attrs:{...entries[index].attributes,type:scriptKind({attrs:entries[index].attributes})==='module'?'module':''}}}),inline=role.page.nodes.filter(node=>node.tag==='script'&&!node.attrs.src&&scriptKind(node)).map(node=>({...node,attrs:{...node.attrs,type:scriptKind(node)==='module'?'module':''}})),manifestScript={raw:declaration.originalManifest,attrs:{type:''}},programs=nativePrograms([...inline,manifestScript,...scripts]),allowedAssignments=new Set(),allowedReferences=new Set(),modules=registry(programs,allowedAssignments,allowedReferences,declaration.bootstrap),framework=[]
 // The actual JSON carrier stays data; external programme bytes are analyzed
 // separately with the same scoped overwrite guards, without executing them.
 currentOwnNextModel(role.page.d,[manifestScript,...scripts])
 const routeOwners=[]
 for(const id of declaration.runtimeModuleIds){const owner=modules.get(id);if(!owner)continue;const{p,factory}=owner;for(const call of p.nodes.filter(n=>enclosing(p,n)===factory&&n.type==='CallExpression'&&p.member(n.callee)==='push')){const receiver=call.callee.object,logical=receiver.type==='AssignmentExpression'?receiver.right:null,target=receiver.type==='AssignmentExpression'?receiver.left:null;if(!target||target.type!=='MemberExpression'||!p.global(target.object)||p.member(target)!=='__NEXT_P'||logical?.type!=='LogicalExpression'||logical.operator!=='||')continue;const a=call.arguments[0];if(a?.type!=='ArrayExpression'||a.elements.length!==2||p.literal(a.elements[0])!==ROUTE)continue;need(logical.left.type==='MemberExpression'&&p.global(logical.left.object)&&p.member(logical.left)==='__NEXT_P'&&logical.right.type==='ArrayExpression'&&logical.right.elements.length===0,'actual registered route initialization differs');liveBody(p,factory,call);const callback=a.elements[1];need(fn(callback)&&callback.params.length===0,'actual current route callback differs');const value=returned(p,callback);need(contextCall(p,value,factory,'r')&&value.arguments.length===1,'actual current route callback is disconnected');allowedAssignments.add(receiver);allowedReferences.add(target);allowedReferences.add(logical.left);routeOwners.push({id:p.literal(value.arguments[0]),p,factory})}}
 const routeOwner=one(routeOwners,'actual registered current role page'),pageID=routeOwner.id,page=exported(modules,pageID,'default'),posting=pattern(page.p,page.value,'posting'),pageReturn=returned(page.p,page.value),consumers=[]
 // The same route's authored hot-dispose callback only queues its own route.
 // It cannot provide a second current page or let an unrelated queue escape.
 for(const p of programs)for(const node of p.nodes){
  if(node.type!=='MemberExpression'||!p.global(node.object)||p.member(node)!=='__NEXT_P'||allowedReferences.has(node))continue
  const access=p.parents.get(node),call=p.parents.get(access),callback=enclosing(p,node),dispose=p.parents.get(callback),target=dispose?.callee,hot=target?.object
  if(p===routeOwner.p&&access?.type==='MemberExpression'&&p.member(access)==='push'&&call?.type==='CallExpression'&&call.arguments.length===1&&call.arguments[0]?.type==='ArrayExpression'&&call.arguments[0].elements.length===1&&p.literal(call.arguments[0].elements[0])===ROUTE&&dispose?.type==='CallExpression'&&dispose.arguments.length===1&&dispose.arguments[0]===callback&&p.member(target)==='dispose'&&p.member(hot)==='hot'&&bindingSame(p,hot.object,routeOwner.factory.params[1]))allowedReferences.add(node)
 }
 framework.push(qualifyFrameworkJSX(modules,page.p,pageReturn,page.factory))
 for(const call of jsxCalls(page.p,pageReturn)){qualifyFrameworkJSX(modules,page.p,call,page.factory);const object=call.arguments[1],id=optionalProperty(page.p,object,'jobPostingId'),link=optionalProperty(page.p,object,'applyLink');if(!id&&!link)continue;need(memberOf(page.p,id,posting,'id')&&memberOf(page.p,link,posting,'applyLink'),'actual own posting identity/application dependency differs');const owner=imported(page.p,call.arguments[0],page.factory);consumers.push(exported(modules,owner.id,owner.name))}
 const app=one(consumers,'same connected current own application component'),jobID=pattern(app.p,app.value,'jobPostingId'),applyLink=pattern(app.p,app.value,'applyLink'),appReturn=returned(app.p,app.value),rendered=jsxCalls(app.p,appReturn)
 framework.push(qualifyFrameworkJSX(modules,app.p,appReturn,app.factory));for(const call of rendered)qualifyFrameworkJSX(modules,app.p,call,app.factory)
 one(rendered.filter(call=>{const href=optionalProperty(app.p,call.arguments[1],'href');return href&&bindingSame(app.p,href,applyLink)}),'same actual published public-job fallback handoff')
 one(rendered.filter(call=>{const props=call.arguments[1],id=optionalProperty(app.p,props,'id'),jid=optionalProperty(app.p,props,'data-jid');return app.p.literal(id)==='ashby_embed'&&jid&&bindingSame(app.p,jid,jobID)}),'same actual role-scoped container')
 const script=one(rendered.filter(call=>{const id=optionalProperty(app.p,call.arguments[1],'id');return app.p.literal(id)==='ashby-embed-script'}),'actual same-account own embed declaration'),src=staticString(app.p,property(app.p,script.arguments[1],'src'));need(src===board+'/embed?version=2','actual own account embed URI differs')
 const settings=[]
 for(const call of app.p.nodes.filter(n=>enclosing(app.p,n)===app.value&&n.type==='CallExpression'&&app.p.member(unwrap(n.callee))==='useEffect')){
  liveBody(app.p,app.value,call);const callback=call.arguments[0];if(!fn(callback))continue
  for(const assignment of walk(callback.body,{nested:false}).filter(n=>n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&app.p.global(n.left.object)&&app.p.member(n.left)==='__Ashby')){
   const hook=unwrap(call.callee);framework.push(qualifyFrameworkEffect(modules,app.p,hook,app.factory))
   liveBody(app.p,callback,assignment);const model=optionalProperty(app.p,assignment.right,'settings');if(!model)continue
   const base=staticString(app.p,property(app.p,model,'ashbyBaseJobBoardUrl')),mode=app.p.literal(property(app.p,model,'displayMode')),id=property(app.p,model,'jobPostingId');need(base===board&&mode==='application-form-only'&&bindingSame(app.p,id,jobID)&&boolean(app.p,property(app.p,model,'autoLoad'))===true,'actual role-specific account/default settings differ');settings.push({base,mode,assignment})
  }
 }
 const setting=one(settings,'actual connected role-specific native initialization');allowedAssignments.add(setting.assignment)
 guardCurrentProgrammeGlobals(programs,{names:['TURBOPACK','__NEXT_P','__Ashby'],allowedAssignments,referenceNames:['TURBOPACK','__NEXT_P'],allowedReferences})
 need(role.applyLink===board+'/'+role.id,'actual own published public-job handoff differs from connected account')
 return{publicJobBase:board,publicJobURL:role.applyLink,roleID:role.id,displayMode:'application-form-only',unfilteredInventory:false,programmesExecuted:false,rendererOrUIActivationVerified:false,backendApplicationActivationVerified:false,applicationEndpointFetched:false,declaredProgrammeURLs:entries.map(e=>e.url),originalProgrammeTexts:[...originals,...dependencies].map(p=>({url:p.url,text:p.text})),frameworkImportProof:framework,originalRouteBootstrap:declaration.bootstrap,source:'current-own-Next-posting-through-current-registered-page-and-current-connected-form-only-component'}
}
