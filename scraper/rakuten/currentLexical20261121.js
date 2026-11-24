import {parse} from 'acorn'

// Static lexical identities for the original public state boundary. No scripts
// execute, and this reader depends only on the production acorn dependency.
const children=node=>Object.entries(node).filter(([key])=>!['start','end','raw','loc','range'].includes(key)).flatMap(([,value])=>(Array.isArray(value)?value:[value]).filter(v=>v&&typeof v==='object'&&typeof v.type==='string'))
const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
export function nativePrograms(scripts){
 const shared={type:'global',parent:null,values:new Map()},programs=[]
 for(const script of scripts){
  const module=script.attrs.type==='module',tree=parse(script.raw,{ecmaVersion:'latest',sourceType:module?'module':'script'}),root=module?{type:'module',parent:null,values:new Map()}:shared,scopes=new Map(),parents=new Map(),nodes=[]
  const scope=(type,parent)=>({type,parent,values:new Map()}),variableScope=current=>['global','module','function','static'].includes(current.type)?current:variableScope(current.parent)
  function bind(pattern,current,init=null){
   if(!pattern)return
   if(pattern.type==='Identifier'){let value=current.values.get(pattern.name);if(!value){value={name:pattern.name,scope:current,defs:[],writes:[]};current.values.set(pattern.name,value)}value.defs.push({pattern,init});return}
   if(pattern.type==='AssignmentPattern'){bind(pattern.left,current,init);return}
   if(pattern.type==='RestElement'){bind(pattern.argument,current);return}
   if(pattern.type==='ArrayPattern'){pattern.elements.forEach(p=>bind(p,current));return}
   if(pattern.type==='ObjectPattern')for(const property of pattern.properties){if(property.type==='RestElement')bind(property.argument,current);else bind(property.value,current,init?{type:'MemberExpression',object:init,property:property.key,computed:property.computed}:null)}
  }
  function visit(node,current,parent=null){
   parents.set(node,parent)
   if(node.type==='FunctionDeclaration')bind(node.id,current,node)
   if(node.type==='ClassDeclaration')bind(node.id,current,node)
   let own=current
   if(functions.has(node.type)){own=scope('function',current);if(node.type==='FunctionExpression')bind(node.id,own,node);node.params.forEach(p=>bind(p,own))}
   else if(node.type==='ClassDeclaration'||node.type==='ClassExpression'){own=scope('class',current);if(node.id)bind(node.id,own,node)}
   else if(node.type==='StaticBlock')own=scope('static',current)
   else if(['BlockStatement','ForStatement','ForInStatement','ForOfStatement','SwitchStatement','CatchClause'].includes(node.type)){own=scope('block',current);if(node.type==='CatchClause')bind(node.param,own)}
   scopes.set(node,own);nodes.push(node)
   if(node.type==='VariableDeclaration')for(const declaration of node.declarations)bind(declaration.id,node.kind==='var'?variableScope(own):own,declaration.init)
   if(node.type==='ImportDeclaration')for(const specifier of node.specifiers)bind(specifier.local,own)
   for(const child of children(node))visit(child,own,node)
  }
  visit(tree,root)
  const lookup=(current,name)=>!current?null:current.values.get(name)??lookup(current.parent,name),binding=node=>node?.type==='Identifier'?lookup(scopes.get(node)??root,node.name):null
  programs.push({script,tree,module,root,nodes,scopes,parents,binding})
 }
 for(const p of programs){
  const mark=target=>{if(!target)return;if(target.type==='Identifier'){p.binding(target)?.writes.push(target);return}if(['ArrayPattern','ObjectPattern','AssignmentPattern','RestElement'].includes(target.type))for(const n of children(target))mark(n.type==='Property'?n.value:n)}
  for(const node of p.nodes)if(node.type==='AssignmentExpression')mark(node.left);else if(node.type==='UpdateExpression')mark(node.argument);else if(['ForInStatement','ForOfStatement'].includes(node.type)){if(node.left.type==='VariableDeclaration')for(const declaration of node.left.declarations)mark(declaration.id);else mark(node.left)}
 }
 for(const p of programs){
  const owners=new Map();for(const candidate of programs)for(const node of candidate.nodes)owners.set(node,candidate)
  const resolve=(node,seen=new Set())=>{if(node?.type!=='Identifier')return node;const owner=owners.get(node)??p,value=owner.binding(node);if(!value||seen.has(value)||value.defs.length!==1||value.writes.length)return node;const init=value.defs[0].init;if(!init)return node;const next=new Set(seen);next.add(value);return resolve(init,next)}
  const literal=node=>{const value=resolve(node);return value?.type==='Literal'?value.value:value?.type==='TemplateLiteral'&&value.expressions.length===0?value.quasis[0].value.cooked:null},member=node=>node?.type==='MemberExpression'?(node.computed?literal(node.property):node.property.name):null
  const global=node=>{const value=resolve(node),owner=owners.get(value)??p;if(value?.type==='Identifier')return['window','globalThis','self'].includes(value.name)&&!owner.binding(value);if(value?.type!=='ThisExpression'||owner.module)return false;for(let at=owner.parents.get(value);at;at=owner.parents.get(at))if(['FunctionDeclaration','FunctionExpression','ClassDeclaration','ClassExpression','StaticBlock'].includes(at.type))return false;return true}
  const builtin=(node,name)=>{const value=resolve(node),owner=owners.get(value)??p;return value?.type==='Identifier'&&value.name===name&&!owner.binding(value)}
  Object.assign(p,{resolve,literal,member,global,builtin})
 }
 return programs
}
