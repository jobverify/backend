import {nativePrograms} from './currentLexical20261120.js'
import {scriptKind} from './currentScriptKind20261120.js'
import {need,one,all} from './currentFacts20261120.js'
import {normalizeInvocation} from './currentInvocations20261121.js'
import {qualifyDefaultFilters} from './currentDefaultFilters20261121.js'

const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const children=node=>Object.entries(node).filter(([key])=>!['start','end','raw','loc','range'].includes(key)).flatMap(([,value])=>(Array.isArray(value)?value:[value]).filter(child=>child&&typeof child==='object'&&typeof child.type==='string'))
const walk=node=>[node,...children(node).flatMap(walk)]
const directCalls=fn=>fn.body.type==='BlockStatement'?fn.body.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='CallExpression').map(node=>node.expression):[]
const arrayMutators=new Set(['push','pop','shift','unshift','splice','sort','reverse','copyWithin','fill'])

// A source-specific static witness from an actually registered DOM-ready callback
// to the original fetch, parsed listed records, grouped native URLs and DOM list.
// Identifiers, incidental statements and script bytes are deliberately unpinned.
export function connectedConsumer(document){
 const scripts=all(document.root,node=>node.tag==='script'&&!node.attrs.src&&scriptKind(node)&&!node.inactive&&!node.inert)
 const programs=nativePrograms(scripts.map(node=>({...node,originalNode:node,attrs:scriptKind(node)==='module'?{...node.attrs,type:'module'}:node.attrs})))
 const candidates=[]
 for(const p of programs){
  const resolve=node=>p.resolve(node),member=node=>p.member(resolve(node)),binding=node=>node?.type==='Identifier'?p.binding(node):null
  const same=(a,b)=>Boolean(binding(a)&&binding(a)===binding(b))
  const fn=node=>{const value=resolve(node);return functions.has(value?.type)?value:null}
  const property=(node,name)=>node?.type==='MemberExpression'&&member(node)===name
  const builtin=(node,name)=>p.builtin(node,name)
  const method=(node,name)=>node?.type==='CallExpression'&&property(node.callee,name)
  const ret=node=>node?.body.type==='BlockStatement'&&node.body.body.length===1&&node.body.body[0].type==='ReturnStatement'?node.body.body[0].argument:node?.body.type!=='BlockStatement'?node?.body:null
  const initial=node=>{const value=binding(node);need(value?.defs.length===1,'connected consumer binding is ambiguous');return value.defs[0].init}
  const owned=node=>[node,...children(node).filter(child=>!functions.has(child.type)).flatMap(owned)]
  const declarations=owner=>owned(owner.body).filter(node=>node.type==='VariableDeclarator'&&node.id.type==='Identifier')
  const defining=(owner,predicate,label)=>one(declarations(owner).filter(node=>predicate(node.init)),label)
  const selected=(receiver,selector)=>method(receiver,'querySelector')&&p.literal(receiver.arguments[0])===selector
  const top=p.tree.body.filter(node=>node.type==='ExpressionStatement').map(node=>node.expression)
  for(const event of top.filter(node=>method(node,'addEventListener')&&builtin(node.callee.object,'document')&&p.literal(node.arguments[0])==='DOMContentLoaded'&&fn(node.arguments[1]))){
   const callback=fn(event.arguments[1])
   const starts=directCalls(callback).map(call=>({call,fn:fn(call.callee)})).filter(row=>row.fn)
   for(const start of starts){
    const links=directCalls(start.fn).map(call=>({call,fn:fn(call.callee)})).filter(row=>row.fn)
    for(const link of links){
     for(const statement of directCalls(link.fn)){
      let chain=statement
      if(method(chain,'catch'))chain=chain.callee.object
      if(!method(chain,'then')||!fn(chain.arguments[0]))continue
      const dataFunction=fn(chain.arguments[0]),jsonStep=chain.callee.object
      if(!method(jsonStep,'then')||!fn(jsonStep.arguments[0]))continue
      const request=jsonStep.callee.object,jsonFunction=fn(jsonStep.arguments[0])
      if(request?.type!=='CallExpression'||!builtin(request.callee,'fetch'))continue
      const url=request.arguments[0]
      if(url?.type!=='BinaryExpression'||url.operator!=='+'||p.literal(url.left)!=='https://api.ashbyhq.com/posting-api/job-board/')continue
      // A connected fetch for this provider is a contract. Changed account,
      // methods, decoding, publication predicates or later effects must hold.
      need(request.arguments.length===1,'connected own public fetch options changed')
      const encoded=url.right
      need(encoded?.type==='CallExpression'&&builtin(encoded.callee,'encodeURIComponent')&&encoded.arguments.length===1&&p.literal(encoded.arguments[0])==='redpanda-data','connected own native account differs')
      const account=binding(encoded.arguments[0]);need(account&&account.defs.length===1&&account.writes.length===0,'connected native account is mutable')
      const decoded=ret(jsonFunction)
      need(jsonFunction.params.length===1&&method(decoded,'json')&&same(decoded.callee.object,jsonFunction.params[0])&&decoded.arguments.length===0,'connected original JSON decoding differs')
      need(dataFunction.params.length===1,'connected original data parameter differs')
      const assignment=one(dataFunction.body.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='AssignmentExpression').map(node=>node.expression).filter(node=>node.left.type==='Identifier'),'connected listed collection assignment')
      const list=assignment.left,listed=assignment.right,listBinding=binding(list)
      need(listBinding?.defs.length===1&&listBinding.writes.length===1&&p.parents.get(listBinding.writes[0])===assignment&&initial(list)?.type==='ArrayExpression'&&initial(list).elements.length===0,'connected listed state is replaced or ambiguous')
      need(assignment.operator==='='&&method(listed,'filter')&&property(listed.callee.object,'jobs')&&same(listed.callee.object.object,dataFunction.params[0])&&listed.arguments.length===1,'connected original jobs flow differs')
      const predicate=fn(listed.arguments[0]),condition=ret(predicate)
      need(predicate?.params.length===1&&condition?.type==='BinaryExpression'&&condition.operator==='!=='&&property(condition.left,'isListed')&&same(condition.left.object,predicate.params[0])&&p.literal(condition.right)===false,'connected listed publication predicate differs')
      const actualApply=one(directCalls(dataFunction).map(call=>({call,fn:fn(call.callee)})).filter(row=>row.fn&&directCalls(row.fn).some(call=>call.arguments.length===1&&call.arguments[0].type==='CallExpression'&&fn(call.callee)&&fn(call.arguments[0].callee))),'connected current collection renderer')
      const rendering=one(directCalls(actualApply.fn).filter(call=>call.arguments.length===1&&call.arguments[0].type==='CallExpression'&&fn(call.callee)&&fn(call.arguments[0].callee)),'connected grouped render invocation')
      const grouped=rendering.arguments[0],group=fn(grouped.callee),render=fn(rendering.callee)
      need(grouped.arguments.length===1&&grouped.arguments[0].type==='Identifier','connected grouped collection argument differs')
      const filtered=initial(grouped.arguments[0]);need(method(filtered,'filter')&&same(filtered.callee.object,list),'connected rendered collection is disconnected')
      need(group.params.length===1&&render.params.length===1,'connected group/render parameter differs')
      const groupLoop=one(walk(group.body).filter(node=>method(node,'forEach')&&same(node.callee.object,group.params[0])&&fn(node.arguments[0])),'connected original grouping loop')
      const groupCallback=fn(groupLoop.arguments[0]);need(groupCallback.params.length===1,'connected grouping role parameter differs')
      const mapped=one(walk(groupCallback.body).filter(node=>method(node,'push')&&node.arguments.length===1&&node.arguments[0].type==='ObjectExpression'),'connected native URL/title model')
      const fields=Object.fromEntries(mapped.arguments[0].properties.filter(node=>node.type==='Property'&&!node.computed&&node.kind==='init').map(node=>[node.key.name??node.key.value,node.value]))
      need(Object.keys(fields).length===2&&property(fields.title,'title')&&same(fields.title.object,groupCallback.params[0])&&property(fields.url,'jobUrl')&&same(fields.url.object,groupCallback.params[0]),'connected native URL/title projection differs')
      const outerLoop=one(walk(render.body).filter(node=>method(node,'forEach')&&same(node.callee.object,render.params[0])&&fn(node.arguments[0])),'connected department DOM loop')
      const department=fn(outerLoop.arguments[0]);need(department.params.length===1,'connected department parameter differs')
      const innerLoop=one(walk(department.body).filter(node=>method(node,'forEach')&&property(node.callee.object,'jobs')&&same(node.callee.object.object,department.params[0])&&fn(node.arguments[0])),'connected role DOM loop')
      const role=fn(innerLoop.arguments[0]);need(role.params.length===1,'connected DOM role parameter differs')
      const item=defining(role,node=>method(node,'cloneNode')&&p.literal(node.arguments[0])===true,'connected job template clone')
      const anchor=defining(role,node=>selected(node,'a')&&same(node.callee.object,item.id),'connected actual job link')
      const title=defining(role,node=>selected(node,'[data-careers="job-title"]')&&same(node.callee.object,item.id),'connected actual job title')
      const writes=walk(role.body).filter(node=>node.type==='AssignmentExpression')
      const linkWrite=one(writes.filter(node=>property(node.left,'href')&&same(node.left.object,anchor.id)),'connected unique native link effect')
      const titleWrite=one(writes.filter(node=>property(node.left,'textContent')&&same(node.left.object,title.id)),'connected unique native title effect')
      need(linkWrite.operator==='='&&property(linkWrite.right,'url')&&same(linkWrite.right.object,role.params[0]),'connected native link effect differs')
      need(titleWrite.operator==='='&&property(titleWrite.right,'title')&&same(titleWrite.right.object,role.params[0]),'connected native title effect differs')
      const dept=defining(department,node=>method(node,'cloneNode')&&p.literal(node.arguments[0])===true,'connected department template clone')
      const listElement=defining(department,node=>selected(node,'[data-careers="jobs-list"]')&&same(node.callee.object,dept.id),'connected actual jobs list')
      const itemAppend=one(walk(role.body).filter(node=>method(node,'appendChild')&&same(node.callee.object,listElement.id)&&same(node.arguments[0],item.id)),'connected job list append effect')
      const renderContainer=defining(render,node=>property(node,'container'),'connected render container state')
      const departmentAppend=one(walk(department.body).filter(node=>method(node,'appendChild')&&same(node.callee.object,renderContainer.id)&&same(node.arguments[0],dept.id)),'connected department append effect')
      const ownContainer=defining(start.fn,node=>selected(node,'[data-careers="jobs-container"]')&&builtin(node.callee.object,'document'),'connected actual own container selection')
      const ownDepartment=defining(start.fn,node=>selected(node,'[data-careers="department-template"]')&&same(node.callee.object,ownContainer.id),'connected own department template selection')
      const deptTemplate=item.init.callee.object,groupTemplate=dept.init.callee.object
      const templateWrite=one(walk(start.fn.body).filter(node=>node.type==='AssignmentExpression'&&same(node.left,groupTemplate)),'connected original department template state')
      need(method(templateWrite.right,'cloneNode')&&same(templateWrite.right.callee.object,ownDepartment.id),'connected department template origin differs')
      const nested=defining(start.fn,node=>selected(node,'[data-careers="job-template"]')&&same(node.callee.object,groupTemplate),'connected own nested job template selection')
      const roleWrite=one(walk(start.fn.body).filter(node=>node.type==='AssignmentExpression'&&same(node.left,deptTemplate)),'connected original job template state')
      need(method(roleWrite.right,'cloneNode')&&same(roleWrite.right.callee.object,nested.id),'connected job template origin differs')
      const containerWrite=one(walk(start.fn.body).filter(node=>node.type==='AssignmentExpression'&&property(node.left,'container')&&same(node.right,ownContainer.id)),'connected original container state')
      need(same(containerWrite.left.object,renderContainer.init.object),'connected original rendered container differs')
      // A descendant node is not an execution path. Every essential operation
      // must remain reachable for the qualified original JSON and actual DOM.
      const present=new Set([dataFunction.params[0],ownContainer.id,ownDepartment.id,nested.id,item.id,anchor.id,title.id,dept.id,listElement.id,renderContainer.id].map(binding))
      const unknown=Symbol('unknown')
      const truth=node=>{
       if(!node)return unknown
       if(node.type==='Literal')return node.value
       if(node.type==='Identifier'&&present.has(binding(node)))return true
       if(node.type==='UnaryExpression'&&node.operator==='!'){const value=truth(node.argument);return value===unknown?unknown:!value}
       if(node.type==='LogicalExpression'){
        const left=truth(node.left);if(left===unknown)return unknown
        if(node.operator==='&&')return left?truth(node.right):left
        if(node.operator==='||')return left?left:truth(node.right)
       }
       if(property(node,'jobs')&&same(node.object,dataFunction.params[0]))return true
       if(method(node,'isArray')&&builtin(node.callee.object,'Array')&&node.arguments.length===1&&property(node.arguments[0],'jobs')&&same(node.arguments[0].object,dataFunction.params[0]))return true
       return unknown
      }
      const aborts=node=>{
       if(!node||functions.has(node.type))return false
       if(['ReturnStatement','ThrowStatement','BreakStatement','ContinueStatement'].includes(node.type))return true
       if(node.type==='BlockStatement')return node.body.some(aborts)
       if(node.type==='IfStatement'){const value=truth(node.test);return value===unknown?aborts(node.consequent)||aborts(node.alternate):aborts(value?node.consequent:node.alternate)}
       if(['ForStatement','ForOfStatement','ForInStatement','WhileStatement','DoWhileStatement','TryStatement','SwitchStatement'].includes(node.type))return children(node).some(aborts)
       return false
      }
      const reachable=(owner,target)=>{
       let child=target
       for(let parent=p.parents.get(child);parent&&child!==owner.body;child=parent,parent=p.parents.get(child)){
        need(!functions.has(parent.type)||parent===owner,'connected witness crosses an uninvoked function')
        if(parent.type==='BlockStatement'){
         const index=parent.body.indexOf(child)
         if(index>=0)need(!parent.body.slice(0,index).some(aborts),'connected current native operation is unreachable or conditionally aborted')
        }
        if(parent.type==='IfStatement'&&child!==parent.test){const value=truth(parent.test);need(value!==unknown&&Boolean(value)===(child===parent.consequent),'connected current native effect is unreachable or conditional')}
        if(['ConditionalExpression','LogicalExpression','WhileStatement','ForStatement','SwitchCase','TryStatement'].includes(parent.type))need(false,'connected current native effect requires new control-flow qualification')
       }
      }
      for(const[owner,target]of[[callback,start.call],[start.fn,link.call],[link.fn,statement],[dataFunction,assignment],[dataFunction,actualApply.call],[actualApply.fn,rendering],[group,groupLoop],[groupCallback,mapped],[render,outerLoop],[department,innerLoop],[department,departmentAppend],[role,item],[role,linkWrite],[role,titleWrite],[role,itemAppend]])reachable(owner,target)
      const filterFunction=fn(filtered.arguments[0]),filterResult=ret(filterFunction)
      need(filterFunction?.params.length===1&&filterResult&&walk(filterResult).some(node=>same(node,filterFunction.params[0]))&&!(filterResult.type==='Literal'),'connected rendered filter discards the original records')
      const defaultFilters=qualifyDefaultFilters(p,{apply:actualApply.fn,filterFunction,filtered,state:containerWrite.left.object,document})
      const groupReceiver=mapped.callee.object
      need(property(groupReceiver,'jobs')&&groupReceiver.object.type==='MemberExpression'&&groupReceiver.object.computed,'connected native projection has no department storage')
      const storage=groupReceiver.object.object,storageInitial=initial(storage)
      need(storageInitial?.type==='ObjectExpression'&&storageInitial.properties.length===0,'connected department storage differs')
      const groupReturn=one(group.body.body.filter(node=>node.type==='ReturnStatement'),'connected original grouped return')
      const mappedReturn=groupReturn.argument
      need(method(mappedReturn,'map')&&method(mappedReturn.callee.object,'sort'),'connected original grouped return discards records')
      const keys=mappedReturn.callee.object.callee.object
      need(method(keys,'keys')&&builtin(keys.callee.object,'Object')&&keys.arguments.length===1&&same(keys.arguments[0],storage),'connected grouped return uses different storage')
      const groupKey=fn(mappedReturn.arguments[0]),groupValue=ret(groupKey)
      need(groupKey?.params.length===1&&groupValue?.type==='MemberExpression'&&groupValue.computed&&same(groupValue.object,storage)&&same(groupValue.property,groupKey.params[0]),'connected grouped result is not the original department records')
      reachable(group,groupReturn)
      const storageWrite=one(owned(groupCallback.body).filter(node=>node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&same(node.left.object,storage)),'connected department initialization')
      need(storageWrite.operator==='='&&storageWrite.right.type==='ObjectExpression','connected department initialization differs')
      const storageFields=Object.fromEntries(storageWrite.right.properties.filter(node=>node.type==='Property'&&!node.computed&&node.kind==='init').map(node=>[node.key.name??node.key.value,node.value]))
      need(Object.keys(storageFields).length===2&&storageFields.jobs?.type==='ArrayExpression'&&storageFields.jobs.elements.length===0&&same(storageWrite.left.property,groupReceiver.object.property),'connected department record array differs')
      let storageGuard=p.parents.get(storageWrite)
      while(storageGuard&&storageGuard.type!=='IfStatement'&&storageGuard!==groupCallback)storageGuard=p.parents.get(storageGuard)
      need(storageGuard?.type==='IfStatement'&&storageGuard.test.type==='UnaryExpression'&&storageGuard.test.operator==='!'&&storageGuard.test.argument.type==='MemberExpression'&&same(storageGuard.test.argument.object,storage)&&same(storageGuard.test.argument.property,storageWrite.left.property),'connected department storage initialization is disconnected')
      const critical=new Set([account,listBinding,binding(groupTemplate),binding(deptTemplate),binding(grouped.arguments[0]),binding(storage),...dataFunction.params.map(binding),...group.params.map(binding),...groupCallback.params.map(binding),...render.params.map(binding),...department.params.map(binding),...role.params.map(binding)].filter(Boolean))
      const affected=(node,seen=new Set())=>{
       if(!node||seen.has(node))return false
       seen.add(node)
       if(node.type==='Identifier'&&critical.has(binding(node)))return true
       if(node.type==='MemberExpression')return affected(node.object,seen)
       const value=resolve(node);return value!==node&&affected(value,seen)
      }
      let invocationArrays=null
      const invocation=(callee,args)=>normalizeInvocation(p,callee,args,{onArray:array=>invocationArrays?.add(array)})
      const permittedWrites=new Set([assignment,templateWrite,roleWrite,containerWrite,storageWrite])
      permittedWrites.add(defaultFilters.selectionAssignment);defaultFilters.bindings.forEach(value=>critical.add(value))
      const reflectionNames=new Set(['assign','defineProperty','defineProperties','set','deleteProperty','setPrototypeOf','freeze','seal','preventExtensions'])
      const reflection=callee=>reflectionNames.has(member(callee))&&['Object','Reflect'].some(name=>builtin(callee.object,name))
      const readonlyFor=(q,callee)=>['Object','Reflect'].some(name=>q.builtin(callee?.object,name))&&['keys','values','entries','hasOwn','getOwnPropertyDescriptor','getOwnPropertyDescriptors','getPrototypeOf','isExtensible','isFrozen','isSealed'].includes(q.member(callee))||q.builtin(callee?.object,'Array')&&q.member(callee)==='isArray'||['encodeURIComponent','String','Number','Boolean'].some(name=>q.builtin(callee,name))
      const readonlyNative=callee=>readonlyFor(p,callee)
      const normalizeCall=node=>{
       const prior=invocationArrays;invocationArrays=null
       try{return invocation(node.callee,node.arguments)}finally{invocationArrays=prior}
      }
      // A spread/apply argument array is itself part of the proof. Looking only
      // at its initializer would ignore later indexed writes or helper escapes.
      const stableInvocationArrays=(arrays,q=p)=>{
       if(!arrays.size)return
       const bindings=new Set()
       const localBinding=node=>node?.type==='Identifier'?q.binding(node):null
       const localFunction=node=>{const value=q.resolve(node);return functions.has(value?.type)?value:null}
       const localReflection=callee=>reflectionNames.has(q.member(callee))&&['Object','Reflect'].some(name=>q.builtin(callee?.object,name))
       const depends=(node,seen=new Set())=>{
        if(!node||seen.has(node))return false;seen.add(node)
        if(arrays.has(node)||node.type==='Identifier'&&bindings.has(localBinding(node)))return true
        if(node.type==='MemberExpression')return depends(node.object,seen)
        const value=q.resolve(node);return value!==node&&depends(value,seen)
       }
       for(let pass=0;pass<16;pass++){
        let changed=false;const add=node=>{const value=localBinding(node);if(value&&!bindings.has(value)){bindings.add(value);changed=true}}
        for(const node of q.nodes){
         if(node.type==='VariableDeclarator'&&depends(node.init))add(node.id)
         if(node.type==='CallExpression'){const local=localFunction(node.callee);if(local)node.arguments.forEach((arg,index)=>{if(depends(arg))add(local.params[index])})}
        }
        if(!changed)break;need(pass<15,'finite connected invocation array aliases exceeded')
       }
       for(const node of q.nodes){
        if(node.type==='AssignmentExpression')need(!depends(node.left),'connected invocation argument array is mutated')
        if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')need(!depends(node.argument),'connected invocation argument array is updated/deleted')
        if(node.type!=='CallExpression')continue
        const call=normalizeInvocation(q,node.callee,node.arguments);if(!call)continue
        const callee=call.callee
        if(arrayMutators.has(q.member(callee)))need(!depends(call.thisValue??callee.object),'connected invocation argument array mutator differs')
        if(localReflection(callee))need(!call.unknown&&!depends(call.args[0]),'connected invocation argument array reflection differs')
        if(call.args.some(arg=>depends(arg)))need(Boolean(localFunction(callee)||localReflection(callee)||readonlyFor(q,callee)),'connected invocation argument array escapes to an unknown consumer')
       }
      }
      const readonlyConfiguredGetter=call=>{
       if(member(call.callee)!=='get'||call.args.length!==1)return false
       const configured=resolve(call.callee.object)
       if(configured?.type!=='MemberExpression'||!configured.computed)return false
       const entries=resolve(configured.object)
       if(entries?.type!=='ArrayExpression'||!entries.elements.length)return false
       return entries.elements.every(entry=>{
        const object=resolve(entry)
        if(object?.type!=='ObjectExpression')return false
        const getters=object.properties.filter(property=>property.type==='Property'&&!property.computed&&(property.key.name??property.key.value)==='get')
        if(getters.length!==1)return false
        const getter=fn(getters[0].value)
        return getter?.params.length===1&&Boolean(ret(getter))&&!owned(getter.body).some(node=>['AssignmentExpression','UpdateExpression','CallExpression','NewExpression','AwaitExpression','YieldExpression','ThrowStatement'].includes(node.type)||node.type==='UnaryExpression'&&node.operator==='delete')
       })
      }
      const domBindings=new Map([[anchor.id,'link'],[title.id,'title'],[item.id,'item'],[dept.id,'department'],[listElement.id,'list'],[renderContainer.id,'container'],[ownContainer.id,'container'],[containerWrite.left.object,'state']].map(([node,kind])=>[binding(node),kind]))
      const domInitializers=new Map([[anchor.init,'link'],[title.init,'title'],[item.init,'item'],[dept.init,'department'],[listElement.init,'list'],[renderContainer.init,'container'],[ownContainer.init,'container'],[resolve(containerWrite.left.object),'state']])
      const domIdentity=node=>domBindings.get(binding(node))??domInitializers.get(resolve(node))??null
      const domAccess=node=>{const path=[];let base=node;while(base?.type==='MemberExpression'){path.unshift(member(base));base=base.object}return{kind:domIdentity(base),path}}
      const ownerOf=node=>{for(let at=p.parents.get(node);at;at=p.parents.get(at))if(functions.has(at.type))return at;return null}
      const primitiveFields=new Set(['id','title','jobUrl','url','department','descriptionPlain','descriptionHtml','employmentType','workplaceType','length','isListed','name','location'])
      const objectEscape=(node,seen=new Set())=>{
       if(!node||seen.has(node))return false;seen.add(node)
       if(node.type==='MemberExpression'&&primitiveFields.has(member(node)))return false
       if(node.type==='Identifier'){
        const definition=binding(node)?.defs
        if(definition?.length===1&&definition[0].init&&definition[0].init!==node){const value=definition[0].init;if(value.type==='Literal'||value.type==='MemberExpression'&&primitiveFields.has(member(value)))return false}
       }
       return affected(node)||Boolean(domIdentity(node))
      }
      const harmlessAttributes=new Set(['target','rel','aria-label','title'])
      for(const node of p.nodes){
       if(node.type==='AssignmentExpression'){
        const access=domAccess(node.left),field=access.path.join('.')
        if(access.kind==='state'&&access.path[0]==='container')need(node===containerWrite,'connected native container state is replaced')
        else if(access.kind&&access.kind!=='state'){
         const href=access.kind==='link'&&field==='href'&&node===linkWrite
         const titleText=access.kind==='title'&&field==='textContent'&&node===titleWrite
         const blank=p.literal(node.right)===''
         const cloneStyle=['item','department'].includes(access.kind)&&field==='style.display'&&blank
         const listClear=access.kind==='list'&&field==='innerHTML'&&blank&&ownerOf(node)===department&&node.start<innerLoop.start
         const containerClear=access.kind==='container'&&field==='innerHTML'&&blank&&ownerOf(node)===render&&node.start<outerLoop.start
         need(href||titleText||cloneStyle||listClear||containerClear||harmlessAttributes.has(field),'connected native record DOM effect is overwritten')
        }
       }
       if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')need(!domAccess(node.argument).kind,'connected native record DOM identity is updated/deleted')
       if(node.type!=='CallExpression')continue
       const call=normalizeCall(node);if(!call)continue
       const callee=call.callee,name=member(callee),receiver=domAccess(call.thisValue??callee?.object)
       if(reflection(callee)){
        const kind=domIdentity(call.args[0])
        if(kind==='state'){
         const key=p.literal(call.args[1]);need(['set','defineProperty','deleteProperty'].includes(name)&&typeof key==='string'&&key!=='container','connected native container state reflection differs')
        }else if(kind)need(['set','defineProperty','deleteProperty'].includes(name)&&harmlessAttributes.has(p.literal(call.args[1])),'connected native record DOM reflection differs')
       }
       if(receiver.kind&&receiver.kind!=='state'){
        const readonly=['querySelector','querySelectorAll','cloneNode','getAttribute','hasAttribute','matches','closest','contains'].includes(name)
        const append=node===itemAppend||node===departmentAppend
        const remove=name==='removeAttribute'&&(['item','department'].includes(receiver.kind)&&p.literal(call.args[0])==='data-careers'||harmlessAttributes.has(p.literal(call.args[0])))
        const attribute=name==='setAttribute'&&harmlessAttributes.has(p.literal(call.args[0]))
        need(readonly||append||remove||attribute,'connected native record DOM method changes the original effect')
       }
      }
      // Propagate actual collection aliases and read-only helper parameters.
      for(let pass=0;pass<16;pass++){let changed=false;const add=node=>{const value=binding(node);if(value&&!critical.has(value)){critical.add(value);changed=true}}
       for(const node of p.nodes){if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&affected(node.init))add(node.id)
        if(node.type==='CallExpression'){const local=fn(node.callee);if(local)node.arguments.forEach((arg,index)=>{if(affected(arg)&&local.params[index]?.type==='Identifier')add(local.params[index])});if(['filter','map','forEach'].includes(member(node.callee))&&affected(node.callee.object)){const callback=fn(node.arguments[0]);if(callback){add(callback.params[0]);add(callback.params[2])}}}
       }if(!changed)break;need(pass<15,'finite connected alias scope exceeded')
      }
      for(const node of p.nodes){
       if(node.type==='AssignmentExpression'&&affected(node.left))need(permittedWrites.has(node),'connected native state mutation differs')
       if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')need(!affected(node.argument),'connected native state update/delete differs')
       if(node.type==='CallExpression'){
        invocationArrays=new Set()
        const call=invocation(node.callee,node.arguments)
        const arrays=invocationArrays;invocationArrays=null
        if(!call)continue
        const callee=call.callee,name=member(callee)
        if(arrayMutators.has(name)||reflection(callee))stableInvocationArrays(arrays)
        if(arrayMutators.has(name)&&node!==mapped)need(!call.unknown&&!affected(call.thisValue??callee.object),'connected native collection mutator differs')
        if(reflection(callee))need(!call.unknown&&!affected(call.args[0]),'connected native state reflection differs')
        if(call.args.some(arg=>objectEscape(arg)))need(Boolean(fn(callee)||reflection(callee)||readonlyNative(callee)||readonlyConfiguredGetter(call)||node===itemAppend||node===departmentAppend),'connected original native collection escapes to an unknown consumer: '+(member(callee)??callee?.name??callee?.type??'unknown'))
        need(!builtin(callee,'eval')&&!builtin(callee,'Function'),'connected native source uses dynamic execution')
       }
      }
      // Original inline programmes share browser globals. A later programme
      // runs before DOMContentLoaded, so it can replace fetch before this path.
      // A later registration-method replacement cannot undo an existing event
      // registration, and remains a coherent neighbouring case.
      const currentIndex=programs.indexOf(p)
      for(const[programIndex,q]of programs.entries()){
       const qMember=node=>q.member(q.resolve(node)),qGlobal=node=>q.global(q.resolve(node))
       const browserNamespaces=new Set(['Object','Array','Element','Node','Function','Reflect','String','URLSearchParams'])
       const primitivePaths=[['Object','keys'],['Array','isArray'],...['filter','forEach','map','sort','slice','indexOf'].map(name=>['Array','prototype',name]),...['querySelector','querySelectorAll','appendChild','cloneNode'].map(name=>['Element','prototype',name]),...['cloneNode','appendChild','removeChild'].map(name=>['Node','prototype',name]),...['call','apply','bind'].map(name=>['Function','prototype',name]),...['trim','toLowerCase','indexOf','localeCompare'].map(name=>['String','prototype',name]),['URLSearchParams','prototype','get'],['URLSearchParams','prototype','getAll']]
       const namespacePath=(input,depth=0)=>{need(depth<=32,'finite browser primitive namespace dependency exceeded');const value=q.resolve(input);for(const name of browserNamespaces)if(q.builtin(value,name))return[name];if(value?.type!=='MemberExpression')return null;const name=qMember(value);if(qGlobal(value.object)&&browserNamespaces.has(name))return[name];const parent=namespacePath(value.object,depth+1);return parent?[...parent,name]:null}
       const protectedPath=path=>path&&primitivePaths.some(critical=>path.length<=critical.length&&path.every((value,index)=>value==null||value===critical[index]))
       const protectedMember=(object,name,node)=>{
        if(qGlobal(object))return name==null||['fetch','encodeURIComponent','document',...browserNamespaces].includes(name)
        if(q.builtin(object,'document'))return name==='querySelector'||name==='addEventListener'&&(programIndex<currentIndex||programIndex===currentIndex&&node.start<event.start)
        const path=namespacePath(object);if(path)return protectedPath([...path,name])
        return false
       }
       const protectedTarget=(target,node)=>{
        const value=q.resolve(target)
        if(target?.type==='Identifier'&&['fetch','encodeURIComponent','document',...browserNamespaces].some(name=>q.builtin(target,name)))return true
        return value?.type==='MemberExpression'&&protectedMember(value.object,qMember(value),node)
       }
       for(const node of q.nodes){
        if(node.type==='AssignmentExpression')need(!protectedTarget(node.left,node),'connected native browser dependency assignment differs')
        if(node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete')need(!protectedTarget(node.argument,node),'connected native browser dependency update/delete differs')
        if(node.type!=='CallExpression')continue
        const arrays=new Set(),call=normalizeInvocation(q,node.callee,node.arguments,{onArray:array=>arrays.add(array)})
        if(!call)continue
        const callee=call.callee,name=qMember(callee)
        if(!reflectionNames.has(name)||!['Object','Reflect'].some(value=>q.builtin(callee?.object,value)))continue
        const target=q.resolve(call.args[0])
        if(!qGlobal(target)&&!q.builtin(target,'document'))continue
        need(!call.unknown,'connected browser dependency reflection arguments are unresolved');stableInvocationArrays(arrays,q)
        if(name==='assign'||name==='defineProperties'){
         for(const raw of call.args.slice(1)){
          const object=q.resolve(raw);need(object?.type==='ObjectExpression','connected browser dependency reflection source is unresolved')
          for(const property of object.properties){need(property.type==='Property','connected browser dependency reflection spread is unresolved');const key=property.computed?q.literal(property.key):property.key.name??property.key.value;need(typeof key==='string'&&!protectedMember(target,key,node),'connected native browser dependency reflection differs')}
         }
        }else if(['set','defineProperty','deleteProperty'].includes(name)){
         const key=q.literal(call.args[1]);need(typeof key==='string'&&!protectedMember(target,key,node),'connected native browser dependency reflection differs')
        }else need(false,'connected browser dependency identity/prototype reflection differs')
       }
      }
      const dom=all(document.root,()=>true),container=one(dom.filter(node=>node.attrs['data-careers']==='jobs-container'),'actual current jobs container'),departments=one(all(container,node=>node.attrs['data-careers']==='department-template'),'actual current department template'),job=one(all(departments,node=>node.attrs['data-careers']==='job-template'),'actual current job template')
      const listNode=one(all(departments,node=>node.attrs['data-careers']==='jobs-list'),'actual current jobs list'),titleNode=one(all(job,node=>node.attrs['data-careers']==='job-title'),'actual current role title'),anchorNode=one(all(job,node=>node.tag==='a'),'actual current role anchor')
      need(all(listNode,node=>node===job).length===1&&all(anchorNode,node=>node===titleNode).length===1,'actual role template/list DOM connection differs')
      candidates.push({script:p.script.originalNode,nodes:[container,departments,job,listNode,titleNode,anchorNode],proof:{connected:true,kind:'own-dom-ready-fetch-json-listed-state-grouped-native-url-title-dom-effect',account:'redpanda-data',feed:'https://api.ashbyhq.com/posting-api/job-board/redpanda-data',nativeProgramsExecuted:false,originalProgram:p.script.raw}})
     }
    }
   }
  }
 }
 return one(candidates,'current connected own native collection consumer')
}
