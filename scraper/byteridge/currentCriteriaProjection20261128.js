import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {parse,parseExpressionAt} from 'acorn'
import {executableDocument} from './nativeVisibility.js'

// This finite profile permits extraction of native public DTO data. The new
// organization/loading, criteria rendering and application modules are NOT
// reviewed programs. The ordinary nativePageContract keeps rejecting them.
const profile=JSON.parse(readFileSync(new URL('./currentCriteriaProfile20261128.json',import.meta.url),'utf8'))
const digest=body=>createHash('sha256').update(body).digest('hex')
const check=(condition,message)=>{if(!condition)throw Object.assign(Error('Byteridge current native criteria data: '+message),{code:'BYTERIDGE_NATIVE_CONTRACT'})}
export const currentCriteriaClientSHA256=Object.freeze({...profile.publicClientSHA256})
export const currentCriteriaInitialScripts=Object.freeze([...profile.initialScriptURLs])
export const currentCriteriaPublicClients=Object.freeze(Object.keys(currentCriteriaClientSHA256))
export const currentCriteriaDTOKeys=Object.freeze([...profile.dtoKeys])

export function matchesCurrentCriteriaManifest(html){
 const scripts=executableDocument(html).nodes(n=>n.tag==='script'&&n.attrs.src)
  .map(n=>new URL(n.attrs.src,'https://byteridge.turbohire.co').href)
  .filter(url=>new URL(url).origin==='https://byteridge.turbohire.co')
 return scripts.length===currentCriteriaInitialScripts.length
  &&new Set(scripts).size===scripts.length&&scripts.every(url=>currentCriteriaInitialScripts.includes(url))
}

const method=(body,owner,name,hash,staticMethod=false)=>{
 const nodes=owner.body.body.filter(node=>node.key?.name===name)
 check(nodes.length===1&&nodes[0].type==='MethodDefinition'&&!nodes[0].computed&&nodes[0].static===staticMethod
  &&nodes[0].kind===(name==='constructor'?'constructor':'method')&&digest(body.slice(nodes[0].start,nodes[0].end))===hash,
  'unchanged public read service '+name+' binding changed')
}

export function qualifyCurrentCriteriaReadService(body){
 check(typeof body==='string'&&Buffer.byteLength(body)<=16000000,'invalid public read service body')
 // The entire main program remains identical to November 18. Independently
 // bind its complete public-read methods and origin; never run the program.
 const declarations=[...body.matchAll(/class\s+[A-Za-z_$][\w$]*\{constructor\(\)\{this\.API_SERVER_BASE_URL="(https:[^"]+)"/g)]
 check(declarations.length===2&&declarations[0][1]===profile.apiOrigin&&declarations[1][1]==='https://th-scoring-engine.turbohire.co','native read service origins changed')
 const service=parseExpressionAt(body,declarations[0].index,{ecmaVersion:'latest'})
 check(service.type==='ClassExpression'&&service.superClass===null,'native public service structure changed')
 for(const [name,hash]of Object.entries(profile.publicMethodSHA256)){
  if(name==='getUnauthenticatedAccessToken')continue
  method(body,service,name,hash)
 }
 const marker=body.indexOf('static getUnauthenticatedAccessToken(')
 check(marker>0&&body.indexOf('static getUnauthenticatedAccessToken(',marker+1)===-1,'anonymous read-session helper changed')
 const owners=[...body.slice(0,marker).matchAll(/class\s+[A-Za-z_$][\w$]*\s*\{/g)]
 const login=parseExpressionAt(body,owners.at(-1).index,{ecmaVersion:'latest'})
 method(body,login,'getUnauthenticatedAccessToken',profile.publicMethodSHA256.getUnauthenticatedAccessToken,true)
 return {apiOrigin:profile.apiOrigin,readMethods:Object.keys(profile.publicMethodSHA256)}
}

export function qualifyCurrentCriteriaPrograms(programs){
 check(programs instanceof Map&&programs.size===currentCriteriaPublicClients.length,'incomplete current public graph')
 for(const [url,hash]of Object.entries(currentCriteriaClientSHA256)){
  const body=programs.get(url)
  check(typeof body==='string'&&digest(body)===hash,'unreviewed current public program bytes: '+url)
 }
 const mainURL=currentCriteriaInitialScripts.find(url=>new URL(url).pathname.startsWith('/main.'))
 const readService=qualifyCurrentCriteriaReadService(programs.get(mainURL))
 const parsed=new Map(),unqualifiedModules=[]
 for(const expected of profile.unqualifiedModules){
  const source=programs.get(expected.url)
  if(!parsed.has(expected.url)){
   const program=parse(source,{ecmaVersion:'latest'})
   const pushes=program.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.type==='MemberExpression'&&n.expression.callee.property.name==='push')
   check(pushes.length===1,'unqualified native module graph shape changed')
   const entries=pushes[0].expression.arguments[0]?.elements?.[1]?.properties
   check(Array.isArray(entries),'unqualified native module records missing')
   const modules=new Map(entries.map(p=>[String(p.key.value??p.key.name),source.slice(p.value.start,p.value.end)]))
   check(modules.size===entries.length,'duplicate unqualified native module identity')
   parsed.set(expected.url,modules)
  }
  const raw=parsed.get(expected.url).get(expected.moduleId)
  check(typeof raw==='string'&&digest(raw)===expected.sha256,'unqualified native module retention mismatch')
  unqualifiedModules.push({...expected,source:raw,renderingQualified:false,applicationQualified:false,organizationLoadingQualified:false})
 }
 return {...readService,
  programs:Object.fromEntries(Object.entries(currentCriteriaClientSHA256)),unqualifiedModules,
  renderingQualified:false,applicationQualified:false,companyScopeQualified:false}
}
