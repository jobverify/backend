import {parse} from 'acorn'
import {isDeepStrictEqual} from 'node:util'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {consumerFunctions} from './currentConsumerContract20261120.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {readNativePublicationCarriers} from './currentAuthoredStatements20261120.js'

export const CAREERS='https://careers.salesforce.com/',HOME='https://www.salesforce.com/company/careers/',JOBS=HOME+'jobs/',CLIENT='https://c.salesforce.com/digital/xsf/components/v1-stable/careers.js'
const fail=message=>Object.assign(Error('Salesforce current native consumer: '+message),{softFailure:true,abortRetries:true,failureKind:'parser_or_contract_error',lifecycleCleanupAllowed:false}),need=(ok,message)=>{if(!ok)throw fail(message)},one=(a,label)=>{need(a.length===1,'Missing/ambiguous '+label);return a[0]},name=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?n.value:null
const walk=(n,p,out=[])=>{if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(c=>walk(c,p,out));else if(v&&typeof v==='object')walk(v,p,out);return out}
const ast=(source,type='module')=>{try{return parse(source,{ecmaVersion:'latest',sourceType:type})}catch(e){throw fail('Malformed current public program: '+e.message)}}
const prop=n=>n?.type==='MemberExpression'?name(n.property):null,hasProp=(n,key)=>walk(n,c=>c.type==='MemberExpression'&&prop(c)===key).length>0
const declarationRows=tree=>tree.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations.map(d=>({name:name(d.id),node:d.init,declaration:d,kind:n.kind})):n.type==='FunctionDeclaration'?[{name:name(n.id),node:n,declaration:n,kind:'function'}]:[])
const isFunction=n=>['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n?.type)
const expr=s=>ast('('+s+')').body[0].expression
function bindings(n,out=[]){if(n?.type==='Identifier')out.push(n.name);else if(n?.type==='AssignmentPattern')bindings(n.left,out);else if(n?.type==='RestElement')bindings(n.argument,out);else if(n?.type==='ArrayPattern')n.elements.forEach(v=>bindings(v,out));else if(n?.type==='ObjectPattern')n.properties.forEach(v=>bindings(v.value??v.argument,out));return out}
function alpha(fn,external={}){
 const ids=new Map()
 for(const n of walk(fn,n=>isFunction(n)||n.type==='VariableDeclarator'||n.type==='CatchClause'))for(const id of bindings(n.id??n.param).concat(isFunction(n)?n.params.flatMap(p=>bindings(p)):[]))if(!ids.has(id))ids.set(id,'local'+ids.size)
 for(const[k,v]of Object.entries(external))if(!ids.has(k))ids.set(k,v)
 const visit=(n,parent,key)=>{if(Array.isArray(n))return n.map(v=>visit(v,parent,key));if(!n||typeof n!=='object')return n;const out={};for(const[k,v]of Object.entries(n)){if(['start','end','raw'].includes(k))continue;if(n.type==='Identifier'&&k==='name'&&ids.has(v)&&!(parent?.type==='MemberExpression'&&key==='property'&&!parent.computed)&&!(parent?.type==='Property'&&key==='key'&&!parent.computed))out[k]=ids.get(v);else out[k]=visit(v,n,k)}return out}
 return visit(fn,null,null)
}
const template=source=>source.startsWith('function ')?ast(source).body[0]:expr(source)
const rootMember=n=>n?.type==='MemberExpression'&&['window','globalThis'].includes(name(n.object))&&name(n.property)==='sfdcBase'
function publicationAttributes(attributes,label,at=new Date().toISOString()){
 const validateDate=(raw,kind,observedAt,deadline=false)=>{try{need(typeof raw==='string'&&raw.trim(),'Malformed '+label+' date');const v=nativeDate(raw,{required:true}),milliseconds=Date.parse(v.iso);need(deadline?milliseconds+(v.exact?0:86399999)>=Date.parse(observedAt):milliseconds<=Date.parse(observedAt),'Native '+label+' expired/future '+kind);return{raw,milliseconds,calendar:v.iso.slice(0,10),precision:v.precision,exact:v.exact}}catch(error){if(error?.failureKind==='parser_or_contract_error')throw error;throw fail('Malformed '+label+' original date: '+error.message)}}
 return readNativePublicationCarriers({},{nativeAttributes:attributes},null,[],{failure:fail,employerNames:['Salesforce'],validateDate,observedAt:at})
}
function page(html,kind){
 need(typeof html==='string'&&Buffer.byteLength(html)<=2*1024*1024,'Native publisher body bound')
 const d=document(html),canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical').attrs.href,expected=kind==='home'?HOME:JOBS
 need(canonical===expected&&one(d.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:site_name'),'native publisher brand').attrs.content==='Salesforce'&&one(d.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:url'),'native publisher URL').attrs.content===expected,'Native exact corporate publisher identity differs')
 const root=one(d.nodes(n=>n.attrs.id==='main-content'),'native current content root');need(!(root.attrs.class??'').split(/\s+/).some(c=>['d-none','hidden'].includes(c)),'Native current content root explicitly hidden')
 return{d,canonical,originalRootAttributes:root.attrs,rootPublication:publicationAttributes(root.attrs,'current publisher root')}
}
export function readCurrentHome(html){const{d,canonical}=page(html,'home'),urls=[...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.href&&/search jobs/i.test(d.text(n))).map(n=>new URL(n.attrs.href,HOME).href))];need(one(urls,'current corporate Search jobs link')===JOBS,'Native corporate job handoff differs');return{jobsURL:JOBS,canonical,rendererExecuted:false,companyDisplayBrand:'Salesforce',sourceLegalEmployer:null}}
export function readCurrentJobsPage(html){
 const{d,canonical,originalRootAttributes,rootPublication}=page(html,'jobs'),clients=d.nodes(n=>n.tag==='script'&&n.attrs.src&&/\/careers[.]js(?:[?#]|$)/.test(n.attrs.src));need(one(clients,'active native careers client').attrs.src===CLIENT,'Native careers client owner/route differs');const clientPublication=publicationAttributes(clients[0].attrs,'current native client')
 const roots=[],writes=[],parents=new WeakMap()
 for(const s of d.nodes(n=>n.tag==='script'&&!n.attrs.src&&(!n.attrs.type||['module','text/javascript','application/javascript'].includes(n.attrs.type)))){const tree=ast(s.raw??'','script');for(const parent of walk(tree,()=>true))for(const value of Object.values(parent))if(Array.isArray(value))value.filter(v=>v&&typeof v==='object').forEach(v=>parents.set(v,parent));else if(value&&typeof value==='object')parents.set(value,parent);for(const n of walk(tree,rootMember))roots.push(n);for(const n of walk(tree,n=>n.type==='AssignmentExpression'&&rootMember(n.left)))writes.push({n,source:s.raw})}
 const{n,source}=one(writes.filter(w=>w.n.right.type==='CallExpression'),'original active publisher environment'),r=n.right
 need(n.operator==='='&&r?.type==='CallExpression'&&name(r.callee?.object)==='Object'&&name(r.callee?.property)==='assign'&&r.arguments.length===2&&r.arguments[0].type==='LogicalExpression'&&r.arguments[0].operator==='||'&&rootMember(r.arguments[0].left)&&r.arguments[0].right.type==='ObjectExpression'&&!r.arguments[0].right.properties.length&&r.arguments[1].type==='ObjectExpression','Native original environment binding differs')
 const safeRoots=new Set([n.left,r.arguments[0].left])
 for(const write of writes.filter(w=>w.n!==n)){const a=write.n,b=a.right;need(a.operator==='='&&b.type==='LogicalExpression'&&b.operator==='||'&&rootMember(b.left)&&b.right.type==='ObjectExpression'&&!b.right.properties.length,'Native publisher environment root overwritten');safeRoots.add(a.left);safeRoots.add(b.left)}
 need(roots.every(root=>{const parent=parents.get(root);return safeRoots.has(root)||parent?.type==='MemberExpression'&&parent.object===root&&!parent.computed&&!['env','__proto__','constructor','prototype'].includes(name(parent.property))}),'Native publisher configuration escaped original literal assignment')
 const originalConfiguration=readLiteralModel(source.slice(r.arguments[1].start,r.arguments[1].end)).value
 need(originalConfiguration.env==='PROD','Native publisher environment must be PROD')
 return{canonical,environment:'prod',clientURL:CLIENT,originalConfiguration,originalEnvironmentAssignment:source.slice(n.start,n.end),originalRootAttributes,originalClientAttributes:clients[0].attrs,publisherPublicationCarriers:{root:rootPublication,client:clientPublication},rendererExecuted:false}
}
export function readCurrentConsumer(source,pageModel,observedAt=new Date().toISOString()){
 need(typeof source==='string'&&Buffer.byteLength(source)<=2*1024*1024&&pageModel.environment==='prod'&&pageModel.clientURL===CLIENT,'Native current consumer context/bound differs')
 const tree=ast(source),decls=declarationRows(tree),functions=decls.filter(d=>isFunction(d.node)),byName=id=>one(decls.filter(d=>d.name===id),'native binding '+id),byRole=predicate=>one(functions.filter(d=>predicate(d.node)),'native semantic function'),roles={}
 roles.environmentResolver=byRole(n=>walk(n,c=>rootMember(c)&&name(c.object)==='globalThis').length>0)
 roles.feedConfiguration=byRole(n=>walk(n,c=>c.type==='ObjectExpression'&&c.properties.some(p=>name(p.key)==='jobsPrimary')&&c.properties.some(p=>name(p.key)==='jobsFull')).length>0)
 roles.rowProjection=byRole(n=>hasProp(n,'Job_Requisition_Ref_ID')&&hasProp(n,'Job_Posting_Title'))
 const mapper=roles.rowProjection.node,guard=mapper.body.body[0]
 need(guard.type==='IfStatement'&&guard.test.type==='UnaryExpression'&&guard.test.operator==='!'&&guard.test.argument.type==='CallExpression','Native row model guard differs')
 roles.isRecord=byName(name(guard.test.argument.callee))
 const idRead=one(walk(mapper,n=>n.type==='CallExpression'&&n.arguments.length===1&&prop(n.arguments[0])==='Job_Requisition_Ref_ID'),'native record identity mapping')
 roles.textField=byName(name(idRead.callee))
 roles.structuredGeography=byName(name(one(walk(mapper,n=>n.type==='SpreadElement'&&n.argument.type==='CallExpression'),'native typed geography projection').argument.callee))
 const structured=roles.structuredGeography.node,arrayCalls=walk(structured,n=>n.type==='CallExpression'&&name(n.callee)&&decls.some(d=>d.name===name(n.callee)))
 roles.stringArray=byName(one([...new Set(arrayCalls.map(n=>name(n.callee)))],'native structured geography array helper'))
 const assignedNames=new Set(Object.values(roles).map(d=>d.name)),otherMapperCalls=[...new Set(walk(mapper,n=>n.type==='CallExpression'&&name(n.callee)&&decls.some(d=>d.name===name(n.callee))&&!assignedNames.has(name(n.callee))).map(n=>name(n.callee)))]
 roles.locationText=byName(one(otherMapperCalls,'native authored location mapper'))
 roles.postedSorter=byRole(n=>hasProp(n,'External_Job_Posting_Start_Date')&&hasProp(n,'NEGATIVE_INFINITY'))
 roles.applicationFormatter=byRole(n=>walk(n,c=>c.type==='CallExpression'&&prop(c.callee)==='endsWith'&&c.arguments[0]?.value==='/apply').length>0)
 const provider=byRole(n=>hasProp(n,'jobsPrimary')&&hasProp(n,'jobsFullBackup')),effects=walk(provider.node,n=>n.type==='CallExpression'&&prop(n.callee)==='useEffect'&&hasProp(n,'jobsPrimary')),effect=one(effects,'connected active feed effect'),callback=effect.arguments[0]
 need(isFunction(callback)&&provider.node.body.body.some(n=>n.type==='ExpressionStatement'&&n.expression===effect),'Native feed effect is disconnected from active provider')
 const calls=walk(callback,n=>n.type==='CallExpression'&&n.callee?.type==='ArrowFunctionExpression'&&n.callee.async&&hasProp(n.callee,'jobsPrimary')),loaderCall=one(calls,'connected feed loader'),loader=loaderCall.callee
 const activeCalls=callback.body.body.filter(n=>n.type==='ExpressionStatement').flatMap(n=>n.expression.type==='SequenceExpression'?n.expression.expressions:[n.expression]);need(activeCalls.includes(loaderCall),'Native feed loader invocation is not unconditional')
 const firstGuard=callback.body.body[0],guardSet=callback.body.body[1]?.expression,ref=firstGuard?.test?.object
 need(firstGuard?.type==='IfStatement'&&firstGuard.test.type==='MemberExpression'&&prop(firstGuard.test)==='current'&&firstGuard.consequent.type==='ReturnStatement'&&!firstGuard.consequent.argument&&!firstGuard.alternate&&guardSet?.type==='AssignmentExpression'&&guardSet.operator==='='&&guardSet.left.type==='MemberExpression'&&prop(guardSet.left)==='current'&&name(guardSet.left.object)===name(ref)&&guardSet.right.type==='UnaryExpression'&&guardSet.right.operator==='!'&&guardSet.right.argument.value===0&&callback.body.body.slice(2).every(n=>['VariableDeclaration','ExpressionStatement'].includes(n.type)),'Native active feed effect early-return/initialization differs')
 const refDeclaration=one(declarationRows(provider.node.body).filter(d=>d.name===name(ref)),'native one-time feed guard');need(refDeclaration.node?.type==='CallExpression'&&prop(refDeclaration.node.callee)==='useRef'&&refDeclaration.node.arguments[0]?.type==='UnaryExpression'&&refDeclaration.node.arguments[0].operator==='!'&&refDeclaration.node.arguments[0].argument.value===1,'Native one-time feed guard initialized unavailable')
 roles.feedLoader={name:null,node:loader}
 const configInit=loader.body.body[0];need(configInit.type==='VariableDeclaration'&&configInit.declarations.length===1&&configInit.declarations[0].init?.type==='CallExpression'&&name(configInit.declarations[0].init.callee)===roles.feedConfiguration.name,'Native actual feed configuration selection differs')
 const mergeCall=one(walk(loader,n=>n.type==='CallExpression'&&n.arguments.length===2&&prop(n.arguments[0])==='jobsPrimary'&&prop(n.arguments[1])==='jobsFull'),'actual primary/full native feed invocation')
 const inside=declarationRows(callback.body),merger=one(inside.filter(d=>d.name===name(mergeCall.callee)),'connected native feed merger');need(isFunction(merger.node)&&merger.node.async,'Native feed merger declaration differs');roles.feedMerger=merger
 const firstAwait=merger.node.body.body[0].declarations?.[0]?.init;need(firstAwait?.type==='AwaitExpression'&&firstAwait.argument?.type==='CallExpression','Native actual primary feed read differs')
 roles.feedReader=one(inside.filter(d=>d.name===name(firstAwait.argument.callee)),'connected native original JSON reader')
 const enumCall=one(walk(roles.environmentResolver.node,n=>n.type==='CallExpression'&&prop(n.callee)==='includes'),'native environment enum'),environmentChoices=byName(name(enumCall.callee.object));need(isDeepStrictEqual(environmentChoices.node.elements?.map(n=>n.value),['qa','uat','prod']),'Native environment choices differ')
 const states=provider.node.body.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).filter(n=>n.id.type==='ArrayPattern'&&n.init?.type==='CallExpression'&&prop(n.init.callee)==='useState')
 need(states.length===5,'Native current publication state binding differs')
 const setters={setPublishedJobs:name(states[0].id.elements[1]),setLoading:name(states[2].id.elements[1]),setEnrichment:name(states[3].id.elements[1]),setError:name(states[4].id.elements[1])}
 const pageInfo=one(provider.node.body.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).filter(n=>isFunction(n.init)&&walk(n.init,c=>c.type==='ObjectExpression'&&c.properties.some(p=>name(p.key)==='pageInfo')).length),'native publication wrapper')
 roles.pageInfoWrapper={name:name(pageInfo.id),node:pageInfo.init}
 const publicationReturn=one(provider.node.body.body.filter(n=>n.type==='ReturnStatement'),'native current publication return'),context=one(walk(publicationReturn.argument,n=>n.type==='ObjectExpression'&&n.properties.some(p=>name(p.key)==='jobsData')),'native current publication context'),publishedJobs=one(context.properties.filter(p=>name(p.key)==='jobsData'),'native published job model').value
 need(name(publishedJobs)===name(states[0].id.elements[0]),'Native actual publication context disconnected from current job state')
 const returnedProvider=publicationReturn.argument,providerTag=returnedProvider?.arguments?.[0],providerProps=returnedProvider?.arguments?.[1],contextID=name(providerTag?.object),childrenBinding=provider.node.params[0]?.properties?.find(p=>name(p.key)==='children')?.value
 need(returnedProvider?.type==='CallExpression'&&prop(returnedProvider.callee)==='jsx'&&providerTag?.type==='MemberExpression'&&prop(providerTag)==='Provider'&&contextID&&providerProps?.type==='ObjectExpression'&&name(providerProps.properties.find(p=>name(p.key)==='children')?.value)===name(childrenBinding),'Native actual current Provider tag/children disconnected')
 const contextDeclaration=byName(contextID);need(contextDeclaration.node?.type==='CallExpression'&&prop(contextDeclaration.node.callee)==='createContext','Native actual publication Context declaration differs')
 const applyCandidate=one(walk(tree,n=>n.type==='ObjectExpression'&&n.properties.some(p=>name(p.key)==='id'&&p.value.value==='js-apply-external')),'native actual Apply object'),roleComponent=one(functions.filter(d=>walk(d.node,n=>n===applyCandidate).length),'native actual role component'),roleDeclarations=declarationRows(roleComponent.node.body)
 const contextRead=one(roleDeclarations.filter(d=>d.declaration.id?.type==='ObjectPattern'&&d.declaration.id.properties.some(p=>name(p.key)==='jobsData')),'native actual role job-state binding'),dataBinding=name(contextRead.declaration.id.properties.find(p=>name(p.key)==='jobsData').value),loadingBinding=name(contextRead.declaration.id.properties.find(p=>name(p.key)==='loading').value)
 roles.roleContextHook=byName(name(contextRead.node?.callee));need(isFunction(roles.roleContextHook.node),'Native actual role context hook differs');const consumedContext=one(walk(roles.roleContextHook.node,n=>n.type==='CallExpression'&&prop(n.callee)==='useContext'),'native role Context consumer');need(name(consumedContext.arguments[0])===contextID,'Native actual role consumes a disconnected Context')
 const routeID=one(roleDeclarations.filter(d=>d.declaration.id?.type==='ObjectPattern'&&d.declaration.id.properties.some(p=>name(p.key)==='jobId')),'native actual route identity'),jobIDBinding=name(routeID.declaration.id.properties.find(p=>name(p.key)==='jobId').value),lookupInitial=one(roleDeclarations.filter(d=>d.node?.type==='ConditionalExpression'&&d.node.consequent?.type==='CallExpression'&&prop(d.node.consequent.arguments[0])==='jobs'),'native actual initial same-role lookup')
 need(name(lookupInitial.node.consequent.arguments[0].object)===dataBinding&&name(lookupInitial.node.consequent.arguments[1])===jobIDBinding,'Native actual initial job-state lookup disconnected');roles.roleLookup=byName(name(lookupInitial.node.consequent.callee))
 const roleEffect=one(walk(roleComponent.node,n=>n.type==='CallExpression'&&prop(n.callee)==='useEffect'&&walk(n.arguments[0],c=>c.type==='CallExpression'&&name(c.callee)===roles.roleLookup.name).length),'native actual role-state effect');roles.roleStateEffect={name:null,node:roleEffect.arguments[0]}
 need(roleComponent.node.body.body.some(n=>n.type==='ExpressionStatement'&&(n.expression===roleEffect||n.expression.type==='SequenceExpression'&&n.expression.expressions.includes(roleEffect)))&&isDeepStrictEqual(roleEffect.arguments[1]?.elements?.map(name),[jobIDBinding,dataBinding,loadingBinding]),'Native actual role-state effect disconnected from routed state')
 const savedCall=one(walk(roles.roleStateEffect.node,n=>n.type==='CallExpression'&&n.arguments[0]?.type==='ArrayExpression'),'native same-role saved projection');roles.roleSavedProjection=byName(name(savedCall.callee));const savedIDs=one(walk(roles.roleSavedProjection.node,n=>n.type==='CallExpression'&&n.arguments.length===0),'native saved-ID-only helper'),roleState=one(roleDeclarations.filter(d=>d.declaration.id?.type==='ArrayPattern'&&d.node?.type==='CallExpression'&&prop(d.node.callee)==='useState'),'native current same-role state')
 const actualBindings=Object.fromEntries(Object.entries(roles).filter(([,d])=>d.name).map(([role,d])=>[d.name,role])),expectedBindings=Object.fromEntries(Object.entries(consumerFunctions).filter(([,d])=>d.binding).map(([role,d])=>[d.binding,role]))
 actualBindings[environmentChoices.name]='environmentChoices';expectedBindings.Ye='environmentChoices'
 for(const[role,id]of Object.entries(setters))actualBindings[id]=role
 Object.assign(expectedBindings,{n:'setPublishedJobs',s:'setLoading',u:'setEnrichment',p:'setError',v:'pageInfo'});actualBindings[name(pageInfo.id)]='pageInfo'
 Object.assign(expectedBindings,{g:'reactRuntime',dt:'jobsContext',nn:'savedIDs',n:'roleLoading',t:'roleJobData',e:'roleID',i:'setRole'});Object.assign(actualBindings,{[name(states[0].init.callee.object)]:'reactRuntime',[contextID]:'jobsContext',[name(savedIDs.callee)]:'savedIDs',[loadingBinding]:'roleLoading',[dataBinding]:'roleJobData',[jobIDBinding]:'roleID',[name(roleState.declaration.id.elements[1])]:'setRole'})
 // Setter aliases are local to the provider callbacks; role-state aliases are
 // different lexical scopes even when the current minifier reuses their names.
 const providerExpected={...expectedBindings,n:'setPublishedJobs',s:'setLoading',u:'setEnrichment',p:'setError',v:'pageInfo'},providerActual={...actualBindings,...Object.fromEntries(Object.entries(setters).map(([role,id])=>[id,role]))}
 for(const[role,contract]of Object.entries(consumerFunctions)){const own=role.startsWith('role');need(isDeepStrictEqual(alpha(roles[role].node,own?actualBindings:providerActual),alpha(template(contract.source),own?expectedBindings:providerExpected)),'Native connected '+role+' semantics changed')}
 // Constrain the actual Apply and main render calls, not disconnected helpers.
 const applyObject=one(walk(tree,n=>n.type==='ObjectExpression'&&n.properties.some(p=>name(p.key)==='id'&&p.value.value==='js-apply-external')),'native actual Apply object'),href=one(applyObject.properties.filter(p=>name(p.key)==='href'),'native actual Apply href').value
 need(href.type==='CallExpression'&&name(href.callee)===roles.applicationFormatter.name&&href.arguments.length===1&&prop(href.arguments[0])==='externalJobPostingSite','Native actual same-record application binding changed')
 const record=name(href.arguments[0].object),owner=one(walk(tree,n=>n.type==='ObjectExpression'&&n.properties.some(p=>name(p.key)==='id'&&p.value?.value==='js-job-detail')),'native role owner'),ownerID=one(owner.properties.filter(p=>name(p.key)==='data-id'),'native role owner ID').value
 need(prop(ownerID)==='id'&&name(ownerID.object)===record&&walk(owner,n=>n===applyObject).length===1,'Native application escaped same-role native owner')
 const nativeConsumerCarriers=[]
 for(const[label,object]of[['actual Apply',applyObject],['actual native role owner',owner]]){const literalAttributes={};for(const p of object.properties){
  need(p.type==='Property'&&!p.computed,'Native '+label+' contains unqualified spread/computed attributes');const key=name(p.key),value=p.value.value
  if(['disabled','hidden','inert','aria-disabled','aria-hidden','data-is-disabled','data-is-closed','data-is-expired'].includes(key))need([false,'false',0,'0'].includes(value),'Native '+label+' explicitly disabled/hidden')
  if(['data-is-published','data-is-active','data-can-apply'].includes(key))need([true,'true',1,'1'].includes(value),'Native '+label+' current publication/application disabled')
  if(['data-status','data-job-status','data-publication-status'].includes(key))need(typeof value==='string'&&/^(?:open|active|published|approved)$/i.test(value),'Native '+label+' unavailable publication status')
  if(key==='data-country')need(value==='India','Native '+label+' country conflicts with selected India')
  if(key==='data-employer')need(value==='Salesforce','Native '+label+' employer differs')
  if(key==='className')need(typeof value==='string'&&!value.split(/\s+/).some(c=>['d-none','hidden'].includes(c)),'Native '+label+' explicitly hidden class')
  if(key==='style'){need(p.value.type==='ObjectExpression','Native '+label+' unqualified visibility style');for(const entry of p.value.properties)if(['display','visibility','contentVisibility'].includes(name(entry.key)))need(!['none','hidden','collapse'].includes(entry.value.value),'Native '+label+' explicitly hidden style')}
  if(key.startsWith('data-')&&!['data-id','data-jobtitle'].includes(key)){need(p.value.type==='Literal','Native '+label+' unqualified scoped publication metadata');literalAttributes[key]=typeof value==='boolean'?String(value):value}
 }nativeConsumerCarriers.push({label,...publicationAttributes(literalAttributes,label,observedAt)})}
 const root=one(decls.filter(d=>d.node?.type==='CallExpression'&&name(d.node.callee?.object)==='document'&&prop(d.node.callee)==='getElementById'&&d.node.arguments[0]?.value==='main-content'),'native current renderer root'),render=one(walk(tree,n=>n.type==='CallExpression'&&prop(n.callee)==='render'&&walk(n,c=>c.type==='CallExpression'&&name(c.arguments[0])===provider.name).length>0),'active native publication provider render')
 need(tree.body.some(n=>n.type==='IfStatement'&&name(n.test)===root.name&&walk(n,c=>c===render).length===1),'Native current data provider is disconnected from active root')
 const renderCall=render.arguments[0],strictProps=renderCall?.arguments?.[1],providerRender=strictProps?.properties?.find(p=>name(p.key)==='children')?.value,routerRender=providerRender?.arguments?.[1]?.properties?.find(p=>name(p.key)==='children')?.value
 need(renderCall?.type==='CallExpression'&&prop(renderCall.callee)==='jsx'&&prop(renderCall.arguments[0])==='StrictMode'&&providerRender?.type==='CallExpression'&&name(providerRender.arguments[0])===provider.name&&routerRender?.type==='CallExpression'&&name(routerRender.arguments[0]),'Native actual render argument/provider/router disconnected')
 const routeTable=byName(name(routerRender.arguments[0]));need(isFunction(routeTable.node)&&routeTable.node.body.type==='CallExpression','Native actual route table disconnected');const roleRoute=one(walk(routeTable.node.body,n=>n.type==='CallExpression'&&n.arguments[1]?.type==='ObjectExpression'&&n.arguments[1].properties.some(p=>name(p.key)==='path'&&p.value.value==='/:jobId/:jobSlug')),'native actual routed role declaration'),routeProps=roleRoute.arguments[1]
 need(name(routeProps.properties.find(p=>name(p.key)==='component')?.value)===roleComponent.name,'Native actual route component disconnected from current own role')
 const routePath=(node,target,path=[])=>{if(node===target)return path;for(const value of Object.values(node??{}))for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object'){const found=routePath(child,target,[...path,node]);if(found)return found}return null},ancestry=routePath(routeTable.node.body,roleRoute)
 need(ancestry&&ancestry.every(n=>['CallExpression','ObjectExpression','Property','ArrayExpression'].includes(n.type)),'Native actual role route has unqualified conditional/execution wrapper')
 return{primaryURL:'https://a.sfdcstatic.com/digital/xsf/careers/prod/jobs_1.json',fullURL:'https://a.sfdcstatic.com/digital/xsf/careers/prod/jobs_2.json',primaryFullMerge:'native-full-overrides-same-id;append-new-full-id',rendererExecuted:false,wholeBuildPinned:false,semanticFunctionCount:Object.keys(consumerFunctions).length,originalRelevantFunctions:Object.fromEntries(Object.entries(roles).map(([role,d])=>[role,source.slice(d.node.start,d.node.end)])),originalEnvironment:pageModel.originalConfiguration,nativeConsumerCarriers,publications:nativeConsumerCarriers.flatMap(v=>v.publications),deadlines:nativeConsumerCarriers.flatMap(v=>v.deadlines),originalRoleRoute:source.slice(roleRoute.start,roleRoute.end)}
}
export function nativeApplicationURL(value,id){
 need(typeof value==='string'&&/^JR\d+$/.test(id),'Native authored application/requisition absent')
 const raw=value.trim().replace(/\/$/,''),u=new URL(raw),base=new RegExp('^/External_Career_Site/job/[^/]+/[^/]+_'+id+'(?:-\\d+)?(?:/apply)?$')
 need(u.origin==='https://salesforce.wd12.myworkdayjobs.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&base.test(u.pathname),'Native same-requisition application owner/identity differs')
 return raw.toLowerCase().endsWith('/apply')?raw:raw+'/apply'
}
