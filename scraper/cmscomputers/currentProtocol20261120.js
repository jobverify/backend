import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure('cmscomputers',message)}
const name=node=>node?.type==='Identifier'?node.name:node?.type==='Literal'&&typeof node.value==='string'?node.value:null
const properties=node=>node?.type==='ObjectExpression'&&node.properties.every(p=>p.type==='Property'&&!p.computed&&p.kind==='init')?new Map(node.properties.map(p=>[name(p.key),p.value])):null
const literal=node=>node?.type==='Literal'?node.value:undefined
const cache=new Map()
const methods={
 getInternalApiCareerSiteBrandsConfiguration:{url:'/internal_api/career_site/brands/configuration',query:{career_site:0}},
 getInternalApiCareerSiteLocations:{url:'/internal_api/career_site/locations',query:{career_site:0,query:1,page:2,per_page:3,skip_pagination:4}},
 getInternalApiCareerSiteOpenings:{url:'/internal_api/career_site/openings',query:{career_site:0,page:5,radius:1,sort_by:2,category:3,compensation_type:4,query:6,department:7,location:8,position:9,locale:10}},
 getInternalApiPortalApplicationFormsNew:{url:'/internal_api/portal/{account_slug}/application_forms/new',path:{account_slug:0},query:{funnel_id:1,try_new_ui:2,persona_id:3,brand_id:4}}
}
export function declaredCmsPrograms(document,origin){
 const base=new URL(origin),prefix=base.origin==='https://apply.rekrutek.ai'?'/apply/':'/'
 const rows=document.nodes(n=>n.tag==='script'&&!n.inert&&n.attrs.src).flatMap(n=>{
  let url;try{url=new URL(n.attrs.src,base)}catch{return[]}
  if(url.origin!==base.origin||url.username||url.password||url.search||url.hash)return[]
  const match=new RegExp('^'+prefix+'[a-zA-Z0-9_-]{6,64}/(runtime|npm\\.api-clients|main)\\.[a-zA-Z0-9_-]{8,64}\\.js$').exec(url.pathname)
  return match?[{url:url.href,kind:match[1]}]:[]
 })
 need(rows.length===3&&new Set(rows.map(r=>r.kind)).size===3,'current native declared program selection changed')
 return rows
}
export function readCmsProtocol(program,{kind,surface}){
 if(kind==='runtime')return{kind:'declared-runtime-not-executed',surface}
 const key=surface+':'+kind+':'+createHash('sha256').update(program).digest('hex')
 if(cache.has(key))return structuredClone(cache.get(key))
 let ast;try{ast=parse(program,{ecmaVersion:'latest',sourceType:'script'})}catch{need(false,'current native program is not parseable data')}
 const foundMethods=new Map(),origins=[],sortOptions=[],routes=[],stack=[{node:ast,parent:null}]
 while(stack.length){
  const {node,parent}=stack.pop();if(!node||typeof node!=='object')continue
  if(node.type==='MethodDefinition'&&node.static&&Object.hasOwn(methods,name(node.key))){const method=name(node.key);if(!foundMethods.has(method))foundMethods.set(method,[]);foundMethods.get(method).push(node)}
  if(node.type==='IfStatement'&&node.test?.type==='BinaryExpression'&&node.test.operator==='==='&&[literal(node.test.left),literal(node.test.right)].includes(surface==='board'?'careers.rekrutek.ai':'apply.rekrutek.ai')){
   const p=properties(node.consequent?.type==='ReturnStatement'?node.consequent.argument:null)
   if(p)origins.push({environment:literal(p.get('environment')),monolithOrigin:literal(p.get('monolithOrigin')),tenant:literal(p.get('tenant'))})
  }
  if(node.type==='ArrayExpression'&&node.elements.length>=1&&node.elements.length<=20){const p=node.elements.map(properties);if(p.every(Boolean)){const keys=p.map(x=>literal(x.get('key')));if(keys.includes('title')&&keys.includes('distance')&&keys.includes('date_posted'))sortOptions.push(keys)}}
  if(node.type==='ObjectExpression'&&parent?.type==='CallExpression'&&parent.arguments[1]===node&&parent.arguments[0]?.type==='MemberExpression'&&name(parent.arguments[0].property)==='Route'){
   const path=literal(properties(node)?.get('path'));if(path==='/apply/:accountSlug/opening/:funnelId')routes.push(path)
  }
  if(node.type==='Literal')continue
  for(const value of Object.values(node))if(Array.isArray(value)){for(const child of value)if(child&&typeof child==='object')stack.push({node:child,parent:node})}else if(value&&typeof value==='object')stack.push({node:value,parent:node})
 }
 let model
 if(kind==='npm.api-clients'){
  const selected=surface==='board'?Object.keys(methods):['getInternalApiPortalApplicationFormsNew'],requests=[]
  for(const method of selected){const nodes=foundMethods.get(method)??[];need(nodes.length===1,'current native public method declaration changed: '+method);const fn=nodes[0].value,body=fn.body?.body,call=body?.length===1&&body[0].type==='ReturnStatement'?body[0].argument:null,p=properties(call?.type==='CallExpression'&&call.arguments.length===2?call.arguments[1]:null),expected=methods[method]
   need(fn.params.every(x=>x.type==='Identifier')&&p&&literal(p.get('method'))==='GET'&&literal(p.get('url'))===expected.url&&p.size===2+Number(Boolean(expected.path))+Number(Boolean(expected.query)),'current native public GET protocol changed: '+method)
   const record={method:'GET',url:expected.url}
   for(const group of ['path','query'])if(expected[group]){const values=properties(p.get(group));need(values&&values.size===Object.keys(expected[group]).length&&Object.entries(expected[group]).every(([k,index])=>values.get(k)?.type==='Identifier'&&values.get(k).name===fn.params[index]?.name),'current native account/role/query binding changed: '+method);record[group]=expected[group]}
   requests.push(record)
  }
  model={surface,requests}
 }else{
  need(origins.length===1&&origins[0].environment==='prod'&&origins[0].monolithOrigin==='https://hire.rekrutek.ai'&&origins[0].tenant==='rekrutek','current native public API origin declaration changed')
  if(surface==='board')need(sortOptions.length>=1,'current native title sort declaration changed')
  else need(routes.length===1,'current native account/role application route changed')
  model={surface,origin:origins[0],...(surface==='board'?{declaredSortKeys:[...new Set(sortOptions.flat())].sort()}:{roleRoute:routes[0]})}
 }
 if(cache.size>=20)cache.clear();cache.set(key,model);return structuredClone(model)
}
