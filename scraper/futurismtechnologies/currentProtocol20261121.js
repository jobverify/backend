import fs from 'node:fs'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

export const CAREERS_URL='https://www.futurismtechnologies.com/careers/'
export const TENANT='futurismtechnologies'
export const NATIVE_ORIGIN='https://'+TENANT+'.mynexthire.com'
const need=(ok,message)=>{if(!ok)throw Error('Futurism native publication: '+message)}
const one=(rows,message)=>{need(rows.length===1,message);return rows[0]}
const ast=source=>parse(source,{ecmaVersion:'latest',sourceType:'script'})
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,visit));else if(value&&typeof value==='object')walk(value,visit)}
const key=node=>node?.computed?node.property?.value:node?.property?.name
const isMember=(node,owner,name)=>node?.type==='MemberExpression'&&node.object?.name===owner&&key(node)===name
const assignments=(tree,owner,name)=>{const values=[];walk(tree,node=>{if(node.type==='AssignmentExpression'&&isMember(node.left,owner,name))values.push(node)});return values}
const functionAssignment=(tree,owner,name)=>{const found=one(assignments(tree,owner,name),'unique '+owner+'.'+name);need(tree.body.some(statement=>statement.type==='ExpressionStatement'&&statement.expression===found)&&found.operator==='='&&found.right.type==='FunctionExpression','executed literal '+name+' function');return found.right}
const functionNamed=(tree,name)=>one(tree.body.filter(node=>node.type==='FunctionDeclaration'&&node.id?.name===name),'active '+name)
const contains=(tree,predicate)=>{let yes=false;walk(tree,node=>{if(predicate(node))yes=true});return yes}
const canonical=node=>{
 const scopes=new WeakMap(),definitions=new WeakMap(),labels=new Map()
 let serial=0
 const scope=(parent,fn=false)=>({parent,fn,bindings:new Map()})
 const root=scope(null,true)
 const bind=(id,current,kind='let')=>{
  if(id?.type==='AssignmentPattern')return bind(id.left,current,kind)
  need(id?.type==='Identifier','simple lexical routing bindings')
  let target=current;if(kind==='var')while(!target.fn&&target.parent)target=target.parent
  let binding=target.bindings.get(id.name)
  if(!binding){binding={label:'binding'+serial++};target.bindings.set(id.name,binding)}
  definitions.set(id,binding)
 }
 const build=(n,current,parent)=>{
  if(!n||typeof n!=='object')return
  if(Array.isArray(n)){n.forEach(x=>build(x,current,parent));return}
  if(/Function(?:Expression|Declaration)$/.test(n.type)||n.type==='ArrowFunctionExpression'){
   if(n.type==='FunctionDeclaration'&&n.id)bind(n.id,current,'var')
   const inner=scope(current,true);scopes.set(n,inner)
   if(n.type==='FunctionExpression'&&n.id)bind(n.id,inner)
   for(const p of n.params)bind(p,inner)
   for(const p of n.params)if(p.type==='AssignmentPattern')build(p.right,inner,p,'right')
   build(n.body,inner,n,'body');return
  }
  if(n.type==='BlockStatement')current=scope(current)
  scopes.set(n,current)
  if(n.type==='VariableDeclarator')bind(n.id,current,parent.kind)
  for(const[k,v]of Object.entries(n))if(!['start','end','loc','raw'].includes(k))build(v,current,n,k)
 }
 build(node,root)
 const lookup=(name,current)=>{for(;current;current=current.parent)if(current.bindings.has(name))return current.bindings.get(name)}
 const visit=(n,parent,field,current=root)=>{
  if(Array.isArray(n))return n.map(x=>visit(x,parent,field,current))
  if(!n||typeof n!=='object')return n
  current=scopes.get(n)??current
  if(n.type==='Identifier'){
   const property=(parent?.type==='MemberExpression'&&field==='property'&&!parent.computed)||(parent?.type==='Property'&&field==='key'&&!parent.computed)
   const binding=property?null:definitions.get(n)??lookup(n.name,current)
   if(binding)labels.set(binding,binding.label)
   return{type:n.type,name:binding?labels.get(binding):n.name}
  }
  return Object.fromEntries(Object.entries(n).filter(([k])=>!['start','end','loc','raw'].includes(k)).map(([k,v])=>[k,visit(v,n,k,current)]))
 }
 return visit(node)
}
const normal=node=>JSON.stringify(canonical(node))
const projection=(fn,statements)=>({...fn,body:{...fn.body,body:statements}})

export function relevantProtocolParts({integration,controller,encoder,globalClient}){
 const i=ast(integration),wholeC=ast(controller),wholeE=ast(encoder),g=ast(globalClient),parts={}
 const moduleCreation=(tree,moduleName)=>{
  const declarations=tree.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations)
  const creation=one(declarations.filter(node=>node.init?.type==='CallExpression'&&isMember(node.init.callee,'angular','module')&&node.init.arguments[0]?.value===moduleName&&node.init.arguments.length===2),'active native '+moduleName+' module creation')
  const config=creation.init.arguments[1]
  need(config?.type==='MemberExpression'&&key(config)===moduleName&&isMember(config.object,'__st_global_app_manager','dependencies'),'native '+moduleName+' declared dependency source')
  const resets=[];walk(tree,node=>{if(node.type==='CallExpression'&&isMember(node.callee,'angular','module')&&node.arguments[0]?.value===moduleName&&node.arguments.length>1)resets.push(node)})
  need(resets.length===1&&resets[0]===creation.init,'unique native '+moduleName+' module initialization')
  need(!contains(tree,node=>(node.type==='AssignmentExpression'&&node.left?.name===creation.id.name)||(node.type==='UpdateExpression'&&node.argument?.name===creation.id.name)),'native module receiver reassignment')
  return creation
 }
 const careerModule=moduleCreation(wholeC,'careersApp'),encoderModule=moduleCreation(wholeE,'encoderApp')
 const manager=functionNamed(g,'_st_global_class_app_manager')
 const managerInitializers=g.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).filter(node=>node.id.name==='__st_global_app_manager')
 const managerInit=one(managerInitializers,'active native dependency manager')
 need(managerInit.init?.type==='NewExpression'&&managerInit.init.callee.name==='_st_global_class_app_manager'&&managerInit.init.arguments.length===0,'consumed native dependency manager')
 const dependencies=manager.body.body.filter(node=>node.type==='ExpressionStatement').map(node=>node.expression).filter(node=>node.type==='AssignmentExpression'&&node.operator==='='&&node.left?.type==='MemberExpression'&&key(node.left)==='careersApp'&&node.left.object?.type==='MemberExpression'&&key(node.left.object)==='dependencies'&&node.left.object.object?.type==='ThisExpression')
 const nativeDependencies=one(dependencies,'current native application dependencies').right
 need(nativeDependencies.type==='ArrayExpression'&&nativeDependencies.elements.every(node=>node.type==='Literal'&&typeof node.value==='string')&&nativeDependencies.elements.some(node=>node.value==='encoderApp'),'native careersApp consumes the declared encoderApp')
 const registration=(tree,kind,name)=>{
  const calls=tree.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='CallExpression'&&key(node.expression.callee)===kind&&node.expression.arguments[0]?.value===name).map(node=>node.expression)
  const call=one(calls,'executed top-level '+name+' registration')
  need(call.arguments.length===2,'closed '+name+' registration arguments')
  const expected=name==='encoderFactory'?'encoderApp':'careersApp',creation=name==='encoderFactory'?encoderModule:careerModule,receiver=call.callee.object
  need(receiver?.type==='CallExpression'&&isMember(receiver.callee,'angular','module')&&receiver.arguments.length===1&&receiver.arguments[0]?.value===expected||receiver?.type==='Identifier'&&receiver.name===creation.id.name,'native '+name+' Angular module receiver')
  const injected=call.arguments[1],fn=injected.type==='FunctionExpression'?injected:injected.type==='ArrayExpression'?injected.elements.at(-1):null
  need(fn?.type==='FunctionExpression','literal active '+name+' initializer')
  return{fn,injected}
 }
 const factoryRegistration=registration(wholeC,'factory','careersFactory'),encoderRegistration=registration(wholeE,'factory','encoderFactory'),controllerRegistration=registration(wholeC,'controller','careersController')
 const f=factoryRegistration.fn.body,e=encoderRegistration.fn.body,c=controllerRegistration.fn.body
 for(const[body,owner]of [[f,'careersFactory'],[e,'encoderFactory']]){
  const returns=[]
  const owned=node=>{if(!node||typeof node!=='object'||/Function/.test(node.type))return;if(node.type==='ReturnStatement')returns.push(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(owned);else if(value&&typeof value==='object')owned(value)}
  owned(body);need(returns.length===1&&body.body.at(-1)===returns[0]&&returns[0].argument?.name===owner,'consumed current '+owner+' service identity')
 }
 parts.iframeRouting=functionNamed(i,'mnh_ci_onreadystatechange')
 for(const name of ['getClientDetails','getRequisitionList','getRequisitionV2','getMSBaseUrl'])parts[name]=functionAssignment(f,'careersFactory',name)
 for(const name of ['getQStringObject','encodeJson','getEncodedJobboardLink'])parts[name]=functionAssignment(e,'encoderFactory',name)
 const prefix=one(wholeE.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='CallExpression'&&node.expression.callee.type==='FunctionExpression'),'single published Base64 encoding library')
 parts.base64Encoding=prefix
 const server=functionNamed(g,'_st_global_detect_server'),fields=new Set(['isLocalHost','isIqa','host','protocol','employerShortName','qualifiedEmployerShortName'])
 const selected=server.body.body.filter(node=>node.type==='VariableDeclaration'&&node.declarations.some(d=>['localhostInstance','winLocation','mnhServer'].includes(d.id.name))||contains(node,n=>n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.object.name==='mnhServer'&&fields.has(key(n)))||node.type==='ReturnStatement')
 parts.nativeTenantRouting=projection(server,selected.map(node=>{
  const copy=structuredClone(node)
  if(copy.type==='VariableDeclaration')for(const d of copy.declarations)if(d.id.name==='mnhServer')d.init.properties=d.init.properties.filter(p=>['host','protocol','employerShortName'].includes(p.key.value??p.key.name))
  return copy
 }))
 const bindServices=(registration,services)=>{
  const{fn,injected}=registration
  if(injected.type==='ArrayExpression')need(injected.elements.length===fn.params.length+1&&injected.elements.slice(0,-1).every(n=>n.type==='Literal'&&typeof n.value==='string'),'closed native dependency injection')
  for(const name of services){
   if(injected.type==='FunctionExpression')need(fn.params.some(p=>p.name===name),'implicit current '+name+' dependency')
   else{const index=injected.elements.findIndex(n=>n?.value===name);need(index>=0&&fn.params[index]?.name===name,'resolved current '+name+' dependency')}
  }
 }
 bindServices(factoryRegistration,['$http','$window','encoderFactory'])
 bindServices(controllerRegistration,['$scope','$sanitize','careersFactory','encoderFactory'])
 for(const dependency of ['$http','$window','encoderFactory'])need(!contains(f,n=>(n.type==='AssignmentExpression'||n.type==='UpdateExpression')&&n.left?.type==='Identifier'&&n.left.name===dependency),'native transport dependency reassignment')
 const serverInitializers=g.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).filter(node=>node.id.name==='$mnh')
 const nativeServer=one(serverInitializers,'active native server initialization')
 need(nativeServer.init?.type==='CallExpression'&&nativeServer.init.callee.name==='_st_global_detect_server'&&nativeServer.init.arguments.length===0,'consumed native hostname routing')
 need(!contains(g,n=>n.type==='AssignmentExpression'&&(n.left?.name==='$mnh'||n.left.type==='MemberExpression'&&n.left.object.name==='$mnh'&&fields.has(key(n)))),'native routing override')
 const baseWrites=assignments(f,'careersFactory','smaclifyUrl')
 need(baseWrites.length===2,'closed native origin assignments')
 parts.nativeOrigin=baseWrites.map(node=>node.right)
 const list=functionAssignment(c,'$scope','getReqsList')
 const listCall=one(list.body.body.filter(node=>contains(node,n=>n.type==='CallExpression'&&isMember(n.callee,'careersFactory','getRequisitionList'))),'single consumed native list call')
 const index=list.body.body.indexOf(listCall)
 const call=one((()=>{const rows=[];walk(listCall,n=>{if(n.type==='CallExpression'&&isMember(n.callee,'careersFactory','getRequisitionList'))rows.push(n)});return rows})(),'one native list transport')
 need(call.arguments.length===1,'native list arguments')
 parts.listInput=projection(list,[...list.body.body.slice(0,index),{type:'ReturnStatement',argument:call}])
 const callbacks=[];walk(listCall,n=>{if(n.type==='CallExpression'&&key(n.callee)==='then')callbacks.push(n.arguments[0])})
 const callback=one(callbacks,'list response callback')
 parts.listConsumer=projection(callback,callback.body.body.slice(0,2))
 const detail=functionAssignment(c,'$scope','getRequisition')
 const detailStart=detail.body.body.findIndex(node=>node.type==='VariableDeclaration'&&node.declarations.some(d=>d.id.name==='input'))
 const detailEnd=detail.body.body.findIndex(node=>node.type==='VariableDeclaration'&&node.declarations.some(d=>d.id.name==='getRequisition'))
 need(detailStart>=0&&detailEnd>detailStart,'closed native detail input construction')
 parts.detailInput=projection(detail,detail.body.body.slice(detailStart,detailEnd+1))

 // Prototype methods are explicit active assignments, rather than text matches.
 const prototypeFunction=(owner,name)=>{
  const rows=c.body.filter(node=>node.type==='ExpressionStatement').map(node=>node.expression).filter(node=>node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&key(node.left)===name&&isMember(node.left.object,owner,'prototype')).map(node=>node.right)
  return one(rows,'unique native '+name)
 }
 parts.applicationRoute=prototypeFunction('basePageClass','getALink')
 parts.roleLink=projection(prototypeFunction('reqsListPageClass','goToJDPage'),prototypeFunction('reqsListPageClass','goToJDPage').body.body.slice(0,5))
 parts.applicationLink=projection(prototypeFunction('requisitionPageClass','goToApplicationPage'),prototypeFunction('requisitionPageClass','goToApplicationPage').body.body.slice(0,5))
 return parts
}

export function readRelevantProtocol(programmes){
 const actual=relevantProtocolParts(programmes)
 const reviewed=JSON.parse(fs.readFileSync(new URL('./reviewedProtocol20261121.json',import.meta.url)))
 for(const[name,value]of Object.entries(reviewed.parts))need(normal(actual[name])===JSON.stringify(value),'relevant '+name+' request/identity/application contract changed')
 return{tenant:TENANT,nativeOrigin:NATIVE_ORIGIN,accountURL:NATIVE_ORIGIN+'/employer/jobboard/details_by_shortname/get/'+TENANT+'/',listURL:NATIVE_ORIGIN+'/employer/careers/reqlist/get',
  detailURL:'https://'+TENANT+'.prod.us1.mynexthire.io/d17/careers/requisition/object',listInput:{source:'careers',code:'',filterByBuId:-1},
  detailInput:reqId=>({source:'careers',id:'',code:'',reqId}),protocolScope:'Only published iframe routing, anonymous request construction and row-bound JD/application link consumers; no whole-client/UI fingerprint or browser-equivalence claim.'}
}
export const canonicalProtocol=canonical

const scriptURL=(document,path,base)=>new URL(one(document.nodes(node=>node.tag==='script'&&node.attrs.src&&new URL(node.attrs.src,base).pathname===path),'unique declared '+path).attrs.src,base).href
export function readCorporate(html){
 const document=readNativeDocument(html),visible=readVisibleNativeDocument(html)
 need(one(document.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'own canonical').attrs.href===CAREERS_URL,'own canonical URL')
 need(/Career.*Current Openings.*Futurism Technologies/.test(one(document.nodes(n=>n.tag==='title'),'own title').raw),'own careers publisher title')
 const frame=one(visible.frames().filter(n=>n.attrs.id==='mnhembedded'),'active native careers frame')
 need(frame.tag==='iframe'&&frame.attrs.src===''&&frame.attrs['mnh-jd-list-view']==='table','current public listing frame')
 const initializers=[]
 for(const script of document.nodes(n=>n.tag==='script'&&!n.attrs.src&&(!n.attrs.type||['text/javascript','application/javascript'].includes(n.attrs.type)))){
  const source=script.raw??'';if(!source.includes('mnh_ci_onreadystatechange'))continue
  const tree=ast(source)
  const expected=ast('document.onreadystatechange = function(e){if(document.readyState === "complete"){mnh_ci_onreadystatechange("careers","futurismtechnologies");}};')
  need(normal(tree)===normal(expected),'active ready-state recruitment initializer')
  walk(tree,node=>{if(node.type==='CallExpression'&&node.callee.name==='mnh_ci_onreadystatechange')initializers.push(node)})
  need(tree.body.length===1&&tree.body[0].type==='ExpressionStatement'&&tree.body[0].expression.type==='AssignmentExpression'&&isMember(tree.body[0].expression.left,'document','onreadystatechange'),'executed native initializer carrier')
 }
 const init=one(initializers,'one active native initializer')
 need(init.arguments.length===2&&init.arguments[0].value==='careers'&&init.arguments[1].value===TENANT,'own native recruitment account')
 const integration=scriptURL(document,'/employer/ui/js/jobboard/careers-integration.js',CAREERS_URL)
 need(new URL(integration).origin===NATIVE_ORIGIN,'declared native integration owner')
 return{integration,portal:NATIVE_ORIGIN+'/employer/jobs/careers',tenant:TENANT}
}
export function readBoard(html){
 const document=readNativeDocument(html),visible=readVisibleNativeDocument(html)
 one(visible.nodes(n=>n.attrs['ng-app']==='careersApp'&&n.attrs['ng-controller']==='careersController'),'active native controller mount')
 const scripts=Object.fromEntries([['controller','/employer/ui/js/jobboard/careers.js'],['encoder','/employer/ui/js/wowjsons/encoder.js'],['globalClient','/employer/ui/js/wow/wow-global-classes.js']].map(([key,path])=>{
  const url=scriptURL(document,path,NATIVE_ORIGIN);need(new URL(url).origin===NATIVE_ORIGIN,'same native programme owner');return[key,url]
 }))
 const template=name=>{
  const node=one(document.nodes(n=>n.attrs['ng-include']!==undefined&&n.attrs.src==="'/employer/ui/html/jobboard/careers/"+name+".html'"),'active native '+name+' declaration')
  need(node.attrs.src.startsWith("'")&&node.attrs.src.endsWith("'"),'literal template URL');return new URL(node.attrs.src.slice(1,-1),NATIVE_ORIGIN).href
 }
 return{...scripts,listTemplate:template('careers-jobs-table'),detailTemplate:template('careers-jd')}
}
export function readDetailTemplate(html){
 const doc=readNativeDocument(html)
 one(doc.nodes(n=>n.attrs['ng-bind-html']==='thePage.reqData.jdDisplay'),'full native criteria renderer')
 const button=one(doc.nodes(n=>n.tag==='button'&&n.attrs['ng-click']==='thePage.goToApplicationPage(thePage.reqData.reqId)'),'row-bound apply control')
 need(!Object.hasOwn(button.attrs,'disabled')&&button.attrs.type==='button','active native apply button')
 need(button.attrs['ng-disabled']==="during.getRequisition || (basePage.basePageVars.qStringContext.cvSource != 'careers' && (thePage.reqData.activeApplicationCount >= thePage.reqData.maxActiveApplication))",'careers apply enablement')
 return{criteria:'reqDetailsBO.jdDisplay',application:'row-bound active native application URL; no submission or browser execution performed'}
}
export function nativeRoleLink(reqId,pageType){
 need(Number.isSafeInteger(reqId)&&reqId>0&&['jd','application'].includes(pageType),'typed role link')
 const q={pageType,cvSource:'careers',reqId,requester:{id:'',code:'',name:''},page:'careers',bufilter:-1,customFields:{}}
 return CAREERS_URL+'?src%3Dcareers%26p%3D'+Buffer.from(JSON.stringify(q)).toString('base64')
}
