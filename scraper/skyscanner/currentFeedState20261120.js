// Inspect the published programme without executing it. Local names and module
// numbers are deliberately resolved from bindings in the current programme.
export function proveCurrentFeedState({nodes,parents,manager,output,reads,fetchCall,raw,need,one}){
 const functionNode=n=>n&&['FunctionExpression','FunctionDeclaration','ArrowFunctionExpression'].includes(n.type)
 const owner=n=>{for(let p=parents.get(n);p;p=parents.get(p))if(functionNode(p))return p;return null}
 const variables=manager.scopes.flatMap(s=>s.variables),references=manager.scopes.flatMap(s=>s.references)
 const variable=id=>references.find(r=>r.identifier===id)?.resolved??variables.find(v=>v.identifiers.includes(id))
 const immutable=v=>{need(v&&v.defs.length===1&&v.references.every(r=>!r.isWrite()||r.init===true),'native state binding is absent or changed');return v}
 const definition=id=>immutable(variable(id)).defs[0].node
 const last=n=>n?.type==='SequenceExpression'?n.expressions.at(-1):n
 const method=(call,key)=>{const m=last(call?.callee);return m?.type==='MemberExpression'&&!m.computed&&m.property.name===key?m:null}
 const sameBinding=(a,b)=>a?.type==='Identifier'&&b?.type==='Identifier'&&variable(a)&&variable(a)===variable(b)
 const consumer=parents.get(reads[0].identifier),setter=consumer.callee
 need(setter.type==='Identifier','complete feed is not delivered to its live state setter')
 const stateDefinition=definition(setter),pattern=stateDefinition.id,stateCall=stateDefinition.init,stateMethod=method(stateCall,'useState')
 need(pattern?.type==='ArrayPattern'&&pattern.elements.length===2&&pattern.elements.every(n=>n?.type==='Identifier')&&sameBinding(pattern.elements[1],setter)&&stateMethod&&stateCall.arguments.length===1&&stateCall.arguments[0].type==='ArrayExpression'&&stateCall.arguments[0].elements.length===0,'native feed state setter is disconnected')
 const state=immutable(variable(pattern.elements[0])),hook=owner(stateDefinition),factory=owner(hook)
 need(functionNode(hook)&&functionNode(factory)&&factory.params.length===3&&factory.params.every(n=>n.type==='Identifier'),'native hook module factory unavailable')
 const react=stateMethod.object,reactDefinition=definition(react),loader=factory.params[2],exports=factory.params[1]
 need(reactDefinition.init?.type==='CallExpression'&&sameBinding(reactDefinition.init.callee,loader)&&reactDefinition.init.arguments.length===1&&reactDefinition.init.arguments[0].type==='Literal','native state module import disconnected')
 const request=owner(fetchCall),invocation=parents.get(request),effect=owner(request),effectCall=parents.get(effect),effectMethod=method(effectCall,'useEffect')
 need(request?.async===true&&invocation?.type==='CallExpression'&&invocation.callee===request&&invocation.arguments.length===0&&effectCall?.type==='CallExpression'&&effectCall.arguments[0]===effect&&effectCall.arguments.length===2&&effectCall.arguments[1].type==='ArrayExpression'&&effectCall.arguments[1].elements.length===0&&effectMethod&&sameBinding(effectMethod.object,react)&&owner(effectCall)===hook&&owner(consumer)===request,'current native feed request is disconnected from its active effect')
 const returned=one(nodes.filter(n=>n.type==='ReturnStatement'&&owner(n)===hook),'current hook return'),model=last(returned.argument)
 need(model?.type==='ObjectExpression','native current hook result unavailable')
 const jobs=one(model.properties.filter(p=>p.type==='Property'&&!p.computed&&(p.key.name??p.key.value)==='jobs'),'current jobs state property')
 need(jobs.value.type==='Identifier'&&variable(jobs.value)===state,'native hook does not return the feed state')
 const hookDeclaration=parents.get(hook)
 need(hookDeclaration?.type==='VariableDeclarator'&&hookDeclaration.id.type==='Identifier','native current hook declaration unavailable')
 const hookVariable=immutable(variable(hookDeclaration.id)),hookReads=hookVariable.references.filter(r=>r.isRead())
 const within=(child,ancestor)=>{for(let p=child;p;p=parents.get(p))if(p===ancestor)return true;return false},components=[]
 for(const reference of hookReads){
  const call=parents.get(reference.identifier),projected=parents.get(call),component=owner(call)
  if(call?.type!=='CallExpression'||call.callee!==reference.identifier||call.arguments.length||projected?.type!=='VariableDeclarator'||projected.init!==call||projected.id.type!=='ObjectPattern'||!functionNode(component))continue
  const projection=projected.id.properties.find(p=>p.type==='Property'&&!p.computed&&(p.key.name??p.key.value)==='jobs')
  if(projection?.value.type!=='Identifier')continue
  const currentJobs=immutable(variable(projection.value))
  for(const filtered of nodes.filter(n=>n.type==='CallExpression'&&method(n,'filter')&&variable(method(n,'filter').object)===currentJobs&&owner(n)===component)){
   const declaration=parents.get(filtered);if(declaration?.type!=='VariableDeclarator'||declaration.id.type!=='Identifier'||declaration.init!==filtered)continue
   const selected=immutable(variable(declaration.id))
   for(const mapped of nodes.filter(n=>n.type==='CallExpression'&&method(n,'map')&&variable(method(n,'map').object)===selected&&owner(n)===component)){
    const callback=mapped.arguments[0];if(mapped.arguments.length!==1||callback?.type!=='ArrowFunctionExpression'||callback.params.length!==1||callback.params[0].type!=='Identifier')continue
    const record=variable(callback.params[0]),returns=nodes.filter(n=>n.type==='ReturnStatement'&&owner(n)===component),rendered=callback.body.type==='BlockStatement'?nodes.filter(n=>n.type==='ReturnStatement'&&owner(n)===callback).map(n=>n.argument):[callback.body]
    if(!returns.some(n=>within(mapped,n.argument)))continue
    const links=nodes.filter(n=>n.type==='CallExpression'&&owner(n)===callback&&rendered.some(r=>within(n,r))&&(method(n,'jsx')||method(n,'jsxs'))&&n.arguments[0]?.value==='a'&&n.arguments[1]?.type==='ObjectExpression').flatMap(n=>n.arguments[1].properties.filter(p=>p.type==='Property'&&!p.computed&&(p.key.name??p.key.value)==='href').map(p=>p.value)).filter(n=>n.type==='TemplateLiteral'&&n.quasis.length===2&&n.quasis[0].value.cooked==='/jobs/job/'&&n.quasis[1].value.cooked===''&&n.expressions.length===1&&n.expressions[0].type==='MemberExpression'&&!n.expressions[0].computed&&n.expressions[0].property.name==='id'&&variable(n.expressions[0].object)===record)
    if(links.length===1&&nodes.some(n=>n.type==='MemberExpression'&&!n.computed&&n.property.name==='title'&&variable(n.object)===record&&owner(n)===callback))components.push({projected,component,route:links[0],mapped})
   }
  }
 }
 const{projected,component,route}=one(components,'current hook consumer that renders native job identities')
 const functionValue=(n,seen=new Set())=>{n=last(n);if(functionNode(n))return n;if(n?.type!=='Identifier')return null;const v=variable(n);if(!v||seen.has(v)||v.defs.length!==1)return null;const d=v.defs[0];if(d.type==='FunctionName'&&functionNode(d.node)){immutable(v);return d.node}if(d.node.type!=='VariableDeclarator'||!functionNode(d.node.init)&&d.node.init?.type!=='Identifier')return null;immutable(v);seen.add(v);return functionValue(d.node.init,seen)}
 const exportCall=one(nodes.filter(n=>n.type==='CallExpression'&&owner(n)===factory&&method(n,'d')&&sameBinding(method(n,'d').object,loader)&&n.arguments.length===2&&sameBinding(n.arguments[0],exports)&&n.arguments[1].type==='ObjectExpression'&&n.arguments[1].properties.some(p=>!p.computed&&(p.key.name??p.key.value)==='default')),'current programme default export')
 const exported=one(exportCall.arguments[1].properties.filter(p=>!p.computed&&(p.key.name??p.key.value)==='default'),'native default component export'),getter=exported.value
 need(getter?.type==='ArrowFunctionExpression'&&getter.params.length===0,'native default component getter changed')
 const entry=functionValue(getter.body);need(entry,'native default component implementation absent')
 const belongs=n=>{for(let p=n;p;p=parents.get(p))if(p===factory)return true;return false},edges=new Map()
 for(const call of nodes.filter(n=>n.type==='CallExpression'&&belongs(n))){const from=owner(call);if(!from)continue;const returned=from.type==='ArrowFunctionExpression'&&from.body.type!=='BlockStatement'?[from.body]:nodes.filter(n=>n.type==='ReturnStatement'&&owner(n)===from).map(n=>n.argument);if(!returned.some(n=>within(call,n)))continue;const destinations=[functionValue(call.callee)],jsx=method(call,'jsx')??method(call,'jsxs');if(jsx)destinations.push(functionValue(call.arguments[0]));for(const to of destinations.filter(Boolean)){if(!edges.has(from))edges.set(from,new Set());edges.get(from).add(to)}}
 const seen=new Set(),pending=[entry];while(pending.length){const n=pending.pop();if(seen.has(n))continue;seen.add(n);pending.push(...(edges.get(n)??[]))}
 need(seen.has(component),'native feed consumer is disconnected from the current exported component')
 return{originalStateDeclaration:raw.slice(stateDefinition.start,stateDefinition.end),originalSetterCall:raw.slice(consumer.start,consumer.end),originalCurrentConsumer:raw.slice(projected.start,projected.end),originalNativeRoleRoute:raw.slice(route.start,route.end),originalDefaultExport:raw.slice(exportCall.start,exportCall.end),connectedStateEffectHookAndExport:true,completeSelectionDeclaration:raw.slice(output.start,output.end)}
}
