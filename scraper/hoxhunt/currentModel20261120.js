import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {need,one} from './currentFacts20261120.js'
import {nativePrograms} from './currentLexical20261120.js'
import {scriptKind} from './currentScriptKind20261120.js'

// Qualify the original public state by lexical identities and finite known
// write semantics. Native JavaScript remains data and never executes.
const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
export function currentNativeModel(d){
 const scripts=d.nodes(n=>n.tag==='script'&&!n.attrs.src).flatMap(node=>{const kind=scriptKind(node);return kind?[{...node,attrs:{...node.attrs,type:kind==='module'?'module':''},originalNode:node}]:[]}),programs=nativePrograms(scripts),owners=new Map()
 for(const p of programs)for(const node of p.nodes)owners.set(node,p)
 const owner=(p,node)=>owners.get(node)??p,member=(p,node,name)=>node?.type==='MemberExpression'&&p.member(node)===name,builtin=(p,node,name)=>p.builtin(node,name)||member(p,p.resolve(node),name)&&p.global(p.resolve(node).object),root=(p,node)=>member(p,node,'__appData')&&p.global(node.object),references=programs.flatMap(p=>p.nodes.filter(node=>root(p,node))),assignments=programs.flatMap(p=>p.tree.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='AssignmentExpression'&&root(p,node.expression.left)).map(node=>({assignment:node.expression,node:p.script.originalNode}))),original=one(assignments,'original active top-level state assignment')
 need(original.assignment.operator==='='&&original.assignment.right.type==='ObjectExpression'&&references.length===1&&references[0]===original.assignment.left,'Native original state overwritten, escaped or disconnected')
 const checkedArrays=new WeakSet();let argumentArrays=0
 function browserBinding(p,node){
  const current=owner(p,node),binding=current.binding(node)
  if(!binding)return true
  return binding.scope.type==='global'&&binding.defs.some(def=>{const source=owner(current,def.pattern);for(let at=source.parents.get(def.pattern);at;at=source.parents.get(at)){if(at.type==='FunctionDeclaration')return true;if(at.type==='VariableDeclaration')return at.kind==='var';if(functions.has(at.type))return false}return false})
 }
 function written(p,target,operation){
  if(!target)return
  if(target.type==='ObjectPattern'){for(const property of target.properties)written(p,property.type==='RestElement'?property.argument:property.value,operation);return}
  if(target.type==='ArrayPattern'){for(const element of target.elements)written(p,element,operation);return}
  if(target.type==='AssignmentPattern'){written(p,target.left,operation);return}
  if(target.type==='RestElement'){written(p,target.argument,operation);return}
  if(target.type==='Identifier'){need(target.name!=='__appData'||!browserBinding(p,target),'Native original state replaced by an unqualified browser property write');return}
  if(target.type!=='MemberExpression'||!p.global(target.object))return
  const key=p.member(target);need(key!=null,'Unqualified computed native state write');need(key!=='__appData'||operation===original.assignment,'Native original state replaced by a browser property write')
 }
 function globalDeclaration(p,pattern,operation){
  if(!pattern)return
  if(pattern.type==='Identifier'){const binding=p.binding(pattern);if(binding?.scope.type==='global')written(p,pattern,operation);return}
  if(pattern.type==='ObjectPattern'){for(const property of pattern.properties)globalDeclaration(p,property.type==='RestElement'?property.argument:property.value,operation);return}
  if(pattern.type==='ArrayPattern'){for(const element of pattern.elements)globalDeclaration(p,element,operation);return}
  if(pattern.type==='AssignmentPattern')globalDeclaration(p,pattern.left,operation)
  if(pattern.type==='RestElement')globalDeclaration(p,pattern.argument,operation)
 }
 function globalFunction(p,node){
  if(p.module||node.id?.name!=='__appData')return false
  if(p.parents.get(node)?.type==='Program')return true
  if(p.tree.body.some(statement=>statement.directive==='use strict'))return false
  for(let at=p.parents.get(node);at;at=p.parents.get(at))if(functions.has(at.type)||['ClassDeclaration','ClassExpression','StaticBlock'].includes(at.type))return false
  return true
 }
 function criticalCallable(p,input,depth=0){
  need(depth<=8,'finite native callable scope exceeded');const target=p.resolve(input)
  if(target?.type==='CallExpression'){const binder=p.resolve(target.callee);return member(p,binder,'bind')&&criticalCallable(p,binder.object,depth+1)}
  if(target?.type!=='MemberExpression')return false
  const method=p.member(target),namespace=p.resolve(target.object)
  if(builtin(p,namespace,'Reflect')&&method==='apply')return true
  if(['call','apply','bind'].includes(method))return criticalCallable(p,namespace,depth+1)
  return builtin(p,namespace,'Object')&&['assign','defineProperty','defineProperties'].includes(method)||builtin(p,namespace,'Reflect')&&['apply','set','defineProperty','deleteProperty'].includes(method)
 }
 function referencesArray(p,input,array,depth=0){
  need(depth<=16,'finite native argument alias scope exceeded');const value=p.resolve(input)
  if(value===array)return true
  if(value?.type==='SpreadElement')return referencesArray(p,value.argument,array,depth+1)
  if(value?.type==='ObjectExpression')return value.properties.some(property=>referencesArray(p,property.type==='SpreadElement'?property.argument:property.value,array,depth+1))
  if(value?.type==='ArrayExpression')return value.elements.some(element=>referencesArray(p,element,array,depth+1))
  return false
 }
 function arrayContents(p,input,critical){
  const array=p.resolve(input);if(array?.type!=='ArrayExpression'){need(!critical,'Unqualified spread native mutation arguments');return null}
  if(critical)need(array.elements.every(Boolean),'Sparse native mutation arguments')
  if(critical&&!checkedArrays.has(array)){
   need(++argumentArrays<=128,'finite native argument dependency scope exceeded');checkedArrays.add(array)
   for(const source of programs)for(const node of source.nodes){
    if(node.type==='VariableDeclarator'&&referencesArray(source,node.init,array))need(node.id.type==='Identifier'&&!source.binding(node.id)?.writes.length,'Native argument tuple has a written alias')
    const target=node.type==='AssignmentExpression'?node.left:['UpdateExpression','UnaryExpression'].includes(node.type)?node.argument:null
    if(target?.type==='MemberExpression'&&source.resolve(target.object)===array)need(false,'Native argument tuple member changed')
    if(node.type==='AssignmentExpression'&&referencesArray(source,node.right,array))need(false,'Native argument tuple escaped through an assignment')
    if(node.type==='ReturnStatement'&&referencesArray(source,node.argument,array))need(false,'Native argument tuple escaped through a return')
    if(node.type!=='CallExpression')continue
    const callee=source.resolve(node.callee)
    if(callee?.type==='MemberExpression'&&source.resolve(callee.object)===array)need(false,'Native argument tuple method may change values')
    for(let index=0;index<node.arguments.length;index++)if(node.arguments[index]?.type!=='SpreadElement'&&referencesArray(source,node.arguments[index],array)){
     const applied=member(source,callee,'apply')&&(builtin(source,callee.object,'Reflect')&&index===2||criticalCallable(source,callee.object)&&index===1)
     need(applied,'Native argument tuple escaped to an unknown consumer')
    }
   }
  }
  return array.elements
 }
 function spreadArguments(p,args,critical,depth=0){
  need(depth<=8&&args.length<=256,'finite native argument scope exceeded')
  return args.flatMap(argument=>{if(argument?.type!=='SpreadElement')return[argument];const values=arrayContents(p,argument.argument,critical);return values?spreadArguments(p,values,critical,depth+1):[argument]})
 }
 function invocation(p,callee,args,depth=0){
  need(depth<=8,'finite native mutation alias scope exceeded');const target=p.resolve(callee)
  if(member(p,target,'bind'))return{target,args,bindingOnly:true}
  args=spreadArguments(p,args,criticalCallable(p,target))
  if(target?.type==='CallExpression'){const binder=p.resolve(target.callee);if(member(p,binder,'bind')){const bound=spreadArguments(p,target.arguments,criticalCallable(p,binder.object));return invocation(p,binder.object,[...bound.slice(1),...args],depth+1)}return{target,args}}
  if(target?.type!=='MemberExpression')return{target,args}
  const method=p.member(target),namespace=p.resolve(target.object)
  if(builtin(p,namespace,'Reflect')&&method==='apply'){const values=arrayContents(p,args[2],criticalCallable(p,args[0]));if(values)return invocation(p,args[0],values,depth+1);return{target,args}}
  if(['call','apply'].includes(method)&&['MemberExpression','CallExpression'].includes(namespace?.type)){if(method==='call')return invocation(p,namespace,args.slice(1),depth+1);const values=arrayContents(p,args[1],criticalCallable(p,namespace));if(values)return invocation(p,namespace,values,depth+1)}
  return{target,args}
 }
 function mutation(p,target,args){
  if(target?.type!=='MemberExpression'||!p.global(args[0]))return
  const method=p.member(target),namespace=p.resolve(target.object),property=(node,computed)=>computed?p.literal(node):node?.type==='Identifier'?node.name:node?.type==='Literal'?node.value:null
  if(builtin(p,namespace,'Object')&&['assign','defineProperties'].includes(method))for(const value of args.slice(1)){const object=p.resolve(value);need(object?.type==='ObjectExpression'&&object.properties.every(entry=>entry.type==='Property'&&property(entry.key,entry.computed)!=null&&property(entry.key,entry.computed)!=='__appData'),'Native original state may be replaced by a global object mutation')}
  if(builtin(p,namespace,'Object')&&method==='defineProperty'||builtin(p,namespace,'Reflect')&&['set','defineProperty','deleteProperty'].includes(method))need(p.literal(args[1])!=null&&p.literal(args[1])!=='__appData','Native original state may be replaced by a global property mutation')
 }
 for(const p of programs)for(const node of p.nodes){
  if(node.type==='AssignmentExpression')written(p,node.left,node)
  else if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')written(p,node.argument,node)
  else if(node.type==='VariableDeclaration'&&node.kind==='var'){for(const declaration of node.declarations)if(declaration.init)globalDeclaration(p,declaration.id,node)}
  else if(node.type==='FunctionDeclaration')need(!globalFunction(p,node),'Native original state replaced by a classic global function declaration')
  if(['ForInStatement','ForOfStatement'].includes(node.type)){if(node.left.type==='VariableDeclaration'){if(node.left.kind==='var')for(const declaration of node.left.declarations)globalDeclaration(p,declaration.id,node)}else written(p,node.left,node)}
  if(node.type==='CallExpression'){const call=invocation(p,node.callee,node.arguments);if(!call.bindingOnly)mutation(p,call.target,call.args)}
 }
 const a=original.assignment,syntax=readLiteralModel(original.node.raw.slice(a.right.start,a.right.end)),model=syntax.value;need(model&&typeof model==='object'&&!Array.isArray(model)&&model.organization&&model.jobBoard,'Native current public state unavailable')
 return{originalModel:model,originalAssignment:original.node.raw.slice(a.start,a.end),originalScriptAttributes:original.node.attrs,syntax:{validJSON:syntax.validJSON,duplicateKeys:syntax.duplicateKeys??[]}}
}
