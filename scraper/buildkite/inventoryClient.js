import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const fail=()=>{throw Error('Current public inventory client changed')}
const hash=value=>createHash('sha256').update(value).digest('hex')
const canonical=value=>JSON.stringify(value,(key,item)=>['start','end','loc','raw'].includes(key)?undefined:item)
const publicTripFunctions=new Set('isMobile saveJobsClickHandler addMultipleJobsHandler getDepartmentsData getLocationsData getJobsData searchByPhrase searchJobs sortJobsByPhrase searchJobsByPhrase sortJobs initDepartmentsSelector initLocationSelector getJobDate applyFilter renderFilter initFilter initSelector renderSavedJobs renderJobs renderUnavailablePage initInputSearch extendJobsWithLocations'.split(' '))
const publicTripVariables=new Set('savedJobs allJobs departments jobs locations filter sort queryParams ghSrc'.split(' '))
const nativeURI='https://boards-api.greenhouse.io/v1/boards/'
const active=node=>!node.inert&&!Object.hasOwn(node.attrs,'nomodule')&&['','module','text/javascript','application/javascript'].includes((node.attrs.type||'').trim().toLowerCase())
export function buildkiteInventoryAsset(html){
 const doc=readNativeDocument(html),nodes=doc.nodes(node=>node.tag==='astro-island'&&!node.inert&&node.attrs['component-url']?.startsWith('/_astro/open-roles.'))
 if(nodes.length!==1)fail()
 const node=nodes[0],path=node.attrs['component-url']
 if(!/^\/_astro\/open-roles\.[A-Za-z0-9_-]+\.js$/.test(path)||node.attrs['component-export']!=='default'||node.attrs.client!=='load'||node.attrs.props!=='{}'||!Object.hasOwn(node.attrs,'ssr'))fail()
 return new URL(path,'https://buildkite.com').href
}
// These fingerprints cover only the reviewed public inventory program: the
// native read, initial unfiltered state, data dependencies and card renderer.
// The separate application/detail-only function bodies are deliberately outside
// Tripadvisor's proof. No script is evaluated or imported.
export function readCurrentInventoryClient(source,html,javascript){
 if(!['buildkite','tripadvisor'].includes(source))fail()
 let script=javascript,assetURL=null
 if(source==='buildkite')assetURL=buildkiteInventoryAsset(html)
 else{
  const candidates=readNativeDocument(html).nodes(node=>node.tag==='script'&&active(node)&&!node.attrs.src&&node.raw.includes(nativeURI+'tripadvisor/jobs?content=true'))
  if(candidates.length!==1||javascript!=null&&javascript!==candidates[0].raw)fail()
  script=candidates[0].raw
 }
 if(typeof script!=='string'||Buffer.byteLength(script)>256*1024)fail()
 let ast;try{ast=parse(script,{ecmaVersion:'latest',sourceType:'module'})}catch{fail()}
 const selected=[],names=new Set(),protectedGlobals=new Set(['fetch','window','document','Math','JSON','URLSearchParams','Object','Array','Set','Map','Promise','Buffer','Date','RegExp','URL','parseInt','localStorage','navigator','history','AOS','$','Fuse','setTimeout','clearTimeout','console'])
 let domCount=0
 for(const node of ast.body){
  const declared=node.type==='ImportDeclaration'?node.specifiers.map(n=>n.local.name):node.type==='VariableDeclaration'?node.declarations.map(n=>n.id.type==='Identifier'?n.id.name:null):['FunctionDeclaration','ClassDeclaration'].includes(node.type)?[node.id?.name]:[]
  if(declared.some(name=>!name||names.has(name)||protectedGlobals.has(name)))fail()
  for(const name of declared)names.add(name)
  const selectedNode=source==='buildkite'?(node.type==='ImportDeclaration'||node.type==='VariableDeclaration'&&node.declarations.every(n=>['o','s'].includes(n.id.name))||node.type==='FunctionDeclaration'&&['c','l'].includes(node.id.name)||node.type==='ExportNamedDeclaration')
   :(node.type==='VariableDeclaration'&&node.declarations.every(n=>publicTripVariables.has(n.id.name))||node.type==='FunctionDeclaration'&&publicTripFunctions.has(node.id.name)||node.type==='ExpressionStatement'&&node.expression.type==='CallExpression'&&node.expression.callee.type==='MemberExpression'&&!node.expression.callee.computed&&node.expression.callee.object.name==='window'&&node.expression.callee.property.name==='addEventListener'&&node.expression.arguments[0]?.value==='DOMContentLoaded')
  if(selectedNode){selected.push(node);if(node.type==='ExpressionStatement')domCount++}
  else if(node.type!=='FunctionDeclaration')fail()
 }
 const expected=source==='buildkite'?'c961a10ed4e96032bc2477e975e8b632b91e1b992c4185fca29c26e10bab56bb':'ecbc279efa7881e5b98507fd6cdb570272a8688b36e98969110d9f67d01452ec'
 if(hash(canonical(selected))!==expected||source==='tripadvisor'&&domCount!==1)fail()
 return{source,boardToken:source,method:'GET',body:null,query:'content=true',nativeURL:nativeURI+source+'/jobs?content=true',assetURL,
  publicProgramSHA256:expected,originalScriptSHA256:hash(script),qualification:'nonexecuting-actual-public-inventory-AST-and-initial-renderer;application-only-functions-not-required'}
}
