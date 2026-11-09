import {parseBoundedProgram} from '../../scraper-support/utils/remoteScriptData.js'

const ORIGIN='https://admin.applexus.com'
const PATH='/api/careers_list'
const MESSAGE='Applexus published careers client unavailable or changed'
const reject=()=>{throw new Error(MESSAGE)}
const requireContract=condition=>{if(!condition)reject()}
const isFunction=node=>['ArrowFunctionExpression','FunctionExpression','FunctionDeclaration'].includes(node?.type)
const identifier=(node,name)=>node?.type==='Identifier'&&(name===undefined||node.name===name)
const literal=(node,value)=>node?.type==='Literal'&&node.value===value
const shape=node=>JSON.stringify(node,(key,value)=>['start','end','raw'].includes(key)?undefined:value)
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&!node.optional&&identifier(node.object,object)&&identifier(node.property,property)
const propertyName=node=>node.type==='Identifier'?node.name:node.type==='Literal'?String(node.value):null
const properties=(node,type='ObjectExpression')=>{
 requireContract(node?.type===type)
 const result=new Map()
 for(const p of node.properties){
  requireContract(p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init')
  const name=propertyName(p.key)
  requireContract(name!==null&&!result.has(name)&&!['__proto__','prototype','constructor'].includes(name))
  result.set(name,p.value)
 }
 return result
}
const records=(node,ancestors=[])=>{
 if(!node||typeof node!=='object')return[]
 const children=Object.entries(node).filter(([key])=>!['start','end','raw'].includes(key)).flatMap(([,value])=>Array.isArray(value)?value:value&&typeof value==='object'?[value]:[])
 return[{node,ancestors},...children.flatMap(child=>records(child,[...ancestors,node]))]
}
const patternNames=node=>{
 if(!node)return[]
 if(identifier(node))return[node.name]
 if(node.type==='ObjectPattern')return node.properties.flatMap(p=>patternNames(p.type==='RestElement'?p.argument:p.value))
 if(node.type==='ArrayPattern')return node.elements.flatMap(patternNames)
 if(node.type==='AssignmentPattern')return patternNames(node.left)
 if(node.type==='RestElement')return patternNames(node.argument)
 return[]
}
const localNames=fn=>{
 const names=fn.params.flatMap(patternNames)
 const visit=node=>{
  if(!node||typeof node!=='object')return
  if(['FunctionDeclaration','ClassDeclaration'].includes(node.type)){if(node.id)names.push(...patternNames(node.id));return}
  if(isFunction(node)||node.type==='ClassExpression')return
  if(node.type==='VariableDeclarator')names.push(...patternNames(node.id))
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)
 }
 visit(fn.body);return names
}
const noShadow=(name,ancestors,module)=>{
 requireContract(!module.params.some(p=>identifier(p,name)))
 for(const scope of ancestors)if(isFunction(scope)&&scope!==module)requireContract(!localNames(scope).includes(name))
}
const webpackModules=program=>{
 requireContract(program.body.length===1&&program.body[0].type==='ExpressionStatement')
 const call=program.body[0].expression,callee=call.callee,assignment=callee?.object
 requireContract(call.type==='CallExpression'&&!call.optional&&call.arguments.length===1&&callee.type==='MemberExpression'&&!callee.computed&&identifier(callee.property,'push'))
 requireContract(assignment?.type==='AssignmentExpression'&&assignment.operator==='='&&member(assignment.left,'self','webpackChunk_N_E'))
 const fallback=assignment.right
 requireContract(fallback.type==='LogicalExpression'&&fallback.operator==='||'&&member(fallback.left,'self','webpackChunk_N_E')&&fallback.right.type==='ArrayExpression'&&fallback.right.elements.length===0)
 const chunk=call.arguments[0]
 requireContract(chunk.type==='ArrayExpression'&&chunk.elements.length===2&&chunk.elements[0]?.type==='ArrayExpression'&&chunk.elements[0].elements.length>0&&chunk.elements[0].elements.every(n=>n?.type==='Literal'&&Number.isSafeInteger(n.value)&&n.value>=0))
 return [...properties(chunk.elements[1]).values()]
}
const concatArguments=node=>{
 if(literal(node,''))return[node]
 requireContract(node?.type==='CallExpression'&&!node.optional&&node.callee.type==='MemberExpression'&&!node.callee.computed&&identifier(node.callee.property,'concat')&&node.arguments.every(n=>n.type!=='SpreadElement'))
 return[...concatArguments(node.callee.object),...node.arguments]
}
const verifyKey=(key,locationName)=>{
 requireContract(key?.type==='ArrowFunctionExpression'&&!key.async&&key.params.length===2&&key.params.every(p=>identifier(p)))
 requireContract(new Set(key.params.map(p=>p.name)).size===2&&!key.params.some(p=>p.name===locationName))
 const invoke=key.body,inner=invoke?.callee
 requireContract(invoke.type==='CallExpression'&&!invoke.optional&&inner.type==='ArrowFunctionExpression'&&!inner.async&&inner.params.length===2&&inner.params.every(p=>identifier(p))&&invoke.arguments.length===2&&invoke.arguments.every((n,i)=>identifier(n,key.params[i].name)))
 requireContract(new Set(inner.params.map(p=>p.name)).size===2&&!inner.params.some(p=>p.name===locationName))
 requireContract(inner.body.type==='BlockStatement'&&inner.body.body.length===2&&inner.body.body[0].type==='VariableDeclaration'&&inner.body.body[0].declarations.every(d=>identifier(d.id)&&d.init===null))
 const returned=inner.body.body[1]
 requireContract(returned.type==='ReturnStatement'&&returned.argument?.type==='ConditionalExpression'&&literal(returned.argument.consequent,null))
 const args=concatArguments(returned.argument.alternate)
 requireContract(args.length===8&&literal(args[0],'')&&[ORIGIN,ORIGIN+'/'].some(v=>literal(args[1],v))&&literal(args[2],PATH+'?location=')&&identifier(args[3],locationName)&&literal(args[4],'&limit=')&&literal(args[5],9)&&literal(args[6],'&offset='))
 const offset=args[7]
 requireContract(offset.type==='BinaryExpression'&&offset.operator==='*'&&literal(offset.left,9)&&identifier(offset.right,inner.params[0].name))
 // The previous native page's empty data array is the sole terminal guard.
 const previous=inner.params[1].name,temp=inner.body.body[0].declarations
 requireContract(temp.length===1)
 requireContract(![locationName,...inner.params.map(p=>p.name)].includes(temp[0].id.name))
 const expected=parseBoundedProgram(`(${previous}&&(null==(${temp[0].id.name}=${previous}.data)?void 0:${temp[0].id.name}.length)===0)`)
 requireContract(shape(returned.argument.test)===shape(expected.body[0].expression))
}
const verifyTotal=(division,data,size,setSize,hook)=>{
 requireContract(division.type==='BinaryExpression'&&division.operator==='/'&&literal(division.right,9))
 const assignments=records(division.left).map(({node})=>node).filter(node=>node.type==='AssignmentExpression')
 requireContract(assignments.length===3&&assignments.every(n=>n.operator==='='&&identifier(n.left)))
 const names=assignments.map(n=>n.left.name),[first,second,last]=names
 requireContract(new Set(names).size===3&&names.every(name=>localNames(hook).includes(name)&&![data.name,size.name,setSize.name].includes(name)))
 const expected=parseBoundedProgram(`((null==${data.name}||null==(${first}=${data.name}[0])||null==(${second}=${first}.career_list)||null==(${last}=${second}.pagination)?void 0:${last}.total)||0)`)
 requireContract(shape(division.left)===shape(expected.body[0].expression))
}
const authorizationFromFetcher=fetcher=>{
 requireContract(fetcher?.type==='ArrowFunctionExpression'&&!fetcher.async&&fetcher.params.length===1&&identifier(fetcher.params[0])&&fetcher.params[0].name!=='fetch')
 const then=fetcher.body
 requireContract(then.type==='CallExpression'&&!then.optional&&then.arguments.length===1&&then.callee.type==='MemberExpression'&&!then.callee.computed&&identifier(then.callee.property,'then'))
 const request=then.callee.object
 requireContract(request.type==='CallExpression'&&!request.optional&&identifier(request.callee,'fetch')&&request.arguments.length===2&&identifier(request.arguments[0],fetcher.params[0].name))
 const options=properties(request.arguments[1])
 requireContract(options.size===1||options.size===2&&literal(options.get('method'),'GET'))
 requireContract([...options.keys()].every(key=>['headers','method'].includes(key)))
 const headers=properties(options.get('headers')),authorization=headers.get('Authorization')
 requireContract(headers.size===1&&authorization?.type==='Literal'&&typeof authorization.value==='string'&&authorization.value.length<=8192)
 const value=authorization.value,token=value.startsWith('Basic ')?value.slice(6):''
 requireContract(/^[A-Za-z0-9+/]+={0,2}$/.test(token)&&Buffer.from(token,'base64').toString('base64')===token)
 const json=then.arguments[0]
 requireContract(json.type==='ArrowFunctionExpression'&&!json.async&&json.params.length===1&&identifier(json.params[0])&&json.body.type==='CallExpression'&&!json.body.optional&&json.body.arguments.length===0&&member(json.body.callee,json.params[0].name,'json'))
 return value
}

// Parse the currently published anonymous careers client; never execute its
// webpack functions, fetchers, credentials, application module or URL builder.
export const extractPublishedApplexusClient=js=>{
 try{
  requireContract(typeof js==='string')
  const modules=webpackModules(parseBoundedProgram(js)),candidates=modules.filter(module=>records(module).some(({node})=>literal(node,PATH+'?location=')))
  requireContract(candidates.length===1)
  const module=candidates[0]
  requireContract(module.type==='ArrowFunctionExpression'&&module.params.length===3&&module.params.every(p=>identifier(p))&&module.body.type==='BlockStatement')
  const declarations=new Map()
  for(const statement of module.body.body){
   if(statement.type==='VariableDeclaration')for(const declaration of statement.declarations){requireContract(identifier(declaration.id)&&!declarations.has(declaration.id.name));declarations.set(declaration.id.name,declaration.init)}
   if(['FunctionDeclaration','ClassDeclaration'].includes(statement.type)){requireContract(identifier(statement.id)&&!declarations.has(statement.id.name));declarations.set(statement.id.name,statement)}
  }
  requireContract(!declarations.has('fetch')&&!declarations.has('Math'))
  noShadow('fetch',[],module)
  const all=records(module),calls=all.filter(({node})=>node.type==='CallExpression'&&node.arguments[0]&&records(node.arguments[0]).some(({node})=>literal(node,PATH+'?location=')))
   .filter(({node})=>node.callee.type==='SequenceExpression'&&node.callee.expressions.length===2&&literal(node.callee.expressions[0],0)&&node.callee.expressions[1].type==='MemberExpression'&&identifier(node.callee.expressions[1].property,'Ay'))
  requireContract(calls.length===1)
  const{node:call,ancestors}=calls[0],swr=call.callee.expressions[1]
  requireContract(!swr.computed&&!swr.optional&&identifier(swr.object)&&call.arguments.length===3&&identifier(call.arguments[1]))
  const importName=swr.object.name,fetcherName=call.arguments[1].name,loader=declarations.get(importName)
  noShadow(importName,ancestors,module);noShadow(fetcherName,ancestors,module);noShadow('Math',ancestors,module)
  requireContract(loader?.type==='CallExpression'&&identifier(loader.callee,module.params[2].name)&&loader.arguments.length===1&&literal(loader.arguments[0],67016))
  requireContract(!all.some(({node})=>node.type==='AssignmentExpression'&&[importName,fetcherName].some(name=>identifier(node.left,name))||node.type==='UpdateExpression'&&[importName,fetcherName].some(name=>identifier(node.argument,name))))
  const hook=[...ancestors].reverse().find(isFunction)
  requireContract(hook?.type==='ArrowFunctionExpression'&&hook.params.length===1&&identifier(hook.params[0])&&hook.body.type==='BlockStatement')
  verifyKey(call.arguments[0],hook.params[0].name)
  const binding=ancestors.at(-1)
  requireContract(binding?.type==='VariableDeclarator'&&binding.init===call)
  const result=properties(binding.id,'ObjectPattern'),data=result.get('data'),size=result.get('size'),setSize=result.get('setSize')
  requireContract(identifier(data)&&identifier(size)&&identifier(setSize))
  const totals=hook.body.body.filter(s=>s.type==='VariableDeclaration').flatMap(s=>s.declarations).filter(d=>d.init?.type==='CallExpression'&&member(d.init.callee,'Math','ceil'))
  requireContract(totals.length===1&&identifier(totals[0].id)&&totals[0].init.arguments.length===1)
  const division=totals[0].init.arguments[0]
  verifyTotal(division,data,size,setSize,hook)
  const returned=hook.body.body.filter(s=>s.type==='ReturnStatement')
  requireContract(returned.length===1)
  const rendered=properties(returned[0].argument),more=rendered.get('hasMorePages')
  requireContract(identifier(rendered.get('size'),size.name)&&identifier(rendered.get('setSize'),setSize.name)&&identifier(rendered.get('totalPages'),totals[0].id.name)&&more?.type==='BinaryExpression'&&more.operator==='<'&&identifier(more.left,size.name)&&identifier(more.right,totals[0].id.name))
  const authorization=authorizationFromFetcher(declarations.get(fetcherName))
  return {authorization,apiOrigin:ORIGIN,listingPath:PATH,pageSize:9,method:'GET'}
 }catch{
  // Acorn diagnostics and literal data can contain source text. Do not attach
  // an underlying error/cause or configuration to this public contract error.
  throw Object.assign(new Error(MESSAGE),{failureKind:'parser_or_contract_error',abortRetries:true})
 }
}
