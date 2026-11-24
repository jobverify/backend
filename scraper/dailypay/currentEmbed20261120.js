import {need,one} from './currentFacts20261120.js'
import {nativePrograms} from './currentLexical20261120.js'

const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const executable=n=>n.tag==='script'&&!n.attrs.src&&(!n.attrs.type||['text/javascript','application/javascript','module'].includes(n.attrs.type))
const rootPath=(p,node,names)=>{node=p.resolve(node);return names.length?node?.type==='MemberExpression'&&p.member(node)===names.at(-1)&&rootPath(p,node.object,names.slice(0,-1)):p.global(node)}
const field=(p,node)=>node.computed?p.literal(node.key):node.key?.name??node.key?.value
const dependencies=new Set(['__ashbyBaseJobBoardUrl','__Ashby','Object','Reflect','URL','document','addEventListener','encodeURIComponent'])

// Inspect known writes and invoked native mutators, including bound aliases.
// Nothing in an authored script is evaluated or installed on the process.
function writes(programs,target,protectedKeys,permitted=new Set()){
 for(const p of programs){
  for(const node of p.nodes.filter(n=>n.type==='AssignmentExpression'||n.type==='UpdateExpression'||n.type==='UnaryExpression'&&n.operator==='delete')){
   const left=node.left??node.argument
   if(left?.type!=='MemberExpression'||!target(p,left.object)||permitted.has(node))continue
   const name=p.member(left);need(name!=null&&!protectedKeys.has(name),'actual declared native state or dependency overwritten')
  }
  function mutation(callee,args,depth=0){
   need(depth<=12,'finite declared native mutator scope exceeded');const selected=p.resolve(callee)
   if(selected?.type==='CallExpression'){const binder=p.resolve(selected.callee);if(binder?.type==='MemberExpression'&&p.member(binder)==='bind')mutation(binder.object,[...selected.arguments.slice(1),...args],depth+1);return}
   if(selected?.type!=='MemberExpression')return
   const method=p.member(selected),owner=p.resolve(selected.object)
   if(p.builtin(owner,'Reflect')&&method==='apply'){const values=p.resolve(args[2]);need(values?.type==='ArrayExpression','unresolved reflected native mutator arguments');mutation(args[0],values.elements,depth+1);return}
   if(['call','apply'].includes(method)&&['MemberExpression','CallExpression'].includes(owner?.type)){if(method==='call')mutation(owner,args.slice(1),depth+1);else{const values=p.resolve(args[1]);need(values?.type==='ArrayExpression','unresolved native mutator apply arguments');mutation(owner,values.elements,depth+1)}return}
   if(!target(p,args[0]))return
   if(p.builtin(owner,'Object')&&['assign','defineProperties'].includes(method))for(const value of args.slice(1)){const object=p.resolve(value);need(object?.type==='ObjectExpression'&&object.properties.every(v=>v.type==='Property'&&field(p,v)!=null&&!protectedKeys.has(field(p,v))),'declared native state may be replaced by object mutation')}
   if(p.builtin(owner,'Object')&&method==='defineProperty'||p.builtin(owner,'Reflect')&&['set','defineProperty','deleteProperty'].includes(method))need(p.literal(args[1])!=null&&!protectedKeys.has(p.literal(args[1])),'declared native state may be replaced by property mutation')
  }
  for(const node of p.nodes.filter(n=>n.type==='CallExpression'))if(!permitted.has(node))mutation(node.callee,node.arguments)
 }
}
function builtinDependencies(programs){
 writes(programs,(p,n)=>p.builtin(n,'Object'),new Set(['assign','defineProperty','defineProperties']))
 writes(programs,(p,n)=>p.builtin(n,'Reflect'),new Set(['apply','set','defineProperty','deleteProperty']))
}

export function originalOwnDeclaration(d,board){
 const programs=nativePrograms(d.nodes(executable)),selected=programs.flatMap(p=>p.tree.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&rootPath(p,n.expression.left,['__ashbyBaseJobBoardUrl'])).map(n=>({p,node:n.expression}))),entry=one(selected,'actual own top-level native base declaration')
 need(entry.node.operator==='='&&entry.node.right.type==='Literal'&&entry.node.right.value===board,'own native literal board account differs')
 const references=programs.flatMap(p=>p.nodes.filter(n=>rootPath(p,n,['__ashbyBaseJobBoardUrl'])))
 need(references.length===1&&references[0]===entry.node.left,'own native base declaration is overwritten or escaped')
 need(!programs.some(p=>p.nodes.some(n=>rootPath(p,n,['__Ashby']))),'unqualified own native settings override')
 writes(programs,(p,n)=>p.global(n),dependencies,new Set([entry.node]));builtinDependencies(programs)
 return{board,script:entry.p.script,originalAssignment:entry.p.script.raw.slice(entry.node.start,entry.node.end)}
}

export function connectedEmbed(text,board,containerID){
 const programs=nativePrograms([{raw:text,attrs:{}}]),p=one(programs,'actual executable native client'),path=(n,names)=>rootPath(p,n,names),call=(n,names)=>n?.type==='CallExpression'&&path(n.callee,names)
 const exported=one(p.tree.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&path(n.expression.left,['__Ashby'])),'actual exported native client').expression,model=p.resolve(exported.right)
 need(exported.operator==='='&&model?.type==='ObjectExpression','exported native client is not the actual literal model')
 function slot(object,name){need(object?.type==='ObjectExpression','native connected object differs');return one(object.properties.filter(n=>n.type==='Property'&&field(p,n)===name),'native connected property '+name).value}
 function method(object,name){const value=slot(object,name);need(functions.has(value.type)&&value.body?.type==='BlockStatement','native connected method differs: '+name);return value}
 function owned(fn,type){return p.nodes.filter(n=>{if(n.type!==type)return false;let parent=p.parents.get(n);while(parent&&!functions.has(parent.type))parent=p.parents.get(parent);return parent===fn})}
 function abrupt(node,skipped){
  if(!node||skipped.has(node)||functions.has(node.type))return false
  if(['ReturnStatement','ThrowStatement','ContinueStatement'].includes(node.type))return true
  if(node.type==='IfStatement'&&node.test.type==='Literal')return abrupt(node.test.value?node.consequent:node.alternate,skipped)
  return Object.entries(node).filter(([key])=>!['start','end','raw'].includes(key)).some(([,value])=>(Array.isArray(value)?value:[value]).some(child=>child&&typeof child==='object'&&abrupt(child,skipped)))
 }
 function reaches(block,node,skipped=new Set()){
  let direct=node;while(direct&&p.parents.get(direct)!==block)direct=p.parents.get(direct)
  const index=block.body.indexOf(direct);need(index>=0&&block.body.slice(0,index).every(statement=>!abrupt(statement,skipped)),'actual native consumer is unreachable before an earlier return or throw')
 }
 const statementCall=(stat,names)=>stat?.type==='ExpressionStatement'&&call(stat.expression,names)
 const binding=(n,id)=>n?.type==='Identifier'&&p.binding(n)!=null&&p.binding(n)===p.binding(id)
 const frameFactory=n=>call(n,['__Ashby','iFrame'])&&n.arguments.length===0
 const frameMethod=(n,name)=>n?.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&p.member(n.callee)===name&&frameFactory(n.callee.object)
 const defaults=slot(model,'defaultSettings'),constants=slot(model,'constants'),initialize=method(model,'initialize'),frame=method(model,'iFrame'),builder=method(model,'buildIFrameUrl')
 const criticalSettings=new Set(['autoLoad','displayMode','jobPostingId','pageToShow','ashbyBaseJobBoardUrl']),absent=node=>p.builtin(node,'undefined')||p.resolve(node)?.type==='Literal'&&p.resolve(node).value==null
 need(p.literal(slot(model,'isInitialized'))===false,'native automatic initialization already disabled')
 need(p.literal(slot(defaults,'autoLoad'))===true&&p.literal(slot(defaults,'displayMode'))==='full-job-board','native current automatic board mode differs')
 need(absent(slot(defaults,'jobPostingId'))&&absent(slot(defaults,'pageToShow')),'native default settings select a particular role or application')
 const initialSettings=slot(model,'settings')
 function undefinedExpression(node){return p.builtin(node,'undefined')||node?.type==='UnaryExpression'&&node.operator==='void'&&p.literal(node.argument)===0}
 function initialSettingsObject(node){return node?.type==='ObjectExpression'&&node.properties.every(n=>n.type==='Property'&&field(p,n)!=null&&!criticalSettings.has(field(p,n)))}
 if(!initialSettingsObject(initialSettings)){
  const conditional=initialSettings.left,test=conditional?.test,first=test?.left,second=test?.right,alias=first?.left
  need(initialSettings.type==='LogicalExpression'&&initialSettings.operator==='||'&&initialSettingsObject(initialSettings.right)&&conditional?.type==='ConditionalExpression'&&test?.type==='LogicalExpression'&&test.operator==='||'&&first?.type==='BinaryExpression'&&first.operator==='==='&&first.right.type==='Literal'&&first.right.value===null&&alias?.type==='AssignmentExpression'&&alias.operator==='='&&alias.left.type==='Identifier'&&path(alias.right,['__Ashby'])&&second?.type==='BinaryExpression'&&second.operator==='==='&&binding(second.left,alias.left)&&undefinedExpression(second.right)&&undefinedExpression(conditional.consequent)&&conditional.alternate.type==='MemberExpression'&&binding(conditional.alternate.object,alias.left)&&p.member(conditional.alternate)==='settings'&&p.binding(alias.left)?.writes.length===1,'native initial settings override unfiltered automatic defaults')
 }
 need(p.literal(slot(constants,'IFRAME_CONTAINER_ID'))===containerID,'native current container is disconnected')
 const initializeSettings=one(initialize.body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&path(n.expression.left,['__Ashby','settings'])),'actual initialized native settings').expression
 const assign=initializeSettings.right;need(initializeSettings.operator==='='&&assign.type==='CallExpression'&&p.builtin(assign.callee.object,'Object')&&p.member(assign.callee)==='assign','native base settings are not the actual initializer')
 need(assign.arguments.length>=5&&assign.arguments[0]?.type==='ObjectExpression'&&assign.arguments[0].properties.length===0&&path(assign.arguments[1],['__Ashby','defaultSettings']),'native initializer defaults are disconnected')
 let searchSettings=0,currentSettings=0
 for(const overlay of assign.arguments.slice(2,-1)){
  const value=p.resolve(overlay)
  if(call(value,['__Ashby','getSettingsFromSearchParams'])){need(++searchSettings===1&&value.arguments.length===0,'native initializer search settings differ');continue}
  if(path(overlay,['__Ashby','settings'])){need(++currentSettings===1,'native initializer current settings differ');continue}
  need(value?.type==='ObjectExpression'&&value.properties.every(n=>n.type==='Property'&&field(p,n)!=null&&!criticalSettings.has(field(p,n))),'native initializer overlay replaces automatic or unfiltered settings')
 }
 need(searchSettings===1&&currentSettings===1,'native initializer omits actual settings consumers')
 const last=assign.arguments.at(-1);need(last?.type==='ConditionalExpression'&&path(last.test,['__ashbyBaseJobBoardUrl'])&&last.consequent.type==='ObjectExpression'&&path(slot(last.consequent,'ashbyBaseJobBoardUrl'),['__ashbyBaseJobBoardUrl']),'native own base is disconnected from initialized settings')
 const auto=one(initialize.body.body.filter(n=>n.type==='IfStatement'&&n.test.type==='BinaryExpression'&&n.test.operator==='==='&&path(n.test.left,['__Ashby','settings','autoLoad'])&&p.literal(n.test.right)===true),'actual current native auto-load condition')
 const initialLoad=one(auto.consequent.body.filter(n=>n.type==='IfStatement'&&n.test.type==='UnaryExpression'&&n.test.operator==='!'&&frameMethod(n.test.argument,'doesExist')),'actual current missing-frame branch')
 const loadStatement=one(initialLoad.consequent.body.filter(n=>n.type==='ExpressionStatement'&&frameMethod(n.expression,'load')&&n.expression.arguments.length===0),'actual auto-load invokes the returned consumer')
 const initializedGuard=one(initialize.body.body.filter(n=>n.type==='IfStatement'&&path(n.test,['__Ashby','isInitialized'])),'actual native initialization state guard')
 need(initializedGuard.consequent.type==='BlockStatement'&&initializedGuard.consequent.body.length===1&&initializedGuard.consequent.body[0].type==='ReturnStatement'&&initializedGuard.consequent.body[0].argument==null&&!initializedGuard.alternate,'native initialization guard differs')
 reaches(initialize.body,initializeSettings,new Set([initializedGuard]));reaches(initialize.body,auto,new Set([initializedGuard]));reaches(auto.consequent,initialLoad);reaches(initialLoad.consequent,loadStatement)
 const returns=frame.body.body.filter(n=>n.type==='ReturnStatement');const consumer=one(returns,'actual native iframe consumer').argument
 reaches(frame.body,returns[0])
 const getContainer=method(consumer,'getContainerElement'),containerReturn=one(getContainer.body.body.filter(n=>n.type==='ReturnStatement'),'actual native container return').argument
 need(containerReturn?.type==='CallExpression'&&p.builtin(containerReturn.callee.object,'document')&&p.member(containerReturn.callee)==='getElementById'&&path(containerReturn.arguments[0],['__Ashby','constants','IFRAME_CONTAINER_ID']),'native iframe owner is disconnected from current DOM')
 reaches(getContainer.body,one(getContainer.body.body.filter(n=>n.type==='ReturnStatement'),'reachable actual native container return'))
 const getIframe=method(consumer,'getIframeElement'),iframeReturn=one(getIframe.body.body.filter(n=>n.type==='ReturnStatement'),'actual native iframe existence owner').argument
 need(iframeReturn?.type==='CallExpression'&&p.builtin(iframeReturn.callee.object,'document')&&p.member(iframeReturn.callee)==='getElementById'&&path(iframeReturn.arguments[0],['__Ashby','constants','IFRAME_ELEMENT_ID'])&&typeof p.literal(slot(constants,'IFRAME_ELEMENT_ID'))==='string','native existing iframe lookup is disconnected')
 const exists=method(consumer,'doesExist'),existsContainer=one(owned(exists,'VariableDeclarator').filter(n=>frameMethod(n.init,'getContainerElement')),'actual frame-existence container'),existsFrame=one(owned(exists,'VariableDeclarator').filter(n=>frameMethod(n.init,'getIframeElement')),'actual frame-existence iframe'),existsReturn=one(owned(exists,'ReturnStatement'),'actual frame-existence return').argument
 const present=(node,id)=>node?.type==='BinaryExpression'&&['!=','!=='].includes(node.operator)&&binding(node.left,id)&&node.right.type==='Literal'&&node.right.value===null
 need(existsReturn?.type==='LogicalExpression'&&existsReturn.operator==='&&'&&present(existsReturn.left,existsContainer.id)&&present(existsReturn.right,existsFrame.id),'native missing-frame condition does not inspect actual DOM owners')
 const load=method(consumer,'load'),declarations=owned(load,'VariableDeclarator'),container=one(declarations.filter(n=>frameMethod(n.init,'getContainerElement')),'actual native iframe container binding'),iframe=one(declarations.filter(n=>n.init?.type==='CallExpression'&&p.builtin(n.init.callee.object,'document')&&p.member(n.init.callee)==='createElement'&&p.literal(n.init.arguments[0])==='iframe'),'actual created native iframe'),settings=one(declarations.filter(n=>n.init?.type==='CallExpression'&&p.builtin(n.init.callee.object,'Object')&&p.member(n.init.callee)==='assign'&&path(n.init.arguments[0],['__Ashby','settings'])),'actual consumer native settings')
 need(settings.init.arguments.length===4&&call(p.resolve(settings.init.arguments[1]),['__Ashby','getSettingsFromSearchParams'])&&frameMethod(p.resolve(settings.init.arguments[2]),'getSettingsFromContainer')&&binding(settings.init.arguments[3],load.params[0]),'native consumer settings have an unqualified base override')
 need(p.nodes.filter(n=>frameMethod(n,'load')).every(n=>n.arguments.length===0),'native actual load overrides automatic settings')
 for(const overlay of[method(model,'getSettingsFromSearchParams'),method(consumer,'getSettingsFromContainer')]){
  const record=one(owned(overlay,'VariableDeclarator').filter(n=>n.init?.type==='ObjectExpression'),'native returned parameter settings object')
  need(record.init.properties.every(n=>n.type==='Property'&&field(p,n)!=null&&field(p,n)!=='ashbyBaseJobBoardUrl')&&owned(overlay,'ReturnStatement').every(n=>binding(n.argument,record.id)),'native returned parameter settings replace the declared base')
  writes(programs,(q,n)=>q.resolve(n)===record.init,new Set(['ashbyBaseJobBoardUrl']))
 }
 writes(programs,(q,n)=>rootPath(q,n,['__Ashby','settings']),criticalSettings,new Set([settings.init]))
 writes(programs,(q,n)=>q.resolve(n)===iframe.init,new Set(['src','setAttribute','setAttributeNS','removeAttribute','removeAttributeNS']))
 const sourceStatement=one(load.body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.type==='MemberExpression'&&binding(n.expression.callee.object,iframe.id)&&p.member(n.expression.callee)==='setAttribute'&&p.literal(n.expression.arguments[0])==='src'),'actual native iframe source'),source=sourceStatement.expression.arguments[1]
 need(call(source,['__Ashby','buildIFrameUrl'])&&binding(source.arguments[0],settings.id),'actual native frame source is disconnected from the configured URL builder')
 const append=one(load.body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.type==='MemberExpression'&&binding(n.expression.callee.object,container.id)&&p.member(n.expression.callee)==='appendChild'&&binding(n.expression.arguments[0],iframe.id)),'native iframe has a connected DOM consumer')
 const missingContainer=new Set(load.body.body.filter(n=>n.type==='IfStatement'&&n.test.type==='BinaryExpression'&&['==','==='].includes(n.test.operator)&&binding(n.test.left,container.id)&&n.test.right.type==='Literal'&&n.test.right.value===null))
 reaches(load.body,sourceStatement,missingContainer);reaches(load.body,append,missingContainer);need(sourceStatement.start<append.start,'native iframe source is set after its DOM consumer')
 function invocation(callee,args,receiver=null,depth=0){
  need(depth<=12,'finite actual native DOM invocation scope exceeded');const selected=p.resolve(callee)
  if(selected?.type==='CallExpression'){const binder=p.resolve(selected.callee);return binder?.type==='MemberExpression'&&p.member(binder)==='bind'?invocation(binder.object,[...selected.arguments.slice(1),...args],selected.arguments[0],depth+1):null}
  if(selected?.type!=='MemberExpression')return null
  const name=p.member(selected),owner=p.resolve(selected.object)
  if(p.builtin(owner,'Reflect')&&name==='apply'){const values=p.resolve(args[2]);need(values?.type==='ArrayExpression','unresolved reflected native DOM arguments');return invocation(args[0],values.elements,args[1],depth+1)}
  if(['call','apply'].includes(name)&&['MemberExpression','CallExpression'].includes(owner?.type)){if(name==='call')return invocation(owner,args.slice(1),args[0],depth+1);const values=p.resolve(args[1]);need(values?.type==='ArrayExpression','unresolved applied native DOM arguments');return invocation(owner,values.elements,args[0],depth+1)}
  return{owner:p.resolve(receiver??owner),name,args}
 }
 for(const node of p.nodes.filter(n=>n.type==='CallExpression')){const call=invocation(node.callee,node.arguments);if(call?.owner!==iframe.init||!['setAttribute','setAttributeNS','removeAttribute','removeAttributeNS','toggleAttribute'].includes(call.name))continue;const name=p.literal(call.args[call.name.endsWith('NS')?1:0]);need(typeof name==='string'&&(name.toLowerCase()!=='src'||node===sourceStatement.expression),'actual native iframe source is replaced by a direct or bound DOM setter')}
 need(builder.params[0]?.type==='Identifier','native URL settings parameter missing')
 const base=one(owned(builder,'VariableDeclarator').filter(n=>n.init?.type==='MemberExpression'&&binding(n.init.object,builder.params[0])&&p.member(n.init)==='ashbyBaseJobBoardUrl'),'actual configured URL base'),built=one(owned(builder,'VariableDeclarator').filter(n=>n.init?.type==='NewExpression'&&p.builtin(n.init.callee,'URL')&&binding(n.init.arguments[0],base.id)),'actual configured URL constructor')
 writes(programs,(q,n)=>q.resolve(n)===built.init,new Set(['href','host','hostname','origin','protocol','pathname','port','username','password']))
 need(builder.body.body.some(n=>n.type==='ReturnStatement'&&n.argument?.type==='MemberExpression'&&binding(n.argument.object,built.id)&&p.member(n.argument)==='href'),'native URL constructor is disconnected from returned source')
 for(const write of owned(builder,'AssignmentExpression').filter(n=>binding(n.left,base.id))){let guard=p.parents.get(write);while(guard&&guard!==builder&&!(guard.type==='IfStatement'&&guard.test.type==='MemberExpression'&&binding(guard.test.object,builder.params[0])&&p.member(guard.test)==='jobPostingId'&&write.start>=guard.consequent.start&&write.end<=guard.consequent.end))guard=p.parents.get(guard);need(guard&&guard!==builder&&write.operator==='='&&write.right.type==='TemplateLiteral'&&write.right.quasis[0].value.cooked===''&&binding(write.right.expressions[0],base.id)&&write.right.quasis.every(q=>!q.value.cooked.includes('://')),'native builder changes the actual unfiltered declared base path or origin')}
 for(const write of owned(builder,'AssignmentExpression'))if(write.left?.type==='MemberExpression'&&binding(write.left.object,built.id))need(false,'native returned URL has an unqualified direct replacement')
 const start=one(p.tree.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.arguments.length===0&&functions.has(n.expression.callee.type)),'actual connected native initialization').expression.callee
 const ready=one(start.body.body.filter(n=>n.type==='IfStatement'&&n.test.type==='BinaryExpression'&&n.test.operator==='==='&&n.test.left.type==='MemberExpression'&&p.builtin(n.test.left.object,'document')&&p.member(n.test.left)==='readyState'&&p.literal(n.test.right)==='complete'),'actual native readiness branch')
 need(ready.consequent.body.some(n=>statementCall(n,['__Ashby','initialize'])),'native initializer is not invoked at current readiness')
 for(const event of['DOMContentLoaded','load'])need(ready.alternate.body.some(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&p.builtin(n.expression.callee,'addEventListener')&&p.literal(n.expression.arguments[0])===event&&path(n.expression.arguments[1],['__Ashby','initialize'])),'native initializer is not the registered readiness consumer')
 const fallback=one(p.tree.body.filter(n=>n.type==='IfStatement'&&n.test.type==='UnaryExpression'&&n.test.operator==='!'&&path(n.test.argument,['__ashbyBaseJobBoardUrl'])),'actual guarded native base fallback'),fallbackWrite=one(fallback.consequent.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&path(n.expression.left,['__ashbyBaseJobBoardUrl'])),'actual guarded native base').expression
 need(fallbackWrite.operator==='='&&p.literal(fallbackWrite.right)===board,'native fallback declares another account')
 writes(programs,(q,n)=>q.global(n),dependencies,new Set([exported,fallbackWrite]));builtinDependencies(programs)
 const initializedWrite=one(owned(initialize,'AssignmentExpression').filter(n=>path(n.left,['__Ashby','isInitialized'])),'actual initialized state transition');need(initializedWrite.operator==='='&&p.literal(initializedWrite.right)===true&&initializedWrite.start>initializeSettings.end&&initializedWrite.end<auto.start,'native initialized state transition differs')
 writes(programs,(q,n)=>q.resolve(n)===model||rootPath(q,n,['__Ashby']),new Set(['buildIFrameUrl','iFrame','initialize','defaultSettings','constants','settings','isInitialized']),new Set([initializeSettings,initializedWrite]))
 writes(programs,(q,n)=>q.resolve(n)===defaults||rootPath(q,n,['__Ashby','defaultSettings']),criticalSettings)
 writes(programs,(q,n)=>q.resolve(n)===constants||rootPath(q,n,['__Ashby','constants']),new Set(['IFRAME_CONTAINER_ID','IFRAME_ELEMENT_ID']))
 return{connectedStaticConsumer:true,executed:false,board,containerID,consumer:'registered-initialize/automatic-returned-iframe-load/declared-base-settings/URL-builder/src/appendChild',originalExport:text.slice(exported.start,exported.end),originalBaseConsumer:text.slice(last.start,last.end),originalIframeSource:text.slice(source.start,source.end)}
}
