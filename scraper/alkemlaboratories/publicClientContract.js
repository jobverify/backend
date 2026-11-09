// Compare the published public recruiting path, without executing the SPA or
// making analytics, password screens or candidate actions inventory gates.
import {parse} from 'acorn'
import {sha,requireNative} from './publicRead.js'
const company='Alkem Laboratories',check=(ok,message)=>requireNative(ok,company,message),cache=new Map()
const walk=(root,fn)=>{const pending=[root];while(pending.length){const node=pending.pop();fn(node);for(const value of Object.values(node))if(value&&typeof value==='object'){if(Array.isArray(value))pending.push(...value.filter(v=>v&&typeof v==='object'));else pending.push(value)}}}
const canonical=node=>JSON.stringify(node,(key,value)=>['start','end','raw'].includes(key)?undefined:value)
const fingerprint=node=>sha(canonical(node)),name=node=>node?.key?.name??node?.key?.value
const literals=root=>{const values=[];walk(root,node=>{if(node.type==='Literal')values.push(node.value)});return values}
function syntax(body){let ast;try{ast=parse(body,{ecmaVersion:'latest',sourceType:'script'})}catch{check(false,'published public client JavaScript is not supported')}return ast}
function webpack(ast){
 const packs=ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression?.type==='CallExpression'&&n.expression.callee?.property?.name==='push'&&n.expression.arguments[0]?.type==='ArrayExpression').map(n=>n.expression.arguments[0])
 check(packs.length===1,'public webpack module registration changed')
 const pack=packs[0],definition=pack.elements[1],modules=new Map()
 if(definition?.type==='ArrayExpression')definition.elements.forEach((node,index)=>{if(node)modules.set(String(index),node)})
 else if(definition?.type==='ObjectExpression')for(const property of definition.properties)modules.set(String(name(property)),property.value)
 else check(false,'public webpack module table changed')
 return{pack,modules}
}
const memo=(kind,body,operation)=>{const key=kind+':'+sha(body);if(cache.has(key))return cache.get(key);const value=operation();if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,value);return value}
export function inspectPublicMain(body){return memo('main',body,()=>{
 const {pack,modules}=webpack(syntax(body)),wanted=['getUnAuthenticatedAccessToken','getOrgDetailsFromAccountName','getPublicOrgInfo','getPublicJobRefsForOrgFiltered'],candidates=[]
 for(const[moduleId,module]of modules)walk(module,node=>{if(!['ClassDeclaration','ClassExpression'].includes(node.type))return;const methods=node.body.body.filter(n=>n.type==='MethodDefinition');if(wanted.every(key=>methods.some(n=>name(n)===key)))candidates.push({moduleId,module,node,methods})})
 check(candidates.length===1,'public API service class is missing or ambiguous')
 const service=candidates[0],apiBases=[]
 for(const method of service.methods.filter(n=>n.kind==='constructor'))walk(method,node=>{if(node.type==='AssignmentExpression'&&node.left?.object?.type==='ThisExpression'&&node.left.property?.name==='API_SERVER_BASE_URL')apiBases.push(node.right?.value)})
 check(apiBases.length===1&&typeof apiBases[0]==='string','public native API origin binding changed')
 const publicMethods=Object.fromEntries(wanted.map(key=>{const methods=service.methods.filter(n=>name(n)===key);check(methods.length===1,'ambiguous public API method '+key);return[key,fingerprint(methods[0])] }))
 const aliases=new Set([service.node.id?.name].filter(Boolean)),bindings=[]
 const top=service.module.body?.body||[]
 for(let pass=0;pass<3;pass++)for(const statement of top.filter(n=>n.type==='VariableDeclaration'))for(const declaration of statement.declarations){let references=false;walk(declaration.init||{},node=>{if(node.type==='Identifier'&&aliases.has(node.name))references=true});if(references&&declaration.id?.type==='Identifier')aliases.add(declaration.id.name)}
 for(const statement of top.filter(n=>n.type!=='ClassDeclaration')){let references=false;walk(statement,node=>{if(node.type==='Identifier'&&aliases.has(node.name))references=true});if(references)bindings.push(fingerprint(statement))}
 const entryId=pack.elements[2]?.elements?.[0]?.elements?.[0]?.value,entry=modules.get(String(entryId));check(entry,'public native startup module changed')
 const renders=[],variables=[]
 walk(entry,node=>{if(node.type==='MethodDefinition'&&name(node)==='render'&&literals(node).includes('/job/publicjobs/:id'))renders.push(node);if(node.type==='VariableDeclarator')variables.push(node)})
 check(renders.length===1,'public root router binding changed')
 const loaders=[]
 for(const variable of variables){const ids=[];walk(variable.init||{},node=>{if(node.type==='CallExpression'&&node.callee?.property?.name==='e'&&node.arguments?.length===1&&Number.isSafeInteger(node.arguments[0].value))ids.push(node.arguments[0].value)})
  if(ids.length&&literals(variable).includes(3902))loaders.push({variable,ids:[...new Set(ids)].sort((a,b)=>a-b)})
 }
 check(loaders.length===1,'public employer router lazy module changed')
 return{apiBase:apiBases[0],apiServiceModule:service.moduleId,publicMethods,publicServiceBindings:bindings,entryId,rootRender:fingerprint(renders[0]),publicLazyBootstrap:fingerprint(loaders[0].variable),publicChunkIds:loaders[0].ids}
})}
export function inspectPublicRuntime(body,ids){return memo('runtime:'+ids.join(','),body,()=>{
 const ast=syntax(body),maps=[],paths=[]
 walk(ast,node=>{
  if(node.type==='ObjectExpression'&&node.properties.length>ids.length&&node.properties.every(p=>/^\d+$/.test(String(name(p)))&&typeof p.value?.value==='string'&&/^[a-f0-9]{20}$/.test(p.value.value))){const map=Object.fromEntries(node.properties.map(p=>[name(p),p.value.value]));if(ids.every(id=>map[id]))maps.push(map)}
  if(node.type==='AssignmentExpression'&&node.left?.property?.name==='p'&&node.right?.type==='Literal'&&node.right.value==='/')paths.push('/')
 })
 check(maps.length===1&&paths.length===1,'public lazy chunk URL graph changed')
 return{publicPath:'/',publicChunkIds:ids,urls:ids.map(id=>'/'+id+'.'+maps[0][id]+'.chunk.js')}
})}
export function inspectPublicInventory(body){return memo('inventory',body,()=>{
 const {modules}=webpack(syntax(body)),stores=[],defaults=[]
 for(const[moduleId,module]of modules)walk(module,node=>{
  if(['ClassDeclaration','ClassExpression'].includes(node.type)){
   const methods=node.body.body.filter(n=>n.type==='MethodDefinition'),jobs=methods.filter(n=>name(n)==='getPublicJobs')
   if(jobs.length){check(jobs.length===1,'ambiguous public inventory handler');const selected=methods.filter(n=>['getPublicJobs','getActiveCareerPage','onInitStore'].includes(name(n)));stores.push({moduleId,methods:Object.fromEntries(selected.map(n=>[name(n),fingerprint(n)]))})}
  }
  if(node.type==='ObjectExpression'){
   const keys=node.properties.map(name)
   if(['SortByV2','BunitIds','Experience','JobTypes','Locations','CreatedDate','Compensation','Skills','Keyword','ClientIds','Department'].every(key=>keys.includes(key))&&keys.length<=13)defaults.push({moduleId,keys,fingerprint:fingerprint(node)})
  }
 })
 return{stores:stores.sort((a,b)=>a.moduleId.localeCompare(b.moduleId)),defaults:defaults.sort((a,b)=>a.fingerprint.localeCompare(b.fingerprint))}
})}
export function unreviewedInlineRecruiting(scripts){
 const findings=[]
 for(const script of scripts.filter(s=>s.executable&&!s.attrs.src)){
  let ast;try{ast=syntax(script.body)}catch{continue}
  walk(ast,node=>{if(node.type==='Literal'&&typeof node.value==='string'&&/(?:\/(?:api\/)?(?:careerpage|publicjobs|jobs|positions|openings)(?:[/?]|$)|boards-api\.greenhouse|jobs\.lever\.co)/i.test(node.value))findings.push({kind:'unreviewed-native-inline-recruiting-client',target:node.value})})
 }
 return findings
}
export function inspectCorporateHandoff(body){return memo('corporate',body,()=>{
 const candidates=[]
 walk(syntax(body),node=>{if(node.type!=='ObjectExpression')return;const child=node.properties.find(p=>name(p)==='children');if(child?.value?.value!=='SEARCH JOBS')return;const click=node.properties.find(p=>name(p)==='onClick'),classes=node.properties.find(p=>name(p)==='className');if(!click)return
  check(typeof classes?.value?.value==='string','public SearchJobs client class binding is unsupported')
  const relevant=node.properties.filter(p=>/^(?:on(?:Click|Mouse\w*|Key\w*|Focus|Blur)|disabled|hidden|inert|style|children|dangerouslySetInnerHTML|tabIndex|aria-hidden|aria-disabled)$/.test(String(name(p))))
  candidates.push({publicHandoffSHA256:fingerprint({...node,properties:relevant}),clientClassName:classes.value.value})
 })
 check(candidates.length===1,'public SearchJobs executable handler is missing or ambiguous');return candidates[0]
})}
