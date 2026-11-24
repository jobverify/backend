import {need} from './currentFacts20261120.js'

const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const children=node=>Object.entries(node).filter(([key])=>!['start','end','range','loc','raw'].includes(key)).flatMap(([key,value])=>Array.isArray(value)?value.filter(child=>child&&typeof child.type==='string').map(child=>({key,child})):value&&typeof value.type==='string'?[{key,child:value}]:[])

// Finite declaration and reference analysis over Acorn syntax. This does not
// evaluate native programmes or depend on development-only lint packages.
export function analyzeNativeScopes(ast){
 const scopes=[],at=new WeakMap(),bindings=new Map(),declarations=new WeakSet(),writeTargets=new WeakSet()
 let visits=0
 const scope=(type,parent,{arrow=false}={})=>{const value={type,upper:parent,bindings:new Map(),variables:[],through:[],functionScope:null,thisGlobal:type==='global'||(type==='function'?!arrow?false:parent.thisGlobal:parent.thisGlobal)};value.functionScope=['global','function'].includes(type)?value:parent.functionScope;scopes.push(value);return value}
 const root=scope('global',null)
 function bind(pattern,current,node){
  if(!pattern)return
  if(pattern.type==='Identifier'){
   let variable=current.bindings.get(pattern.name)
   if(!variable){variable={name:pattern.name,scope:current,defs:[],references:[],identifiers:[]};current.bindings.set(pattern.name,variable);current.variables.push(variable)}
   variable.defs.push({node});variable.identifiers.push(pattern);declarations.add(pattern);bindings.set(pattern,variable);return
  }
  if(pattern.type==='AssignmentPattern')return bind(pattern.left,current,node)
  if(pattern.type==='RestElement')return bind(pattern.argument,current,node)
  if(pattern.type==='ArrayPattern'){pattern.elements.forEach(child=>bind(child,current,node));return}
  if(pattern.type==='ObjectPattern')for(const property of pattern.properties)bind(property.value??property.argument,current,node)
 }
 function build(node,current,parent){
  need(++visits<=300000,'finite native lexical declaration budget exceeded')
  if(node.type==='FunctionDeclaration'&&node.id)bind(node.id,current,node)
  if(node.type==='ClassDeclaration'&&node.id)bind(node.id,current,node)
  if(functions.has(node.type)){
   current=scope('function',current,{arrow:node.type==='ArrowFunctionExpression'})
   if(node.type==='FunctionExpression'&&node.id)bind(node.id,current,node)
   for(const parameter of node.params)bind(parameter,current,node)
  }else if(node.type==='CatchClause'){
   current=scope('catch',current);bind(node.param,current,node)
  }else if(['BlockStatement','SwitchStatement','ForStatement','ForOfStatement','ForInStatement','ClassBody'].includes(node.type))current=scope('block',current)
  at.set(node,current)
  if(node.type==='VariableDeclarator')bind(node.id,parent.kind==='var'?current.functionScope:current,node)
  if(node.type==='ImportDeclaration')for(const specifier of node.specifiers)bind(specifier.local,current,node)
  for(const{child}of children(node))build(child,current,node)
 }
 build(ast,root,null)
 function target(node){
  if(!node)return
  if(node.type==='Identifier'){writeTargets.add(node);return}
  if(node.type==='AssignmentPattern')return target(node.left)
  if(node.type==='RestElement')return target(node.argument)
  if(node.type==='ArrayPattern')return node.elements.forEach(target)
  if(node.type==='ObjectPattern')node.properties.forEach(property=>target(property.value??property.argument))
 }
 function mark(node){
  if(node.type==='AssignmentExpression')target(node.left)
  if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')target(node.argument)
  if(['ForOfStatement','ForInStatement'].includes(node.type)&&node.left.type!=='VariableDeclaration')target(node.left)
  for(const{child}of children(node))mark(child)
 }
 mark(ast)
 const lookup=(current,name)=>!current?null:current.bindings.get(name)??lookup(current.upper,name)
 function references(node,parent,key){
  if(node.type==='Identifier'&&!declarations.has(node)){
   const staticKey=parent&&(parent.type==='MemberExpression'&&key==='property'&&!parent.computed||['Property','MethodDefinition','PropertyDefinition'].includes(parent.type)&&key==='key'&&!parent.computed||['LabeledStatement','BreakStatement','ContinueStatement'].includes(parent.type)&&key==='label'||parent.type==='MetaProperty')
   if(!staticKey){const variable=lookup(at.get(node),node.name),reference={identifier:node,init:false,isWrite:()=>writeTargets.has(node)};if(variable){bindings.set(node,variable);variable.references.push(reference)}else root.through.push(reference)}
  }
  for(const child of children(node))references(child.child,node,child.key)
 }
 references(ast,null,null)
 return{bindings,at,manager:{scopes,globalScope:root}}
}
