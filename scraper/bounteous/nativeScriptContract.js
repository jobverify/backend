import{createHash}from'node:crypto'
import{parseBoundedProgram,parseRemoteLiteral}from'../../scraper-support/utils/remoteScriptData.js'
import{document}from'../../scraper-support/shared/rmkNativePairHtml.js'

const requireValue=(ok,message)=>{if(!ok)throw Error('Native executable AST contract: '+message)}
const one=(values,label)=>{requireValue(values.length===1,'expected one '+label);return values[0]}
const isFunction=node=>node&&['FunctionExpression','FunctionDeclaration','ArrowFunctionExpression'].includes(node.type)
const member=node=>node?.type==='Identifier'?node.name:node?.type==='MemberExpression'&&!node.computed&&!node.optional?member(node.object)+'.'+node.property.name:null
const reference=node=>node?.type==='SequenceExpression'?reference(node.expressions.at(-1)):node?.type==='CallExpression'&&member(node.callee)==='Object'&&node.arguments.length===1?reference(node.arguments[0]):member(node)
const shape=node=>JSON.stringify(node,(key,value)=>['start','end','raw'].includes(key)?undefined:value)
const digest=node=>createHash('sha256').update(shape(node)).digest('hex')
function program(source){try{return parseBoundedProgram(source)}catch{throw Error('Native executable AST contract: unsupported current public program')}}
function tree(ast){
 const nodes=[],parents=new Map()
 const visit=(node,parent)=>{if(!node||typeof node!=='object')return;if(typeof node.type==='string'){nodes.push(node);if(parent)parents.set(node,parent)}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>visit(child,node));else if(value&&typeof value==='object')visit(value,node)}
 visit(ast);return{nodes,parents}
}
function expressionAtBody(node,body,parents){
 let at=node
 while(parents.get(at)?.type==='SequenceExpression')at=parents.get(at)
 const statement=parents.get(at);return statement?.type==='ExpressionStatement'&&parents.get(statement)===body
}
function names(pattern){
 if(!pattern)return[]
 if(pattern.type==='Identifier')return[pattern.name]
 if(pattern.type==='ObjectPattern')return pattern.properties.flatMap(property=>names(property.value||property.argument))
 if(pattern.type==='ArrayPattern')return pattern.elements.flatMap(names)
 if(pattern.type==='AssignmentPattern')return names(pattern.left)
 if(pattern.type==='RestElement')return names(pattern.argument)
 return[]
}
function scopeNodes(scope){
 const result=[]
 const visit=node=>{if(!node||typeof node!=='object')return;result.push(node);if(isFunction(node)||node.type==='ClassExpression'||node.type==='ClassDeclaration')return;for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)}
 for(const node of scope.body?.body||scope.body||[])visit(node)
 return result
}
function scopeBindings(scope,name){
 return[...(scope.params||[]).flatMap(names).filter(value=>value===name),...scopeNodes(scope).flatMap(node=>node.type==='VariableDeclarator'?names(node.id).filter(value=>value===name):['FunctionDeclaration','ClassDeclaration'].includes(node.type)&&node.id?.name===name?[name]:[])]
}
function noMutation(scope,roots,exactRoots=[]){
 requireValue(!scopeNodes(scope).some(node=>{
  const target=node.type==='AssignmentExpression'?member(node.left):node.type==='UpdateExpression'?member(node.argument):null
  return target&&(exactRoots.includes(target)||roots.some(root=>target===root||target.startsWith(root+'.')))
 }),'reassigned public client namespace')
}
function directDefinition(scope,name,expectedDigest,parents){
 const declarations=scopeNodes(scope).filter(node=>node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&node.id.name===name)
 const declaration=one(declarations,'public '+name+' binding')
 requireValue(scopeBindings(scope,name).length===1&&parents.get(parents.get(declaration))===scope.body,'shadowed or inactive public client binding '+name)
 if(expectedDigest)requireValue(digest(declaration.init)===expectedDigest,'changed public '+name+' dataflow')
 return declaration
}
function registration(ast,queue){
 requireValue(ast.body.length===1&&ast.body[0].type==='ExpressionStatement','public client is not an unconditional registration')
 const call=ast.body[0].expression,receiver=call.callee?.object
 requireValue(call.type==='CallExpression'&&call.callee.type==='MemberExpression'&&!call.callee.computed&&call.callee.property.name==='push'&&call.arguments.length===1&&call.arguments[0].type==='ArrayExpression','public client registration changed')
 const valid=queue==='webpack'
  ?receiver?.type==='AssignmentExpression'&&receiver.operator==='='&&member(receiver.left)==='window.__LOADABLE_LOADED_CHUNKS__'&&receiver.right.type==='LogicalExpression'&&receiver.right.operator==='||'&&member(receiver.right.left)==='window.__LOADABLE_LOADED_CHUNKS__'&&receiver.right.right.type==='ArrayExpression'&&receiver.right.right.elements.length===0
  :receiver?.type==='LogicalExpression'&&receiver.operator==='||'&&member(receiver.left)==='globalThis.TURBOPACK'&&receiver.right.type==='AssignmentExpression'&&receiver.right.operator==='='&&member(receiver.right.left)==='globalThis.TURBOPACK'&&receiver.right.right.type==='ArrayExpression'&&receiver.right.right.elements.length===0
 requireValue(valid,'public client queue binding changed');return call.arguments[0]
}

// These semantic signatures cover only the actual public inventory components
// and their route/data dependencies. Positions, comments and literal spelling
// are ignored. Unrelated private application/contact components are not hashed.
export function validateBounteousClient(source){
 const ast=program(source),{nodes,parents}=tree(ast),registrationArray=registration(ast,'webpack')
 requireValue(registrationArray.elements.length===2&&shape(registrationArray.elements[0]).includes('29'),'current careers public chunk changed')
 const modules=registrationArray.elements[1];requireValue(modules?.type==='ObjectExpression','public component module map missing')
 const property=one(modules.properties.filter(property=>property.type==='Property'&&!property.computed&&(property.key.name||property.key.value)==='Eh3C'),'declared careers component module'),factory=property.value
 requireValue(factory.type==='FunctionExpression'&&factory.params.map(parameter=>parameter.name).join(',')==='e,t,r','public module namespace changed')
 for(const name of ['fetch','Object','Promise'])requireValue(scopeBindings(factory,name).length===0,'shadowed native transport namespace')
 noMutation(factory,['fetch','Object','Promise','n','i','m'])
 for(const[name,signature]of Object.entries({n:'1310613b136bd3528474c5b6ee9129f4eba09b042883dc9ad220dc80508cd4d6',i:'14334e83db429cbfce55b3d222322b194615a9510d3f20e1e97c3515883773c2',m:'d8fc36fa2808de8deffc2039ca5e54c5e7f664cd83e7e0273084ce6ab4037367'}))directDefinition(factory,name,signature,parents)
 const moduleNodes=tree(factory).nodes
 const exported=one(moduleNodes.filter(node=>node.type==='AssignmentExpression'&&member(node.left)==='t.default'&&isFunction(node.right)),'exported public careers component')
 requireValue(moduleNodes.filter(node=>node.type==='AssignmentExpression'&&member(node.left)==='t.default').length===1,'reassigned public careers export')
 requireValue(expressionAtBody(exported,factory.body,parents),'inactive or unbound public careers export')
 requireValue(digest(exported.right)==='1257c8a69474584419e3623b49ef725dbfbf308768ebe7847e2715a34671414d','changed public feed/complete-array/render component')
}

export function validateBikClient(source){
 const ast=program(source),{nodes,parents}=tree(ast),array=registration(ast,'turbopack')
 requireValue(array.elements.length===5&&array.elements[1]?.value===99481&&array.elements[3]?.value===76278,'current careers module/route registration changed')
 const factory=array.elements[2],route=array.elements[4]
 requireValue(factory.type==='ArrowFunctionExpression'&&factory.params.length===1&&factory.params[0].name==='e','public careers factory changed')
 requireValue(digest(route)==='4a3d6d99a8f46b6115d0cfb0b5f2a0b4d488853a69f6593ced7a9116bc84b574','inactive or changed /careers route-to-module binding')
 const component=directDefinition(factory,'tR','d41525cdb7421e47828336c80ceebc75aa51d967766bb7745a6a1cdc341daa70',parents).init
 for(const[name,signature]of Object.entries({d:'d54cd39cb4ca70d5cc2b67daa8323786923d11a85fea359fb159ead4ca8e3fd1',v:'80c30ec0287370a98d307f0e934aef96da60858f36480b0be0d192b4d1cce58c',tw:'eea7eb4ee650d2bb17cc23c7af915b965eb022cc905f9ee4cb5027886a701387'}))directDefinition(factory,name,signature,parents)
 // The bundled Axios implementation attaches its public utility properties to
 // tw. Its existing initialization is allowed; replacing tw or its request
 // methods would detach the jobs component from the reviewed public client.
 noMutation(factory,['tR','d','v','tw.get','tw.request'],['tw'])
 const exports=one(nodes.filter(node=>node.type==='CallExpression'&&member(node.callee)==='e.s'&&node.arguments[0]?.type==='ArrayExpression'&&node.arguments[0].elements[0]?.value==='default'),'current careers default export')
 requireValue(expressionAtBody(exports,factory.body,parents)&&exports.arguments[0].elements[2]?.type==='ArrowFunctionExpression','inactive public careers export')
 const defaultComponent=exports.arguments[0].elements[2]
 requireValue(!scopeBindings(defaultComponent,'tR').length,'shadowed public jobs component')
 noMutation(defaultComponent,['tR'])
 const renders=nodes.filter(node=>node.type==='CallExpression'&&['d.jsx','d.jsxs'].includes(reference(node.callee))&&member(node.arguments[0])==='tR')
 const render=one(renders,'actual public jobs component render');let at=parents.get(render),returned=false
 while(at&&at!==defaultComponent){requireValue(!isFunction(at)&&!['IfStatement','ConditionalExpression','LogicalExpression','SwitchStatement','TryStatement'].includes(at.type),'inactive public jobs render');if(at.type==='ReturnStatement')returned=true;at=parents.get(at)}
 requireValue(at===defaultComponent&&returned&&component.body.type==='BlockStatement','unbound public jobs render')
}

export function readAixNativeInit(html){
 const doc=document(html),scripts=[]
 const visit=node=>{if(typeof node==='string'||['template','noscript','textarea','title','style','iframe','plaintext','xmp','noembed','noframes'].includes(node.tag))return
  if(node.tag==='script'){if(!node.attrs.src&&/^(?:|text\/javascript|application\/javascript|module)$/.test((node.attrs.type||'').toLowerCase()))scripts.push(node);return}
  node.children.forEach(visit)}
 visit(doc.root);const candidates=[]
 for(const script of scripts){const ast=program(script.raw||''),all=tree(ast).nodes
  requireValue(scopeBindings(ast,'j2w').length===0,'shadowed native company/query namespace')
  noMutation(ast,['j2w','window.j2w','globalThis.j2w'])
  for(const node of all.filter(node=>node.type==='CallExpression'&&member(node.callee)==='j2w.init')){
   requireValue(ast.body.some(statement=>statement.type==='ExpressionStatement'&&statement.expression===node),'native company/query init is not unconditional executable code')
   requireValue(node.arguments.length===1&&node.arguments[0].type==='ObjectExpression','dynamic native company/query initializer')
   const value={},seen=new Set(),core=new Set(['ssoCompanyId','brand','q','location','locationsearch','geolocation','locale','categoryId','siteTypeId','isInternal'])
   for(const property of node.arguments[0].properties){
    requireValue(property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init','unknown native company/query property assignment')
    const name=property.key.name??property.key.value
    requireValue(typeof name==='string'&&!['__proto__','constructor','prototype'].includes(name),'unknown native company/query property')
    if(!core.has(name))continue
    requireValue(!seen.has(name),'duplicate native company/query property');seen.add(name)
    try{value[name]=parseRemoteLiteral(script.raw.slice(property.value.start,property.value.end))}catch{throw Error('Native executable AST contract: native company/query data is not a literal')}
   }
   candidates.push(value)
  }
 }
 return one(candidates,'executable native company/query init')
}
