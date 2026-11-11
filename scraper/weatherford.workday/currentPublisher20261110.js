import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'

export const WEATHERFORD_CAREERS='https://www.weatherford.com/careers/'
export const WEATHERFORD_NATIVE_SITE='https://fa-exmi-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1'
const VANITY='https://careers.weatherford.com/'
const SITE_FRAGMENT='#en/sites/CX_1/join-talent-community'
const PROGRAM_SHA256='0af5b6665f55b30c1a98100b1162c18dcfe1eb4ca2372b01f42b3a23c61ea8c0'
const TELEMETRY_AST_SHA256='1ced59c4b7301b3db04536f636234d3ad30f9fe0941411b762a06275311d9b07'
const sha=value=>createHash('sha256').update(value).digest('hex')
const check=(ok,message)=>{if(!ok)throw Error('Weatherford current publisher: '+message)}
const activeDocument=html=>{
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],nodes=[]
 const visit=node=>{
  if(node.inert||['blockquote','q','pre','code','aside'].includes(node.tag))return
  nodes.push(node)
  for(const child of node.children)if(typeof child!=='string')visit(child)
 }
 visit(root);return{nodes:predicate=>nodes.filter(predicate)}
}
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.name===object&&node.property?.name===property
const id=(node,name)=>node?.type==='Identifier'&&node.name===name
const literal=(node,value)=>node?.type==='Literal'&&node.value===value

// The current second program is Boomerang telemetry. Its complete reviewed AST
// stays fixed; only primitive ak.* object data and its rotating Akamai DNS
// prefetch hostname vary per response. Names, expressions, calls, assignments,
// URLs and all other literals remain part of the digest. Nothing executes.
const telemetryModel=node=>{
 if(Array.isArray(node))return node.map(telemetryModel)
 if(!node||typeof node!=='object')return node
 const model={}
 for(const[key,value]of Object.entries(node)){
  if(['start','end','raw'].includes(key))continue
  if(node.type==='Property'&&key==='value'&&node.key.type==='Literal'&&/^ak\./.test(node.key.value)&&value.type==='Literal'){
   model[key]={type:'Literal',telemetryValueType:typeof value.value};continue
  }
  if(node.type==='VariableDeclarator'&&key==='init'&&node.id.name==='a'&&value?.type==='Literal'
   &&typeof value.value==='string'&&/^[a-z0-9-]+\.akamaihd\.net$/.test(value.value)){
   model[key]={type:'Literal',telemetryDNSPrefetchDomain:'akamaihd.net'};continue
  }
  model[key]=telemetryModel(value)
 }
 return model
}
const executableVanityScripts=html=>{
 const root=readNativeDocument(html).nodes(n=>n.tag==='root')[0],scripts=[]
 const visit=node=>{
  // Hidden/quoted HTML still executes scripts and event handlers in a browser.
  // Template contents do not. This traversal intentionally differs from the
  // visible evidence traversal above.
  if(node.tag==='template')return
  check(!['iframe','frame','frameset','object','embed'].includes(node.tag),'unreviewed vanity execution surface')
  check(!(node.tag==='meta'&&(node.attrs['http-equiv']||'').trim().toLowerCase()==='refresh'),'unreviewed vanity refresh')
  for(const[key,value]of Object.entries(node.attrs)){
   check(!key.startsWith('on')||node.tag==='body'&&key==='onload'&&value==='replacecontent()','unreviewed vanity event handler')
   check(!/^\s*(?:javascript|data):/i.test(value),'unreviewed vanity executable URL')
  }
  if(node.tag==='script'&&!['application/json','application/ld+json','text/plain','text/template'].includes((node.attrs.type||'').trim().toLowerCase())){
   check(!node.attrs.src,'unreviewed external vanity program')
   scripts.push(node)
  }
  for(const child of node.children)if(typeof child!=='string')visit(child)
 }
 visit(root);check(scripts.length===2,'current vanity executable program set changed')
 return scripts
}

function reviewedNativeHost(html){
 const doc=activeDocument(html)
 const allPrograms=executableVanityScripts(html)
 check(!doc.nodes(n=>n.tag==='base').length,'vanity document base changed')
 const bodies=doc.nodes(n=>n.tag==='body')
 check(bodies.length===1&&bodies[0].attrs.onload==='replacecontent()','active vanity entry point changed')
 const programs=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')
  &&(!n.attrs.type||n.attrs.type==='text/javascript')).map(n=>({body:n.raw||'',ast:parse(n.raw||'',{ecmaVersion:'latest',sourceType:'script'})}))
 const candidates=programs.filter(p=>p.ast.body.some(n=>n.type==='FunctionDeclaration'&&n.id?.name==='replacecontent'))
 check(candidates.length===1&&sha(candidates[0].body)===PROGRAM_SHA256,'reviewed active vanity program changed')
 check(allPrograms[0].raw===candidates[0].body
  &&sha(JSON.stringify(telemetryModel(parse(allPrograms[1].raw,{ecmaVersion:'latest',sourceType:'script'}))))===TELEMETRY_AST_SHA256,
 'reviewed complete vanity execution context changed')
 const fn=candidates[0].ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id?.name==='replacecontent')
 const declarations=fn.body.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations)
 const host=declarations.filter(n=>id(n.id,'host')),prefix=declarations.filter(n=>id(n.id,'ceBaseURL'))
 check(host.length===1&&literal(host[0].init,new URL(WEATHERFORD_NATIVE_SITE).origin),'active native host changed')
 check(prefix.length===1&&prefix[0].init?.type==='BinaryExpression'&&prefix[0].init.operator==='+'
  &&id(prefix[0].init.left,'host')&&literal(prefix[0].init.right,'/hcmUI/CandidateExperience/'),'active candidate path changed')
 const calls=fn.body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression').map(n=>n.expression)
 check(calls.filter(n=>member(n.callee,'xhr','open')&&n.arguments.length===3&&literal(n.arguments[0],'GET')
  &&n.arguments[1].type==='BinaryExpression'&&n.arguments[1].operator==='+'
  &&id(n.arguments[1].left,'ceBaseURL')&&id(n.arguments[1].right,'anchortext')&&literal(n.arguments[2],true)).length===1,
 'active public XHR contract changed')
 return{host:host[0].init.value,programSHA256:PROGRAM_SHA256,telemetryASTSHA256:TELEMETRY_AST_SHA256}
}

export async function readWeatherfordPublisherDeclaration({page,readPage,readDeclaredBoardPage,now}){
 check(page.url===WEATHERFORD_CAREERS,'current corporate careers URL changed')
 const doc=activeDocument(page.html)
 check(!doc.nodes(n=>n.tag==='base').length,'corporate document base changed')
 const titles=doc.nodes(n=>n.tag==='title').map(n=>decodeNativeEntities(n.raw||''))
 check(titles.length===1&&/\bWeatherford\b/.test(titles[0]),'current corporate publisher changed')
 const links=doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>new URL(n.attrs.href,page.url).href)
 check(links.includes(VANITY)&&links.includes(VANITY+SITE_FRAGMENT),'active corporate vanity/site declaration changed')
 const vanity=await readPage(VANITY)
 check(vanity.url===VANITY,'vanity changed authority or path')
 const contract=reviewedNativeHost(vanity.html)
 const site=new URL('/hcmUI/CandidateExperience/'+SITE_FRAGMENT.slice(1).replace(/\/join-talent-community$/,''),contract.host).href
 check(site===WEATHERFORD_NATIVE_SITE,'derived native site changed')
 const native=await readDeclaredBoardPage(site)
 check(native.url===site,'native site changed authority or path')
 const nativeDoc=activeDocument(native.html),nativeTitles=nativeDoc.nodes(n=>n.tag==='title')
 check(nativeTitles.length===1&&decodeNativeEntities(nativeTitles[0].raw||'')==='Weatherford','exact native publisher changed')
 const bases=nativeDoc.nodes(n=>n.tag==='base')
 check(bases.length===1&&bases[0].attrs['data-sitenumber']==='CX_1'
  &&new URL(bases[0].attrs.href,native.url).href===site
  &&new URL(bases[0].attrs['data-apibaseurl']).origin===contract.host,'native site/API identity changed')
 return{url:site,context:{corporateURL:page.url,vanityURL:vanity.url,siteURL:native.url,site:'CX_1',publisher:'Weatherford',...contract},
  evidence:{checkedAt:now,corporateURL:page.url,corporateBodySHA256:sha(page.html),vanityURL:vanity.url,vanityBodySHA256:sha(vanity.html),
   nativeURL:native.url,nativeBodySHA256:sha(native.html),programSHA256:contract.programSHA256,method:'current-corporate-active-link-and-reviewed-vanity-AST-public-GET'}}
}
