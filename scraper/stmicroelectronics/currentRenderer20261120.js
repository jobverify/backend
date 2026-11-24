import {parse} from 'acorn'

// Read published syntax only. This does not execute the client or establish
// browser equivalence; own role/schema/country/open-state checks remain separate.
export function readRecruitmentConsumers(source){
 const need=(ok,message)=>{if(!ok)throw Object.assign(new Error('[stmicroelectronics] native renderer '+message),{softFailure:true,abortRetries:true,failureKind:'surface_drift_or_fail_closed'})}
 let ast
 try{ast=parse(source,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,'syntax changed')}
 const nodes=[],parent=new WeakMap()
 function visit(n,p){if(!n||typeof n!=='object')return;nodes.push(n);if(p)parent.set(n,p)
  for(const [key,v]of Object.entries(n))if(!['start','end','loc','range'].includes(key)){if(Array.isArray(v)){for(const item of v)if(item?.type)visit(item,n)}else if(v?.type)visit(v,n)}
 }visit(ast)
 const key=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?n.value:null
 const path=n=>{
  if(n?.type==='ChainExpression')return path(n.expression)
  if(n?.type==='Identifier')return n.name
  if(n?.type==='ThisExpression')return 'this'
  if(n?.type==='SequenceExpression')return path(n.expressions.at(-1))
  if(n?.type==='MemberExpression'&&(!n.computed||n.property.type==='Literal')){const base=path(n.object),part=key(n.property);return base!==null&&part!==null?base+'.'+part:null}
  return null
 }
 const prop=(n,name)=>n?.properties?.filter(p=>p.type==='Property'&&!p.computed&&key(p.key)===name)??[]
 const one=(list,message)=>{need(list.length===1,message+' missing or ambiguous');return list[0]}
 const nearest=(n,predicate)=>{for(n=parent.get(n);n;n=parent.get(n))if(predicate(n))return n;return null}
 const functionIs=n=>n.type==='FunctionExpression'||n.type==='ArrowFunctionExpression'||n.type==='FunctionDeclaration'
 const functionOf=n=>nearest(n,functionIs)
 const inside=(n,ancestor)=>n.start>=ancestor.start&&n.end<=ancestor.end
 const inNodes=(n,predicate)=>nodes.filter(x=>inside(x,n)&&predicate(x))
 const literal=(n,value)=>n?.type==='Literal'&&n.value===value
 const objectBinding=(fn,initialPath)=>{
  const pattern=one(inNodes(fn,n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&path(n.init)===initialPath&&functionOf(n)===fn),'consumer input binding').id
  return name=>{const p=one(prop(pattern,name),'consumer '+name+' input');return p.value.type==='AssignmentPattern'?path(p.value.left):path(p.value)}
 }
 const concatParts=n=>{
  if(n?.type==='Literal')return [n.value]
  if(n?.type==='CallExpression'&&n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.property.name==='concat'){
   const base=concatParts(n.callee.object);return base?[...base,...n.arguments.map(v=>v.type==='Literal'?v.value:path(v)??'#expression')]:null
  }return null
 }
 const calls=n=>inNodes(n,x=>x.type==='CallExpression')
 const resolve=(name,at)=>{
  for(let owner=functionOf(at);owner;owner=functionOf(owner)){
   const found=inNodes(owner,n=>(n.type==='VariableDeclarator'&&path(n.id)===name||n.type==='FunctionDeclaration'&&n.id?.name===name)&&functionOf(n)===owner)
   if(found.length)return one(found,'lexical '+name+' binding').init??found[0]
   need(!owner.params?.some(p=>path(p)===name),'unresolved formal '+name)
  }
  need(false,'unresolved lexical consumer binding')
 }
 const exported=member=>{
  need(member?.type==='MemberExpression'&&!member.computed&&member.object.type==='Identifier','transport import changed')
  const required=resolve(member.object.name,member),moduleOwner=functionOf(required)
  need(required.type==='CallExpression'&&required.arguments.length===1&&required.arguments[0].type==='Literal'&&Number.isSafeInteger(required.arguments[0].value)
   &&path(required.callee)===path(moduleOwner.params[2]),'transport require binding changed')
  const id=required.arguments[0].value,definition=one(nodes.filter(n=>n.type==='Property'&&key(n.key)===id&&functionIs(n.value)),'consumed native utility module').value
  const exporter=one(inNodes(definition,n=>n.type==='CallExpression'&&path(n.callee)===path(definition.params[2])+'.d'
   &&path(n.arguments[0])===path(definition.params[1])&&n.arguments[1]?.type==='ObjectExpression'),'native utility exports')
  const getter=one(prop(exporter.arguments[1],member.property.name),'consumed native utility export').value
  need(getter.type==='ArrowFunctionExpression'&&getter.params.length===0&&getter.body.type==='Identifier','native utility getter changed')
  return resolve(getter.body.name,getter.body)
 }
 const unsequence=n=>n?.type==='SequenceExpression'?n.expressions.at(-1):n
 const boundNames=n=>{
  if(!n)return []
  if(n.type==='Identifier')return [n.name]
  if(n.type==='AssignmentPattern')return boundNames(n.left)
  if(n.type==='RestElement')return boundNames(n.argument)
  if(n.type==='ArrayPattern')return n.elements.flatMap(boundNames)
  if(n.type==='ObjectPattern')return n.properties.flatMap(p=>boundNames(p.type==='RestElement'?p.argument:p.value))
  return []
 }
 const ownsBinding=(owner,name)=>owner.params?.some(p=>boundNames(p).includes(name))
  ||inNodes(owner,n=>(n.type==='VariableDeclarator'&&boundNames(n.id).includes(name)||n.type==='FunctionDeclaration'&&n.id?.name===name)&&functionOf(n)===owner).length>0
 const globalIsFree=(name,at)=>{for(let owner=functionOf(at);owner;owner=functionOf(owner))if(ownsBinding(owner,name))return false;return true}

 const proveGET=call=>{
  const fn=exported(unsequence(call.callee))
  need(functionIs(fn)&&fn.params.length>=1,'native GET implementation changed')
  const fetchCall=one(inNodes(fn,n=>n.type==='CallExpression'&&path(n.callee)==='fetch'&&functionOf(n)===fn),'native GET fetch')
  const options=fetchCall.arguments[1],input=path(fn.params[0])
  need(fetchCall.arguments.length===2&&options?.type==='ObjectExpression'&&options.properties.length===5
   &&['cache','credentials','headers','method','signal'].every(k=>prop(options,k).length===1)
   &&literal(prop(options,'method')[0].value,'GET')&&literal(prop(options,'credentials')[0].value,'same-origin'),'native GET method/options changed')
  need(fn.params[0].type==='Identifier'&&globalIsFree('fetch',fetchCall),'native global fetch is shadowed')
  const urlWrites=inNodes(fn,n=>n.start<fetchCall.start&&(
   n.type==='AssignmentExpression'&&path(n.left)===input||n.type==='UpdateExpression'&&path(n.argument)===input
   ||n.type==='VariableDeclarator'&&path(n.id)===input&&n.init))
  need(!urlWrites.some(n=>{for(let owner=functionOf(n);owner;owner=functionOf(owner)){if(owner===fn)return true;if(ownsBinding(owner,input))return false}return false}),'native GET URL input was reassigned')

  const rewrite=fetchCall.arguments[0]
  need(rewrite.type==='CallExpression'&&rewrite.callee.type==='Identifier'&&rewrite.arguments.length===1&&path(rewrite.arguments[0])===input,'native effective URL writer changed')
  const rewriteFn=resolve(rewrite.callee.name,rewrite.callee),first=rewriteFn.body?.body?.[0],second=rewriteFn.body?.body?.[1]
  const token=first?.type==='VariableDeclaration'&&first.declarations.length===1?first.declarations[0]:null,read=token?.init
  need(rewriteFn.params.length===1&&read?.type==='CallExpression'&&read.arguments.length===1&&literal(read.arguments[0],'pdf_server_token')
   &&read.callee.type==='MemberExpression'&&read.callee.property.name==='get','native public URL precondition changed')
  const params=read.callee.object
  need(params.type==='MemberExpression'&&!params.computed&&params.property.name==='searchParams'&&params.object.type==='NewExpression'
   &&path(params.object.callee)==='URL'&&params.object.arguments.length===1&&path(params.object.arguments[0])==='window.location.href'
   &&second?.type==='IfStatement'&&second.test.type==='UnaryExpression'&&second.test.operator==='!'&&path(second.test.argument)===path(token.id)
   &&second.consequent.type==='ReturnStatement'&&path(second.consequent.argument)===path(rewriteFn.params[0]),'native public URL rewrite changed')
  return {method:'GET',options:['cache','credentials','headers','method','signal'],publicRoleURLWithoutQueryUnchanged:true}
 }
 const queryRead=(n,search,keyName)=>{
  need(n.type==='CallExpression'&&n.arguments.length===2&&path(n.arguments[0])===search&&literal(n.arguments[1],keyName),'native public query reader changed')
  const fn=exported(unsequence(n.callee)),body=fn.body
  need(fn.type==='ArrowFunctionExpression'&&fn.params.length===2&&body.type==='CallExpression'&&body.arguments.length===1&&path(body.arguments[0])===path(fn.params[1])
   &&body.callee.type==='MemberExpression'&&body.callee.property.name==='get'&&body.callee.object.type==='NewExpression'
   &&path(body.callee.object.callee)==='URLSearchParams'&&body.callee.object.arguments.length===1&&path(body.callee.object.arguments[0])===path(fn.params[0]),'native query helper semantics changed')
 }
 const concatNodes=n=>{
  if(n?.type==='Literal')return [n]
  if(n?.type==='CallExpression'&&n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.property.name==='concat'){
   const base=concatNodes(n.callee.object);return base?[...base,...n.arguments]:null
  }return null
 }

 const carrier=one(nodes.filter(n=>n.type==='Literal'&&n.value==='smartApplyData'&&parent.get(n)?.type==='VariableDeclarator'),'carrier reader')
 const carrierFn=functionOf(carrier)
 need(calls(carrierFn).some(n=>path(n.callee)==='JSON.parse')&&calls(carrierFn).some(n=>path(n.callee)==='document.getElementById'),'carrier JSON reader changed')
 
 const descriptionSinks=nodes.filter(n=>n.type==='Property'&&!n.computed&&key(n.key)==='__html'&&n.value.type==='LogicalExpression'
  &&n.value.operator==='||'&&path(n.value.left)?.endsWith('.insights.job_description'))
 need(descriptionSinks.length===2,'full criteria sinks changed')
 const descriptionFn=functionOf(descriptionSinks[0])
 need(descriptionSinks.every(n=>functionOf(n)===descriptionFn),'criteria consumers split')
 const position=objectBinding(descriptionFn,'this.props')('position')
 for(const sink of descriptionSinks)need(path(sink.value.left)===position+'.insights.job_description'&&path(sink.value.right)===position+'.job_description.0','authored criteria precedence changed')
 const allSinks=inNodes(descriptionFn,n=>n.type==='Property'&&key(n.key)==='__html')
 need(allSinks.length===2,'additional criteria sink requires review')
 const custom=one(inNodes(descriptionFn,n=>n.type==='ConditionalExpression'&&n.test.type==='LogicalExpression'
  &&path(n.test.left)===position+'.insights.custom_JD'&&path(n.test.right)===position+'.insights.custom_JD.enable'),'custom criteria condition')
 need(inNodes(custom.consequent,n=>n.type==='Property'&&key(n.key)==='data'&&path(n.value)===position+'.insights.custom_JD').length===1,'custom criteria data changed')
 const criteriaClass=nearest(descriptionFn,n=>n.type==='ClassDeclaration'||n.type==='ClassExpression')
 const criteriaName=criteriaClass?.id?.name??path(parent.get(criteriaClass)?.id)
 need(typeof criteriaName==='string','criteria component binding changed')
 
 const insightLiteral=one(nodes.filter(n=>literal(n,'/insights?domain=')),'role insights transport')
 const transport=functionOf(insightLiteral),input=path(transport.params[0]),get=objectBinding(transport,input)
 const mode=get('mode'),pid=get('positionId'),domain=get('domain')
 const httpCalls=calls(transport).filter(n=>unsequence(n.callee)?.type==='MemberExpression')
 const insights=one(httpCalls.filter(n=>{const p=concatParts(n.arguments[0]);return p?.slice(0,6).join('|')===['/api/',mode,'/v2/jobs/',pid,'/insights?domain=',domain].join('|')}),'own insights GET')
 const job=one(httpCalls.filter(n=>{const p=concatParts(n.arguments[0]);return p?.slice(0,6).join('|')===['/api/',mode,'/v2/jobs/',pid,'?domain=',domain].join('|')}),'own full role GET')
 need(insights.arguments.length===1&&job.arguments.length===1&&path(insights.callee)===path(job.callee),'public role GET transport changed')
 proveGET(insights);proveGET(job)
 const insightParts=concatNodes(insights.arguments[0]),jobParts=concatNodes(job.arguments[0])
 need(insightParts?.length===7&&jobParts?.length===11,'effective role URL parts changed')
 const suffix=path(insightParts[6])
 need(suffix!==null&&path(jobParts[6])===suffix,'native role URL scope suffix changed')
 const suffixValue=resolve(suffix,insightParts[6])
 need(suffixValue.type==='ConditionalExpression'&&literal(suffixValue.alternate,'')
  &&concatParts(suffixValue.consequent)?.length===2&&concatParts(suffixValue.consequent)[0]==='&microsite='
  &&concatParts(suffixValue.consequent)[1]===path(suffixValue.test),'native microsite URL suffix changed')
 queryRead(resolve(path(suffixValue.test),suffixValue.test),'window.location.search','microsite')
 const debug=jobParts[7]
 need(debug.type==='ConditionalExpression'&&literal(debug.consequent,'&debug=1')&&literal(debug.alternate,'')&&debug.test.type==='CallExpression'
  &&debug.test.arguments.length===0&&debug.test.callee.type==='Identifier','native debug URL suffix changed')
 const debugFn=resolve(debug.test.callee.name,debug.test.callee),debugBody=debugFn.body
 need(debugFn.type==='ArrowFunctionExpression'&&debugFn.params.length===0&&debugBody.type==='BinaryExpression'&&debugBody.operator==='==='&&literal(debugBody.left,'1'),'native debug predicate changed')
 queryRead(debugBody.right,'window.location.search','debug')
 const privatePart=jobParts[8]
 need(privatePart.type==='ConditionalExpression'&&literal(privatePart.consequent,'&is_private_apply=1')&&literal(privatePart.alternate,''),'native private URL suffix changed')
 const privateTest=resolve(path(privatePart.test),privatePart.test)
 need(privateTest.type==='CallExpression'&&path(privateTest.callee)==='window.location.href.includes'&&privateTest.arguments.length===1,'native private route predicate changed')
 const privatePath=concatNodes(privateTest.arguments[0])
 need(privatePath?.length===2&&literal(privatePath[0],'/careers/')&&concatParts(resolve(path(privatePath[1]),privatePath[1]))?.join('')==='job/private','native private route changed')
 const card=jobParts[9],extra=jobParts[10]
 need(card.type==='ConditionalExpression'&&literal(card.alternate,'')&&concatParts(card.consequent)?.join('|')===['&pcs_jobs_card_index=',get('cardIndex')].join('|')
  &&card.test.type==='LogicalExpression'&&card.test.operator==='&&'&&card.test.left.type==='BinaryExpression'&&card.test.left.operator==='!=='
  &&card.test.left.left.type==='UnaryExpression'&&card.test.left.left.operator==='-'&&literal(card.test.left.left.argument,1)&&path(card.test.left.right)===get('cardIndex')
  &&card.test.right.type==='BinaryExpression'&&card.test.right.operator==='!=='&&card.test.right.left.type==='UnaryExpression'&&card.test.right.left.operator==='void'
  &&literal(card.test.right.left.argument,0)&&path(card.test.right.right)===get('cardIndex'),'native role card URL suffix changed')
 need(extra.type==='ConditionalExpression'&&literal(extra.alternate,'')&&concatParts(extra.consequent)?.join('|')===['&',path(extra.test)].join('|'),'native persisted query URL suffix changed')
 const paramsString=resolve(path(extra.test),extra.test)
 need(paramsString.type==='CallExpression'&&paramsString.arguments.length===0&&paramsString.callee.type==='MemberExpression'&&paramsString.callee.property.name==='toString','native persisted query binding changed')
 const paramsName=path(paramsString.callee.object),paramsValue=resolve(paramsName,paramsString)
 const paramsSearch=paramsValue.arguments?.[0]
 need(paramsValue.type==='NewExpression'&&path(paramsValue.callee)==='URLSearchParams'&&paramsValue.arguments.length===1
  &&paramsSearch?.type==='ConditionalExpression'&&paramsSearch.test.type==='BinaryExpression'&&paramsSearch.test.operator==='=='
  &&literal(paramsSearch.test.left,null)&&paramsSearch.test.right.type==='AssignmentExpression'&&paramsSearch.test.right.operator==='='
  &&path(paramsSearch.test.right.right)==='window.location'&&paramsSearch.consequent.type==='UnaryExpression'&&paramsSearch.consequent.operator==='void'
  &&literal(paramsSearch.consequent.argument,0)&&path(paramsSearch.alternate)===path(paramsSearch.test.right.left)+'.search','native query initialization changed')
 const paramsWrites=inNodes(transport,n=>n.type==='MemberExpression'&&path(n.object)===paramsName)
 need(paramsWrites.every(n=>!n.computed&&['toString','delete'].includes(n.property.name)),'native query mutation changed')

 const requestArray=nearest(job,n=>n.type==='ArrayExpression')
 need(requestArray&&inside(insights,requestArray)&&requestArray.elements.length===4
  &&inside(insights,requestArray.elements[0])&&inside(job,requestArray.elements[2]),'native response order changed')
 const responseMap=one(inNodes(transport,n=>n.type==='ObjectExpression'&&prop(n,'insights').length&&prop(n,'job').length&&prop(n,'brandingJob').length),'native response mapping')
 const responseFn=functionOf(responseMap),responsePattern=one(inNodes(responseFn,n=>n.type==='VariableDeclarator'&&n.id.type==='ArrayPattern'),'native response tuple').id
 need(path(prop(responseMap,'insights')[0].value)===path(responsePattern.elements[0])&&path(prop(responseMap,'job')[0].value)===path(responsePattern.elements[2]),'native full role response mapping changed')
 const transportCall=one(nodes.filter(n=>n.type==='CallExpression'&&n.callee===transport),'active role data consumer')
 const component=functionOf(transportCall)
 const componentInput=path(component.params[0]),componentBindings=objectBinding(component,componentInput)
 const componentPosition=componentBindings('position'),componentMode=componentBindings('mode'),componentDomain=componentBindings('domain')
 const args=transportCall.arguments[0]
 need(args?.type==='ObjectExpression'&&path(prop(args,'positionId')[0]?.value)===componentPosition+'.id'
  &&path(prop(args,'mode')[0]?.value)===componentMode&&path(prop(args,'domain')[0]?.value)===componentDomain,'role request identity binding changed')
 const criteriaCall=one(calls(component).filter(n=>n.arguments.length>=2&&path(n.arguments[0])===criteriaName),'active full criteria component')
 need(path(prop(criteriaCall.arguments[1],'position')[0]?.value)===componentPosition,'full criteria role binding changed')
 
 const mergeToken=one(nodes.filter(n=>literal(n,'UPDATE_INSIGHTS')&&parent.get(n)?.type==='CallExpression'
  &&parent.get(n).arguments[0]===n&&functionOf(n)?.type==='ArrowFunctionExpression'),'role data dispatch')
 const dispatch=parent.get(mergeToken),mergeFn=functionOf(mergeToken),mergeInput=path(mergeFn.params[1]),merged=objectBinding(mergeFn,mergeInput)
 const spread=dispatch.arguments[1]
 need(path(dispatch.callee)===path(mergeFn.params[0])&&spread?.type==='CallExpression'&&spread.arguments.length===5
  &&spread.arguments[0].type==='ObjectExpression'&&spread.arguments[0].properties.length===0
  &&spread.arguments.slice(1).map(path).join('|')===['insights','people','similarJobs','job'].map(merged).join('|'),'role/insights precedence changed')
 need(inside(mergeFn,component),'role dispatch disconnected from native component')
 
 const applications=nodes.filter(n=>literal(n,'/careers/apply')&&parent.get(n)?.type==='ConditionalExpression')
 const applicationLiteral=one(applications,'native own application target')
 const applicationFn=functionOf(applicationLiteral),applicationParent=parent.get(applicationFn)
 need(nearest(applicationFn,functionIs)===component&&applicationParent?.type==='VariableDeclarator','native role application binding changed')
 const appName=path(applicationParent.id)
 const reachable=new Set([appName])
 let changed=true
 while(changed){changed=false;for(const call of calls(component)){
  if(!reachable.has(path(call.callee)))continue
  const owner=functionOf(call),declaration=parent.get(owner)
  if(declaration?.type==='VariableDeclarator'&&nearest(owner,functionIs)===component&&!reachable.has(path(declaration.id))){reachable.add(path(declaration.id));changed=true}
 }}
 const buttons=inNodes(component,n=>n.type==='ObjectExpression'&&prop(n,'dataTestId').some(p=>literal(p.value,'apply-button')))
 need(buttons.length>=1&&buttons.every(n=>reachable.has(path(prop(n,'handler')[0]?.value))&&prop(n,'disabled').length===1&&prop(n,'disabled')[0].value.type==='ConditionalExpression'&&path(prop(n,'disabled')[0].value.test)===componentPosition+'.insights.applied_at'&&literal(prop(n,'disabled')[0].value.consequent,'disabled')&&literal(prop(n,'disabled')[0].value.alternate,null)),'native apply action disconnected or disabled')
 const appBranch=applicationFn.body.body[0],boot=path(appBranch?.test?.right?.object)
 const rest=one(inNodes(component,n=>n.type==='VariableDeclarator'&&path(n.id)===boot&&functionOf(n)===component),'application remaining props').init
 const componentPattern=one(inNodes(component,n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&path(n.init)===componentInput&&functionOf(n)===component),'component input props').id
 need(rest?.type==='CallExpression'&&rest.callee.type==='FunctionExpression'&&rest.arguments.length===2&&path(rest.arguments[0])===componentInput
  &&rest.arguments[1].type==='ArrayExpression'&&rest.arguments[1].elements.every(n=>n.type==='Literal'&&typeof n.value==='string')
  &&JSON.stringify(rest.arguments[1].elements.map(n=>n.value))===JSON.stringify(componentPattern.properties.map(n=>key(n.key))),'application remaining props binding changed')
 const restInput=path(rest.callee.params[0])
 const restCopies=inNodes(rest.callee,n=>n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&functionOf(n)===rest.callee)
 need(restCopies.length===2&&restCopies.every(n=>n.left.computed&&n.right.type==='MemberExpression'&&n.right.computed
  &&path(n.right.object)===restInput&&path(n.left.property)===path(n.right.property)),'application remaining props copy changed')
 need(applicationFn.body.body.length===1&&appBranch?.type==='IfStatement'&&appBranch.test.type==='LogicalExpression'&&appBranch.test.operator==='&&'
  &&appBranch.test.left.type==='BinaryExpression'&&appBranch.test.left.operator==='==='&&literal(appBranch.test.left.left,'apply')&&path(appBranch.test.left.right)===componentMode
  &&path(appBranch.test.right)===boot+'.pcsApplyFormV2Enabled'&&appBranch.consequent.type==='BlockStatement'&&appBranch.consequent.body.length===4
  &&appBranch.alternate?.type==='BlockStatement'&&appBranch.alternate.body.length===2,'native application control flow changed')
 const pathname=one(inNodes(applicationFn,n=>n.type==='Property'&&key(n.key)==='pathname'),'native application route').value
 need(pathname.type==='ConditionalExpression'&&literal(pathname.consequent,'/careers/apply/private')&&literal(pathname.alternate,'/careers/apply'),'native application route changed')
 const route=parent.get(parent.get(pathname)),writer=parent.get(route)
 need(route?.type==='ObjectExpression'&&route.properties.length===3&&['pathname','search','state'].every(k=>prop(route,k).length===1)
  &&writer?.type==='CallExpression'&&writer.arguments.length===1&&writer.arguments[0]===route
  &&writer.callee.type==='MemberExpression'&&!writer.callee.computed&&writer.callee.property.name==='push'
  &&writer.callee.object.type==='Identifier','native application URL writer changed')
 const pidAssignment=one(inNodes(applicationFn,n=>n.type==='AssignmentExpression'&&path(n.left)?.endsWith('.pid')&&path(n.right)===componentPosition+'.id'),'native apply pid')
 const query=path(pidAssignment.left.object),queryInput=one(inNodes(applicationFn,n=>n.type==='VariableDeclarator'&&path(n.id)===query),'native application query input').init
 need(queryInput?.type==='CallExpression'&&queryInput.callee.type==='MemberExpression'&&!queryInput.callee.computed&&queryInput.callee.property.name==='parse'
  &&queryInput.arguments.length===1&&path(queryInput.arguments[0])==='window.location.search','native application query parsing changed')
 const search=prop(route,'search')[0].value,parts=concatParts(search)
 need(parts?.length===2&&parts[0]==='?'&&search.arguments.length===1,'native application search changed')
 const stringify=search.arguments[0]
 need(stringify.type==='CallExpression'&&path(stringify.callee)===path(queryInput.callee.object)+'.stringify'
  &&stringify.arguments.length===1&&path(stringify.arguments[0])===query,'native application search identity changed')

 need(inNodes(applicationFn,n=>n.type==='AssignmentExpression'&&path(n.left)?.endsWith('.pid')&&path(n.right)===componentPosition+'.id').length===1
  &&inNodes(applicationFn,n=>n.type==='Property'&&key(n.key)==='position'&&path(n.value)===componentPosition).length===1,'native apply role identity changed')
 need(calls(applicationFn).some(n=>literal(n.arguments[0],'SHOW_FORM')),'native application form action changed')
 const openTokens=nodes.filter(n=>literal(n,'/api/apply/v2/jobs/open?pids='))
 need(openTokens.length===2&&functionOf(openTokens[0])===functionOf(openTokens[1]),'current-open transport changed')
 const openFn=functionOf(openTokens[0])
 const openCalls=calls(openFn).filter(n=>concatNodes(n.arguments[0])?.[0]&&literal(concatNodes(n.arguments[0])[0],'/api/apply/v2/jobs/open?pids='))
 need(openCalls.length===2,'current-open GET changed')
 for(const call of openCalls){
  proveGET(call);const parts=concatNodes(call.arguments[0])
  need(parts.length===4&&literal(parts[0],'/api/apply/v2/jobs/open?pids=')&&literal(parts[2],'&domain=')
   &&path(parts[3])?.endsWith('.props.domain'),'current-open ID/domain URL changed')
  const id=path(parts[1]),value=resolve(id,parts[1])
  const owner=path(parts[3].object),nothing=n=>n?.type==='UnaryExpression'&&n.operator==='void'&&literal(n.argument,0)
  const single=value.type==='ConditionalExpression'&&nothing(value.consequent)&&value.test.type==='BinaryExpression'&&value.test.operator==='=='
   &&literal(value.test.left,null)&&value.test.right.type==='AssignmentExpression'&&value.test.right.operator==='='
   &&path(value.test.right.right)===owner+'.viewingPosition'&&path(value.alternate)===path(value.test.right.left)+'.id'
  let multiple=false
  if(value.type==='ConditionalExpression'&&nothing(value.consequent)&&value.test.type==='BinaryExpression'&&value.test.operator==='=='&&literal(value.test.left,null)
   &&value.alternate.type==='CallExpression'&&value.alternate.callee.type==='MemberExpression'&&value.alternate.callee.property.name==='map'
   &&path(value.alternate.callee.object)===path(value.test.right)&&value.alternate.arguments.length===1){
   const mapper=value.alternate.arguments[0],array=resolve(path(value.test.right),value.test.right),item=path(mapper.params?.[0]),body=mapper.body
   multiple=mapper.type==='ArrowFunctionExpression'&&mapper.params.length===1&&body.type==='ConditionalExpression'&&nothing(body.consequent)
    &&body.test.type==='BinaryExpression'&&body.test.operator==='=='&&literal(body.test.left,null)&&path(body.test.right)===item&&path(body.alternate)===item+'.id'
    &&array.type==='ConditionalExpression'&&path(array.alternate)===owner+'.starredPositions'
  }
  need(single||multiple,'current-open native ID binding changed')
 }

 
 return {carrier:'smartApplyData',fullCriteria:{positionBinding:true,htmlSinks:2,precedence:['insights.job_description','job_description[0]'],customJD:'enabled typed data'},
  transport:{method:'GET',fullRole:'/api/{mode}/v2/jobs/{positionId}?domain={domain}',insights:'/api/{mode}/v2/jobs/{positionId}/insights?domain={domain}',responseBinding:'job:2,insights:0',jobDataPrecedence:true},
  application:{positionBinding:true,publicPath:'/careers/apply',privatePath:'/careers/apply/private',fallbackAction:'SHOW_FORM'},
  currentOpen:'/api/apply/v2/jobs/open?pids={ids}&domain={domain}'}
}
