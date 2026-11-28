import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(readFileSync(new URL('./current-public-profile20261128.json',import.meta.url)))
const digest=value=>createHash('sha256').update(value).digest('hex')
const fail=(ok,message)=>{
 if(!ok)throw Object.assign(new Error('Ganit current public career: '+message),{
  failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
 })
}
const exact=(body,hash,bytes)=>typeof body==='string'&&Buffer.byteLength(body)===bytes&&digest(body)===hash
const programURLs=profile.programs.map(program=>program.url)

// Inspect the retained static ES-import closure without executing it.
// Its current route has no server/client data loader or action. The page and
// exported route component display an explicit empty careers state. Browser
// workers/resources and other possible native producers remain unqualified.
export function validateCurrentPublicSnapshot(snapshot){
 fail(exact(snapshot?.career,profile.careerSHA256,profile.careerBytes),'current frame profile changed')
 fail(exact(snapshot.homepage,profile.homepageSHA256,profile.homepageBytes),'current corporate frame profile changed')
 fail(Array.isArray(snapshot.programs)&&snapshot.programs.length===profile.programs.length,'declared current program graph is incomplete')
 const programs=new Map(snapshot.programs.map(program=>[program.url,program.body]))
 fail(programs.size===programURLs.length&&programURLs.every(url=>programs.has(url)),'current program identities changed')
 const edges=[],dynamic=[],asts=new Map()
 for(const spec of profile.programs){
  const body=programs.get(spec.url)
  fail(exact(body,spec.sha256,spec.bytes),'complete current program profile changed: '+spec.url)
  const ast=parse(body,{sourceType:'module',ecmaVersion:'latest'});asts.set(spec.url,ast)
  const visit=node=>{
   if(!node||typeof node!=='object')return
   if(node.type==='ImportDeclaration'||['ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source){
    const to=new URL(node.source.value,spec.url).href
    fail(programs.has(to),'undeclared own current program import')
    edges.push({from:spec.url,to,kind:'static'})
   }
   if(node.type==='ImportExpression'){
    if(node.source.type==='Literal'&&typeof node.source.value==='string'){
     const to=new URL(node.source.value,spec.url).href;fail(programs.has(to),'undeclared literal current program import')
     edges.push({from:spec.url,to,kind:'literal-dynamic'})
    }else dynamic.push({url:spec.url,start:node.start,end:node.end,expression:body.slice(node.start,node.end)})
   }
   for(const [key,value] of Object.entries(node))if(key!=='source'){
    if(Array.isArray(value))for(const child of value)visit(child)
    else if(value&&typeof value==='object')visit(value)
   }
  }
  visit(ast)
 }
 fail(isDeepStrictEqual(edges,profile.staticEdges)&&isDeepStrictEqual(dynamic,profile.frameworkDynamicImports),'current publisher dependency structure changed')
 const manifestURL=new URL('/assets/manifest-fcfe1732.js',profile.careerURL).href,manifestBody=programs.get(manifestURL)
 const prefix='window.__reactRouterManifest='
 fail(manifestBody.startsWith(prefix)&&manifestBody.endsWith(';'),'current literal route manifest changed')
 const manifest=JSON.parse(manifestBody.slice(prefix.length,-1))
 fail(isDeepStrictEqual(manifest.routes['routes/careers'],profile.careerRoute)
  &&isDeepStrictEqual(manifest.routes.root,profile.rootRoute)&&isDeepStrictEqual(manifest.entry,profile.entry),'current route manifest no longer binds the observed public career')
 for(const route of[manifest.routes.root,manifest.routes['routes/careers']])for(const field of['hasAction','hasLoader','hasClientAction','hasClientLoader','hasClientMiddleware'])fail(route[field]===false,'current route gained an unqualified data producer')
 const routeURL=new URL(profile.careerRoute.module,profile.careerURL).href,routeAST=asts.get(routeURL)
 const exports=routeAST.body.filter(node=>node.type==='ExportNamedDeclaration').flatMap(node=>node.specifiers.map(spec=>spec.exported.name)).sort()
 fail(isDeepStrictEqual(exports,['default','meta'])&&!routeAST.body.some(node=>['ExportAllDeclaration','ExportDefaultDeclaration'].includes(node.type)),'current career exports gained unqualified behavior')
 const doc=readNativeDocument(snapshot.career),owner=doc.nodes(node=>node.attrs.id==='cg-roles')
 fail(owner.length===1&&doc.text(owner[0]).includes('We have no open roles listed right now. To hear about future ones, get in touch .'),'current native empty-state owner changed')
 return {configuredPublicNativeDataEmpty:true,configuredBoardComplete:false,browserRenderingQualified:false,applicationQualified:false,
  companyInventoryComplete:false,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
  nativeProgramCount:programs.size,staticESImportClosureQualified:true,browserResourceGraphComplete:false,nativeProducerComplete:false,
  frameworkDynamicImportsQualifiedForBrowser:false}
}

export async function readCurrentPublicCareers(options={}){
 const reader=createCurrentNativeReader(options,{source:'ganit',admitted:[[profile.careerURL,'html'],[profile.homepageURL,'html'],...programURLs.map(url=>[url,'javascript'])]})
 try{
  const first=await reader.read(profile.careerURL)
  if(!exact(first.body,profile.careerSHA256,profile.careerBytes))return {legacyHTML:first.body}
  const snapshot=async career=>{
   fail(exact(career,profile.careerSHA256,profile.careerBytes),'current opening or closing frame profile changed')
   const homepage=await reader.read(profile.homepageURL)
   fail(exact(homepage.body,profile.homepageSHA256,profile.homepageBytes),'current corporate frame profile changed')
   const programs=[]
   for(const spec of profile.programs){
    const page=await reader.read(spec.url)
    fail(exact(page.body,spec.sha256,spec.bytes),'complete current program profile changed: '+spec.url)
    programs.push({url:page.url,body:page.body})
   }
   const value={career,homepage:homepage.body,programs}
   validateCurrentPublicSnapshot(value)
   return value
  }
  const opening=await snapshot(first.body),closing=await snapshot((await reader.read(profile.careerURL)).body)
  fail(isDeepStrictEqual(opening,closing),'whole current closing native public data changed')
  const audit={source:'ganit',...validateCurrentPublicSnapshot(opening),opening,closing,
   checkedAt:(options.now??(()=>new Date().toISOString()))(),transport:reader.stats(),
   reason:'Paired current careers HTML and the retained static ES-import closure display an explicit empty state; native producer coverage, browser workers/resources, employer-wide scope, application and cleanup remain unqualified'}
  reader.check();options.onRecords?.([]);reader.check();options.onAudit?.(structuredClone(audit));reader.check()
  const jobs=[]
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.careerURL,firstParty:true,listingComplete:false,
   lifecycleCleanupAllowed:false,pagesFetched:audit.transport.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:audit.checkedAt,reason:audit.reason})
  attachSourceObservationEvidence(jobs,{source:'ganit',recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:structuredClone(audit),configurable:true})
  return {jobs}
 }catch(error){options.signal?.throwIfAborted();throw error}
 finally{reader.close()}
}
