import {parse} from 'acorn'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
export const BOARD='https://app.pyjamahr.com/careers?company=Kuku%20FM&company_uuid=8B92017E1E&isHeaderVisible=true&is_careers_page=true'
export const UUID='8B92017E1E',API='https://api.pyjamahr.com',APP='https://app.pyjamahr.com'
export const fail=message=>Object.assign(Error('Kuku FM current native contract: '+message),{source:'kukufm',abortRetries:true,softFailure:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
export const need=(ok,message)=>{if(!ok)throw fail(message)}
const one=(a,label)=>{need(a.length===1,'Missing/ambiguous '+label);return a[0]}
const ident=(n,name)=>n?.type==='Identifier'&&(name===undefined||n.name===name)
const literal=(n,value)=>n?.type==='Literal'&&(value===undefined||n.value===value)
const member=(n,object,key)=>n?.type==='MemberExpression'&&!n.computed&&ident(n.object,object)&&ident(n.property,key)
const tail=n=>n?.type==='SequenceExpression'?n.expressions.at(-1):n
const callMember=n=>n?.type==='CallExpression'?tail(n.callee):null
function walk(root,fn,{nested=true}={}){let count=0;const visit=(n,parent)=>{if(!n||typeof n!=='object')return;need(++count<=1000000,'Finite native AST node budget');fn(n,parent);if(!nested&&n!==root&&/^(?:Function|ArrowFunction)/.test(n.type))return;for(const[k,v]of Object.entries(n))if(k!=='start'&&k!=='end'&&v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])visit(c,n)};visit(root,null)}
const all=(n,p,opts)=>{const out=[];walk(n,v=>{if(p(v))out.push(v)},opts);return out}
const statements=fn=>fn.body.body.flatMap(s=>s.type==='ExpressionStatement'&&s.expression.type==='SequenceExpression'?s.expression.expressions.map(expression=>({type:'ExpressionStatement',expression})):s)
const vars=fn=>statements(fn).filter(s=>s.type==='VariableDeclaration').flatMap(s=>s.declarations)
const definition=(fn,name)=>one([...vars(fn).filter(d=>ident(d.id,name)).map(d=>d.init),...statements(fn).filter(s=>s.type==='FunctionDeclaration'&&ident(s.id,name))],'native binding '+name)
function imports(fn){const r=new Map(),require=fn.params[2].name;for(const d of vars(fn)){const init=tail(d.init);if(ident(d.id)&&init?.type==='CallExpression'&&ident(init.callee,require)&&init.arguments.length===1&&literal(init.arguments[0])&&Number.isSafeInteger(init.arguments[0].value))r.set(d.id.name,init.arguments[0].value)}return r}
function exportsOf(fn){const require=fn.params[2].name,output=fn.params[1].name,defs=statements(fn).filter(s=>s.type==='ExpressionStatement'&&s.expression.type==='CallExpression'&&member(s.expression.callee,require,'d')&&ident(s.expression.arguments[0],output));const props=one(defs,'active webpack export declaration').expression.arguments[1];need(props?.type==='ObjectExpression','Literal native exports');const out=new Map();for(const p of props.properties){const name=p.key.name??p.key.value,body=p.value.body?.body;need(!out.has(name)&&body?.length===1&&body[0].type==='ReturnStatement'&&ident(body[0].argument),'Literal native exported getter');out.set(name,body[0].argument.name)}return out}
function registry(program,check){need(typeof program==='string'&&Buffer.byteLength(program)<=2000000,'Finite original declared programme');const tree=parse(program,{ecmaVersion:'latest'});check();const p=one(tree.body.filter(s=>s.type==='ExpressionStatement'&&s.expression.type==='CallExpression'&&s.expression.callee.type==='MemberExpression'&&s.expression.callee.property.name==='push'),'active webpack registration').expression;const owner=p.callee.object;need(owner.type==='AssignmentExpression'&&member(owner.left,'self','webpackChunk_N_E')&&owner.right.type==='LogicalExpression'&&owner.right.operator==='||'&&member(owner.right.left,'self','webpackChunk_N_E')&&owner.right.right.type==='ArrayExpression'&&owner.right.right.elements.length===0,'Native webpack registry owner');const payload=p.arguments[0];need(p.arguments.length===1&&payload?.type==='ArrayExpression'&&payload.elements[1]?.type==='ObjectExpression','Literal native webpack payload');const modules=new Map();for(const prop of payload.elements[1].properties){const key=prop.key.value;need(Number.isSafeInteger(key)&&!modules.has(key)&&prop.value?.type==='FunctionExpression'&&prop.value.params.length<=3,'Native module identity');modules.set(key,prop.value)}return {modules,runtime:payload.elements[2],tree}}
function noShadow(fn,names){const direct=vars(fn).filter(d=>ident(d.id)&&names.has(d.id.name));need(direct.length===0,'Critical imported binding shadowed by native consumer');const assignments=all(fn,n=>n.type==='AssignmentExpression'&&ident(n.left)&&names.has(n.left.name)||n.type==='UpdateExpression'&&ident(n.argument)&&names.has(n.argument.name),{nested:false});need(!assignments.length,'Critical native binding overwritten')}
function sourceOf(program,n){return program.slice(n.start,n.end)}
const functions=n=>/^(?:Function|ArrowFunction)/.test(n?.type??'')
function enclosingFunction(node,parents){for(let p=parents.get(node);p;p=parents.get(p))if(functions(p))return p;return null}
const returnedContains=(fn,node)=>statements(fn).filter(s=>s.type==='ReturnStatement').some(s=>all(s.argument,n=>n===node,{nested:false}).length===1)

export function readKukuBoard(html){
 const d=readNativeDocument(html),data=one(d.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'),'active original Next model');need(!data.inert&&!data.inactive&&data.attrs.type==='application/json','Native Next model is data')
 const parsed=readLiteralModel(data.raw);need(parsed.validJSON,'Strict original native Next JSON');const model=structuredClone(parsed.value),company=model?.props?.pageProps?.companyDetails
 need(model.page==='/careers'&&model.isFallback===false&&model.gssp===true&&model.props.__N_SSP===true&&model.props.pageProps.isBot===false,'Current native route/public SSR state')
 need(company?.id===9713&&company.name==='Kuku FM'&&company.uuid===UUID&&company.slug==='kuku-fm'&&company.url==='https://kukufm.com','Exact native employer/account/backlink changed')
 need(isDeepStrictEqual(model.query,{company:'Kuku FM',company_uuid:UUID,isHeaderVisible:'true',is_careers_page:'true'}),'Exact configured current board query changed')
 need(isDeepStrictEqual(activeHead(html).titles,['Kuku FM']),'Native employer title changed')
 const canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical');need(canonical.attrs.href==='https://jobs.pyjamahr.com/kuku-fm','Native employer canonical changed')
 const scripts=d.nodes(n=>n.tag==='script'&&n.attrs.src&&!n.inert&&!n.inactive),chosen=scripts.map(n=>({url:new URL(n.attrs.src,APP).href,attributes:structuredClone(n.attrs)})).filter(r=>new URL(r.url).origin===APP&&/\/_next\/static\/chunks\/(?:pages\/(?:_app|careers)-|2113-)[a-zA-Z0-9]+\.js$/.test(r.url))
 need(chosen.length===3&&new Set(chosen.map(r=>r.url)).size===3,'Current native app/card/careers declarations changed')
 for(const pattern of[/\/pages\/_app-/,/\/2113-/,/\/pages\/careers-/])need(chosen.filter(r=>pattern.test(r.url)).length===1,'Current unique native programme declaration')
 need(typeof model.buildId==='string'&&scripts.some(n=>n.attrs.src==='/_next/static/'+model.buildId+'/_buildManifest.js'),'Native build declaration differs')
 return {company:structuredClone(company),model,programs:chosen}
}
export function readKukuProtocol(board,responses,check=()=>{}){
 const entries=board.programs.map(p=>{const r=one(responses.filter(r=>r.url===p.url),'current declared programme entity');return {url:r.url,program:r.body,...registry(r.body,check)}}),modules=new Map()
 for(const e of entries)for(const[id,fn]of e.modules){need(!modules.has(id),'Duplicate native webpack module');modules.set(id,{fn,entry:e})}
 const page=one(entries.filter(e=>/\/pages\/careers-/.test(e.url)),'careers entry programme'),registrations=[]
 for(const[id,fn]of page.modules)for(const s of statements(fn)){const n=s.expression;if(n?.type!=='CallExpression'||n.callee.type!=='MemberExpression'||n.callee.property.name!=='push')continue;const owner=n.callee.object;if(owner.type!=='AssignmentExpression'||!member(owner.left,'window','__NEXT_P'))continue;need(owner.right.type==='LogicalExpression'&&owner.right.operator==='||'&&member(owner.right.left,'window','__NEXT_P')&&owner.right.right.type==='ArrayExpression'&&owner.right.right.elements.length===0,'Actual native route registration owner changed');const a=n.arguments[0];if(a?.type==='ArrayExpression'&&literal(a.elements[0],'/careers'))registrations.push({id,fn,loader:a.elements[1]})}
 const registration=one(registrations,'active native careers route registration'),ret=registration.loader?.body?.body
 need(ret?.length===1&&ret[0].type==='ReturnStatement'&&ret[0].argument.type==='CallExpression'&&ident(ret[0].argument.callee,registration.fn.params[2].name)&&ret[0].argument.arguments.length===1&&literal(ret[0].argument.arguments[0]),'Native route module consumer changed')
 const routeID=ret[0].argument.arguments[0].value,route=modules.get(routeID);need(route&&route.entry===page,'Native active careers module absent')
 need(page.runtime?.type==='FunctionExpression'&&all(page.runtime,n=>n.type==='AssignmentExpression'&&literal(n.right,registration.id)).length===1,'Native route registration not bootstrapped')
 const requireName=page.runtime.params[0]?.name;need(ident(page.runtime.params[0]),'Native bootstrap require binding changed')
 const bootstrap=one(page.runtime.body.body.filter(s=>s.type==='ExpressionStatement'&&s.expression.type==='CallExpression'&&member(s.expression.callee,requireName,'O')&&s.expression.arguments.length===3),'active native bootstrap loader').expression,callback=bootstrap.arguments[2]
 need(literal(bootstrap.arguments[0],0)&&bootstrap.arguments[1]?.type==='ArrayExpression'&&callback?.type==='FunctionExpression'&&callback.params.length===0&&callback.body.body.length===2,'Native bootstrap callback changed')
 const bootstrapReturn=one(callback.body.body.filter(s=>s.type==='ReturnStatement'),'actual native route require return').argument,bootstrapVars=vars(callback)
 need(bootstrapReturn?.type==='SequenceExpression'&&bootstrapReturn.expressions.length===2&&bootstrapVars.length===1&&bootstrapVars[0].init===null&&ident(bootstrapVars[0].id),'Actual native bootstrap sequence changed')
 const assigned=bootstrapReturn.expressions[0],invoked=bootstrapReturn.expressions[1],bootstrapLocal=bootstrapVars[0].id.name
 need(assigned.type==='AssignmentExpression'&&assigned.operator==='='&&ident(assigned.left,bootstrapLocal)&&literal(assigned.right,registration.id)&&invoked.type==='CallExpression'&&ident(invoked.callee,requireName)&&invoked.arguments.length===1&&invoked.arguments[0].type==='AssignmentExpression'&&member(invoked.arguments[0].left,requireName,'s')&&ident(invoked.arguments[0].right,bootstrapLocal),'Native consumed bootstrap registration differs from dormant literals')

 const routeExports=exportsOf(route.fn),entry=definition(route.fn,routeExports.get('default'));need(entry?.type==='FunctionDeclaration','Actual exported native careers component')
 const importsByName=imports(route.fn),calls=all(entry,n=>n.type==='CallExpression'&&callMember(n)?.type==='MemberExpression'&&ident(callMember(n).object)&&n.arguments.length===1&&n.arguments[0]?.type==='CallExpression'&&callMember(n.arguments[0])?.type==='MemberExpression'&&ident(callMember(n.arguments[0]).object,callMember(n).object.name)&&n.arguments[0].arguments.length===8)
 const consumer=one(calls,'connected native listing GET/query builder'),helperName=callMember(consumer).object.name,helper=modules.get(importsByName.get(helperName));need(helper,'Actual imported native listing helper');noShadow(entry,new Set([helperName]))
 const queryArguments=consumer.arguments[0].arguments,routerName=queryArguments[0]?.name
 need(ident(queryArguments[0])&&ident(queryArguments[2]),'Native listing consumes current router/account and careers flag')
 const router=definition(entry,routerName),routerCall=router?.object,routerMember=callMember(routerCall)
 need(router?.type==='MemberExpression'&&ident(router.property,'query')&&routerMember?.type==='MemberExpression'&&ident(routerMember.property,'useRouter')&&importsByName.get(routerMember.object.name)===11163,'Actual native router query binding changed')
 const flag=definition(entry,queryArguments[2].name);need(flag?.type==='LogicalExpression'&&flag.operator==='||'&&member(flag.left,routerName,'is_careers_page')&&flag.right.type==='UnaryExpression'&&flag.right.operator==='!'&&literal(flag.right.argument,1),'Actual native careers query flag binding changed')
 const parents=new Map();walk(entry,(node,parent)=>parents.set(node,parent));const critical=new Set([helperName,routerName,queryArguments[2].name])
 for(let node=parents.get(consumer);node&&node!==entry;node=parents.get(node))if(/^(?:Function|ArrowFunction)/.test(node.type)){need(!node.params.some(p=>ident(p)&&critical.has(p.name)),'Actual consumer parameter shadows native account/client');noShadow(node,critical)}
 need(!all(entry,n=>n.type==='AssignmentExpression'&&ident(n.left)&&critical.has(n.left.name)||n.type==='UpdateExpression'&&ident(n.argument)&&critical.has(n.argument.name)).length,'Actual native account/client binding overwritten')


 // Bind the GET inside the actually invoked async workflow, not a dormant nested function.
 const workflow=one(vars(entry).filter(d=>all(d.init,n=>n===consumer).length),'component listing workflow binding'),loader=workflow.init
 need(ident(workflow.id)&&loader?.type==='CallExpression'&&loader.arguments.length===0&&loader.callee.type==='FunctionExpression'&&loader.callee.params.length===0,'Native listing workflow is not invoked')
 const asyncBinding=one(vars(loader.callee),'native async workflow'),wrapper=one(statements(loader.callee).filter(s=>s.type==='ReturnStatement'),'native async workflow return').argument
 need(loader.callee.body.body.length===2&&ident(asyncBinding.id)&&asyncBinding.init?.type==='CallExpression'&&asyncBinding.init.arguments.length===1&&wrapper?.type==='FunctionExpression'&&wrapper.params.length===0&&wrapper.body.body.length===1,'Native listing async wrapper changed')
 const applied=wrapper.body.body[0].argument
 need(wrapper.body.body[0].type==='ReturnStatement'&&applied?.type==='CallExpression'&&member(applied.callee,asyncBinding.id.name,'apply')&&applied.arguments.length===2&&applied.arguments[0].type==='ThisExpression'&&ident(applied.arguments[1],'arguments'),'Native listing workflow is not the returned invoked async function')
 const marked=asyncBinding.init.arguments[0],generator=marked?.arguments?.[0]
 need(marked?.type==='CallExpression'&&marked.callee.type==='MemberExpression'&&ident(marked.callee.property,'mark')&&marked.arguments.length===1&&generator?.type==='FunctionExpression','Native listing generator is not consumed')
 const wrapped=one(statements(generator).filter(s=>s.type==='ReturnStatement'),'native active generator return').argument,state=wrapped?.arguments?.[0]
 need(wrapped?.type==='CallExpression'&&wrapped.callee.type==='MemberExpression'&&ident(wrapped.callee.property,'wrap')&&state?.type==='FunctionExpression'&&enclosingFunction(consumer,parents)===state,'Listing GET exists only in an uninvoked nested function')
 const effect=one(statements(entry).filter(s=>{const call=s.expression,callee=callMember(call),callback=call?.arguments?.[0],deps=call?.arguments?.[1],body=callback?.body?.body;if(!(call?.type==='CallExpression'&&callee?.type==='MemberExpression'&&ident(callee.object)&&importsByName.get(callee.object.name)===67294&&ident(callee.property,'useEffect')&&call.arguments.length===2&&deps?.type==='ArrayExpression'&&deps.elements.length===0&&callback?.type==='FunctionExpression'&&callback.params.length===0&&body?.length===1))return false;const request=body[0].expression;return body[0].type==='ExpressionStatement'&&request?.type==='CallExpression'&&ident(request.callee,workflow.id.name)&&request.arguments.length===1&&literal(request.arguments[0],null)}),'active component listing effect')

 const he=exportsOf(helper.fn),getter=definition(helper.fn,he.get(callMember(consumer).property.name)),builder=definition(helper.fn,he.get(callMember(consumer.arguments[0]).property.name))
 need(getter?.type==='FunctionExpression'&&getter.params.length===1&&builder?.type==='FunctionExpression'&&builder.params.length===8,'Native query and GET exported functions')
 const queryText=sourceOf(helper.entry.program,builder),params=builder.params.map(p=>p.name),local=vars(builder)[0]
 need(local&&ident(local.id)&&queryText.includes('api/career/jobs/?company_uuid=')&&all(builder,n=>n.type==='CallExpression'&&ident(n.callee,'encodeURIComponent')).length===1,'Native company query builder missing')
 const expected='"api/career/jobs/?company_uuid=".concat(encodeURIComponent('+params[0]+'.company_uuid.trim()),"&page=").concat('+params[1]+',"&is_careers_page=").concat('+params[2]+')'
 const shape=n=>JSON.stringify(n,(k,v)=>['start','end','raw'].includes(k)?undefined:v)
 need(shape(local.init)===shape(parse('('+expected+')',{ecmaVersion:'latest'}).body[0].expression),'Native exact UUID/page/careers query binding changed')
 const urlWrites=all(builder,n=>n.type==='AssignmentExpression'&&ident(n.left,local.id.name)),expectedFilters=['&company_product=','&department=','&location=','&query=']
 need(urlWrites.length===4&&urlWrites.every(n=>n.operator==='+='&&n.right.type==='CallExpression')&&isDeepStrictEqual(urlWrites.map(n=>{let c=n.right;while(c?.type==='CallExpression'&&c.callee?.type==='MemberExpression')c=c.callee.object;return c?.value}).sort(),expectedFilters.sort()),'Unknown native account/query rewrite')
 const returned=one(builder.body.body.filter(n=>n.type==='ReturnStatement'),'native complete query return').argument;need(returned?.type==='SequenceExpression'&&ident(returned.expressions.at(-1),local.id.name),'Native complete query return changed')

 const get=one(all(getter,n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&ident(n.callee.property,'get')),'actual helper GET'),clientAlias=get.callee.object
 need(clientAlias.type==='MemberExpression'&&ident(clientAlias.object)&&ident(clientAlias.property,'Z'),'Native helper HTTP client changed');const clientModuleID=imports(helper.fn).get(clientAlias.object.name),http=modules.get(clientModuleID);need(http,'Native actually imported HTTP client')
 const create=one(all(http.fn,n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&ident(n.callee.property,'create')),'native client creation'),config=create.arguments[0];need(config?.type==='ObjectExpression','Literal native HTTP client configuration');const configFields=new Map(config.properties.map(p=>[p.key.name??p.key.value,p.value]));need(literal(configFields.get('baseURL'),API),'Actual consumed native API origin changed')
 need(all(getter,n=>n.type==='ReturnStatement'&&member(n.argument,n.argument?.object?.name,'data')).length===1,'Actual complete native response-data consumer changed')
 need(getter.body.body.length===1&&getter.body.body[0].type==='ReturnStatement','Native GET must be the active returned consumer')
 const catchCall=getter.body.body[0].argument,thenCall=catchCall?.callee?.object,dataConsumer=thenCall?.arguments?.[0]
 need(catchCall?.type==='CallExpression'&&catchCall.callee.type==='MemberExpression'&&ident(catchCall.callee.property,'catch')&&thenCall?.type==='CallExpression'&&thenCall.callee.type==='MemberExpression'&&ident(thenCall.callee.property,'then')&&thenCall.callee.object===get&&thenCall.arguments.length===1&&dataConsumer?.type==='FunctionExpression'&&dataConsumer.params.length===1&&dataConsumer.body.body.length===1&&dataConsumer.body.body[0].type==='ReturnStatement'&&member(dataConsumer.body.body[0].argument,dataConsumer.params[0].name,'data'),'Native actual returned full-response consumer changed')

 need(get.arguments.length===1&&shape(get.arguments[0])===shape(parse('("".concat('+getter.params[0].name+'))',{ecmaVersion:'latest'}).body[0].expression),'Actual native GET URL/options differ')
 need(isDeepStrictEqual([...configFields.keys()].sort(),['baseURL','headers','timeout'])&&literal(configFields.get('timeout'),30000),'Unreviewed native HTTP client method/auth/body options')
 const headers=configFields.get('headers');need(headers?.type==='ObjectExpression'&&headers.properties.length===1&&(headers.properties[0].key.value??headers.properties[0].key.name)==='Content-Type'&&literal(headers.properties[0].value,'application/json'),'Native HTTP header options differ')
 const instance=one(vars(http.fn).filter(d=>d.init===create),'actual native HTTP instance binding'),exported=statements(http.fn).filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&member(n.expression.left,http.fn.params[1].name,'Z'))
 need(ident(instance.id)&&exported.length===1&&ident(exported[0].expression.right,instance.id.name),'Native exported client is not the actually configured instance')

 const detailCalls=all(route.fn,n=>n.type==='CallExpression'&&callMember(n)?.type==='MemberExpression'&&ident(callMember(n).object)&&ident(callMember(n).property,'ue'))
 const detailCall=one(detailCalls,'native detail action consumed by role component'),action=modules.get(importsByName.get(callMember(detailCall).object.name));need(action,'Imported native detail action');const detail=definition(action.fn,exportsOf(action.fn).get('ue'))
 const request=one(all(detail,n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&ident(n.callee.property,'get')),'actual native detail GET'),detailClient=request.callee.object
 need(detailClient.type==='MemberExpression'&&ident(detailClient.property,'Z')&&imports(action.fn).get(detailClient.object.name)===clientModuleID,'Native detail client authority differs')
 need(sourceOf(action.entry.program,request.arguments[0])==='"api/career/jobs/".concat('+detail.params[1].name+',"/?company_uuid=").concat('+detail.params[0].name+',"&is_careers_page=false")','Actual native detail UUID/id binding changed')
 const cardCandidates=[];for(const[id,m]of modules)if(all(m.fn,n=>literal(n,'jobs-card')).length)cardCandidates.push({id,...m})
 const card=one(cardCandidates,'native role card module');need([...importsByName.values()].includes(card.id),'Native role card is not imported by careers entry')
 // Follow the active component return through the list renderer and virtual item callback.
 const jsxName=one([...importsByName].filter(([,id])=>id===85893),'native JSX runtime import')[0],cardName=one([...importsByName].filter(([,id])=>id===card.id),'native imported card binding')[0]
 const jsx=call=>call?.type==='CallExpression'&&callMember(call)?.type==='MemberExpression'&&ident(callMember(call).object,jsxName)&&['jsx','jsxs'].includes(callMember(call).property.name)
 const renderedCard=one(all(route.fn,n=>jsx(n)&&member(n.arguments[0],cardName,'Z')),'actual rendered native role card'),routeParents=new Map();walk(route.fn,(node,parent)=>routeParents.set(node,parent))
 const item=enclosingFunction(renderedCard,routeParents),itemProperty=routeParents.get(item),itemProps=routeParents.get(itemProperty),virtualizer=routeParents.get(itemProps)
 need(item?.type==='FunctionExpression'&&item.body.body.length===1&&item.body.body[0].type==='ReturnStatement'&&item.body.body[0].argument===renderedCard&&itemProperty?.type==='Property'&&ident(itemProperty.key,'itemContent')&&jsx(virtualizer)&&virtualizer.arguments[1]===itemProps,'Native card is not the active virtual row renderer')
 const virtualComponent=virtualizer.arguments[0];need(virtualComponent?.type==='MemberExpression'&&ident(virtualComponent.object)&&importsByName.get(virtualComponent.object.name)===20348&&ident(virtualComponent.property,'OO'),'Native row virtualizer consumer changed')
 const listBinding=one(vars(route.fn).filter(d=>d.init?.type==='FunctionExpression'&&all(d.init,n=>n===renderedCard).length),'native listing component binding'),listComponent=listBinding.init
 need(ident(listBinding.id)&&returnedContains(listComponent,virtualizer),'Native role renderer is outside the returned listing tree')
 const renderedList=one(all(entry,n=>jsx(n)&&ident(n.arguments[0],listBinding.id.name),{nested:false}),'native list consumed by careers component'),listProps=renderedList.arguments[1]
 need(returnedContains(entry,renderedList)&&listProps?.type==='ObjectExpression'&&listProps.properties.some(p=>ident(p.key,'jobs')&&ident(p.value))&&listProps.properties.some(p=>ident(p.key,'loadJobs')&&ident(p.value,workflow.id.name)),'Native listing/card is disconnected from the active careers render')

 const link=one(all(card.fn,n=>n.type==='Property'&&ident(n.key,'href')&&ident(n.value,'Ie')),'native role/apply link consumer')
 const cardFunction=one(all(card.fn,n=>n.type==='FunctionExpression'&&all(n,p=>p===link,{nested:false}).length),'native role card function'),nativeLink=definition(cardFunction,'Ie'),nativeRole=definition(cardFunction,'we')
 need(nativeLink.type==='ConditionalExpression'&&sourceOf(card.entry.program,nativeLink).includes('.APPLY_NOW,"=",!0)')&&sourceOf(card.entry.program,nativeRole).includes('.JOB_ID,"=")')&&sourceOf(card.entry.program,nativeRole).includes('.UUID,"=")'),'Native own role/application declaration changed')

 const constantsName=one(all(nativeRole,n=>n.type==='MemberExpression'&&ident(n.property,'CAREER')),'native role route constant').object.object?.name,constantID=imports(card.fn).get(constantsName),constantModule=modules.get(constantID)
 need(constantModule,'Actually imported native route/query constants');const constantsExports=exportsOf(constantModule.fn),queryConstants=definition(constantModule.fn,constantsExports.get('w')),routeConstants=definition(constantModule.fn,constantsExports.get('_'))
 need(queryConstants?.type==='ObjectExpression'&&routeConstants?.type==='ObjectExpression','Literal actual native role/apply constants')
 const q=new Map(queryConstants.properties.map(p=>[p.key.name??p.key.value,p.value])),routes=new Map(routeConstants.properties.map(p=>[p.key.name??p.key.value,p.value]))
 for(const[k,v]of Object.entries({COMPANY:'company',JOB_ID:'job_id',UUID:'company_uuid',UTM_SOURCE:'utm_source',SOURCE:'source',IS_HEADER_VISIBLE:'isHeaderVisible',APPLY_NOW:'apply_now'}))need(literal(q.get(k),v),'Native actual role/apply query constant changed: '+k)
 need(literal(routes.get('CAREER'),'/careers'),'Native own public role route changed')
 const propsName=cardFunction.params[0]?.name;need(ident(cardFunction.params[0])&&member(definition(cardFunction,'d'),propsName,'jobId')&&member(definition(cardFunction,'f'),propsName,'company'),'Actual role link job/account props changed')
 const nativeRouter=definition(cardFunction,'ae'),nativeRouterCall=nativeRouter?.object,nativeRouterMember=callMember(nativeRouterCall)
 need(nativeRouter?.type==='MemberExpression'&&ident(nativeRouter.property,'query')&&nativeRouterMember?.type==='MemberExpression'&&ident(nativeRouterMember.property,'useRouter')&&imports(card.fn).get(nativeRouterMember.object.name)===11163,'Actual native role link router owner changed')
 const expectedRole='"".concat('+constantsName+'._.CAREER,"?").concat('+constantsName+'.w.COMPANY,"=").concat(f,"&").concat('+constantsName+'.w.JOB_ID,"=").concat(d,"&").concat('+constantsName+'.w.UUID,"=").concat(ae['+constantsName+'.w.UUID],"&").concat('+constantsName+'.w.UTM_SOURCE,"=").concat((0,x.tI)(ae),"&").concat('+constantsName+'.w.SOURCE,"=").concat((0,x.tI)(ae),"&").concat('+constantsName+'.w.IS_HEADER_VISIBLE,"=").concat(ae['+constantsName+'.w.IS_HEADER_VISIBLE])'
 need(shape(nativeRole)===shape(parse('('+expectedRole+')',{ecmaVersion:'latest'}).body[0].expression),'Actual native job/account link value binding changed')
 const legacyApply=nativeLink.alternate,expectedApply='"".concat(we,"&").concat('+constantsName+'.w.APPLY_NOW,"=",!0)'
 need(legacyApply?.type==='ConditionalExpression'&&ident(legacyApply.test,'ue')&&ident(legacyApply.alternate,'we')&&shape(legacyApply.consequent)===shape(parse('('+expectedApply+')',{ecmaVersion:'latest'}).body[0].expression),'Actual own legacy role Apply URL binding changed')

 check();return {apiOrigin:API,boardURL:BOARD,nativeRoute:'/careers',routeModuleID:routeID,listingHelperModuleID:importsByName.get(helperName),httpClientModuleID:clientModuleID,detailActionModuleID:importsByName.get(callMember(detailCall).object.name),cardModuleID:card.id,listingURL:API+'/api/career/jobs/?company_uuid='+UUID+'&page=1&is_careers_page=true',nativeListingQuerySource:queryText,nativeListingWorkflowSource:sourceOf(route.entry.program,workflow.init),nativeListingEffectSource:sourceOf(route.entry.program,effect),nativeCardConsumerSource:sourceOf(route.entry.program,renderedCard),nativeRenderedListingSource:sourceOf(route.entry.program,renderedList),nativeDetailRequestSource:sourceOf(action.entry.program,request),nativeRoleURLSource:sourceOf(card.entry.program,nativeRole),nativeApplyURLSource:sourceOf(card.entry.program,nativeLink),programURLs:entries.map(e=>e.url),downloadedJavaScriptExecuted:false,sourceBrowserActivationVerified:false}
}
