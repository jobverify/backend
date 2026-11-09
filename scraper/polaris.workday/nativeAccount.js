import {parse} from 'acorn'

const memberPath=node=>{
 const parts=[];let count=0
 while(node?.type==='MemberExpression'){
  if(++count>16)return null
  const property=node.property,key=node.computed?property.type==='Literal'?property.value:null:property.type==='Identifier'?property.name:null
  if(typeof key!=='string')return null
  parts.unshift(key);node=node.object
 }
 return node?.type==='Identifier'?[node.name,...parts].join('.'):null
}
const ownAccount=node=>memberPath(node)==='window.workday'
const accountTarget=node=>['window.workday','workday'].includes(memberPath(node))
const protectedTarget=node=>['window.workday','workday','window.workday.tenant','window.workday.siteId','workday.tenant','workday.siteId'].includes(memberPath(node))
const mutationMethods=new Set(['Object.assign','Object.defineProperty','Object.defineProperties','Object.setPrototypeOf','Reflect.set','Reflect.defineProperty','Reflect.deleteProperty','Reflect.setPrototypeOf'])

// Inspect a declared literal; never execute the publisher's JavaScript.
export function hasDeclaredPolarisAccount(document){
 const declarations=[],initializers=new Set(),programs=[]
 for(const node of document.nodes(node=>node.tag==='script')){
  const type=(node.attrs.type||'').trim().toLowerCase()
  if(Object.hasOwn(node.attrs,'src')||Object.hasOwn(node.attrs,'nomodule')||!['','text/javascript','application/javascript'].includes(type))continue
  let program
  try{program=parse(node.raw||'',{ecmaVersion:'latest',sourceType:'script'})}catch{return false}
  programs.push(program)
  for(const statement of program.body){
   const assignment=statement.type==='ExpressionStatement'?statement.expression:null
   if(assignment?.type!=='AssignmentExpression'||assignment.operator!=='='||!ownAccount(assignment.left))continue
   initializers.add(assignment)
   const value=assignment.right
   declarations.push(value.type==='LogicalExpression'&&value.operator==='||'&&ownAccount(value.left)?value.right:value)
  }
 }
 if(declarations.length!==1||declarations[0].type!=='ObjectExpression')return false
 const pending=[...programs];let visited=0
 while(pending.length){
  if(++visited>100000)return false
  const node=pending.pop()
  if(node.type==='AssignmentExpression'&&protectedTarget(node.left)&&!initializers.has(node))return false
  if(node.type==='UpdateExpression'&&protectedTarget(node.argument)||node.type==='UnaryExpression'&&node.operator==='delete'&&protectedTarget(node.argument))return false
  if(node.type==='CallExpression'&&mutationMethods.has(memberPath(node.callee))
   &&(accountTarget(node.arguments[0])||memberPath(node.arguments[0])==='window'))return false
  for(const value of Object.values(node)){
   if(Array.isArray(value))pending.push(...value.filter(child=>child&&typeof child.type==='string'))
   else if(value&&typeof value.type==='string')pending.push(value)
  }
 }
 const fields=new Map()
 for(const property of declarations[0].properties){
  if(property.type!=='Property'||property.computed||property.method||property.kind!=='init')return false
  const key=property.key.type==='Identifier'?property.key.name:property.key.type==='Literal'?property.key.value:null
  if(typeof key!=='string'||fields.has(key))return false
  fields.set(key,property.value)
 }
 return [['tenant','polaris'],['siteId','PolarisJobs']].every(([key,expected])=>fields.get(key)?.type==='Literal'&&fields.get(key).value===expected)
}
