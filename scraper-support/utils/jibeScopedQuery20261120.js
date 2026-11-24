import {parse} from 'acorn'

const need=(ok,message)=>{if(!ok)throw Error('Jibe recruitment: current scoped public client '+message)}
const member=(node,property)=>node?.type==='MemberExpression'&&(!node.computed&&node.property?.name===property
 ||node.computed&&node.property?.type==='Literal'&&node.property.value===property)
const ownSearchGET=node=>node?.type==='CallExpression'&&member(node.callee,'get')&&member(node.callee.object,'http')
 &&node.callee.object.object?.type==='ThisExpression'&&node.arguments[0]?.type==='Literal'&&node.arguments[0].value==='/api/jobs'
function nodesIn(root){
 const nodes=[],stack=[root]
 while(stack.length){
  const node=stack.pop()
  if(!node?.type)continue
  nodes.push(node)
  for(const value of Object.values(node)){
   if(Array.isArray(value))stack.push(...value.filter(item=>item?.type))
   else if(value?.type)stack.push(value)
  }
 }
 return nodes
}
// This is the public query construction, not the bundled program. The closed
// prefix binds the anonymous default, native override loop, scalar escaping,
// parameter precedence, and the only extra native fields (anonymous session
// metadata). Request retry UI and the rest of the client are outside this proof.
const referenceSource='function query(parameter){let retry=!1;const scope={internal:this.config.searchOverride?.internal||"false"};if(!utility.isEmpty(this.config.searchOverride))for(const field in this.config.searchOverride)parameter[field]||(scope[field]=this.config.searchOverride[field].toString());parameter=utility.transform(parameter,(entry,value,key)=>((value=value.toString().replace(/amp;/g,"")).includes("+")&&(value=value.replace(/\\+/g,"%2B")),entry[key]=value,entry));const extra={},headers={};this.config.externalSearch&&this._jibe?.session&&(headers["User-ID"]=this._jibe.session.duid,headers["Session-ID"]=this._jibe.session.id,extra.deviceId=this._jibe.session.ufp,extra.domain='+String.fromCharCode(96,36,123)+'this._jibe.models.jobs.core.client}.jibeapply.com'+String.fromCharCode(96)+'),headers["X-REQUEST-SOURCE"]="CST",this.config.retryIfBadGateway?.enabled&&(retry=!0);const request=this.http.get("/api/jobs",{params:{...parameter,...scope,...extra},headers:headers});}'
const referenceFunction=parse(referenceSource,{ecmaVersion:'latest'}).body[0]

function queryShape(fn){
 const statements=fn?.body?.body
 need(fn?.params?.length===1&&fn.params[0].type==='Identifier'&&statements?.length>=7,'query formal changed')
 const declaration=(index,count)=>{
  const statement=statements[index]
  need(statement?.type==='VariableDeclaration'&&statement.declarations.length===count
   &&statement.declarations.every(value=>value.id.type==='Identifier'),'query bindings changed')
  return statement.declarations.map(value=>value.id.name)
 }
 const retry=declaration(0,1)[0],scope=declaration(1,1)[0]
 const [extra,headers]=declaration(4,2),request=declaration(6,1)[0]
 const condition=statements[2]?.test
 const utility=condition?.argument?.callee?.object?.name
 need(condition?.type==='UnaryExpression'&&condition.operator==='!'&&typeof utility==='string','native override predicate changed')
 const names=[fn.params[0].name,retry,scope,extra,headers,request,utility]
 need(new Set(names).size===names.length,'query bindings alias each other')
 const bindings=new Map(names.map((name,index)=>[name,'$binding'+index]))
 function shape(node,scopeBindings=bindings,parent=null,field=null){
  if(node===null||typeof node!=='object')return node
  if(Array.isArray(node))return node.map(value=>shape(value,scopeBindings,parent,field))
  let current=scopeBindings
  if(node.type==='ForInStatement'){
   const declarations=node.left?.declarations
   need(node.left?.type==='VariableDeclaration'&&declarations?.length===1&&declarations[0].id.type==='Identifier','native override iteration changed')
   current=new Map(scopeBindings)
   current.set(declarations[0].id.name,'$loopField')
  }
  if(['ArrowFunctionExpression','FunctionExpression'].includes(node.type)){
   need(node.params.every(value=>value.type==='Identifier'),'query transform formals changed')
   current=new Map(scopeBindings)
   node.params.forEach((value,index)=>current.set(value.name,'$formal'+index))
  }
  // A deployment may add the literal diagnostic CST header. It carries no
  // tenant/publication selector. Every other pre-request write remains closed.
  if(node===statements[5]?.expression&&node.type==='SequenceExpression'){
   const isDiagnostic=value=>value.type==='AssignmentExpression'&&value.operator==='='
    &&value.left.type==='MemberExpression'&&value.left.object.type==='Identifier'&&value.left.object.name===headers
    &&value.left.computed&&value.left.property.type==='Literal'&&value.left.property.value==='X-REQUEST-SOURCE'
    &&value.right.type==='Literal'&&value.right.value==='CST'
   need(node.expressions.filter(isDiagnostic).length<=1,'ambiguous diagnostic header')
   if(node.expressions.some(isDiagnostic))return shape({...node,expressions:node.expressions.filter(value=>!isDiagnostic(value))},scopeBindings,parent,field)
  }
  if(node.type==='Identifier'){
   const propertyKey=(parent?.type==='MemberExpression'&&field==='property'&&!parent.computed)
    ||(parent?.type==='Property'&&field==='key'&&!parent.computed)
   return {type:'Identifier',name:propertyKey?node.name:current.get(node.name)??node.name}
  }
  const result={}
  for(const [key,value]of Object.entries(node)){
   if(['start','end','loc','range','raw'].includes(key))continue
   result[key]=shape(value,current,node,key)
  }
  return result
 }
 // Keep every statement before the actual public GET. An inserted or reordered
 // writer cannot hide behind a matching route string or override declaration.
 return JSON.stringify(shape(statements.slice(0,7)))
}
const referenceShape=queryShape(referenceFunction)

export function verifyScopedJibeQuery(ast){
 const candidates=nodesIn(ast).filter(node=>node.type==='MethodDefinition'&&node.value?.body?.body?.some(statement=>
  statement.type==='VariableDeclaration'&&statement.declarations.some(value=>ownSearchGET(value.init))))
 need(candidates.length===1,'query owner missing or ambiguous')
 const method=candidates[0],statements=method.value.body.body
 need(method.kind==='method'&&!method.static&&!method.computed&&method.key.name==='searchJob','query owner changed')
 need(statements[6]?.type==='VariableDeclaration'&&statements[6].declarations.length===1
  &&ownSearchGET(statements[6].declarations[0].init),'query route/order changed')
 need(queryShape(method.value)===referenceShape,'anonymous scope construction changed')
 const request=statements[6].declarations[0].id.name
 const ownedNodes=root=>{
  const own=[]
  function visit(node){
   if(!node?.type)return
   if(node!==root&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type))return
   own.push(node)
   for(const value of Object.values(node)){
    if(Array.isArray(value))value.forEach(visit)
    else if(value?.type)visit(value)
   }
  }
  visit(root);return own
 }
 const own=ownedNodes(method.value),all=nodesIn(method.value)
 const transportReferences=all.filter(node=>member(node,'http')&&node.object?.type==='ThisExpression')
 need(transportReferences.length===1&&transportReferences[0]===statements[6].declarations[0].init.callee.object,
  'additional request transport reference requires review')
 need(!all.some(node=>node.type==='MemberExpression'&&node.computed&&node.object?.type==='ThisExpression'),
  'computed request owner requires review')
 const transports=nodesIn(method.value).filter(node=>node.type==='CallExpression'&&(
  node.callee?.type==='MemberExpression'&&member(node.callee.object,'http')&&node.callee.object.object?.type==='ThisExpression'
  ||node.callee?.type==='Identifier'&&node.callee.name==='fetch'
  ||node.callee?.type==='MemberExpression'&&node.callee.property?.name==='fetch'))
 need(transports.length===1&&transports[0]===statements[6].declarations[0].init,'additional request transport requires review')
 const returns=own.filter(node=>node.type==='ReturnStatement')
 const final=statements.at(-1)
 const piping=returns.filter(node=>node.argument?.type==='CallExpression')
 need(returns.length===2&&final?.type==='ReturnStatement'&&final.argument?.type==='Identifier'&&final.argument.name===request
  &&piping.length===1,'returned query request changed')
 const pipeline=piping[0].argument
 need(member(pipeline.callee,'pipe')&&pipeline.callee.object.type==='Identifier'&&pipeline.callee.object.name===request
  &&pipeline.arguments.length===1,'returned retry request changed')
 const unsequence=node=>node?.type==='SequenceExpression'?node.expressions.at(-1):node
 const operator=pipeline.arguments[0],operatorCallee=unsequence(operator?.callee),callback=operator?.arguments?.[0]
 need(operator?.type==='CallExpression'&&operator.arguments.length===1&&member(operatorCallee,'K')
  &&operatorCallee.object.type==='Identifier'&&callback?.type==='ArrowFunctionExpression'&&callback.params.length===1
  &&callback.params[0].type==='Identifier','retry error operator changed')
 const errorName=callback.params[0].name,errorReturns=ownedNodes(callback).filter(node=>node.type==='ReturnStatement')
 need(errorReturns.length===2&&errorReturns.every(node=>{
  const call=node.argument,callee=unsequence(call?.callee)
  if(call?.type!=='CallExpression'||call.arguments.length!==1||callee?.type!=='MemberExpression'||callee.object.type!=='Identifier')return false
  const argument=call.arguments[0]
  return member(callee,'of')&&argument.type==='ObjectExpression'&&argument.properties.length===0
   ||member(callee,'_')&&argument.type==='Identifier'&&argument.name===errorName
 }),'returned retry response/request changed')
 need(!nodesIn(method.value).some(node=>node.type==='AssignmentExpression'&&node.left.type==='Identifier'&&node.left.name===request
  ||node.type==='UpdateExpression'&&node.argument.type==='Identifier'&&node.argument.name===request),'constructed query request reassigned')
 return {method:'GET',endpoint:'/api/jobs',anonymousDefault:'false',scopeSource:'this.config.searchOverride',
  paramsPrecedence:['query','nativeOverride','anonymousSessionMetadata'],browserExecutionEstablished:false}
}
