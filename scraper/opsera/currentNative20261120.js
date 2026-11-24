import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {createCurrentNativeReader} from './currentReader20261120.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
const SOURCE='opsera',CONFIGURED='https://www.opsera.io/careers/',CURRENT='https://opsera.ai/careers'
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
const fail=message=>firstPartyFailure(SOURCE,message,{failureKind:'surface_drift_or_fail_closed',sourceScopeComplete:false})
const full=node=>typeof node==='string'?node:{tag:node.tag,attrs:node.attrs,children:node.children.map(full),...(node.raw!==undefined?{raw:node.raw}:{}),inert:node.inert===true}
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const [key,v]of Object.entries(node))if(!['start','end'].includes(key)){if(Array.isArray(v))v.forEach(n=>walk(n,visit));else walk(v,visit)}}
const id=(node,name)=>node?.type==='Identifier'&&node.name===name
const literal=(node,value)=>node?.type==='Literal'&&node.value===value
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&!node.optional&&id(node.object,object)&&id(node.property,property)
const callee=node=>node?.type==='SequenceExpression'?node.expressions.at(-1):node
const propName=p=>p?.key?.type==='Identifier'?p.key.name:p?.key?.type==='Literal'?p.key.value:null
function props(node){
 if(node?.type!=='ObjectExpression'||node.properties.some(p=>p.type!=='Property'||p.computed||p.method||p.kind!=='init'))return null
 const pairs=node.properties.map(p=>[propName(p),p.value])
 if(pairs.some(([name])=>typeof name!=='string')||new Set(pairs.map(([name])=>name)).size!==pairs.length)return null
 return Object.fromEntries(pairs)
}
function jsx(node,tag){
 const c=callee(node?.callee)
 if(node?.type!=='CallExpression'||c?.type!=='MemberExpression'||c.computed||!['jsx','jsxs'].includes(c.property.name)||node.arguments.length<2||tag&&!literal(node.arguments[0],tag))return null
 return props(node.arguments[1])
}
const only=(object,keys)=>object&&Object.keys(object).every(k=>keys.includes(k))
const ownProgram=url=>{try{const u=new URL(url);return u.href===url&&u.origin==='https://opsera.ai'&&!u.search&&!u.hash&&/^\/_next\/static\/chunks\/[a-zA-Z0-9_.-]+\.js$/.test(u.pathname)}catch{return false}}
export function readCurrentOpseraPage(html){
 const d=readNativeDocument(html),head=activeHead(html)
 if(head.titles.length!==1||head.titles[0]!=="Careers at Opsera - let's grow together"||d.nodes(n=>n.tag==='base').length)throw fail('Current publisher identity changed')
 const roots=d.nodes(n=>n.attrs.id==='roles')
 if(roots.length!==1||!d.text(roots[0]).includes('Current positions.'))throw fail('Current native roles section changed')
 const roles=d.nodes(n=>n.tag==='li'&&n.children.some(c=>typeof c!=='string'&&c.tag==='h3'),roots[0])
 const records=roles.map((node,index)=>{
  const title=d.nodes(n=>n.tag==='h3',node),meta=d.nodes(n=>n.tag==='ul',node)
  if(title.length!==1||meta.length!==1||d.nodes(n=>['a','button','form'].includes(n.tag),node).length)throw fail('Unknown role title/metadata/navigation carrier')
  const fields=meta[0].children.filter(n=>typeof n!=='string'),values=fields.map(n=>d.text(n))
  if(fields.length!==3||fields.some(n=>n.tag!=='li')||!values.every(Boolean))throw fail('Incomplete literal native role metadata')
  const nativeCountry=values[1]==='India-based, remote'?'India':values[1]==='US-based, remote'?'United States':null
  return {ordinal:index+1,title:d.text(title[0]),department:values[0],location:values[1],employmentType:values[2],nativeCountry,country:nativeCountry,fullModel:full(node)}
 })
 if(!records.length||records.length>64)throw fail('Unknown empty or excessive roles model')
 const declarations=d.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>({attrs:n.attrs,url:new URL(n.attrs.src,CURRENT).href}))
 const programs=declarations.filter(p=>ownProgram(p.url))
 if(!programs.length||programs.length>32||new Set(programs.map(p=>p.url)).size!==programs.length)throw fail('Missing, duplicate, or excessive own declared clients')
 return {records,programs,declarations,fullModel:full(d.nodes(n=>n.tag==='root')[0])}
}
function typedRows(node){
 if(node?.type!=='ArrayExpression'||!node.elements.length||node.elements.length>64)return null
 const rows=[]
 for(const element of node.elements){const p=props(element);if(!p||Object.keys(p).length!==4||!['title','dept','location','slug'].every(k=>p[k]?.type==='Literal'&&typeof p[k].value==='string'&&p[k].value.trim()))return null;rows.push(Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v.value])))}
 return rows
}
function rendererBinding(module,arrayName){
 const owner=module.params[0]?.name
 if(module.params.length!==1||!owner)return null
 const exports=module.body.body.filter(s=>s.type==='ExpressionStatement').map(s=>s.expression).filter(c=>c?.type==='CallExpression'&&member(c.callee,owner,'s'))
 const components=exports.flatMap(c=>c.arguments[0]?.type==='ArrayExpression'?c.arguments[0].elements.filter((n,i,all)=>i>=2&&literal(all[i-2],'default')&&literal(all[i-1],0)&&n?.type==='FunctionExpression'):[])
 if(components.length!==1)return null
 const component=components[0],declarations=component.body.body.filter(s=>s.type==='VariableDeclaration').flatMap(s=>s.declarations)
 const state=declarations.find(d=>d.id.type==='ArrayPattern'&&d.id.elements.length===2&&callee(d.init?.callee)?.property?.name==='useState'&&d.init.arguments?.[0]?.type==='Literal'&&typeof d.init.arguments[0].value==='string')
 if(!state)return null
 const stateName=state.id.elements[0]?.name
 const filtered=declarations.find(d=>{
  const c=d.init,f=c?.alternate,callback=f?.arguments?.[0],filter=callback?.body
  return d.id.type==='Identifier'&&c?.type==='ConditionalExpression'&&c.test.type==='BinaryExpression'&&c.test.operator==='==='&&literal(c.test.left,state.init.arguments[0].value)&&id(c.test.right,stateName)&&id(c.consequent,arrayName)&&f.type==='CallExpression'&&member(f.callee,arrayName,'filter')&&callback?.type==='ArrowFunctionExpression'&&callback.params.length===1&&filter?.type==='BinaryExpression'&&filter.operator==='==='&&member(filter.left,callback.params[0].name,'dept')&&id(filter.right,stateName)
 })
 if(!filtered)return null
 const maps=[];walk(component,n=>{if(n.type==='CallExpression'&&member(n.callee,filtered.id.name,'map'))maps.push(n)})
 if(maps.length!==1)return null
 const map=maps[0],callback=map.arguments[0],row=callback?.params?.[0]?.name,render=callback?.body
 if(callback?.type!=='ArrowFunctionExpression'||callback.params.length<1||callback.params.length>2||!row)return null
 const outer=jsx(render),children=outer?.children?.elements
 if(!only(outer,['as','className','style','delay','children'])||!literal(outer.as,'li')||!member(render.arguments[2],row,'slug')||children?.length!==2)return null
 const heading=jsx(children[0],'h3'),meta=jsx(children[1],'ul'),items=meta?.children?.elements
 if(!only(heading,['className','children'])||!member(heading.children,row,'title')||!only(meta,['className','children'])||items?.length!==3)return null
 for(const [i,key]of ['dept','location',null].entries()){const p=jsx(items[i],'li');if(!only(p,['className','children'])||(key?!member(p.children,row,key):p.children?.type!=='Literal'||typeof p.children.value!=='string'||!p.children.value))return null}
 let bad=false;walk(component,n=>{
  const p=jsx(n)
  if(p&&(Object.keys(p).some(k=>['href','action','formAction','dangerouslySetInnerHTML'].includes(k))||n.arguments[0]?.type==='Literal'&&!['div','button','span','p','ul','li','h3'].includes(n.arguments[0].value)))bad=true
  if(n.type==='AssignmentExpression'||n.type==='MemberExpression'&&['href','open','assign','replace','push'].includes(n.computed?n.property?.value:n.property?.name))bad=true
  if(p)for(const key of ['className','style','delay'])walk(p[key],v=>{if(['CallExpression','AssignmentExpression','UpdateExpression','NewExpression'].includes(v.type))bad=true})
  if(n.type==='MemberExpression'&&id(n.object,row)&&!['title','dept','location','slug'].includes(n.property?.name))bad=true
 })
 if(bad)return null
 return {fields:['title','dept','location'],employmentType:jsx(items[2],'li').children.value,slugUsage:'React key only',nativeApplicationTargets:[],scope:'Published literal metadata renderer only; browser behavior and employer-wide inventory remain unproved'}
}
export function findCurrentOpseraBindings(program){
 const ast=parse(program,{ecmaVersion:'latest'}),modules=[]
 let outsideNavigation=false
 for(const statement of ast.body){
  const expression=statement.type==='ExpressionStatement'?statement.expression:null,c=callee(expression?.callee)
  if(expression?.type==='CallExpression'&&c?.type==='MemberExpression'&&!c.computed&&c.property.name==='push'&&expression.arguments.length===1&&expression.arguments[0]?.type==='ArrayExpression'){
   const elements=expression.arguments[0].elements
   for(let i=1;i<elements.length;i++)if(['ArrowFunctionExpression','FunctionExpression'].includes(elements[i]?.type)&&elements[i].body.type==='BlockStatement'&&elements[i-1]?.type==='Literal'&&Number.isSafeInteger(elements[i-1].value))modules.push(elements[i])
  }else{
   // A direct navigation appended beside the registration is relevant, unlike
   // passive stylesheet/class-name or unrelated framework-module changes.
   let navigation=false;walk(statement,n=>{if(n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&n.left.property?.name==='href')navigation=true})
   if(navigation)outsideNavigation=true
  }
 }
 const bindings=[]
 for(const module of modules){
  const arrays=module.body.body.filter(s=>s.type==='VariableDeclaration').flatMap(s=>s.declarations).map(d=>({name:d.id.name,rows:typedRows(d.init)})).filter(d=>d.name&&d.rows)
  for(const array of arrays){const renderer=rendererBinding(module,array.name);if(!renderer)throw fail('Unreviewed literal native role renderer/application behavior');bindings.push({rows:array.rows,renderer})}
 }
 if(bindings.length&&outsideNavigation)throw fail('Unreviewed native application/navigation behavior')
 return bindings
}
export function readCurrentOpseraClient(program){
 const bindings=findCurrentOpseraBindings(program)
 if(bindings.length!==1)throw fail('Expected one unique native role-array/renderer binding')
 return bindings[0].rows
}
export function bindCurrentOpseraRows(page,binding){
 if(binding.rows.length!==page.records.length)throw fail('Rendered/client record count conflicts')
 for(const [i,r]of page.records.entries()){const native=binding.rows[i];if(r.title!==native.title||r.department!==native.dept||r.location!==native.location||r.employmentType!==binding.renderer.employmentType)throw fail('Rendered/client native role metadata conflicts')}
 return binding
}
const relevant=page=>page.records.map(({ordinal,title,department,location,employmentType,nativeCountry})=>({ordinal,title,department,location,employmentType,nativeCountry}))
export async function runCurrentOpsera(options={}){
 const declared=new Set(),io=createCurrentNativeReader(options,{source:SOURCE,admitted:[[CONFIGURED,'html']],learnedURL:(url,kind)=>kind==='javascript'&&declared.has(url)&&ownProgram(url)})
 const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,closingReconciled:false,indiaJobs:0,eligibleJobs:0,records:[],documents:[],configuredURL:CONFIGURED,currentObservedFinalURL:CURRENT}
 const read=async url=>{const r=await io.read(url);audit.documents.push({requestedUrl:url,url:r.url,sha256:r.sha256,body:r.body});return r.body}
 const clients=async page=>{
  const bindings=[]
  for(const p of page.programs){declared.add(p.url);io.allow(p.url,'javascript');bindings.push(...findCurrentOpseraBindings(await read(p.url)))}
  if(bindings.length!==1)throw fail('Expected unique own declared native role client')
  return bindCurrentOpseraRows(page,bindings[0])
 }
 try{
  const opening=readCurrentOpseraPage(await read(CONFIGURED));audit.records=structuredClone(opening.records);audit.observedRecordCount=audit.observedVacancyCount=opening.records.length;audit.indiaJobs=audit.records.filter(r=>r.country==='India').length
  const binding=await clients(opening);audit.nativeClientBinding=binding;audit.openingDeclarations=opening.declarations;audit.openingPublishedModel=opening
  for(const [i,r]of audit.records.entries())Object.assign(r,{nativeClientModel:binding.rows[i],slugUsage:binding.renderer.slugUsage,sourceUrl:CURRENT,applyUrl:null,criteria:null,hold:'native_criteria_and_application_unpublished'})
  const split=audit.documents.length,closing=readCurrentOpseraPage(await read(CONFIGURED)),closingBinding=await clients(closing)
  audit.closingPublishedModel=closing;audit.closingNativeClientBinding=closingBinding;audit.closingDeclarations=closing.declarations
  audit.rawGlobalEqual=audit.documents.length===2*split&&audit.documents.slice(0,split).every((r,i)=>r.url===audit.documents[i+split].url&&r.sha256===audit.documents[i+split].sha256)
  audit.closingReconciled=hash(relevant(opening))===hash(relevant(closing))&&hash(binding)===hash(closingBinding)
  audit.closingQualification='Only complete published role metadata and its literal renderer, not whole-browser equivalence or company scope'
  io.check();throw fail(audit.closingReconciled?'Current literal roles retained; native full criteria and active role/application URLs are unpublished':'Native opening/closing role semantics changed')
 }catch(error){
  options.signal?.throwIfAborted()
  if(error&&typeof error==='object'&&Object.isExtensible(error)){audit.transport=io.stats();Object.assign(error,{abortRetries:true,nativeCollectionEvidence:audit,lifecycleCleanupAllowed:false,sourceScopeComplete:false})}
  if(!Number.isInteger(error?.status)&&!Number.isInteger(error?.httpStatus))io.check()
  options.signal?.throwIfAborted();throw error
 }finally{io.close();options.signal?.throwIfAborted()}
}
