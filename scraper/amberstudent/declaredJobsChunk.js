import {parse} from 'acorn'

const ASSETS='https://cdn-static-assets.amberstudent.com/amber-user-website/build/assets/'
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Amber current jobs route '+message),{abortRetries:true})}
const one=(values,label)=>{need(values.length===1,'has no unique '+label);return values[0]}
const name=node=>node?.name??node?.value
const field=(node,key)=>{
 const values=(node?.properties??[]).filter(p=>p.type==='Property'&&!p.computed&&name(p.key)===key)
 need(values.length<=1,'has ambiguous '+key+' declaration');return values[0]?.value
}
function model(source){
 let ast;try{ast=parse(source,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,'module is not valid JavaScript')}
 const nodes=[],parents=new WeakMap(),pending=[[ast,null]]
 while(pending.length){const [node,parent]=pending.pop();nodes.push(node);if(parent)parents.set(node,parent)
  for(const value of Object.values(node))for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object'&&typeof child.type==='string')pending.push([child,node])}
 const scope=node=>{for(let p=parents.get(node);p;p=parents.get(p))if(['FunctionExpression','FunctionDeclaration','ArrowFunctionExpression','Program'].includes(p.type))return p;return ast}
 return {source,ast,nodes,parents,scope}
}
const member=(node,key)=>node?.type==='MemberExpression'&&!node.computed&&name(node.property)===key
function loadable(initializer,scope,expectedName){
 need(initializer?.type==='CallExpression'&&initializer.arguments[0]?.type==='ObjectExpression','component has no declared loader')
 const options=initializer.arguments[0],label=field(options,'chunkName'),resolve=field(options,'resolve'),importer=field(options,'importAsync')
 need(label?.type==='ArrowFunctionExpression'&&label.body.type==='Literal'&&label.body.value===expectedName,'component is not the Jobs loader')
 need(resolve?.type==='ArrowFunctionExpression'&&resolve.body.type==='Literal'&&Number.isSafeInteger(resolve.body.value),'loader module identity is not literal')
 const call=importer?.type==='ArrowFunctionExpression'?importer.body:null
 need(call?.type==='CallExpression'&&member(call.callee,'then')&&call.arguments.length===1,'loader import is not a declared promise chain')
 const all=call.callee.object,bound=call.arguments[0]
 need(all.type==='CallExpression'&&member(all.callee,'all')&&all.callee.object.name==='Promise'&&all.arguments.length===1
  &&all.arguments[0].type==='ArrayExpression','loader chunk set is not literal')
 need(bound.type==='CallExpression'&&member(bound.callee,'bind')&&bound.callee.object.type==='Identifier'&&bound.arguments.length===2
  &&bound.arguments[0].type==='Identifier'&&bound.arguments[0].name===bound.callee.object.name
  &&bound.arguments[1].type==='Literal'&&bound.arguments[1].value===resolve.body.value,'loader import and resolved module disagree')
 const runtime=bound.callee.object.name
 need(scope.type==='FunctionExpression'&&scope.params[2]?.type==='Identifier'&&scope.params[2].name===runtime,'loader is outside its native webpack module')
 const chunks=all.arguments[0].elements.map(call=>{
  need(call?.type==='CallExpression'&&member(call.callee,'e')&&call.callee.object.name===runtime&&call.arguments.length===1
   &&call.arguments[0].type==='Literal'&&/^\d+$/.test(String(call.arguments[0].value)),'loader chunk identity is not literal')
  return String(call.arguments[0].value)
 })
 need(chunks.length>0&&chunks.length<=8&&new Set(chunks).size===chunks.length,'loader chunk set exceeds its bound')
 return {chunkID:chunks.at(-1),moduleID:resolve.body.value}
}
// Interpret only literal concatenation and the runtime's own literal hash map.
// No downloaded function, renderer, import, or application code is executed.
function chunkURL(main,chunkID){
 const assignment=one(main.nodes.filter(node=>node.type==='AssignmentExpression'&&member(node.left,'u')
  &&node.right.type==='FunctionExpression'&&main.source.slice(node.right.start,node.right.end).includes('".desktop.js"')),'native chunk filename runtime')
 const fn=assignment.right
 need(fn.params.length===1&&fn.params[0].type==='Identifier'&&fn.body.body.length===1&&fn.body.body[0].type==='ReturnStatement','chunk filename runtime is not a literal return')
 const evaluate=node=>{
  if(node.type==='Literal'&&['string','number'].includes(typeof node.value))return node.value
  if(node.type==='Identifier'&&node.name===fn.params[0].name)return chunkID
  if(node.type==='BinaryExpression'&&node.operator==='+')return evaluate(node.left)+evaluate(node.right)
  if(node.type==='LogicalExpression'&&node.operator==='||')return evaluate(node.left)||evaluate(node.right)
  if(node.type==='MemberExpression'&&node.computed&&node.object.type==='ObjectExpression'){
   const key=String(evaluate(node.property)),entries=node.object.properties
   need(entries.every(p=>p.type==='Property'&&!p.computed&&p.value.type==='Literal'&&typeof p.value.value==='string'),'runtime hash map is not literal')
   const matches=entries.filter(p=>String(name(p.key))===key);need(matches.length<=1,'runtime hash map is ambiguous');return matches[0]?.value.value
  }
  need(false,'chunk filename runtime has unreviewed expressions')
 }
 const filename=evaluate(fn.body.body[0].argument)
 need(new RegExp('^js/'+chunkID+'\\.[a-f0-9]+\\.desktop\\.js$').test(filename),'chunk filename differs from the declared chunk')
 return ASSETS+filename
}
function directPlan(main){
 const route=one(main.nodes.filter(node=>node.type==='ObjectExpression'&&field(node,'path')?.type==='Literal'
  &&field(node,'path').value==='/job-opening'),'current Jobs route')
 const component=field(route,'component');need(component?.type==='Identifier','component is not a direct native binding')
 const scope=main.scope(route),binding=one(main.nodes.filter(node=>node.type==='VariableDeclarator'&&node.id.type==='Identifier'
  &&node.id.name===component.name&&main.scope(node)===scope),'Jobs component binding in its lexical module')
 return loadable(binding.init,scope,'pages-Jobs')
}
export function resolveDirectJobsChunkUrl(source){
 if(!/path:"\/job-opening",exact:!0,component:[\w$]+(?:,|})/.test(source))return null
 const main=model(source),plan=directPlan(main);return chunkURL(main,plan.chunkID)
}
export function resolveNestedJobsChunkUrl(source,bridge){
 const main=model(source),parent=directPlan(main),child=model(bridge)
 const registration=one(child.nodes.filter(node=>node.type==='CallExpression'&&member(node.callee,'push')
  &&node.arguments[0]?.type==='ArrayExpression'&&node.arguments[0].elements[0]?.type==='ArrayExpression'),'declared route chunk registration').arguments[0]
 const ids=registration.elements[0].elements.map(node=>String(node?.value))
 need(ids.length===1&&ids[0]===parent.chunkID,'bridge chunk identity differs from the route')
 const modules=registration.elements[1],module=one((modules?.properties??[]).filter(p=>p.type==='Property'
  &&Number(name(p.key))===parent.moduleID&&p.value.type==='FunctionExpression'),'native route module').value
 const loaders=child.nodes.filter(node=>node.type==='VariableDeclarator'&&child.scope(node)===module
  &&node.init?.type==='CallExpression'&&field(node.init.arguments[0],'chunkName')?.body?.value==='Jobs')
 const binding=one(loaders,'nested Jobs loader'),plan=loadable(binding.init,module,'Jobs')
 const exports=child.nodes.filter(node=>node.type==='AssignmentExpression'&&member(node.left,'default')
  &&node.left.object.name===module.params[1]?.name&&child.scope(node)===module)
 need(exports.length===1&&child.nodes.some(node=>node.type==='Identifier'&&node.name===binding.id.name
  &&node.start>=exports[0].right.start&&node.end<=exports[0].right.end),'nested Jobs loader is not used by the route export')
 return chunkURL(main,plan.chunkID)
}
