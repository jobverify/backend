import {parse} from 'acorn'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'

const need=(ok,message)=>{if(!ok)throw firstPartyFailure('sapphiresoftwaresolutionsindia','Native recruitment programme: '+message)}
const key=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?n.value:null
const member=(n,property)=>n?.type==='MemberExpression'&&!n.computed&&key(n.property)===property
const props=n=>n?.type==='ObjectExpression'&&n.properties.every(p=>p.type==='Property'&&!p.computed&&p.kind==='init')?new Map(n.properties.map(p=>[key(p.key),p.value])):null
const identifier=(n,name)=>n?.type==='Identifier'&&n.name===name
const zeroSequence=n=>n?.type==='SequenceExpression'&&n.expressions.length===2&&n.expressions[0].type==='Literal'&&n.expressions[0].value===0?n.expressions[1]:null
const one=(rows,label)=>{need(rows.length===1,label);return rows[0]}
const empty=n=>n?.type==='ArrayExpression'&&n.elements.length===0
const functions=new Set(['ArrowFunctionExpression','FunctionExpression','FunctionDeclaration'])
const targets=n=>!n?[]:n.type==='Identifier'?[n.name]:n.type==='MemberExpression'?targets(n.object):n.type==='ArrayPattern'?n.elements.flatMap(targets):n.type==='ObjectPattern'?n.properties.flatMap(p=>targets(p.value??p.argument)):n.type==='RestElement'?targets(n.argument):n.type==='AssignmentPattern'?targets(n.left):[]

// Inspect recruitment dataflow as syntax, never execute the published client.
// Module numbers, minifier identifiers, CSS classes, icons and error UI do not
// enter the returned model. Full original programmes remain audit provenance.
export function readCurrentSapphireProgramme(source){
 need(typeof source==='string'&&source.length>0&&source.length<=512*1024,'bounded public programme required')
 let ast;try{ast=parse(source,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,'invalid JavaScript')}
 const parents=new WeakMap(),all=[]
 const visit=(n,p=null)=>{if(!n||typeof n!=='object'||typeof n.type!=='string')return;if(p)parents.set(n,p);all.push(n);for(const[k,v]of Object.entries(n)){if(k==='start'||k==='end')continue;if(Array.isArray(v))for(const x of v)visit(x,n);else if(v&&typeof v==='object')visit(v,n)}}
 visit(ast)
 const descendants=root=>all.filter(n=>{for(let p=n;p;p=parents.get(p))if(p===root)return true;return false})
 const enclosing=(n,predicate)=>{for(let p=parents.get(n);p;p=parents.get(p))if(predicate(p))return p;return null}
 const flat=n=>n?.type==='SequenceExpression'?n.expressions.flatMap(flat):[n]
 const active=body=>body.body.filter(n=>n.type==='ExpressionStatement').flatMap(n=>flat(n.expression))
 const carrier=one(active(ast).filter(n=>n.type==='CallExpression'&&member(n.callee,'push')&&n.arguments.length===1&&n.arguments[0].type==='ArrayExpression'&&n.arguments[0].elements[1]?.type==='ObjectExpression'),'one top-level executed webpack module carrier required')
 const registry=(n,owner,field)=>member(n,field)&&identifier(n.object,owner)
 const carrierReceiver=carrier.callee.object,carrierParts=carrier.arguments[0].elements
 need(carrierReceiver?.type==='AssignmentExpression'&&carrierReceiver.operator==='='&&registry(carrierReceiver.left,'self','webpackChunk_N_E')&&carrierReceiver.right?.type==='LogicalExpression'&&carrierReceiver.right.operator==='||'&&registry(carrierReceiver.right.left,'self','webpackChunk_N_E')&&empty(carrierReceiver.right.right)&&carrierParts.length===3&&carrierParts[0]?.type==='ArrayExpression'&&carrierParts[0].elements.every(n=>n?.type==='Literal'&&Number.isSafeInteger(n.value)),'active native webpack registry changed')
 const moduleObject=carrierParts[1],runtime=carrierParts[2]
 const modules=new Map()
 for(const p of moduleObject.properties){need(p.type==='Property'&&!p.computed&&p.kind==='init'&&p.value.type==='FunctionExpression'&&!modules.has(key(p.key)),'unique literal module factories required');modules.set(key(p.key),p.value)}
 need(runtime?.type==='FunctionExpression'&&runtime.params.length===1&&runtime.params[0].type==='Identifier','active webpack entry scheduler required')
 const runtimeName=runtime.params[0].name
 const schedule=one(active(runtime.body).filter(n=>n.type==='CallExpression'&&member(n.callee,'O')&&identifier(n.callee.object,runtimeName)&&n.arguments.length===3),'one active webpack entry scheduling call required')
 const start=schedule.arguments[2]
 need(schedule.arguments[0]?.type==='Literal'&&schedule.arguments[0].value===0&&schedule.arguments[1]?.type==='ArrayExpression'&&schedule.arguments[1].elements.every(n=>n?.type==='Literal'&&Number.isSafeInteger(n.value))&&start?.type==='FunctionExpression'&&start.params.length===0&&start.body.body.length===1&&start.body.body[0].type==='ReturnStatement','literal active entry callback required')
 const load=start.body.body[0].argument,entry=load?.arguments?.[0]
 need(load?.type==='CallExpression'&&identifier(load.callee,runtimeName)&&load.arguments.length===1&&entry?.type==='AssignmentExpression'&&entry.operator==='='&&member(entry.left,'s')&&identifier(entry.left.object,runtimeName)&&entry.right?.type==='Literal','scheduled native entry identity required')
 const entryFactory=modules.get(entry.right.value)
 need(entryFactory?.params.length===3&&entryFactory.params.every(n=>n.type==='Identifier')&&entryFactory.body.body.length===1,'native Next page registration factory required')
 const registration=one(active(entryFactory.body).filter(n=>n.type==='CallExpression'&&member(n.callee,'push')&&n.arguments.length===1),'active native Next page registration required')
 const next=registration.callee.object,nextParts=registration.arguments[0]?.elements
 need(next?.type==='AssignmentExpression'&&next.operator==='='&&registry(next.left,'window','__NEXT_P')&&next.right?.type==='LogicalExpression'&&next.right.operator==='||'&&registry(next.right.left,'window','__NEXT_P')&&empty(next.right.right)&&registration.arguments[0]?.type==='ArrayExpression'&&nextParts.length===2&&nextParts[0]?.type==='Literal'&&nextParts[0].value==='/careers','actual careers page registry binding required')
 const pageLoader=nextParts[1]
 need(pageLoader?.type==='FunctionExpression'&&pageLoader.params.length===0&&pageLoader.body.body.length===1&&pageLoader.body.body[0].type==='ReturnStatement','literal careers module loader required')
 const pageLoad=pageLoader.body.body[0].argument
 need(pageLoad?.type==='CallExpression'&&identifier(pageLoad.callee,entryFactory.params[2].name)&&pageLoad.arguments.length===1&&pageLoad.arguments[0].type==='Literal','registered careers module identity required')
 const request=one(all.filter(n=>n.type==='CallExpression'&&identifier(n.callee,'fetch')&&n.arguments[0]?.type==='CallExpression'&&member(n.arguments[0].callee,'concat')&&n.arguments[0].arguments.some(a=>a.type==='Literal'&&a.value==='/Website/getvacancylist')),'one native vacancy fetch required')
 const factory=one([...modules.values()].filter(f=>descendants(f).includes(request)),'request must belong to one declared module')
 need(modules.get(pageLoad.arguments[0].value)===factory,'vacancy request must belong to the actively registered careers module')
 need(factory.params.length===3&&factory.params.every(p=>p.type==='Identifier'),'literal native module bindings required')
 const requireName=factory.params[2].name
 const url=request.arguments[0],options=props(request.arguments[1])
 need(request.arguments.length===2&&url.callee.object.type==='Literal'&&url.callee.object.value===''&&url.arguments.length===2&&url.arguments[0].type==='Identifier'&&url.arguments[1].type==='Literal'&&url.arguments[1].value==='/Website/getvacancylist'&&options?.size===1&&options.get('method')?.type==='Literal'&&options.get('method').value==='POST','effective URL and exact bodyless POST options changed')
 const callback=enclosing(request,n=>functions.has(n.type)),component=enclosing(callback,n=>functions.has(n.type))
 need(callback?.async===true&&callback.params.length===0&&component&&component!==factory,'anonymous request callback binding changed')
 const directDeclarations=factory.body.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations)
 const componentBinding=one(directDeclarations.filter(n=>n.init===component&&n.id.type==='Identifier'),'active vacancy component declaration required')
 const pageExport=one(active(factory.body).filter(n=>n.type==='CallExpression'&&member(n.callee,'d')&&identifier(n.callee.object,requireName)&&n.arguments.length===2&&identifier(n.arguments[0],factory.params[1].name)&&props(n.arguments[1])?.has('default')),'active careers default export required')
 const defaultGetter=props(pageExport.arguments[1]).get('default')
 need(defaultGetter?.type==='FunctionExpression'&&defaultGetter.params.length===0&&defaultGetter.body.body.length===1&&defaultGetter.body.body[0].type==='ReturnStatement','literal default page export required')
 let page=defaultGetter.body.body[0].argument
 const aliases=new Set()
 while(page?.type==='Identifier'){
  need(!aliases.has(page.name),'cyclic page export alias');aliases.add(page.name)
  page=one(directDeclarations.filter(n=>identifier(n.id,page.name)),'direct page export declaration required').init
 }
 need(functions.has(page?.type)&&page.params.length===0&&page.body.type==='BlockStatement','exported native page function required')
 const pageReturn=one(page.body.body.filter(n=>n.type==='ReturnStatement'),'actual page return required')
 need(descendants(pageReturn.argument).some(n=>n.type==='CallExpression'&&enclosing(n,p=>functions.has(p.type))===page&&['jsx','jsxs'].some(name=>member(zeroSequence(n.callee),name))&&identifier(n.arguments[0],componentBinding.id.name)&&props(n.arguments[1])),'exported careers page must consume the actual vacancy component')
 for(const scope of [callback,component,factory]){
  need(!scope.params.some(p=>targets(p).includes('fetch')),'public fetch is shadowed by a formal parameter')
  for(const n of descendants(scope))if(enclosing(n,p=>functions.has(p.type))===scope)need(!(n.type==='VariableDeclarator'&&targets(n.id).includes('fetch'))&&!(n.type==='FunctionDeclaration'&&identifier(n.id,'fetch')),'public fetch is shadowed by a local binding')
 }
 const nodes=descendants(component),callbackNodes=descendants(callback),baseName=url.arguments[0].name
 const base=one(nodes.filter(n=>n.type==='VariableDeclarator'&&identifier(n.id,baseName)&&!descendants(callback).includes(n)),'unique captured API base binding required')
 const accessor=base.init?.type==='CallExpression'&&base.init.arguments.length===0?zeroSequence(base.init.callee):null
 need(accessor?.type==='MemberExpression'&&!accessor.computed&&accessor.object.type==='Identifier'&&accessor.property.type==='Identifier','base must come from the imported native provider')
 const imported=one(descendants(factory).filter(n=>n.type==='VariableDeclarator'&&identifier(n.id,accessor.object.name)&&n.init?.type==='CallExpression'&&identifier(n.init.callee,requireName)&&n.init.arguments.length===1&&n.init.arguments[0].type==='Literal'),'native provider module import required')
 const provider=modules.get(imported.init.arguments[0].value)
 need(provider?.params.length===3&&provider.params.every(p=>p.type==='Identifier'),'declared API provider factory unavailable')
 const exportsCall=one(descendants(provider).filter(n=>n.type==='CallExpression'&&member(n.callee,'d')&&identifier(n.callee.object,provider.params[2].name)&&n.arguments.length===2&&identifier(n.arguments[0],provider.params[1].name)&&props(n.arguments[1])?.has(accessor.property.name)),'actual provider export required')
 const getter=props(exportsCall.arguments[1]).get(accessor.property.name)
 need(getter?.type==='FunctionExpression'&&getter.params.length===0&&getter.body.body.length===1&&getter.body.body[0].type==='ReturnStatement'&&getter.body.body[0].argument?.type==='Identifier','provider export getter changed')
 const returned=one(provider.body.body.filter(n=>n.type==='FunctionDeclaration'&&identifier(n.id,getter.body.body[0].argument.name)),'provider function binding unavailable')
 need(returned.params.length===0&&returned.body.body.length===1&&returned.body.body[0].type==='ReturnStatement','provider must return the literal public API origin')
 const expression=returned.body.body[0].argument,parts=expression?.type==='SequenceExpression'?expression.expressions:[expression]
 need(parts.length===2&&member(parts[0],'hostname')&&member(parts[0].object,'location')&&identifier(parts[0].object.object,'window')&&parts[1]?.type==='Literal'&&parts[1].value==='https://erpnew.onlinevidyalaya.net','public API authority changed')
 const response=one(callbackNodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.init?.type==='AwaitExpression'&&n.init.argument===request),'actual native fetch result binding required')
 const payload=one(callbackNodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.init?.type==='AwaitExpression'&&n.init.argument?.type==='CallExpression'&&n.init.argument.arguments.length===0&&member(n.init.argument.callee,'json')&&identifier(n.init.argument.callee.object,response.id.name)),'whole native JSON response binding required')
 const publish=one(callbackNodes.filter(n=>n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.arguments.length===1&&n.arguments[0].type==='LogicalExpression'&&n.arguments[0].operator==='||'&&member(n.arguments[0].left,'vacancyList')&&identifier(n.arguments[0].left.object,payload.id.name)&&empty(n.arguments[0].right)),'whole vacancyList publication binding required')
 const state=one(nodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ArrayPattern'&&n.id.elements.length===2&&n.id.elements.every(x=>x?.type==='Identifier')&&identifier(n.id.elements[1],publish.callee.name)&&n.init?.type==='CallExpression'&&n.init.arguments.length===1&&empty(n.init.arguments[0])&&member(zeroSequence(n.init.callee),'useState')),'native vacancy array state binding required')
 const card=one(descendants(factory).filter(n=>n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&functions.has(n.init?.type)&&n.init.params.length===1&&n.init.params[0].type==='Identifier'&&descendants(n.init).some(d=>d.type==='VariableDeclarator'&&d.id.type==='ObjectPattern'&&identifier(d.init,n.init.params[0].name)&&d.id.properties.some(p=>key(p.key)==='item'&&p.value.type==='Identifier'))&&descendants(n.init).some(d=>d.type==='Property'&&key(d.key)==='href'&&d.value.type==='CallExpression'&&member(d.value.callee,'concat')&&d.value.callee.object.type==='Literal'&&d.value.callee.object.value==='/jobs/')),'one native row card/application carrier required')
 const row=one(descendants(card.init).filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&identifier(n.init,card.init.params[0].name)),'row props binding required').id.properties.find(p=>key(p.key)==='item').value.name
 const href=one(descendants(card.init).filter(n=>n.type==='Property'&&key(n.key)==='href'&&n.value.type==='CallExpression'&&member(n.value.callee,'concat')&&n.value.callee.object.type==='Literal'&&n.value.callee.object.value==='/jobs/'),'one exact native role href required').value
 const headings=descendants(card.init).filter(n=>n.type==='CallExpression'&&n.arguments[0]?.type==='Literal'&&/^h[1-6]$/.test(n.arguments[0].value)&&member(props(n.arguments[1])?.get('children'),'position')&&identifier(props(n.arguments[1]).get('children').object,row))
 need(href.arguments.length===1&&member(href.arguments[0],'applyURL')&&identifier(href.arguments[0].object,row)&&headings.length===1,'same native row heading/application identity changed')
 const mappings=nodes.filter(n=>n.type==='CallExpression'&&member(n.callee,'map')&&identifier(n.callee.object,state.id.elements[0].name)&&n.arguments.length===1&&functions.has(n.arguments[0].type)&&n.arguments[0].params.length>=1&&n.arguments[0].params.every(p=>p.type==='Identifier'))
 need(mappings.length>0&&mappings.length<=4,'bounded native vacancy array card maps required')
 for(const mapping of mappings)need(descendants(mapping.arguments[0]).some(n=>n.type==='CallExpression'&&n.arguments.length>=2&&identifier(n.arguments[0],card.id.name)&&props(n.arguments[1])?.get('item')?.type==='Identifier'&&identifier(props(n.arguments[1]).get('item'),mapping.arguments[0].params[0].name)),'actual native row must enter the native role card')
 for(const [scope,names]of [[component,new Set([baseName,state.id.elements[0].name])],[callback,new Set([response.id.name,payload.id.name])],[card.init,new Set([row,card.init.params[0].name])]])for(const n of descendants(scope)){
  const touched=n.type==='AssignmentExpression'?targets(n.left):n.type==='UpdateExpression'||n.type==='UnaryExpression'&&n.operator==='delete'?targets(n.argument):[]
  need(!touched.some(name=>names.has(name)),'reassigned recruitment authority/native row binding')
 }
 return{apiOrigin:parts[1].value,route:'/Website/getvacancylist',method:'POST',bodyPresent:false,rowArray:'vacancyList',nativeTitleField:'position',applicationPrefix:'/jobs/',applicationField:'applyURL'}
}
