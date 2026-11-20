import {parse} from 'acorn'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {need,one} from './currentFacts20261120.js'
import {literal,executableScript} from './currentProtocol20261120.js'

// Inspect literal declarations and relevant writes as data. No publisher script runs.
const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const children=node=>Object.entries(node).filter(([key])=>!['start','end','raw'].includes(key)).flatMap(([,value])=>Array.isArray(value)?value:[value]).filter(value=>value&&typeof value==='object'&&typeof value.type==='string')
function names(pattern){if(!pattern)return[];if(pattern.type==='Identifier')return[pattern.name];if(pattern.type==='RestElement')return names(pattern.argument);if(pattern.type==='AssignmentPattern')return names(pattern.left);if(pattern.type==='ArrayPattern')return pattern.elements.flatMap(names);if(pattern.type==='ObjectPattern')return pattern.properties.flatMap(property=>names(property.value??property.argument));return[]}
const binding=(env,name)=>env.bindings.has(name)?env.bindings.get(name):env.parent?binding(env.parent,name):null
function contexts(trees){
 const global={parent:null,bindings:new Map()},entries=[]
 const declare=(env,pattern,kind,node)=>{for(const name of names(pattern)){if(!env.bindings.has(name))env.bindings.set(name,{name,env,kind,declarations:[],aliases:[]});const current=env.bindings.get(name);current.declarations.push(node)}}
 function hoist(node,env){if(functions.has(node.type))return;if(node.type==='VariableDeclaration'&&node.kind==='var')for(const declaration of node.declarations)declare(env,declaration.id,node.kind,declaration);for(const child of children(node))hoist(child,env)}
 const lexical=(body,env)=>{for(const node of body){if(node.type==='VariableDeclaration'&&node.kind!=='var')for(const declaration of node.declarations)declare(env,declaration.id,node.kind,declaration);if(['FunctionDeclaration','ClassDeclaration'].includes(node.type))declare(env,node.id,node.type,node)}}
 for(const tree of trees)hoist(tree,global)
 for(const tree of trees)lexical(tree.body,global)
 function visit(node,env,tree){
  let current=env
  if(functions.has(node.type)){current={parent:env,bindings:new Map()};declare(current,node.id,'function',node);for(const parameter of node.params)declare(current,parameter,'parameter',parameter);hoist(node.body,current)}
  else if(node.type==='BlockStatement'){current={parent:env,bindings:new Map()};lexical(node.body,current)}
  else if(node.type==='CatchClause'){current={parent:env,bindings:new Map()};declare(current,node.param,'catch',node)}
  else if(['ForStatement','ForInStatement','ForOfStatement'].includes(node.type)){const declaration=node.init??node.left;if(declaration?.type==='VariableDeclaration'&&declaration.kind!=='var'){current={parent:env,bindings:new Map()};for(const value of declaration.declarations)declare(current,value.id,declaration.kind,value)}}
  entries.push({node,env:current,tree});for(const child of children(node))visit(child,current,tree)
 }
 for(const tree of trees)visit(tree,global,tree)
 return{global,entries}
}
export function readCurrentRoleModel(scripts){
 const programmes=scripts.filter(node=>!node.attrs.src&&executableScript(node)).map(script=>({script,tree:parse(script.raw??'',{ecmaVersion:'latest',sourceType:(script.attrs.type??'').toLowerCase()==='module'?'module':'script'})})),{global,entries}=contexts(programmes.map(value=>value.tree))
 const declaration=name=>{const current=global.bindings.get(name);need(current&&current.declarations.length===1,'native original '+name+' declaration missing/ambiguous');return current.declarations[0]}
 const jobsNode=declaration('jobs'),metaNode=declaration('meta'),selected=one(programmes.filter(({tree})=>tree.body.some(statement=>statement.type==='VariableDeclaration'&&statement.declarations.includes(jobsNode))&&tree.body.some(statement=>statement.type==='VariableDeclaration'&&statement.declarations.includes(metaNode))),'native direct jobs/metadata literal carrier'),call=jobsNode.init
 need(call?.type==='CallExpression'&&!call.optional&&call.callee.type==='MemberExpression'&&!call.callee.computed&&call.callee.object.name==='JSON'&&call.callee.property.name==='parse'&&call.arguments.length===1&&call.arguments[0].type==='Literal'&&typeof call.arguments[0].value==='string','native original jobs is not literal JSON')
 for(const name of ['JSON','Object','Reflect','window','self','globalThis'])need(!global.bindings.has(name),'native role literal builtin/global is shadowed: '+name)
 const jobs=readLiteralModel(call.arguments[0].value).value,meta=literal(metaNode.init);need(Array.isArray(jobs)&&jobs.length===1,'native same-role detail model is not one record')
 const constants=new Map(),writes=new Set(entries.filter(({node})=>['AssignmentExpression','UpdateExpression'].includes(node.type)).flatMap(({node,env})=>names(node.left??node.argument).map(name=>binding(env,name))).filter(Boolean))
 for(const{node,env}of entries)if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&node.init?.type==='Literal'){const current=binding(env,node.id.name);if(current?.kind==='const'&&current.declarations.length===1&&!writes.has(current))constants.set(current,node.init.value)}
 const key=(node,env)=>node?.type==='Literal'?node.value:node?.type==='Identifier'?constants.get(binding(env,node.name)):undefined
 function reference(node,env,seen=new Set()){
  if(node?.type==='ChainExpression')return reference(node.expression,env,seen)
  if(node?.type==='Identifier'){
   const current=binding(env,node.name)
   if(current&&current.env!==global){if(seen.has(current))return null;seen.add(current);return current.aliases.length===1?reference(current.aliases[0].node,current.aliases[0].env,seen):null}
   if(['jobs','meta'].includes(node.name))return{kind:'model',root:node.name,path:[]}
   if(['window','self','globalThis'].includes(node.name))return{kind:'global',path:[]}
   if(['JSON','Object','Reflect'].includes(node.name))return{kind:'builtin',root:node.name,path:[]}
   if(current&&!seen.has(current)){seen.add(current);return current.aliases.length===1?reference(current.aliases[0].node,current.aliases[0].env,seen):null}
   return null
  }
  if(node?.type==='MemberExpression'){
   const owner=reference(node.object,env,seen);if(!owner)return null
   const property=node.computed?key(node.property,env):node.property.name
   if(owner.kind==='global'&&['jobs','meta'].includes(property))return{kind:'model',root:property,path:[]}
   if(owner.kind==='global'&&['JSON','Object','Reflect'].includes(property))return{kind:'builtin',root:property,path:[]}
   if(owner.kind==='global'&&['window','self','globalThis'].includes(property))return owner
   return{...owner,kind:owner.kind==='global'?'global-property':owner.kind,path:[...owner.path,property]}
  }
  return null
 }
 for(const{node,env}of entries){if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&node.init&&!['jobs','meta'].includes(node.id.name))binding(env,node.id.name)?.aliases.push({node:node.init,env});if(node.type==='AssignmentExpression'&&node.operator==='='&&node.left.type==='Identifier'&&!['jobs','meta'].includes(node.left.name)){const current=binding(env,node.left.name);if(current)current.aliases.push({node:node.right,env,definition:node})}}
 const additionalMetaDeclarations=[],isObject=ref=>{if(ref?.kind!=='model')return false;let value=ref.root==='jobs'?jobs:meta;for(const property of ref.path){if(property===undefined||value==null)return true;value=value[property]}return value!=null&&typeof value==='object'}
 function metadataDeclaration(node,ref,tree){
  if(ref?.kind!=='model'||ref.root!=='meta'||ref.path.length!==1||!['favicon_url','callback_url','listpage_callback_url'].includes(ref.path[0]))return false
  need(node.type==='AssignmentExpression'&&node.operator==='='&&tree===selected.tree&&tree.body.some(statement=>statement.type==='ExpressionStatement'&&statement.expression===node),'native additional metadata is not a direct literal declaration')
  const field=ref.path[0],value=literal(node.right);if(field==='favicon_url'){const url=new URL(value);need(url.protocol==='https:'&&url.origin==='https://soroco.zohorecruit.com'&&!url.username&&!url.password&&!url.port&&!url.hash,'native publisher favicon declaration conflicts')}else need(value==='','native additional application callback contract changed')
  need(!additionalMetaDeclarations.some(declaration=>declaration.field===field),'native additional metadata declaration duplicated');additionalMetaDeclarations.push({field,value});return true
 }
 for(const{node,env,tree}of entries){
  if(['AssignmentExpression','UpdateExpression'].includes(node.type)||node.type==='UnaryExpression'&&node.operator==='delete'){
   const target=node.left??node.argument,ref=reference(target,env)
   if(metadataDeclaration(node,ref,tree))continue
   const aliasDefinition=target.type==='Identifier'&&binding(env,target.name)?.aliases.some(alias=>alias.definition===node)
   need(aliasDefinition||!ref||!(ref.kind==='model'||ref.kind==='builtin'||ref.kind==='global'||ref.kind==='global-property'&&(ref.path[0]===undefined||['jobs','meta','JSON','Object','Reflect','window','self','globalThis'].includes(ref.path[0]))),'native literal role/employer namespace overwritten')
  }
  if(node.type!=='CallExpression')continue
  const callee=reference(node.callee,env),method=callee?.path.at(-1)
  if(callee?.kind==='builtin'&&['Object','Reflect'].includes(callee.root)&&['assign','defineProperty','defineProperties','set','deleteProperty','setPrototypeOf'].includes(method)){
   const target=reference(node.arguments[0],env);need(!target||!['model','builtin'].includes(target.kind),'native original role/employer modified by object operation')
   if(target?.kind==='global'){
    if(['assign','defineProperties'].includes(method))for(const argument of node.arguments.slice(1)){need(argument.type==='ObjectExpression','dynamic native global model modification is unqualified');for(const property of argument.properties){const name=property.computed?key(property.key,env):property.key.name??property.key.value;need(property.type==='Property'&&name!==undefined&&!['jobs','meta','JSON','Object','Reflect','window','self','globalThis'].includes(name),'native global model replaced by object operation')}}
    else{const name=key(node.arguments[1],env);need(name!==undefined&&!['jobs','meta','JSON','Object','Reflect','window','self','globalThis'].includes(name),'native global model property changed')}
   }
   continue
  }
  need(!(callee?.kind==='model'&&['push','pop','shift','unshift','splice','sort','reverse','copyWithin','fill'].includes(method)),'native original role array mutated')
  if(!(callee?.kind==='builtin'&&callee.root==='JSON'&&method==='stringify'))for(const argument of node.arguments)need(!isObject(reference(argument,env)),'native literal role/employer object escapes to an unqualified mutator')
 }
 return{script:selected.script,jobs,meta,originalMeta:structuredClone(meta),additionalMetaDeclarations,programmesExecuted:false,relevantModelWritesQualified:true}
}
