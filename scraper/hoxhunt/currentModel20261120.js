import {parse} from 'acorn'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {need,one} from './currentFacts20261120.js'
const name=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?n.value:null
const walk=(n,p)=>!n||typeof n!=='object'?[]:[...(p(n)?[n]:[]),...Object.entries(n).filter(([k])=>!['start','end','raw'].includes(k)).flatMap(([,v])=>Array.isArray(v)?v.flatMap(c=>walk(c,p)):walk(v,p))]

// Private adaptation of the independently reviewed Bayer literal-state reader.
// Only the native public state property and object-shape boundary differ.
export function currentNativeModel(d){
 const scripts=d.nodes(n=>n.tag==='script'&&!n.attrs.src&&(!n.attrs.type||['text/javascript','application/javascript','module'].includes(n.attrs.type))),trees=scripts.map(node=>({node,tree:parse(node.raw,{ecmaVersion:'latest',sourceType:node.attrs.type==='module'?'module':'script'})})),aliases=new Set(['window','globalThis'])
 let changed=true
 while(changed){changed=false;for(const{tree}of trees)for(const n of walk(tree,n=>n.type==='VariableDeclarator'||n.type==='AssignmentExpression')){const left=n.id??n.left,right=n.init??n.right;if(left?.type==='Identifier'&&right?.type==='Identifier'&&aliases.has(right.name)&&!aliases.has(left.name)){aliases.add(left.name);changed=true}}}
 const constants=new Map(),constantDeclarations=trees.flatMap(({tree})=>walk(tree,n=>n.type==='VariableDeclaration'&&n.kind==='const').flatMap(n=>n.declarations))
 for(const n of constantDeclarations)if(n.id.type==='Identifier'){const prior=constants.has(n.id.name),value=n.init?.type==='Literal'&&typeof n.init.value==='string'?n.init.value:null;constants.set(n.id.name,prior?null:value)}
 const property=(n,computed)=>!computed?name(n):n?.type==='Literal'?n.value:n?.type==='Identifier'?constants.get(n.name)??null:null,global=n=>n?.type==='Identifier'&&aliases.has(n.name),root=n=>n?.type==='MemberExpression'&&global(n.object)&&property(n.property,n.computed)==='__appData'
 const all=trees.flatMap(({tree,node})=>walk(tree,root).map(value=>({value,node}))),assignments=trees.flatMap(({tree,node})=>tree.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&root(n.expression.left)).map(n=>({assignment:n.expression,node}))),original=one(assignments,'original active top-level state assignment')
 need(original.assignment.operator==='='&&original.assignment.right.type==='ObjectExpression'&&all.length===1&&all[0].value===original.assignment.left,'Native original state overwritten, escaped or disconnected')
 const bindings=n=>!n?[]:n.type==='Identifier'?[n.name]:n.type==='VariableDeclaration'?n.declarations.flatMap(v=>bindings(v.id)):n.type==='ObjectPattern'?n.properties.flatMap(v=>bindings(v.value??v.argument)):n.type==='ArrayPattern'?n.elements.flatMap(bindings):n.type==='AssignmentPattern'?bindings(n.left):n.type==='RestElement'?bindings(n.argument):['FunctionDeclaration','ClassDeclaration'].includes(n.type)?bindings(n.id):[]
 for(const{tree,node}of trees){
  if(node===original.node||node.attrs.type!=='module')need(!tree.body.flatMap(bindings).some(v=>['window','globalThis'].includes(v)),'Native original global object is lexically shadowed')
  for(const n of walk(tree,n=>n.type==='AssignmentExpression'||n.type==='UpdateExpression'||n.type==='UnaryExpression'&&n.operator==='delete')){const target=n.left??n.argument;if(target?.type==='MemberExpression'&&global(target.object)&&target.computed)need(property(target.property,true)!=null,'Unqualified computed native state write')}
  for(const n of walk(tree,n=>n.type==='CallExpression')){
   const callee=n.callee,owner=callee?.type==='MemberExpression'&&callee.object?.type==='Identifier'?callee.object.name:null,method=callee?.type==='MemberExpression'?property(callee.property,callee.computed):null
   if(!global(n.arguments[0]))continue
   if(owner==='Object'&&['assign','defineProperties'].includes(method))for(const value of n.arguments.slice(1))need(value.type==='ObjectExpression'&&value.properties.every(p=>p.type==='Property'&&property(p.key,p.computed)!=null&&property(p.key,p.computed)!=='__appData'),'Native original state may be replaced by a global object mutation')
   if(owner==='Object'&&method==='defineProperty'||owner==='Reflect'&&['set','defineProperty','deleteProperty'].includes(method))need(property(n.arguments[1],true)!=null&&property(n.arguments[1],true)!=='__appData','Native original state may be replaced by a global property mutation')
  }
 }
 const a=original.assignment,syntax=readLiteralModel(original.node.raw.slice(a.right.start,a.right.end)),m=syntax.value;need(m&&typeof m==='object'&&!Array.isArray(m)&&m.organization&&m.jobBoard,'Native current public state unavailable');return{originalModel:m,originalAssignment:original.node.raw.slice(a.start,a.end),originalScriptAttributes:original.node.attrs,syntax:{validJSON:syntax.validJSON,duplicateKeys:syntax.duplicateKeys??[]}}
}
