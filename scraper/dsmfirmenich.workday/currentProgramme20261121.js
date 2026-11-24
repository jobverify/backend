import fs from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure('dsmfirmenich','Current public programme: '+message)}
const key=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?n.value:null
const id=(n,name)=>n?.type==='Identifier'&&n.name===name
const mem=(n,name)=>n?.type==='MemberExpression'&&!n.computed&&key(n.property)===name
const obj=n=>n?.type==='ObjectExpression'&&n.properties.every(p=>p.type==='Property'&&!p.computed&&p.kind==='init')?new Map(n.properties.map(p=>[key(p.key),p.value])):null
const one=(a,label)=>{need(a.length===1,label);return a[0]}
const fns=new Set(['FunctionExpression','FunctionDeclaration','ArrowFunctionExpression'])
const seq=n=>n?.type==='SequenceExpression'?n.expressions.flatMap(seq):[n]
const expressions=b=>b.body.filter(n=>n.type==='ExpressionStatement').flatMap(n=>seq(n.expression))
const zero=n=>n?.type==='SequenceExpression'&&n.expressions.length===2&&n.expressions[0].value===0?n.expressions[1]:null
const boundNames=n=>!n?[]:n.type==='Identifier'?[n.name]:n.type==='ObjectPattern'?n.properties.flatMap(p=>boundNames(p.value??p.argument)):n.type==='ArrayPattern'?n.elements.flatMap(boundNames):n.type==='AssignmentPattern'?boundNames(n.left):n.type==='RestElement'?boundNames(n.argument):[]
function tree(source){
 need(typeof source==='string'&&source.length>0&&source.length<2*1024*1024,'bounded original programme required')
 let ast;try{ast=parse(source,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,'invalid native JavaScript')}
 const all=[],parents=new WeakMap(),spans=new WeakMap(),subtrees=new WeakMap()
 const walk=(n,p)=>{if(!n||typeof n!=='object'||!n.type)return;const start=all.length;all.push(n);if(p)parents.set(n,p);for(const[k,v]of Object.entries(n))if(!['start','end'].includes(k)){if(Array.isArray(v))v.forEach(x=>walk(x,n));else walk(v,n)}spans.set(n,{start,end:all.length})};walk(ast)
 const inside=(n,root)=>{const a=spans.get(n),b=spans.get(root);return !!a&&!!b&&a.start>=b.start&&a.start<b.end}
 const within=root=>{if(!root)return[];if(!subtrees.has(root)){const s=spans.get(root);subtrees.set(root,s?all.slice(s.start,s.end):[])}return subtrees.get(root)}
 const enclosing=(n,predicate)=>{for(let p=parents.get(n);p;p=parents.get(p))if(predicate(p))return p;return null}
 return{source,ast,all,parents,inside,within,enclosing}
}
const moduleMap=object=>{const entries=object.properties.map(p=>{need(p.type==='Property'&&!p.computed&&p.kind==='init'&&p.value.type==='FunctionExpression'&&p.value.params.length<=3&&p.value.params.every(n=>n.type==='Identifier'),'literal native module factories required');return[key(p.key),p.value]});need(new Set(entries.map(([k])=>k)).size===entries.length,'duplicate native module identity');return new Map(entries)}
function chunk(source){
 const t=tree(source),call=one(expressions(t.ast).filter(n=>n.type==='CallExpression'&&mem(n.callee,'push')),'one active top-level native webpack carrier required'),receiver=call.callee.object
 need(receiver?.type==='AssignmentExpression'&&receiver.operator==='='&&mem(receiver.left,'webpackChunkpcsxPwa')&&id(receiver.left.object,'self')&&receiver.right?.type==='LogicalExpression'&&receiver.right.operator==='||'&&mem(receiver.right.left,'webpackChunkpcsxPwa')&&id(receiver.right.left.object,'self')&&receiver.right.right?.type==='ArrayExpression'&&!receiver.right.right.elements.length&&call.arguments.length===1,'active public native registry required')
 const parts=call.arguments[0]?.elements
 need(call.arguments[0]?.type==='ArrayExpression'&&parts.length===2&&parts[0]?.type==='ArrayExpression'&&parts[0].elements.length===1&&parts[0].elements[0]?.type==='Literal'&&parts[1]?.type==='ObjectExpression','native dependency carrier changed')
 return{...t,chunkID:String(parts[0].elements[0].value),modules:moduleMap(parts[1])}
}
// Normalize only the closed recruitment URL/identity expressions below.
// Property names, literal authority, operators and dataflow remain significant;
// minifier identifiers, source positions, comments and formatting do not.
function canonical(node,roles={}){
 const names=new Map(Object.entries(roles)),globals=new Set(['String','Number','URLSearchParams','window','Object','encodeURIComponent','undefined'])
 const normalize=(n,parent,k)=>{
  if(n===null||typeof n!=='object')return n
  if(Array.isArray(n))return n.map(x=>normalize(x,parent,k))
  if(n.type==='Identifier'){
   if(parent?.type==='MemberExpression'&&k==='property'&&!parent.computed||parent?.type==='Property'&&k==='key'&&!parent.computed)return{type:'Identifier',name:n.name}
   if(!names.has(n.name))names.set(n.name,globals.has(n.name)?n.name:'binding'+names.size)
   return{type:'Identifier',name:names.get(n.name)}
  }
  return Object.fromEntries(Object.entries(n).filter(([k])=>!['start','end','raw'].includes(k)).map(([k,v])=>[k,k==='shorthand'?false:normalize(v,n,k)]))
 }
 return normalize(node,null,'')
}
function declarations(t,factory){return factory.body.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations)}
function importedModule(t,factory,namespace){
 need(factory.params.length===3,'native imported module binding unavailable')
 const d=one(declarations(t,factory).filter(d=>id(d.id,namespace)&&d.init?.type==='CallExpression'&&id(d.init.callee,factory.params[2].name)&&d.init.arguments.length===1&&d.init.arguments[0].type==='Literal'),'actual imported native module required')
 return d.init.arguments[0].value
}
function exportedFunction(t,factory,exportName){
 need(factory.params.length===3,'native exported module binding unavailable')
 const d=one(expressions(factory.body).filter(n=>n.type==='CallExpression'&&mem(n.callee,'d')&&id(n.callee.object,factory.params[2].name)&&n.arguments.length===2&&id(n.arguments[0],factory.params[1].name)&&obj(n.arguments[1])?.has(exportName)),'active native export required')
 const getter=obj(d.arguments[1]).get(exportName)
 need(getter?.type==='ArrowFunctionExpression'&&getter.params.length===0&&getter.body.type==='Identifier','literal native export getter required')
 const decl=one([...declarations(t,factory),...factory.body.body.filter(n=>n.type==='FunctionDeclaration')].filter(d=>id(d.id,getter.body.name)),'direct exported component declaration required')
 const fn=decl.type==='FunctionDeclaration'?decl:fns.has(decl.init?.type)?decl.init:decl.init?.type==='CallExpression'&&decl.init.arguments.length===1&&fns.has(decl.init.arguments[0].type)?decl.init.arguments[0]:null
 need(fn,'exported native component function required');return{fn,name:decl.id.name}
}
function consumes(t,fn,binding){
 const returned=fn.body.type==='BlockStatement'?fn.body.body.filter(n=>n.type==='ReturnStatement').map(n=>n.argument):[fn.body]
 return returned.some(root=>t.within(root).some(n=>n.type==='CallExpression'&&mem(n.callee,'createElement')&&t.enclosing(n,p=>fns.has(p.type))===fn&&id(n.arguments[0],binding)))
}
function reachesComponent(t,factory,start,target){
 const seen=new Set(),queue=[{fn:start,depth:0}]
 const local=[...declarations(t,factory),...factory.body.body.filter(n=>n.type==='FunctionDeclaration')]
 while(queue.length){
  const{fn,depth}=queue.shift();if(seen.has(fn)||depth>8)continue;seen.add(fn)
  if(consumes(t,fn,target))return true
  for(const declaration of local){
   if(!consumes(t,fn,declaration.id.name))continue
   const value=declaration.init,next=declaration.type==='FunctionDeclaration'?declaration:fns.has(value?.type)?value:value?.type==='CallExpression'&&value.arguments.length===1&&fns.has(value.arguments[0].type)?value.arguments[0]:null
   if(next)queue.push({fn:next,depth:depth+1})
  }
 }
 return false
}
function noWrites(t,root,names){
 const base=n=>n?.type==='Identifier'?n.name:n?.type==='MemberExpression'?base(n.object):null
 const bound=n=>!n?[]:n.type==='Identifier'?[n.name]:n.type==='ObjectPattern'?n.properties.flatMap(p=>bound(p.value??p.argument)):n.type==='ArrayPattern'?n.elements.flatMap(bound):n.type==='AssignmentPattern'?bound(n.left):n.type==='RestElement'?bound(n.argument):[]
 for(const n of t.within(root))if(n.type==='AssignmentExpression'||n.type==='UpdateExpression'||n.type==='UnaryExpression'&&n.operator==='delete'){
  const name=base(n.left??n.argument);if(!names.includes(name))continue
  let shadowed=false
  for(let f=t.enclosing(n,p=>fns.has(p.type));f&&f!==root;f=t.enclosing(f,p=>fns.has(p.type)))if(f.params.some(p=>bound(p).includes(name))||t.within(f).some(d=>d.type==='VariableDeclarator'&&t.enclosing(d,p=>fns.has(p.type))===f&&bound(d.id).includes(name))){shadowed=true;break}
  need(shadowed,'reassigned native authority/position/application binding')
 }
}
function unshadowed(t,at,names){
 for(let f=fns.has(at.type)?at:t.enclosing(at,n=>fns.has(n.type));f;f=t.enclosing(f,n=>fns.has(n.type))){
  need(!f.params.some(p=>boundNames(p).some(name=>names.includes(name))),'shadowed native URL/position conversion global')
  for(const n of t.within(f))if(t.enclosing(n,p=>fns.has(p.type))===f){
   need(!(n.type==='VariableDeclarator'&&boundNames(n.id).some(name=>names.includes(name)))&&!(n.type==='FunctionDeclaration'&&names.includes(n.id?.name))&&!(n.type==='AssignmentExpression'&&n.left.type==='Identifier'&&names.includes(n.left.name)),'shadowed native URL/position conversion global')
  }
 }
}
export function inspectCurrentDsmEntry(source){
 const t=tree(source),bootstrap=one(expressions(t.ast).filter(n=>n.type==='CallExpression'&&n.arguments.length===0&&n.callee.type==='ArrowFunctionExpression'),'executed native PWA bootstrap required').callee
 need(bootstrap.params.length===0&&bootstrap.body.type==='BlockStatement','literal public native bootstrap required')
 const moduleBinding=one(bootstrap.body.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).filter(d=>d.init?.type==='ObjectExpression'&&d.init.properties.length>0&&d.init.properties.every(p=>p.type==='Property'&&!p.computed&&Number.isSafeInteger(Number(key(p.key)))&&p.value?.type==='FunctionExpression')&&t.all.some(n=>n.type==='FunctionDeclaration'&&t.parents.get(n)===bootstrap.body&&t.within(n).some(x=>x.type==='CallExpression'&&mem(x.callee,'call')&&x.callee.object.type==='MemberExpression'&&x.callee.object.computed&&id(x.callee.object.object,d.id.name)))),'direct executed native module registry required')
 const modules=moduleMap(moduleBinding.init)
 const runtime=one(t.all.filter(n=>n.type==='FunctionDeclaration'&&t.parents.get(n)===bootstrap.body&&t.within(n).some(x=>x.type==='CallExpression'&&mem(x.callee,'call')&&x.callee.object.type==='MemberExpression'&&x.callee.object.computed&&id(x.callee.object.object,moduleBinding.id.name))),'actual module registry consumer required')
 need(runtime.params.length===1&&runtime.params[0].type==='Identifier'&&t.within(runtime).some(n=>n.type==='CallExpression'&&mem(n.callee,'call')&&n.callee.object.type==='MemberExpression'&&id(n.callee.object.object,moduleBinding.id.name)&&id(n.callee.object.property,runtime.params[0].name)&&n.arguments.length===4&&id(n.arguments[3],runtime.id.name)),'actual native module execution binding required')
 const lazyRoute=one(t.all.filter(n=>n.type==='ObjectExpression'&&mem(obj(n)?.get('path'),'JOB_DETAILS')&&obj(n)?.get('component')?.type==='Identifier'),'actual native job-details route required')
 const lazyName=obj(lazyRoute).get('component').name
 const lazy=one(t.all.filter(n=>n.type==='VariableDeclarator'&&id(n.id,lazyName)&&n.init?.type==='CallExpression'),'native job-details lazy component required')
 const factory=t.enclosing(lazy,n=>n.type==='FunctionExpression')
 const bind=one(t.within(lazy.init).filter(n=>n.type==='CallExpression'&&mem(n.callee,'bind')&&id(n.callee.object,factory.params[2].name)&&n.arguments.length===2&&id(n.arguments[0],factory.params[2].name)&&n.arguments[1].type==='Literal'),'native job page module identity required')
 const deps=t.within(lazy.init).filter(n=>n.type==='CallExpression'&&mem(n.callee,'e')&&id(n.callee.object,factory.params[2].name)&&n.arguments.length===1&&n.arguments[0].type==='Literal').map(n=>String(n.arguments[0].value))
 need(deps.length>0&&deps.length<=16&&new Set(deps).size===deps.length&&deps.includes('12480'),'reviewed native position component dependency unavailable')
 need(t.all.some(n=>n.type==='Property'&&key(n.key)==='JOB_DETAILS'&&n.value.type==='Literal'&&n.value.value==='/careers/job/:pid?'),'native public position route parameter changed')
 const urlBuilder=one(t.all.filter(n=>n.type==='AssignmentExpression'&&mem(n.left,'u')&&id(n.left.object,runtime.id.name)&&n.right.type==='ArrowFunctionExpression'),'native chunk URL builder required')
 const publicPath=one(t.all.filter(n=>n.type==='AssignmentExpression'&&mem(n.left,'p')&&id(n.left.object,runtime.id.name)&&n.right.type==='Literal'),'native chunk public path required').right.value
 need(publicPath==='/gen/js/'&&urlBuilder.right.params.length===1&&urlBuilder.right.params[0].type==='Identifier','native chunk public URL authority changed')
 const resolve=(n,chunkID)=>{if(n.type==='Literal')return n.value;if(id(n,urlBuilder.right.params[0].name))return chunkID;if(n.type==='ObjectExpression')return Object.fromEntries(n.properties.map(p=>[key(p.key),resolve(p.value,chunkID)]));if(n.type==='MemberExpression'&&n.computed)return resolve(n.object,chunkID)[resolve(n.property,chunkID)];if(n.type==='LogicalExpression'&&n.operator==='||')return resolve(n.left,chunkID)||resolve(n.right,chunkID);if(n.type==='BinaryExpression'&&n.operator==='+')return resolve(n.left,chunkID)+resolve(n.right,chunkID);need(false,'nonliteral native chunk URL builder')}
 const filenames=deps.map(chunkID=>({chunkID,filename:resolve(urlBuilder.right.body,chunkID)}))
 // Unrelated lazy dependencies are retained in the original programme; only
 // the two actual recruitment identity consumers are acquired here.
 const pageFilename=one(filenames.filter(r=>/^single-position-page\.[a-f0-9]+\.js$/.test(r.filename)),'one declared native role page required').filename,componentFilename=one(filenames.filter(r=>r.chunkID==='12480'&&/^12480\.[a-f0-9]+\.js$/.test(r.filename)),'declared shared native position component required').filename
 const pageURL='https://jobs.dsm-firmenich.com'+publicPath+pageFilename,componentURL='https://jobs.dsm-firmenich.com'+publicPath+componentFilename
 const searchLiteral=one(t.all.filter(n=>n.type==='Literal'&&n.value==='/api/pcsx/search?domain='),'one native public search URL required')
 const searchDecl=t.enclosing(searchLiteral,n=>n.type==='VariableDeclarator'),searchFn=t.enclosing(searchDecl,n=>fns.has(n.type)),searchOuter=t.enclosing(searchFn,n=>n.type==='ArrowFunctionExpression')
 unshadowed(t,searchFn,['URLSearchParams','encodeURIComponent','Object','window'])
 const options=one(t.within(searchOuter).filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&id(n.init,searchOuter.params[0]?.name)),'native search supplied options binding required')
 const bindings=new Map(options.id.properties.map(p=>[key(p.key),p.value]))
 need(bindings.size===6&&['start','query','groupId','location','filters','sortBy'].every(k=>bindings.has(k))&&bindings.get('start').type==='AssignmentPattern'&&bindings.get('start').right.value===0,'native search default options changed')
 const name=k=>{const n=bindings.get(k);return n.type==='AssignmentPattern'?n.left.name:n.name}
 const enc=k=>one(t.within(searchFn).filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='CallExpression'&&id(n.init.callee,'encodeURIComponent')&&n.init.arguments.length===1&&n.init.arguments[0].type==='LogicalExpression'&&n.init.arguments[0].operator==='||'&&id(n.init.arguments[0].left,name(k))&&n.init.arguments[0].right.value===''),'native encoded '+k+' required').id.name
 const filterParams=one(t.within(searchFn).filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='NewExpression'&&id(n.init.callee,'URLSearchParams')&&n.init.arguments.length===0),'native empty default filter parameters required').id.name
 const locale=one(t.within(searchFn).filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='CallExpression'&&mem(n.init.callee,'get')&&n.init.arguments[0]?.value==='hl'),'native optional locale parameter required')
 const searchGet=one(t.within(searchFn).filter(n=>n.type==='CallExpression'&&mem(n.callee,'get')&&id(n.arguments[0],searchDecl.id.name)),'actual public search GET required')
 need(searchGet.arguments.length===2&&obj(searchGet.arguments[1])?.size===1&&id(obj(searchGet.arguments[1]).get('signal'),searchOuter.params[1]?.name),'native search GET options changed')
 noWrites(t,searchFn,[searchDecl.id.name,filterParams,enc('query'),enc('location'),locale.id.name,...['start','query','groupId','location','filters','sortBy'].map(name)])
 const detailLiteral=one(t.all.filter(n=>n.type==='Literal'&&n.value==='/api/pcsx/position_details?'),'one public native detail URL required'),detailURL=t.enclosing(detailLiteral,n=>n.type==='CallExpression'),detailGet=t.enclosing(detailURL,n=>n.type==='CallExpression')
 need(mem(detailURL.callee,'concat')&&detailURL.arguments.length===1&&detailURL.arguments[0].type==='Identifier'&&mem(detailGet.callee,'get')&&detailGet.arguments.length===1,'native detail GET URL/options changed')
 const detailFn=t.enclosing(detailGet,n=>fns.has(n.type)),detailParams=one(t.within(detailFn).filter(n=>n.type==='VariableDeclarator'&&id(n.id,detailURL.arguments[0].name)&&n.init?.type==='NewExpression'&&id(n.init.callee,'URLSearchParams')),'native whole detail query required')
 unshadowed(t,detailFn,['URLSearchParams','Object'])
 const detailOuter=t.enclosing(detailFn,n=>n.type==='ArrowFunctionExpression'),detailOptions=one(t.within(detailOuter).filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&id(n.init,detailOuter.params[0]?.name)),'detail supplied native options required')
 need(detailOptions.id.properties.length===3&&['id','groupId','queriedLocation'].every(k=>detailOptions.id.properties.some(p=>key(p.key)===k&&p.value.type==='Identifier')),'native detail supplied options changed')
 noWrites(t,detailFn,[detailParams.id.name])
 need(t.within(detailFn).every(n=>!(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&id(n.callee.object,detailParams.id.name))),'native detail query is modified after construction')
 const optionRoles=Object.fromEntries(detailOptions.id.properties.map(p=>[p.value.name,key(p.key)]))
 const searchRoles={[name('groupId')]:'domain',[name('start')]:'start',[name('sortBy')]:'sort',[enc('query')]:'encodedQuery',[enc('location')]:'encodedLocation',[filterParams]:'filterParams',[locale.id.name]:'locale'}
 const filterWrites=t.within(searchFn).filter(n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&id(n.callee.object,filterParams)&&!mem(n.callee,'toString'))
 const projection={searchURL:canonical(searchDecl.init,searchRoles),searchLocale:canonical(locale.init),searchFilterWrites:filterWrites.map(n=>canonical(n,{[filterParams]:'filterParams'})),detailQuery:canonical(detailParams.init,optionRoles)}
 return{tree:t,modules,projection,pageURL,componentURL,pageModuleID:bind.arguments[1].value,selectedScope:'First native public India-query page, up to ten raw rows; query matches are not an India/company total.'}
}
export function inspectCurrentDsmRoles(entry,componentSource,pageSource){
 const c=chunk(componentSource),p=chunk(pageSource)
 need(c.chunkID==='12480'&&p.modules.has(entry.pageModuleID),'actual native role dependencies changed')
 const pageFactory=p.modules.get(entry.pageModuleID),page=exportedFunction(p,pageFactory,'default')
 const componentLiteral=one(c.all.filter(n=>n.type==='Literal'&&n.value==='/careers/apply?'),'one current public role application target required')
 const urlDecl=c.enclosing(componentLiteral,n=>n.type==='VariableDeclarator'),appFn=c.enclosing(urlDecl,n=>fns.has(n.type)),appBinding=c.enclosing(appFn,n=>n.type==='VariableDeclarator'),factory=c.enclosing(appBinding,n=>n.type==='FunctionExpression'),factoryID=one([...c.modules].filter(([,v])=>v===factory),'native application module required')[0]
 unshadowed(c,appFn,['URLSearchParams','String','window'])
 const appImport=one(declarations(p,pageFactory).filter(d=>d.init?.type==='CallExpression'&&id(d.init.callee,pageFactory.params[2].name)&&d.init.arguments[0]?.value===factoryID),'active page must import actual native application module')
 const consumedExport=one(p.within(page.fn).filter(n=>n.type==='CallExpression'&&mem(n.callee,'createElement')&&n.arguments[0]?.type==='MemberExpression'&&id(n.arguments[0].object,appImport.id.name)&&p.enclosing(n,x=>fns.has(x.type))===page.fn),'active page must consume actual native position component').arguments[0].property.name
 const main=exportedFunction(c,factory,consumedExport)
 const params=one(c.within(appFn).filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='NewExpression'&&id(n.init.callee,'URLSearchParams')&&obj(n.init.arguments[0])?.size===1&&obj(n.init.arguments[0]).has('pid')),'record-bound public application PID parameters required')
 const positionBinding=one(c.within(appFn).filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&n.id.properties.some(p=>key(p.key)==='position')&&n.id.properties.some(p=>key(p.key)==='litePosition')),'shared full/lite native position store binding required')
 need(positionBinding.init?.type==='Identifier','literal native position store required')
 const fields=new Map(positionBinding.id.properties.map(p=>[key(p.key),p.value])),full=fields.get('position').name,lite=fields.get('litePosition').name
 const privateBinding=one(c.within(appFn).filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&id(n.init,appFn.params[0]?.name)&&n.id.properties.some(p=>key(p.key)==='isPrivatePositionPage'&&p.value.type==='Identifier')),'actual supplied public/private page flag required')
 const privateName=privateBinding.id.properties.find(p=>key(p.key)==='isPrivatePositionPage').value.name
 need(urlDecl.init?.type==='ConditionalExpression'&&id(urlDecl.init.test,privateName),'native application public/private target flag changed')
 const store=one(c.within(appFn).filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&n.id.properties.some(p=>key(p.key)==='positionDetailStore'&&id(p.value,positionBinding.init.name))),'actual position-detail store accessor required')
 const storeCall=zero(store.init?.callee);need(store.init?.type==='CallExpression'&&store.init.arguments.length===0&&storeCall?.type==='MemberExpression','current native store hook required')
 const storeID=importedModule(c,factory,storeCall.object.name)
 const selection=one(p.within(page.fn).filter(n=>n.type==='CallExpression'&&mem(n.callee,'selectPosition')&&n.arguments.length===1),'native page must select its current route position')
 const pageStore=one(p.within(page.fn).filter(n=>n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&n.id.properties.some(prop=>key(prop.key)==='positionDetailStore'&&id(prop.value,selection.callee.object.name))),'page selection must use native detail store')
 const pageStoreCall=zero(pageStore.init?.callee);need(pageStoreCall?.type==='MemberExpression'&&importedModule(p,pageFactory,pageStoreCall.object.name)===storeID,'page/application store identity differs')
 const routeArg=selection.arguments[0];need(routeArg.type==='CallExpression'&&id(routeArg.callee,'Number')&&routeArg.arguments.length===1&&routeArg.arguments[0].type==='Identifier','native route ID selection changed')
 const routeBinding=one(p.within(page.fn).filter(n=>n.type==='VariableDeclarator'&&id(n.id,routeArg.arguments[0].name)&&n.init?.type==='CallExpression'&&n.init.arguments.length===0),'actual supplied route-ID hook required'),routeCall=zero(routeBinding.init.callee)
 need(routeCall?.type==='MemberExpression','native route accessor changed')
 const routeModule=entry.modules.get(importedModule(p,pageFactory,routeCall.object.name));need(routeModule,'native declared route-ID accessor unavailable')
 const routeFn=exportedFunction(entry.tree,routeModule,routeCall.property.name)
 unshadowed(entry.tree,routeFn.fn,['URLSearchParams','Number','window'])
 const selector=one(c.within(appFn).filter(n=>n.type==='MemberExpression'&&n.computed&&obj(n.object)?.has('allowed')),'native full-position application action selector required')
 const allowed=obj(selector.object).get('allowed'),allowedProps=obj(allowed?.arguments?.[1])
 need(allowed?.type==='CallExpression'&&mem(allowed.callee,'createElement')&&allowed.arguments.length===2&&allowedProps&&[...allowedProps.keys()].every(k=>['text','variant','classNames','size','href'].includes(k))&&id(allowedProps.get('href'),urlDecl.id.name),'allowed native action must use the actual public position target without unreviewed eligibility/conditions')
 const labelNode=allowedProps.get('text'),label=labelNode?.type==='Literal'?labelNode.value:labelNode?.type==='CallExpression'&&mem(labelNode.callee,'gettext')&&labelNode.arguments.length===1&&labelNode.arguments[0].type==='Literal'?labelNode.arguments[0].value:null
 need(typeof label==='string'&&label.trim()&&!/\b(?:closed|filled|withdrawn|unavailable)\b|\bnot\s+(?:accepting|hiring)\b/i.test(label),'native allowed application label is unavailable or unqualified')
 const header=one(declarations(c,factory).filter(d=>d.init?.type==='CallExpression'&&d.init.arguments.length===1&&fns.has(d.init.arguments[0].type)&&consumes(c,d.init.arguments[0],appBinding.id.name)),'active native position header must consume application component')
 need(reachesComponent(c,factory,main.fn,header.id.name),'active exported position page must consume the actual header/application flow')
 const headerFn=header.init.arguments[0],appCall=one(c.within(headerFn).filter(n=>n.type==='CallExpression'&&mem(n.callee,'createElement')&&id(n.arguments[0],appBinding.id.name)),'actual native header/application invocation required')
 const headerFlag=obj(appCall.arguments[1])?.get('isPrivatePositionPage');need(headerFlag?.type==='Identifier','native header page flag binding required')
 const flag=one(c.within(headerFn).filter(n=>n.type==='VariableDeclarator'&&id(n.id,headerFlag.name)),'native private page pathname comparison required')
 noWrites(c,appFn,[full,lite,positionBinding.init.name,params.id.name,urlDecl.id.name,privateName,appFn.params[0]?.name]);noWrites(p,page.fn,[routeBinding.id.name,selection.callee.object.name])
 const queryWrites=c.within(appFn).filter(n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&id(n.callee.object,params.id.name)&&!mem(n.callee,'toString'))
 need(queryWrites.length===2&&queryWrites.every(n=>mem(n.callee,'append')&&n.arguments.length===2&&['utm_source','utm_campaign'].includes(n.arguments[0]?.value)),'native application PID/query is modified')
 const projection={applicationParameters:canonical(params.init,{[lite]:'lite'}),applicationURL:canonical(urlDecl.init,{[params.id.name]:'params',[privateName]:'privatePage'}),applicationActionSelector:canonical(selector.property,{[full]:'full'}),privatePageFlag:canonical(flag.init),routeAccessor:canonical(routeFn.fn),routeSelection:canonical(routeArg,{[routeBinding.id.name]:'routeID'})}
 return{projection,publicApplicationPrefix:'/careers/apply?pid=',publicApplicationLabel:label,applicationIdentityField:'litePosition.id',nativeActionField:'position.positionUserActions.applyAction.status',metadataOnly:true,activeApplyVerified:false,applicationVisited:false}
}
const profile=()=>JSON.parse(fs.readFileSync(new URL('./reviewedCriticalProgramme20261121.json',import.meta.url)))
export function readCurrentDsmEntry(source){const r=inspectCurrentDsmEntry(source);need(isDeepStrictEqual(r.projection,profile().entry),'public API URL/default query contract changed');return r}
export function readCurrentDsmRoles(entry,componentSource,pageSource){const r=inspectCurrentDsmRoles(entry,componentSource,pageSource);need(isDeepStrictEqual(r.projection,profile().roles),'native role/application identity contract changed');return r}
