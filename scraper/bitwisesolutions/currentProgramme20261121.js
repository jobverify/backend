import {nativePrograms} from './currentLexical20261121.js'
import {scriptKind} from './currentScriptKind20261121.js'
import {need,one} from './currentFacts20261121.js'

const empty=node=>node?.type==='ObjectExpression'&&node.properties.length===0
const initialValue=node=>node?.type==='Literal'?{known:true,value:node.value}:node?.type==='UnaryExpression'&&node.operator==='!'&&node.argument?.type==='Literal'&&[0,1,true,false].includes(node.argument.value)?{known:true,value:!node.argument.value}:{known:false}
const unwrap=node=>node?.type==='SequenceExpression'&&node.expressions.length===2&&node.expressions[0].value===0?node.expressions[1]:node
const objects=node=>{need(node?.type==='ObjectExpression'&&node.properties.every(p=>p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init'),'literal own options required');const out=new Map();for(const p of node.properties){const key=p.key.name??p.key.value;need(typeof key==='string'&&!out.has(key),'duplicate native options');out.set(key,p.value)}return out}
const within=(p,node,owner)=>{for(let at=node;at;at=p.parents.get(at))if(at===owner)return true;return false}
const reference=(p,node)=>{const parent=p.parents.get(node);return !(parent?.type==='MemberExpression'&&!parent.computed&&parent.property===node||parent?.type==='Property'&&!parent.computed&&parent.key===node&&parent.value!==node)}
const statements=node=>node?.body?.body??[]
function initialPredicate(p,predicate,componentNodes,imported){
 const value=node=>{
  const direct=initialValue(node);if(direct.known)return direct
  if(node?.type==='Identifier'){
   const binding=p.binding(node),state=componentNodes.find(n=>n.type==='VariableDeclarator'&&n.id.type==='ArrayPattern'&&p.binding(n.id.elements[0])===binding)
   if(state){need(binding.defs.length===1&&!binding.writes.length&&imported(state.init?.callee,'useState'),'initial filter state identity changes');return initialValue(state.init.arguments[0])}
   const resolved=p.resolve(node);if(resolved!==node)return value(resolved)
  }
  if(node?.type==='LogicalExpression'){const left=value(node.left);if(!left.known)return left;if(node.operator==='&&')return left.value?value(node.right):left;if(node.operator==='||')return left.value?left:value(node.right)}
  if(node?.type==='BinaryExpression'&&['===','!=='].includes(node.operator)){const a=value(node.left),b=value(node.right);if(a.known&&b.known)return{known:true,value:node.operator==='==='?a.value===b.value:a.value!==b.value}}
  if(node?.type==='CallExpression'&&!node.arguments.length&&p.member(node.callee)==='trim'){const original=value(node.callee.object);if(original.known&&typeof original.value==='string')return{known:true,value:original.value.trim()}}
  return{known:false}
 }
 need(predicate?.type==='ArrowFunctionExpression'&&predicate.params.length===1&&predicate.body.type==='BlockStatement','returned native filter predicate unsupported')
 const evaluate=items=>{for(const item of items){if(item.type==='ReturnStatement')return value(item.argument);if(item.type==='IfStatement'){const condition=value(item.test);need(condition.known,'initial native filter branch unresolved');if(condition.value){const result=evaluate(item.consequent.type==='BlockStatement'?item.consequent.body:[item.consequent]);if(result)return result}else if(item.alternate){const result=evaluate(item.alternate.type==='BlockStatement'?item.alternate.body:[item.alternate]);if(result)return result}}else need(false,'initial native filter has unsupported active statements')}return null}
 const result=evaluate(predicate.body.body);need(result?.known&&result.value===true,'actual returned native filter excludes or fails to prove the default cohort')
}

export function literalFlight(page){
 const strings=[]
 for(const script of page.d.nodes(n=>n.tag==='script'&&!n.attrs.src&&scriptKind(n))){
  const p=one(nativePrograms([{...script,attrs:{...script.attrs,type:scriptKind(script)==='module'?'module':'text/javascript'}}]),'literal Flight programme')
  for(const node of p.nodes){
   if(node.type!=='CallExpression'||p.member(node.callee)!=='push')continue
   const target=p.resolve(node.callee.object)
   if(target?.type!=='MemberExpression'||p.member(target)!=='__next_f'||!p.global(target.object))continue
   const statement=p.parents.get(node);need(statement?.type==='ExpressionStatement'&&p.parents.get(statement)===p.tree,'Flight declaration is not an active direct carrier')
   const values=node.arguments[0];need(node.arguments.length===1&&values?.type==='ArrayExpression','Flight declaration arguments malformed')
   for(const value of values.elements)if(value?.type==='Literal'&&typeof value.value==='string')strings.push(value.value)
  }
 }
 const records=new Map()
 for(const line of strings.join('').split('\n')){
  const match=/^([0-9a-f]+):(I)?([[{].*)$/.exec(line);if(!match)continue
  let value;try{value=JSON.parse(match[3])}catch{need(false,'current Flight model malformed')}
  need(!records.has(match[1]),'current Flight record duplicated');records.set(match[1],{kind:match[2]??'model',value,raw:line})
 }
 need(records.has('0'),'current Flight root missing')
 const reached=new Set(),models=[]
 const visit=value=>{if(typeof value==='string'){const ref=/^\$(?:L|@)?([0-9a-f]+)$/.exec(value);if(ref)record(ref[1]);return}if(!value||typeof value!=='object')return;models.push(value);for(const child of Object.values(value))visit(child)}
 const record=key=>{if(reached.has(key)||!records.has(key))return;need(reached.size<4096,'finite Flight graph exceeded');reached.add(key);if(records.get(key).kind==='model')visit(records.get(key).value)}
 record('0')
 return{records,reached,models}
}
export function declaredProgramme(openings,careers){
 const flight=literalFlight(openings)
 const declared=p=>p.d.nodes(n=>n.tag==='script'&&n.attrs.src&&!n.inert&&!n.inactive&&scriptKind(n)).map(n=>new URL(n.attrs.src,'https://www.bitwiseglobal.com').href),old=new Set(declared(careers)),current=new Set(declared(openings)),candidates=[]
 for(const[key,record]of flight.records){
  if(record.kind!=='I'||!flight.reached.has(key)||!Number.isSafeInteger(record.value[0])||typeof record.value[2]!=='string'||!record.value[2]||!Array.isArray(record.value[1]))continue
  const consumers=flight.models.filter(value=>Array.isArray(value)&&value[0]==='$'&&value[1]==='$L'+key)
  if(consumers.length!==1||consumers[0].length!==4||!consumers[0][3]||Array.isArray(consumers[0][3])||Object.keys(consumers[0][3]).length)continue
  const urls=[...new Set(record.value[1].map(value=>new URL(value,'https://www.bitwiseglobal.com').href).filter(url=>current.has(url)&&!old.has(url)))]
  if(urls.length===1)candidates.push({record,consumer:consumers[0],url:urls[0]})
 }
 const{record,consumer,url}=one(candidates,'reachable current empty-props listing programme')
 need(new URL(url).origin==='https://www.bitwiseglobal.com'&&!new URL(url).search&&!new URL(url).hash,'programme origin differs')
 return{url,moduleID:record.value[0],exportName:record.value[2],originalFlightRecord:record.raw,actualConsumer:consumer}
}
export function listingProgramme(source,declaration){
 const p=one(nativePrograms([{raw:source,attrs:{type:'text/javascript'}}]),'current listing programme'),member=p.member,lit=p.literal
 const calls=p.nodes.filter(n=>n.type==='CallExpression'),top=p.tree.body.filter(n=>!(n.type==='ExpressionStatement'&&typeof n.expression.value==='string'))
 const registrations=calls.filter(n=>member(n.callee)==='push'&&n.arguments[0]?.type==='ArrayExpression'&&n.arguments[0].elements.some(e=>lit(e)===declaration.moduleID))
 const registration=one(registrations,'current module registration'),holder=registration.callee.object
 need(top.length===1&&top[0].type==='ExpressionStatement'&&top[0].expression===registration,'module registration disconnected or guarded')
 need(holder?.type==='LogicalExpression'&&holder.operator==='||'&&member(holder.left)==='TURBOPACK'&&p.global(holder.left.object),'module registration namespace differs')
 need(holder.right?.type==='AssignmentExpression'&&member(holder.right.left)==='TURBOPACK'&&p.global(holder.right.left.object)&&holder.right.right?.type==='ArrayExpression'&&holder.right.right.elements.length===0,'module registration fallback differs')
 const entries=registration.arguments[0].elements,at=entries.findIndex(e=>lit(e)===declaration.moduleID),module=entries[at+1]
 need(module?.type==='ArrowFunctionExpression'&&module.params.length===1&&module.params[0].type==='Identifier'&&module.body.type==='BlockStatement','native module callback malformed')
 const exporter=p.binding(module.params[0]),isExporter=node=>node?.type==='Identifier'&&p.binding(node)===exporter
 const exports=calls.filter(n=>within(p,n,module)&&member(n.callee)==='s'&&isExporter(n.callee.object)),exportCall=one(exports,'actual module export')
 need(p.parents.get(exportCall)?.type==='ExpressionStatement'&&statements(module).includes(p.parents.get(exportCall)),'listing export is inert or conditional')
 const tuple=exportCall.arguments[0];need(exportCall.arguments.length===2&&lit(exportCall.arguments[1])===declaration.moduleID&&tuple?.type==='ArrayExpression'&&tuple.elements.length===3&&lit(tuple.elements[0])===declaration.exportName,'listing export tuple differs')
 const component=tuple.elements[2];need(['FunctionExpression','ArrowFunctionExpression'].includes(component?.type)&&component.body.type==='BlockStatement'&&component.params.length===1,'exported component malformed')
 const regionPattern=component.params[0];need(regionPattern.type==='ObjectPattern'&&regionPattern.properties.length===1&&regionPattern.properties[0].key.name==='region'&&regionPattern.properties[0].value.type==='Identifier','listing input region contract differs')
 const region=p.binding(regionPattern.properties[0].value),same=(node,binding)=>node?.type==='Identifier'&&p.binding(node)===binding
 const imports=new Map()
 for(const node of p.nodes)if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&node.init?.type==='CallExpression'&&member(node.init.callee)==='i'&&isExporter(node.init.callee.object)){need(node.init.arguments.length===1&&Number.isSafeInteger(lit(node.init.arguments[0])),'native import malformed');imports.set(p.binding(node.id),node)}
 const imported=(node,name)=>{const callee=unwrap(node);return callee?.type==='MemberExpression'&&member(callee)===name&&imports.has(p.binding(callee.object))}
 const componentNodes=p.nodes.filter(n=>within(p,n,component)),fetches=componentNodes.filter(n=>n.type==='CallExpression'&&p.builtin(n.callee,'fetch'))
 const request=one(fetches,'connected native listing request'),awaitRequest=p.parents.get(request),responseDecl=p.parents.get(awaitRequest)
 need(awaitRequest?.type==='AwaitExpression'&&responseDecl?.type==='VariableDeclarator'&&responseDecl.id.type==='Identifier','listing response is not directly awaited')
 let loader=component;for(let n=request;n;n=p.parents.get(n))if(n.type==='FunctionDeclaration'){loader=n;break}
 need(loader!==component&&statements(component).includes(loader)&&loader.async,'listing loader is not the exported component local async function')
 const tryBlock=one(statements(loader).filter(n=>n.type==='TryStatement'),'listing request try block'),declarationNode=p.parents.get(responseDecl)
 need(tryBlock.block.body[0]===declarationNode&&statements(loader).at(-1)===tryBlock&&!componentNodes.some(n=>within(p,n,loader)&&n.type==='ReturnStatement'),'listing loader request is inactive or interrupted')
 const options=objects(request.arguments[1]);need(request.arguments.length===2&&options.size===3&&['method','headers','body'].every(k=>options.has(k)),'listing request options differ')
 need(lit(options.get('method'))==='POST','listing method is not the proven read-only public POST')
 const headers=objects(options.get('headers'));need(headers.size===1&&lit(headers.get('Content-Type'))==='application/json','listing JSON header differs')
 const body=options.get('body');need(body?.type==='CallExpression'&&member(body.callee)==='stringify'&&p.builtin(body.callee.object,'JSON')&&body.arguments.length===1,'listing JSON body is disconnected')
 const choice=body.arguments[0];need(choice?.type==='ConditionalExpression'&&same(choice.test,region)&&empty(choice.alternate),'initial region-less listing body differs')
 const filtered=objects(choice.consequent);need(filtered.size===1&&same(filtered.get('locationGroup'),region),'listing region body differs')
 const relative=lit(request.arguments[0]);need(typeof relative==='string'&&relative==='/api/careers','public listing route differs')
 const responseBinding=p.binding(responseDecl.id),jobsDecl=declarationNode.declarations[declarationNode.declarations.indexOf(responseDecl)+1],jobsInit=jobsDecl?.init
 need(jobsDecl?.id.type==='Identifier'&&jobsInit?.type==='LogicalExpression'&&jobsInit.operator==='??'&&jobsInit.right.type==='ArrayExpression'&&jobsInit.right.elements.length===0&&member(jobsInit.left)==='jobs','native jobs response is not retained')
 const json=jobsInit.left.object;need(json?.type==='AwaitExpression'&&json.argument?.type==='CallExpression'&&member(json.argument.callee)==='json'&&same(json.argument.callee.object,responseBinding)&&json.argument.arguments.length===0,'native JSON owner differs')
 const jobsBinding=p.binding(jobsDecl.id),setters=componentNodes.filter(n=>n.type==='CallExpression'&&n.arguments.length===1&&same(n.arguments[0],jobsBinding)&&n.callee.type==='Identifier'),setRows=one(setters,'native jobs state consumer'),setRowsBinding=p.binding(setRows.callee)
 const stateDecl=one(componentNodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ArrayPattern'&&n.id.elements[1]&&same(n.id.elements[1],setRowsBinding)),'returned rows state')
 need(imported(stateDecl.init?.callee,'useState')&&stateDecl.init.arguments.length===1,'rows state is not native React state')
 const rowsBinding=p.binding(stateDecl.id.elements[0]),loaderBinding=p.binding(loader.id),effects=componentNodes.filter(n=>n.type==='CallExpression'&&imported(n.callee,'useEffect'))
 const stateWrites=componentNodes.filter(n=>n.type==='CallExpression'&&same(n.callee,setRowsBinding));need(stateWrites.length===2&&stateWrites.includes(setRows),'native rows state has additional writes')
 const successSequence=p.parents.get(setRows),successStatement=p.parents.get(successSequence);need(successSequence?.type==='SequenceExpression'&&successSequence.expressions.includes(setRows)&&successStatement?.type==='ExpressionStatement'&&tryBlock.block.body.includes(successStatement),'native success-state consumer is inert or conditional')
 const fallback=stateWrites.find(n=>n!==setRows);need(fallback.arguments.length===1&&fallback.arguments[0].type==='ArrayExpression'&&fallback.arguments[0].elements.length===0&&within(p,fallback,tryBlock.handler),'native rows fallback is not the scoped exception branch')
 for(const node of componentNodes)if(node.type==='Identifier'&&reference(p,node)&&p.binding(node)===setRowsBinding&&!setRowsBinding.defs.some(def=>def.pattern===node)){const parent=p.parents.get(node);need(parent?.type==='CallExpression'&&parent.callee===node&&stateWrites.includes(parent),'native rows setter escapes its qualified writes')}
 const cacheInit=stateDecl.init.arguments[0];need(cacheInit?.type==='LogicalExpression'&&cacheInit.operator==='??'&&cacheInit.right.type==='ArrayExpression'&&cacheInit.right.elements.length===0,'initial native row cache differs')
 const cacheBinding=p.binding(cacheInit.left),cacheValue=p.resolve(cacheInit.left);need(cacheValue?.type==='LogicalExpression'&&cacheValue.operator==='??'&&lit(cacheValue.right)===null&&cacheValue.left?.type==='CallExpression'&&member(cacheValue.left.callee)==='get','initial native cache lookup differs')
 const cache=p.resolve(cacheValue.left.callee.object);need(cache?.type==='NewExpression'&&p.builtin(cache.callee,'Map')&&cache.arguments.length===0,'initial native cache is not empty')
 need(effects.some(effect=>{const fn=effect.arguments[0],condition=fn?.body?.type==='BlockStatement'&&fn.body.body.length===1&&fn.body.body[0].type==='ExpressionStatement'?fn.body.body[0].expression:fn?.body;return fn?.type==='ArrowFunctionExpression'&&condition?.type==='ConditionalExpression'&&same(condition.test,cacheBinding)&&condition.alternate?.type==='CallExpression'&&same(condition.alternate.callee,loaderBinding)&&condition.alternate.arguments.length===0}),'listing request has no active initial effect')
 const returns=statements(component).filter(n=>n.type==='ReturnStatement'),returned=one(returns,'actual returned listing tree');need(statements(component).at(-1)===returned,'returned listing tree is interrupted')
 const cards=componentNodes.filter(n=>n.type==='CallExpression'&&member(n.callee)==='map'&&n.arguments[0]?.type==='ArrowFunctionExpression'&&within(p,n,returned)&&n.arguments[0].body?.type==='CallExpression'&&imported(n.arguments[0].body.callee,'jsx'))
 const candidates=cards.filter(n=>{try{return objects(n.arguments[0].body.arguments[1]).has('href')}catch{return false}}),map=one(candidates,'actual returned role cards'),mapper=map.arguments[0]
 need(mapper.params.length===1&&mapper.params[0].type==='Identifier','card row binding malformed')
 const rowBinding=p.binding(mapper.params[0]),card=mapper.body,link=card.arguments[0]
 need(member(link)==='default'&&imports.has(p.binding(link.object)),'card handoff component disconnected')
 const href=objects(card.arguments[1]).get('href');need(href?.type==='TemplateLiteral'&&href.quasis.length===2&&href.quasis[0].value.cooked==='/company/careers/'&&href.quasis[1].value.cooked===''&&href.expressions.length===1&&member(href.expressions[0])==='slug'&&same(href.expressions[0].object,rowBinding),'card identity handoff differs')
 for(const field of ['id','title','jobId','location','experience'])need(componentNodes.some(n=>within(p,n,mapper)&&n.type==='MemberExpression'&&member(n)===field&&same(n.object,rowBinding)),'card native field disconnected '+field)
 const selected=p.resolve(map.callee.object);need(selected?.type==='CallExpression'&&member(selected.callee)==='filter','cards are not from returned jobs')
 initialPredicate(p,selected.arguments[0],componentNodes,imported)
 const selectedBinding=p.binding(map.callee.object)
 const group=p.resolve(selected.callee.object);need(group?.type==='CallExpression'&&imported(group.callee,'useMemo'),'cards region selection is disconnected')
 const choose=group.arguments[0]?.body;need(choose?.type==='ConditionalExpression'&&same(choose.consequent,rowsBinding)&&member(choose.alternate?.callee)==='filter'&&same(choose.alternate.callee.object,rowsBinding),'cards do not preserve the native jobs state')
 const comparison=choose.test;need(comparison?.type==='BinaryExpression'&&comparison.operator==='==='&&(lit(comparison.left)==='all'||lit(comparison.right)==='all'),'default card scope differs')
 const filterState=lit(comparison.left)==='all'?comparison.right:comparison.left
 const initialFilter=one(componentNodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ArrayPattern'&&n.id.elements[0]&&same(n.id.elements[0],p.binding(filterState))),'initial country selector')
 need(imported(initialFilter.init?.callee,'useState')&&lit(initialFilter.init.arguments[0])==='all','initial country selector is filtered')
 const branches=[]
 for(let child=map;child!==returned;){const parent=p.parents.get(child);need(parent,'returned native cards are disconnected');need(!['LogicalExpression','ArrowFunctionExpression','FunctionExpression','IfStatement','WhileStatement','ForStatement','ForOfStatement'].includes(parent.type),'returned native cards are inert or callback-only');if(parent.type==='Property')need(!parent.computed&&(parent.key.name??parent.key.value)==='children'&&parent.value===child,'native cards are not a returned children consumer');if(parent.type==='ConditionalExpression')branches.push({node:parent,child});child=parent}
 need(branches.length===2,'native card visibility branches differ')
 const published=one(branches.filter(({node})=>node.test?.type==='BinaryExpression'&&node.test.operator==='>'&&member(node.test.left)==='length'&&same(node.test.left.object,selectedBinding)&&lit(node.test.right)===0),'nonempty native cards branch')
 need(published.node.consequent===published.child,'nonempty native cards branch inverted')
 const loading=one(branches.filter(branch=>branch!==published),'native loading branch');need(loading.node.alternate===loading.child&&loading.node.test.type==='Identifier','native loading visibility branch inverted')
 const loadingBinding=p.binding(loading.node.test),loadingState=one(componentNodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ArrayPattern'&&same(n.id.elements[0],loadingBinding)),'native loading state'),loadingSetter=p.binding(loadingState.id.elements[1]),loadingInitial=loadingState.init?.arguments?.[0]
 const nullLiteral=node=>node?.type==='Literal'&&node.value===null
 need(imported(loadingState.init?.callee,'useState')&&loadingInitial?.type==='BinaryExpression'&&loadingInitial.operator==='==='&&(nullLiteral(loadingInitial.left)&&same(loadingInitial.right,cacheBinding)||nullLiteral(loadingInitial.right)&&same(loadingInitial.left,cacheBinding)),'native loading initial state differs')
 const loadingCalls=componentNodes.filter(n=>n.type==='CallExpression'&&same(n.callee,loadingSetter)),finallyBody=tryBlock.finalizer?.body,settled=finallyBody?.length===1&&finallyBody[0].type==='ExpressionStatement'?finallyBody[0].expression:null,start=statements(loader)[0]?.expression
 need(loadingCalls.length===2&&loadingCalls.includes(start)&&loadingCalls.includes(settled)&&start?.arguments.length===1&&initialValue(start.arguments[0]).value===true&&settled?.arguments.length===1&&initialValue(settled.arguments[0]).value===false,'native loading state is not settled by the actual request')
 for(const node of componentNodes)if(node.type==='VariableDeclarator'&&node.id.type==='ArrayPattern'&&imported(node.init?.callee,'useState')&&node!==stateDecl&&node!==initialFilter){const value=node.init.arguments[0],decoded=initialValue(value);need(value&&(decoded.known||value.type==='BinaryExpression'),'unsupported initial listing state');if(decoded.known)need(['all','',false,true].includes(decoded.value),'initial client filters differ')}
 const cacheObjectBinding=p.binding(cacheValue.left.callee.object),cacheSets=componentNodes.filter(n=>n.type==='CallExpression'&&member(n.callee)==='set'&&same(n.callee.object,cacheObjectBinding))
 const cacheSet=one(cacheSets,'connected native cache update');need(cacheSet.arguments.length===2&&same(cacheSet.arguments[1],jobsBinding)&&within(p,cacheSet,tryBlock.block)&&p.parents.get(cacheSet)===successSequence&&successSequence.expressions.indexOf(cacheSet)<successSequence.expressions.indexOf(setRows),'native cache response binding differs')
 for(const node of p.nodes)if(node.type==='Identifier'&&reference(p,node)&&p.binding(node)===cacheObjectBinding&&!cacheObjectBinding.defs.some(def=>def.pattern===node)){const parent=p.parents.get(node),call=p.parents.get(parent);need(parent?.type==='MemberExpression'&&parent.object===node&&[cacheSet,cacheValue.left].includes(call),'native cache escapes its current get/set consumer')}
 const protectedBindings=new Set([exporter,region,responseBinding,jobsBinding,setRowsBinding,rowsBinding,loaderBinding,loadingBinding,loadingSetter,selectedBinding,p.binding(selected.callee.object),cacheObjectBinding,...imports.keys()])
 for(const binding of protectedBindings)need(binding&&binding.defs.length===1&&binding.writes.length===0,'native critical binding is reassigned')
 const namespaceFields=new Map([...imports.keys()].map(binding=>[binding,new Set(['jsx','jsxs','useState','useEffect','useMemo','default'])]))
 for(const node of p.nodes){
  if(node.type==='Identifier'&&reference(p,node)&&namespaceFields.has(p.binding(node))){const binding=p.binding(node),parent=p.parents.get(node);if(binding.defs.some(def=>def.pattern===node))continue;need(parent?.type==='MemberExpression'&&parent.object===node&&namespaceFields.get(binding).has(member(parent)),'critical imported namespace escapes or changes')}
  if(node!==holder.right&&(node.type==='AssignmentExpression'||node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')){
   let target=node.left??node.argument;while(target?.type==='MemberExpression')target=target.object
   need(!(target?.type==='Identifier'&&(protectedBindings.has(p.binding(target))||['JSON','fetch','globalThis','window','self','Object','Reflect'].some(name=>p.builtin(target,name)))),'native request/namespace/state is mutated')
  }
  if(node.type==='Identifier'&&reference(p,node)&&p.builtin(node,'JSON')){const parent=p.parents.get(node);need(parent?.type==='MemberExpression'&&parent.object===node&&member(parent)==='stringify'&&parent===body.callee,'native JSON builtin escapes')}
 }
 const requiredNativeNamespaces=[...imports].map(([binding,entry])=>({moduleID:lit(entry.init.arguments[0]),exports:[...new Set(componentNodes.filter(n=>n.type==='MemberExpression'&&n.object.type==='Identifier'&&p.binding(n.object)===binding&&['jsx','jsxs','useState','useEffect','useMemo','default'].includes(member(n))).map(member))]})).filter(entry=>entry.exports.length)
 need(requiredNativeNamespaces.length>0,'actual critical import namespaces missing')
 return{method:'POST',url:new URL(relative,'https://www.bitwiseglobal.com/').href,body:'{}',cardPrefix:'/company/careers/',requiredNativeNamespaces,originalProgramme:source,originalDeclaration:declaration,proof:{currentExport:true,emptyInitialProps:true,connectedInitialEffect:true,originalJobsJSONState:true,returnedNativeCards:true,initialFilterPreservesRows:true,executed:false}}
}
