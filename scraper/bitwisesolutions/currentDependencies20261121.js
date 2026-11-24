import {nativePrograms} from './currentLexical20261121.js'
import {scriptKind} from './currentScriptKind20261121.js'
import {need,one} from './currentFacts20261121.js'
import {literalFlight} from './currentProgramme20261121.js'

const callable=node=>['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node?.type)
const body=node=>node.body.body.filter(n=>!(n.type==='ExpressionStatement'&&typeof n.expression.value==='string'))
const same=(p,node,binding)=>node?.type==='Identifier'&&p.binding(node)===binding
const direct=(p,node,owner)=>{for(let at=node;at;at=p.parents.get(at)){const parent=p.parents.get(at);if(parent===owner.body)return true;if(!['ExpressionStatement','SequenceExpression'].includes(parent?.type))return false}return false}
const unsequence=node=>node?.type==='SequenceExpression'&&node.expressions.length===2&&node.expressions[0].value===0?node.expressions[1]:node
const actualFunction=(p,node)=>{const fn=p.resolve(node);need(callable(fn)&&fn.body.type==='BlockStatement'&&!fn.async&&!fn.generator,'native namespace export is not a defined synchronous function');if(node.type==='Identifier'){const binding=p.binding(node);need(binding?.defs.length===1&&!binding.writes.length,'native exported function changes')}return fn}

function registry(){
 const modules=new Map(),sources=[]
 const add=(source,url)=>{
  const p=one(nativePrograms([{raw:source,attrs:{type:'text/javascript'}}]),'native declared dependency'),registrations=p.nodes.filter(n=>n.type==='CallExpression'&&p.member(n.callee)==='push'&&n.callee.object?.type==='LogicalExpression'&&p.member(n.callee.object.left)==='TURBOPACK'&&p.global(n.callee.object.left.object))
  need(registrations.length===1,'declared dependency registration missing/ambiguous')
  const call=registrations[0],holder=call.callee.object
  need(p.parents.get(call)?.type==='ExpressionStatement'&&p.tree.body.includes(p.parents.get(call)),'native registration is guarded/disconnected')
  need(holder.operator==='||'&&holder.right?.type==='AssignmentExpression'&&p.member(holder.right.left)==='TURBOPACK'&&p.global(holder.right.left.object)&&holder.right.right?.type==='ArrayExpression'&&!holder.right.right.elements.length,'native registry fallback differs')
  const entries=call.arguments[0]?.elements;need(call.arguments.length===1&&entries?.length>1,'native registry array malformed')
  const descriptor=entries[0]
  need(descriptor?.type==='ConditionalExpression'&&p.member(descriptor.consequent)==='currentScript'&&p.builtin(descriptor.consequent.object,'document')&&descriptor.alternate?.type==='UnaryExpression'&&descriptor.alternate.operator==='void'&&p.literal(descriptor.alternate.argument)===0,'native current-script registry descriptor unsupported')
  let count=0
  for(let i=1;i<entries.length;){
   const ids=[];while(entries[i]?.type==='Literal'&&Number.isSafeInteger(entries[i].value)&&entries[i].value>=0)ids.push(entries[i++].value)
   const callback=entries[i++];need(ids.length&&callable(callback)&&callback.body.type==='BlockStatement'&&callback.params.every(n=>n.type==='Identifier'),'native registration slots unsupported')
   for(const id of ids){need(!modules.has(id),'native module definition duplicated');modules.set(id,{p,callback,url,id});count++}
  }
  need(count>0&&modules.size<=1024,'finite native module registry exceeded');sources.push({url,registeredModules:count,originalProgramme:source})
 }
 function exported(id,name,seen=new Set()){
  need(seen.size<24&&!seen.has(id),'native namespace export cycle');const module=modules.get(id);if(!module)return null
  const {p,callback}=module;need(callback.params.length===3,'imported module does not expose native CommonJS owners')
  const [context,moduleParam,exportsParam]=callback.params.map(n=>p.binding(n)),statements=body(callback),trail=new Set(seen);trail.add(id)
  const assignment=statements.length===1&&statements[0].type==='ExpressionStatement'?statements[0].expression:null
  if(assignment?.type==='AssignmentExpression'&&p.member(assignment.left)==='exports'&&same(p,assignment.left.object,moduleParam)){
   const request=assignment.right;need(request?.type==='CallExpression'&&p.member(request.callee)==='r'&&same(p,request.callee.object,context)&&request.arguments.length===1&&Number.isSafeInteger(p.literal(request.arguments[0])),'native forwarding export differs')
   const resolved=exported(p.literal(request.arguments[0]),name,trail);return resolved?{...resolved,chain:[{url:module.url,moduleID:id,export:name,forwarded:true},...resolved.chain]}:null
  }
  const candidates=p.nodes.filter(n=>n.type==='AssignmentExpression'&&n.operator==='='&&n.left.type==='MemberExpression'&&same(p,n.left.object,exportsParam)&&p.member(n.left)===name)
  need(candidates.every(n=>direct(p,n,callback))&&candidates.length<=1,'native namespace export is replaced or inactive')
  let value=candidates[0]?.right,getterProof=null
  if(!value&&name==='default'){
   const loops=statements.filter(n=>n.type==='ForInStatement'&&n.left.type==='VariableDeclaration'&&n.left.declarations.length===1)
   for(const loop of loops){
    const map=p.resolve(loop.right);if(map?.type!=='ObjectExpression')continue
    const property=map.properties.filter(n=>n.type==='Property'&&!n.computed&&(n.key.name??n.key.value)===name);if(!property.length)continue
    need(!value&&property.length===1,'native default getter map ambiguous')
    const index=p.binding(loop.left.declarations[0].id),call=loop.body.type==='ExpressionStatement'?loop.body.expression:null
    need(call?.type==='CallExpression'&&p.member(call.callee)==='defineProperty'&&p.builtin(call.callee.object,'Object')&&same(p,call.arguments[0],exportsParam)&&same(p,call.arguments[1],index),'native default getter publication differs')
    const options=call.arguments[2],getter=options?.properties?.find(n=>(n.key.name??n.key.value)==='get')?.value
    need(getter?.type==='MemberExpression'&&same(p,getter.property,index)&&p.binding(getter.object)===p.binding(loop.right),'native getter map binding differs')
    const fn=actualFunction(p,property[0].value);need(!fn.params.length&&body(fn).length===1&&body(fn)[0].type==='ReturnStatement','native default getter body differs');value=body(fn)[0].argument;getterProof=call
   }
  }
  need(value,'native imported export missing '+name)
  for(const node of p.nodes)if(node.type==='Identifier'&&p.binding(node)===exportsParam&&!exportsParam.defs.some(d=>d.pattern===node)){
   const parent=p.parents.get(node)
   if(parent?.type==='MemberExpression'&&parent.object===node)continue
   const call=parent?.type==='CallExpression'?parent:null
   const metadata=call&&p.member(call.callee)==='defineProperty'&&p.builtin(call.callee.object,'Object')&&call.arguments[0]===node&&(call===getterProof||p.literal(call.arguments[1])==='__esModule')
   const augment=call&&p.member(call.callee)==='assign'&&p.builtin(call.callee.object,'Object')&&call.arguments[1]===node&&p.member(call.arguments[0])==='default'&&same(p,call.arguments[0].object,exportsParam)
   need(metadata||augment,'native export namespace escapes its published fields')
  }
  return{p,fn:actualFunction(p,value),module,chain:[{url:module.url,moduleID:id,export:name,forwarded:false}]}
 }
 function qualify(required){
  const resolved=[]
  for(const requirement of required)for(const name of requirement.exports){const result=exported(requirement.moduleID,name);if(!result)return null;resolved.push({...result,name})}
  let dispatcher=null,jsx=null
  for(const result of resolved){
   const {p,fn,name}=result
   if(name.startsWith('use')){
    const statements=body(fn),call=statements.length===1&&statements[0].type==='ReturnStatement'?statements[0].argument:null,owner=call?.callee?.object
    need(call?.type==='CallExpression'&&p.member(call.callee)===name&&p.member(owner)==='H'&&call.arguments.length===fn.params.length&&fn.params.every((arg,index)=>same(p,call.arguments[index],p.binding(arg))),'native hook export is not the matching dispatcher method')
    const binding=p.binding(owner.object),model=p.resolve(owner.object)
    need(binding?.defs.length===1&&!binding.writes.length&&model?.type==='ObjectExpression'&&model.properties.some(n=>(n.key.name??n.key.value)==='H'&&n.value.type==='Literal'&&n.value.value===null),'native hook dispatcher identity unresolved')
    need(!dispatcher||dispatcher===binding,'native hooks use different dispatchers');dispatcher=binding
    const exposure=p.nodes.filter(n=>n.type==='AssignmentExpression'&&p.member(n.left)==='__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE'&&same(p,n.right,binding));need(exposure.length===1,'native dispatcher owner is not published')
    for(const node of p.nodes)if(node.type==='Identifier'&&p.binding(node)===binding&&!binding.defs.some(d=>d.pattern===node)){
     const parent=p.parents.get(node);need(parent?.type==='MemberExpression'&&parent.object===node||parent===exposure[0],'native dispatcher escapes its actual published owner')
     if(parent?.type==='MemberExpression'&&p.member(parent)==='H'){const next=p.parents.get(parent);need(next?.type==='MemberExpression'&&next.object===parent&&p.parents.get(next)?.type==='CallExpression'&&p.parents.get(next).callee===next,'native hook dispatcher is replaced or transferred')}
    }
   }else if(name==='jsx'||name==='jsxs'){
    need(!jsx||jsx===fn,'native JSX exports use different element constructors');jsx=fn
    const returns=body(fn).filter(n=>n.type==='ReturnStatement'),returned=one(returns,'native JSX element return'),model=returned.argument
    need(model?.type==='ObjectExpression'&&fn.params.length===3,'native JSX element shape differs')
    const property=key=>one(model.properties.filter(n=>n.type==='Property'&&!n.computed&&(n.key.name??n.key.value)===key),'native JSX '+key).value
    const symbol=p.resolve(property('$$typeof'))
    need(symbol?.type==='CallExpression'&&p.member(symbol.callee)==='for'&&p.builtin(symbol.callee.object,'Symbol')&&p.literal(symbol.arguments[0])==='react.transitional.element'&&same(p,property('type'),p.binding(fn.params[0])),'native JSX element type ownership differs')
    const tail=node=>node?.type==='SequenceExpression'?node.expressions.at(-1):node
    const props=p.binding(property('props')),input=p.binding(fn.params[1]),copyBranches=body(fn).filter(n=>n.type==='IfStatement'&&tail(n.test)?.type==='BinaryExpression'&&tail(n.test).operator==='in'&&p.literal(tail(n.test).left)==='key'&&same(p,tail(n.test).right,input))
    const branch=one(copyBranches,'native JSX props key branch'),copy=branch.consequent,other=branch.alternate?.expression
    need(branch.test.type==='SequenceExpression'&&branch.test.expressions.length===3,'native JSX key composition unsupported')
    const keyOwner=p.binding(property('key')),keyWrites=[],keySteps=branch.test.expressions.slice(0,-1)
    for(const [index,step]of keySteps.entries()){
     const condition=step.left,write=step.right,source=condition?.right,concatenation=write?.right
     need(step.type==='LogicalExpression'&&step.operator==='&&'&&condition?.type==='BinaryExpression'&&condition.operator==='!=='&&condition.left.type==='UnaryExpression'&&condition.left.operator==='void'&&p.literal(condition.left.argument)===0,'native JSX key presence check differs')
     need(index===0?same(p,source,p.binding(fn.params[2])):p.member(source)==='key'&&same(p,source.object,input),'native JSX key input differs')
     need(write?.type==='AssignmentExpression'&&same(p,write.left,keyOwner)&&concatenation?.type==='BinaryExpression'&&concatenation.operator==='+'&&p.literal(concatenation.left)===''&&(index===0?same(p,concatenation.right,p.binding(fn.params[2])):p.member(concatenation.right)==='key'&&same(p,concatenation.right.object,input)),'native JSX key scalar composition differs')
     keyWrites.push(write.left)
    }
    need(keyOwner?.writes.length===2&&keyOwner.writes.every(node=>keyWrites.includes(node)),'native JSX key is replaced')

    need(other?.type==='AssignmentExpression'&&same(p,other.left,props)&&same(p,other.right,input)&&copy?.type==='ForInStatement'&&copy.right.type==='SequenceExpression','native JSX props are disconnected')
    const initialize=copy.right.expressions[0];need(initialize?.type==='AssignmentExpression'&&same(p,initialize.left,props)&&initialize.right.type==='ObjectExpression'&&!initialize.right.properties.length&&same(p,copy.right.expressions[1],input),'native JSX props copy owner differs')
    const index=p.binding(copy.left.declarations?.[0]?.id),conditional=copy.body?.expression,assignment=conditional?.right
    need(conditional?.type==='LogicalExpression'&&conditional.operator==='&&'&&conditional.left.type==='BinaryExpression'&&conditional.left.operator==='!=='&&p.literal(conditional.left.left)==='key'&&same(p,conditional.left.right,index)&&assignment?.type==='AssignmentExpression'&&assignment.left?.type==='MemberExpression'&&same(p,assignment.left.object,props)&&same(p,assignment.left.property,index)&&assignment.right?.type==='MemberExpression'&&same(p,assignment.right.object,input)&&same(p,assignment.right.property,index),'native JSX indexed props copy differs')
    need(props&&props.writes.length===2&&props.writes.includes(other.left)&&props.writes.includes(initialize.left),'native JSX props are replaced')
   }else if(name==='default'){
    const parameter=p.binding(fn.params[0]),declarations=p.nodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&same(p,n.init,parameter)),inputs=declarations.flatMap(n=>n.id.properties),href=inputs.find(n=>(n.key?.name??n.key?.value)==='href'),legacy=inputs.find(n=>(n.key?.name??n.key?.value)==='legacyBehavior')
    need(href&&legacy?.value?.type==='AssignmentPattern'&&legacy.value.right.type==='UnaryExpression'&&legacy.value.right.operator==='!'&&legacy.value.right.argument.value===1,'native card default does not expose the actual href/anchor input')
    const anchors=p.nodes.filter(n=>n.type==='CallExpression'&&p.literal(n.arguments[0])==='a'&&n.arguments[1]?.type==='ObjectExpression'&&['jsx','jsxs'].includes(p.member(unsequence(n.callee))))
    need(anchors.some(anchor=>anchor.arguments[1].properties.some(n=>n.type==='SpreadElement'&&p.nodes.some(write=>write.type==='AssignmentExpression'&&p.member(write.left)==='href'&&same(p,write.left.object,p.binding(n.argument))))),'native Link export has no actual anchor href consumer')
    need(p.nodes.some(n=>n.type==='LogicalExpression'&&n.operator==='||'&&same(p,n.right,p.binding(href.value))),'native Link href input is disconnected')
   }else need(false,'unsupported critical namespace export '+name)
  }
  return{executed:false,definitionAndExportOwnersQualified:true,namespaceExports:resolved.map(r=>({export:r.name,chain:r.chain})),originalDeclaredProgrammes:sources}
 }
 return{add,qualify}
}

export async function qualifyDeclaredDependencies(openings,declaration,contract,programme,io){
 const all=openings.d.nodes(n=>n.tag==='script'&&n.attrs.src&&!n.inert&&!n.inactive&&scriptKind(n)==='classic').map(n=>({url:new URL(n.attrs.src,'https://www.bitwiseglobal.com/').href,attributes:structuredClone(n.attrs)})).filter(n=>new URL(n.url).origin==='https://www.bitwiseglobal.com')
 need(all.length>0&&all.length<=16,'finite active own dependency declarations missing/excessive')
 const declared=new Set(all.map(n=>n.url)),required=contract.requiredNativeNamespaces,flight=literalFlight(openings),priority=[],priorityRequirements=new Map()
 for(const requirement of required)for(const record of flight.records.values())if(record.kind==='I'&&record.value[0]===requirement.moduleID){need(Array.isArray(record.value[1]),'native dependency Flight declaration malformed');for(const value of record.value[1]){const url=new URL(value,'https://www.bitwiseglobal.com/').href;if(declared.has(url)){priority.push(url);priorityRequirements.set(url,[...(priorityRequirements.get(url)??[]),requirement])}}}
 const queue=[...new Set([...priority,...all.map(n=>n.url)])].filter(url=>url!==declaration.url),owners=registry();owners.add(programme,declaration.url)
 let proof=owners.qualify(required)
 for(const url of queue){if(proof)break;if(priorityRequirements.has(url)&&priorityRequirements.get(url).every(requirement=>owners.qualify([requirement])))continue;io.allow(url);const original=await io.read(url,{kind:'program'});owners.add(original.text,url);proof=owners.qualify(required)}
 need(proof,'critical imported namespace owner remains unresolved from current declared dependencies')
 return{...proof,originalActiveDeclarations:all,openingOnlyResearchFixtureDoesNotSupplyCurrentProof:true}
}
