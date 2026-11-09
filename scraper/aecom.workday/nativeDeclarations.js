import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {activeScripts} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

export const CAREERS='https://aecom.com/careers/'
export const BOARD='https://aecom.jobs/'
export const SEARCH='https://prod-search-api.jobsyn.org/api/v1/solr/search'
export const SEARCH_HEADERS={'Accept':'application/json','Content-Type':'application/json','X-Origin':'aecom.jobs'}
export const ROLE_BASE='https://microsites.dejobs.org/aecom-jobs/data/'
export const CLIENTS=[
 ['BnXFfOTV.js','481c16c41fd36c92c1c56390861f3c9ae870265182501302a7b4e9dbffe18daf'],
 ['bl7TSgYO.js','764459b751d1f3c020c40236af57608d642378169a5164d314035e199b03749d'],
 ['Bw17jvk9.js','cb6f93c17255bcca2f22cde11399acdb0c8e27f9539d70c0fa8857c07a461e3e'],
 ['Bt1tVEIW.js','3dadcb28be8b618f1dae8c9d27476f233b34c13b717ad152b1514fed5c34387d'],
 ['ldmst_eB.js','1a3f5ff6bcdad404f0073946ccc7ee633021ebc8935621f1c5114d8494c90ca8'],
].map(([file,sha256])=>({url:BOARD+'_nuxt/'+file,sha256}))
const ownedErrors=new WeakSet()
export const nativeFailure=message=>{const error=new Error('AECOM native '+message);ownedErrors.add(error);return error}
export const isNativeFailure=error=>error!==null&&typeof error==='object'&&ownedErrors.has(error)
export const need=(ok,message)=>{if(!ok)throw nativeFailure(message)}

export function verifyCorporateHandoff(html){
 const doc=readVisibleNativeDocument(html,{strict:true})
 need(doc.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD).length>0,'corporate recruitment handoff missing')
 return{careersURL:CAREERS,boardURL:BOARD}
}
const staticValue=node=>{
 if(node.type==='Literal'&&(['string','number','boolean'].includes(typeof node.value)||node.value===null))return node.value
 if(node.type==='ArrayExpression')return node.elements.map(staticValue)
 if(node.type==='ObjectExpression'){
  const seen=new Set()
  return Object.fromEntries(node.properties.map(p=>{
   need(p.type==='Property'&&!p.computed&&!p.method&&!p.shorthand&&p.kind==='init','dynamic bootstrap property')
   const key=p.key.type==='Identifier'?p.key.name:p.key.value
   need(typeof key==='string'&&!seen.has(key),'ambiguous bootstrap field');seen.add(key)
   return[key,staticValue(p.value)]
  }))
 }
 throw new Error('AECOM native dynamic bootstrap value')
}
export function readBoardDeclaration(html){
 const doc=readVisibleNativeDocument(html,{strict:true})
 need(doc.nodes(n=>n.tag==='script'&&n.attrs.src===new URL(CLIENTS[0].url).pathname&&n.attrs.type==='module').length===1,'active reviewed entry module missing')
 const configs=[]
 for(const script of activeScripts(html)){
  // Only the small native config script is parsed, never imported or evaluated.
  if(!script.includes('window.__NUXT__.config'))continue
  const ast=parse(script,{ecmaVersion:'latest'})
  for(const row of ast.body){
   const e=row.type==='ExpressionStatement'&&row.expression
   if(e?.type==='AssignmentExpression'&&e.operator==='='&&script.slice(e.left.start,e.left.end)==='window.__NUXT__.config')configs.push(staticValue(e.right))
  }
 }
 need(configs.length===1,'missing or ambiguous native configuration')
 const config=configs[0],p=config.public
 need(!Object.hasOwn(p||{},'api-url'),'unreviewed public search API override')
 need(p?.source==='solr'&&p['x-origin']==='aecom.jobs'&&p['job-folder']==='aecom-jobs'&&p.num_items===10&&p['add-assets']==='','unreviewed search or role configuration')
 need(Array.isArray(p.buids)&&p.buids.length===2&&p.buids[0]===55872&&p.buids[1]===38582,'native business IDs changed')
 need(p.filters?.filter(f=>f.display==='Country'&&f.key==='country'&&f.name==='location').length===1,'native country filter changed')
 need(config.app?.baseURL==='/'&&config.app?.buildAssetsDir==='/_nuxt/','native asset base changed')
 // Retain only reviewed public selectors, excluding unrelated browser API keys.
 return{boardURL:BOARD,source:p.source,origin:p['x-origin'],jobFolder:p['job-folder'],numItems:10,buids:[...p.buids],countryFilter:{display:'Country',key:'country',name:'location'},addAssets:false,buildID:config.app.buildId,clientContracts:CLIENTS.map(c=>({...c})),programsExecuted:false}
}
export function verifyClient(bytes,contract){
 need(createHash('sha256').update(bytes).digest('hex')===contract.sha256,'published client contract changed: '+new URL(contract.url).pathname)
}
