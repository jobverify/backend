import {parse} from 'acorn'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
const SOURCE='aapkapainter',HOME='https://aapkapainter.com/',CAREER='https://aapkapainter.com/career',SCRIPT='https://ats.zimyo.com/assets/js/jobwidget.js'
const fail=(message,fields)=>firstPartyFailure(SOURCE,message,{failureKind:'surface_drift_or_fail_closed',sourceScopeComplete:false,...fields})
const full=node=>typeof node==='string'?node:{tag:node.tag,attrs:node.attrs,children:node.children.map(full),...(node.raw!==undefined?{raw:node.raw}:{}),inert:node.inert===true}
export function readCurrentAapkaPainterShell(home,career){
 const d=readNativeDocument(home),titles=activeHead(home).titles,text=d.text(d.nodes(n=>n.tag==='root')[0])
 if(titles.length!==1||!/^AapkaPainter [–-] Expert Painting & Waterproofing Services in India$/.test(titles[0])||!text.includes('AapkaPainter Solutions Pvt Ltd')||!d.nodes(n=>n.tag==='a'&&n.attrs.href===CAREER).length||d.nodes(n=>n.tag==='base').length)throw fail('Current own homepage career handoff changed')
 const c=readNativeDocument(career),ct=activeHead(career).titles,canonical=c.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical'))
 if(ct.length!==1||ct[0]!=='Career - Jobs at Aapkapainter'||canonical.length!==1||canonical[0].attrs.href!==CAREER||c.nodes(n=>n.tag==='base').length)throw fail('Current career publisher identity changed')
 const container=c.nodes(n=>n.attrs.id==='job-listing'),scripts=c.nodes(n=>n.tag==='script'&&n.attrs.src===SCRIPT)
 if(container.length!==1||container[0].tag!=='div'||container[0].children.some(n=>typeof n==='string'?n.trim():true)||scripts.length!==1||Object.keys(scripts[0].attrs).some(k=>k!=='src'))throw fail('Current native widget container/declaration changed')
 const declarations=c.nodes(n=>n.tag==='script'&&!n.attrs.src&&/\bUSERID\b/.test(n.raw??''))
 if(declarations.length!==1||declarations[0].attrs.type!=='text/javascript')throw fail('Native widget tenant carrier changed')
 const ast=parse(declarations[0].raw,{ecmaVersion:'latest'}),statement=ast.body[0],decl=statement?.declarations?.[0]
 if(ast.body.length!==1||statement.type!=='VariableDeclaration'||statement.kind!=='var'||statement.declarations.length!==1||decl.id.type!=='Identifier'||decl.id.name!=='USERID'||decl.init?.type!=='Literal'||decl.init.value!=='1476')throw fail('Native widget tenant changed')
 return {tenantId:decl.init.value,scriptURL:SCRIPT,container:full(container[0]),tenantDeclaration:full(declarations[0]),scriptDeclaration:full(scripts[0]),homepage:full(d.nodes(n=>n.tag==='root')[0]),career:full(c.nodes(n=>n.tag==='root')[0])}
}
export async function runCurrentAapkaPainter(options={}){
 const io=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOME,'html'],[CAREER,'html'],[SCRIPT,'javascript']]})
 const audit={source:SOURCE,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,closingReconciled:false,indiaJobs:null,eligibleJobs:null,documents:[]}
 const read=async url=>{const r=await io.read(url);audit.documents.push({url:r.url,sha256:r.sha256,body:r.body});return r.body}
 try{
  const home=await read(HOME),career=await read(CAREER);audit.widget=readCurrentAapkaPainterShell(home,career)
  const program=await read(SCRIPT);audit.widget.program=program
  // A missing, redirecting, or newly changed widget never certifies an empty board.
  throw fail('Declared widget program differs from the unavailable capture; native inventory requires review')
 }catch(error){
  options.signal?.throwIfAborted()
  if(error&&typeof error==='object'&&Object.isExtensible(error)){
   audit.transport=io.stats()
   Object.assign(error,{abortRetries:true,nativeCollectionEvidence:audit,lifecycleCleanupAllowed:false,sourceScopeComplete:false,cleanupAuthority:false,sourceUrl:SCRIPT})
   if(error.status>=500&&error.status<=599)Object.assign(error,{failureType:'upstream_unavailable',upstreamOutage:true})
  }
  if(!Number.isInteger(error?.status)&&!Number.isInteger(error?.httpStatus))io.check()
  options.signal?.throwIfAborted();throw error
 }finally{io.close();options.signal?.throwIfAborted()}
}
