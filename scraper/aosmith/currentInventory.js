import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {readNativeListing,readNativePosting,HOME,CAREERS,BOARD,SEARCH} from './native.js'
import {createPublicPageReader} from '../../scraper-support/native-sources/publicNativeGetSources/safeTransport.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {document as readRmkDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'

const origin=new URL(SEARCH).origin
const assetProgramSHA='a8c92a3acd90a3b1f20b7a362ea0752632b1e73976e23765d3160f20c0db441c'
const sha=body=>createHash('sha256').update(body).digest('hex')
const fail=(message,code='AOSMITH_NATIVE_CONTRACT_CHANGED')=>Object.assign(new Error('A. O. Smith native: '+message),{code})
const requireCurrent=(ok,message)=>{if(!ok)throw fail(message)}
const canonical=value=>JSON.stringify(value,(key,item)=>['start','end','loc','raw'].includes(key)?undefined:item)
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right)
const active=node=>!node.inert&&!Object.hasOwn(node.attrs,'nomodule')&&['','module','application/javascript','text/javascript'].includes((node.attrs.type??'').trim().toLowerCase())
const property=node=>!node?.computed&&node?.property?.type==='Identifier'?node.property.name:node?.property?.type==='Literal'?node.property.value:null
const pathOf=node=>node?.type==='Identifier'?[node.name]:node?.type==='MemberExpression'?[...pathOf(node.object),property(node)]:[]
const selected=node=>{const parts=pathOf(node),at=parts[0]==='j2w'?0:['window','globalThis','self'].includes(parts[0])&&parts[1]==='j2w'?1:-1;return at>=0&&(parts.length===at+1||parts[at+1]==='SearchResults'||parts[at+1]==null)}
const readyBinding=node=>{const parts=pathOf(node);return parts.length===1&&parts[0]==='$'||parts.length===2&&['window','globalThis','self'].includes(parts[0])&&parts[1]==='$'}

export function readCurrentAoSmithInitializer(html){
 const doc=readRmkDocument(html),scripts=[]
 const visitNodes=node=>{
  if(typeof node==='string'||['template','noscript','textarea','title','style','iframe','plaintext','xmp','noembed','noframes'].includes(node.tag))return
  if(node.tag==='script'){if(active(node))scripts.push(node);return}
  for(const child of node.children??[])visitNodes(child)
 }
 visitNodes(doc.root)
 const programs=scripts.filter(node=>!node.attrs.src&&/\bj2w\b|\$/.test(node.raw??''))
 const initializers=[]
 for(const script of programs){
  const ast=parse(script.raw,{ecmaVersion:'latest',sourceType:script.attrs.type==='module'?'module':'script'})
  const bootstraps=new Set(ast.body.filter(node=>node.type==='VariableDeclaration'&&node.kind==='var').flatMap(node=>node.declarations)
   .filter(node=>node.id?.name==='j2w'&&node.init?.type==='LogicalExpression'&&node.init.operator==='||'&&node.init.left?.type==='Identifier'&&node.init.left.name==='j2w'
    &&node.init.right?.type==='ObjectExpression'&&node.init.right.properties.length===0))
  const visit=(node,functionDepth=0)=>{
   if(!node||typeof node!=='object')return
   if(functionDepth===0&&(['VariableDeclarator','FunctionDeclaration','ClassDeclaration'].includes(node.type)&&node.id?.name==='$'
    ||node.type==='AssignmentExpression'&&readyBinding(node.left)||node.type==='UpdateExpression'&&readyBinding(node.argument)))throw fail('public ready function binding is replaced')
   if(functionDepth===0&&(node.type==='VariableDeclarator'&&selected(node.init)||node.type==='AssignmentExpression'&&selected(node.right)))throw fail('public initializer namespace escapes through an alias')
   if(node.type==='AssignmentExpression'&&selected(node.left)||node.type==='UpdateExpression'&&selected(node.argument)||node.type==='UnaryExpression'&&node.operator==='delete'&&selected(node.argument)
    ||['VariableDeclarator','FunctionDeclaration','ClassDeclaration'].includes(node.type)&&node.id?.name==='j2w'&&!bootstraps.has(node))throw fail('public initializer namespace is reassigned')
   if(node.type==='CallExpression'&&pathOf(node.callee).join('.')==='j2w.SearchResults.init')initializers.push({node,ast,script})
   else if(node.type==='CallExpression'&&selected(node.callee))throw fail('unreviewed public initializer namespace call')
   if(node.type==='CallExpression'&&node.arguments.some(selected))throw fail('public initializer namespace escapes through another call')
   const depth=functionDepth+Number(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type))
   for(const[key,value]of Object.entries(node))if(!['start','end','loc'].includes(key)){if(Array.isArray(value))value.forEach(child=>visit(child,depth));else if(value&&typeof value==='object')visit(value,depth)}
  }
  visit(ast)
 }
 requireCurrent(initializers.length===1,'expected one actual public tile initializer')
 const {node,ast,script}=initializers[0],outer=ast.body[0]?.expression,callback=outer?.arguments?.[0]
 requireCurrent(ast.body.length===1&&ast.body[0].type==='ExpressionStatement'&&outer?.type==='CallExpression'&&outer.callee?.type==='Identifier'&&outer.callee.name==='$'
  &&outer.arguments.length===1&&callback?.type==='FunctionExpression'&&!callback.async&&!callback.generator&&callback.params.length===0
  &&callback.body.body.length===1&&callback.body.body[0].type==='ExpressionStatement'&&callback.body.body[0].expression===node
  &&node.arguments.length===1&&node.arguments[0].type==='ObjectExpression','public tile initializer is conditional, dormant or unreviewed')
 const assets=scripts.filter(item=>/\/platform\/js\/j2w\/min\/j2w\.searchResults\.min\.js(?:\?|$)/.test(item.attrs.src??''))
 requireCurrent(assets.length===1,'published pagination client unavailable or inactive')
 const assetURL=new URL(assets[0].attrs.src,SEARCH)
 requireCurrent(assetURL.origin===origin&&!assetURL.username&&!assetURL.password,'public pagination client changed origin')
 return{assetURL:assetURL.href,initializerSHA256:sha(canonical(ast)),initializer:{start:script.start,end:script.end,source:script.raw},javascriptExecuted:false}
}

const listingModel=row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='sourceNativeListingHTML'))
const postingModel=row=>Object.fromEntries(Object.entries(row).filter(([key])=>[
 'jobId','title','sourceUrl','applyUrl','sourceNativeEmployer','sourceNativeDescriptionHTML','sourceNativeAddresses','sourceNativeJobLocations','sourceNativeLocationLabels','sourceNativeFields',
 'sourceNativeStructuredFields','sourceNativeFieldIssues','sourcePostingDate','sourceClosingDate','sourceEmploymentType','sourceNativeWorkplace','jobDescription','minimumQualification',
 'country','city','state','locations','sourceCountryScopeUnresolved','sourceNativeLocationConflict','sourceNativeClosed','sourceNativeValidityExpired','sourceNativeValidityUnresolved',
].includes(key)))
const handoff=(html,from,to)=>readNativeDocument(html).nodes(node=>node.tag==='a'&&node.attrs.href).some(node=>{try{return new URL(node.attrs.href,from).href===to}catch{return false}})
const parallel=async(items,operation,signal)=>{
 let next=0
 const settled=await Promise.allSettled(Array.from({length:4},async()=>{while(next<items.length){signal.throwIfAborted();await operation(items[next++])}}))
 const rejected=settled.find(row=>row.status==='rejected');if(rejected)throw rejected.reason
}

export const createCurrentAoSmithScraper=(defaults={})=>({async run(passed={}){
 const options={...defaults,...passed},caller=options.signal,budget=options.collectionBudgetMs??360000,maxJobs=options.maxJobs??null
 caller?.throwIfAborted()
 requireCurrent(!(options.fetchText||options.fetchJson)||options.fetchPage,'original HTTP fetchPage required; parsed-only injection refused')
 requireCurrent(Number.isSafeInteger(budget)&&budget>0&&budget<=600000,'invalid collection budget')
 requireCurrent(maxJobs===null||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid maxJobs')
 const observedAt=typeof options.now==='function'?options.now():new Date().toISOString()
 requireCurrent(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const deadline=new AbortController(),timeout=fail('public collection deadline exceeded','AOSMITH_COLLECTION_TIMEOUT')
 timeout.name='TimeoutError'
 const timer=setTimeout(()=>deadline.abort(timeout),budget),signal=caller?AbortSignal.any([caller,deadline.signal]):deadline.signal
 const held=new Set(),allowed=new Set([HOME,CAREERS,BOARD,SEARCH]),rawPages=[],issues=[],readers=[]
 let aggregateBytes=0,requestCount=0
 const makeReader=()=>{
  const fetchPage=options.fetchPage?((url,request)=>withCallerSignal(()=>options.fetchPage(url,{...request,signal:caller??signal}),signal)):undefined
  const reader=createPublicPageReader({...options,fetchPage,signal,heldHosts:held});readers.push(reader);return reader
 }
 const get=async(reader,value,phase)=>{
  requireCurrent(allowed.has(value),'unpublished URL requested')
  let url=value
  for(let hop=0;hop<6;hop++){
   signal.throwIfAborted();requireCurrent(++requestCount<=400,'public request budget exceeded')
   const page=await withCallerSignal(()=>reader.read(url),signal)
   requireCurrent(page?.url===url&&Number.isInteger(page.status)&&typeof page.bodyBase64==='string'&&page.headers&&typeof page.headers==='object','original HTTP page unavailable')
   const body=Buffer.from(page.bodyBase64,'base64');aggregateBytes+=body.length
   requireCurrent(body.length<=16*1024*1024&&aggregateBytes<=128*1024*1024,'public response byte budget exceeded')
   rawPages.push({phase,url,status:page.status,headers:Object.fromEntries(Object.entries(page.headers).filter(([key])=>['content-type','location'].includes(key.toLowerCase()))),bodyBase64:page.bodyBase64,bodySHA256:sha(body)})
   if([401,403,429].includes(page.status))throw Object.assign(fail('public HTTP access denied','AOSMITH_PUBLIC_ACCESS_DENIED'),{status:page.status,failureKind:'blocked',abortRetries:true})
   if([301,302,303,307,308].includes(page.status)){
    requireCurrent(page.headers.location,'original redirect missing location')
    const next=new URL(page.headers.location,url);requireCurrent(next.origin===new URL(url).origin&&!next.username&&!next.password,'redirect changed source origin')
    url=next.href;allowed.add(url);continue
   }
   requireCurrent(page.status===200&&page.transportQualified!==false,'public HTTP status/security hold '+page.status)
   return new TextDecoder('utf-8',{fatal:true}).decode(body)
  }
  throw fail('public redirect hop bound exceeded')
 }
 const binding=async(reader,phase)=>{
  const home=await get(reader,HOME,phase),careers=await get(reader,CAREERS,phase),board=await get(reader,BOARD,phase)
  return handoff(home,HOME,CAREERS)&&handoff(careers,CAREERS,BOARD)&&handoff(board,BOARD,SEARCH)
 }
 const scan=async(reader,phase)=>{
  const rows=[],seen=new Set();let next=SEARCH,model=null,total=null,pages=0,client=null
  while(next){
   requireCurrent(++pages<=100,'native page bound exceeded');allowed.add(next)
   const html=await get(reader,next,phase);let parserHTML=html
   if(next===SEARCH){
    client=readCurrentAoSmithInitializer(html);allowed.add(client.assetURL)
    const asset=await get(reader,client.assetURL,phase)
    let program
    try{program=parse(asset,{ecmaVersion:'latest'})}catch{throw fail('published GET pagination client contract changed')}
    requireCurrent(sha(canonical(program))===assetProgramSHA,'published GET pagination client contract changed')
    // The legacy tile parser uses visibility for script discovery. Feed it the
    // independently verified executable initializer outside its presentation
    // wrapper; every tile and the retained original HTTP bytes stay intact.
    const {start,end,source}=client.initializer
    parserHTML=html.slice(0,start)+html.slice(end)+'<script type="application/javascript">'+source+'</script>'
   }
   const page=readNativeListing(parserHTML,next,model);model=page.model
   if(total===null)total=page.reportedTotal
   requireCurrent(page.reportedTotal===total&&page.pageNumber===pages,'native total/page range changed')
   for(const row of page.rows){requireCurrent(!seen.has(row.jobId),'duplicate native public ID');seen.add(row.jobId);rows.push(row)}
   next=page.nextURL
  }
  requireCurrent(rows.length===total,'native total and rows do not reconcile')
  return{rows,reportedTotal:total,pagesFetched:pages,client}
 }
 const inspect=async(reader,listing,phase)=>{
  const rows=new Array(listing.rows.length)
  await parallel(listing.rows.map((row,index)=>({row,index})),async({row,index})=>{
   allowed.add(row.sourceUrl)
   try{rows[index]=readNativePosting(await get(reader,row.sourceUrl,phase),row,observedAt)}
   catch(error){signal.throwIfAborted();if(error.abortRetries)throw error;rows[index]={source:'aosmith',jobId:row.jobId,title:row.title,sourceUrl:row.sourceUrl,country:null,sourceNativeListing:structuredClone(row),sourceCountryScopeUnresolved:true,sourceNativeDetailQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,error:{name:error.name,message:error.message}};issues.push({phase,jobId:row.jobId,reason:error.message})}
  },signal)
  return rows
 }
 const execute=async()=>{
  const openingReader=makeReader(),openingBinding=await binding(openingReader,'opening'),opening=await scan(openingReader,'opening'),earlier=await inspect(openingReader,opening,'opening')
  const closingReader=makeReader(),closingBinding=await binding(closingReader,'closing'),closing=await scan(closingReader,'closing'),current=await inspect(closingReader,closing,'closing')
  let final=null,finalBinding=false
  try{final=await scan(closingReader,'final');finalBinding=await binding(closingReader,'final')}
  catch(error){signal.throwIfAborted();if(error.abortRetries)throw error;issues.push({phase:'final',reason:error.message})}
  const openingById=new Map(earlier.map(row=>[row.jobId,row])),closingById=new Map(current.map(row=>[row.jobId,row])),finalById=new Map((final?.rows??[]).map(row=>[row.jobId,row]))
  const identities=[...new Set([...opening.rows,...closing.rows,...(final?.rows??[])].map(row=>row.jobId))]
  const observations=identities.map(id=>{
   const before=openingById.get(id),after=closingById.get(id),last=finalById.get(id),row=structuredClone(after??before??{source:'aosmith',jobId:id,title:last?.title,sourceUrl:last?.sourceUrl,sourceNativeListing:last,country:null,sourceCountryScopeUnresolved:true})
   const stable=Boolean(before?.sourceNativeDetailQualified&&after?.sourceNativeDetailQualified&&same(postingModel(before),postingModel(after))
    &&same(listingModel(before.sourceNativeListing),listingModel(after.sourceNativeListing))&&last&&same(listingModel(after.sourceNativeListing),listingModel(last)))
   return{...row,sourceOwnModelStabilityQualified:stable,sourceDetailComplete:stable,sourceCurrentNativePostingIdentityQualified:Boolean(stable&&openingBinding&&closingBinding&&finalBinding&&!row.sourceNativeValidityExpired&&!row.sourceNativeValidityUnresolved),
    sourceScopeComplete:false,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false}
  })
  const listingStable=Boolean(final&&same(opening.rows.map(listingModel),closing.rows.map(listingModel))&&same(closing.rows.map(listingModel),final.rows.map(listingModel)))
  const complete=Boolean(openingBinding&&closingBinding&&finalBinding&&listingStable&&observations.length===final?.reportedTotal
   &&observations.every(row=>row.sourceDetailComplete&&!row.sourceCountryScopeUnresolved&&!row.sourceNativeLocationConflict&&!row.sourceNativeValidityUnresolved))
  const eligible=observations.filter(row=>row.sourceCurrentNativePostingIdentityQualified&&row.country==='India'&&!row.sourceCountryScopeUnresolved)
  const chosen=maxJobs>0?eligible.slice(0,maxJobs):eligible,capped=chosen.length!==eligible.length
  const jobs=chosen.map(row=>({...row,sourceListingComplete:complete&&!capped,sourceDeclaredBoardScopeComplete:complete&&!capped}))
  const evidence={status:complete&&!capped?'complete-inventory':'coverage-gap',firstParty:rawPages.some(page=>page.status===200),surface:SEARCH,listingComplete:complete&&!capped,pagesFetched:rawPages.length,
   reportedTotal:complete?observations.length:null,indiaFacetCount:complete?eligible.length:null,verifiedAt:new Date().toISOString(),
   reason:complete&&!capped?'current-configured-public-native-board;two-full-own-detail-passes-final-inventory-and-country-proof;company-wide-scope-and-cleanup-unqualified':'current-native-criteria-country-temporal-binding-or-output-cap-gap'}
  const audit={source:'aosmith',observedAt,opening,closing,final,openingBinding,closingBinding,finalBinding,employerBindingQualified:openingBinding&&closingBinding&&finalBinding,listingStable,
   ownModelStabilityQualified:observations.every(row=>row.sourceOwnModelStabilityQualified),observations,observationHistory:identities.map(id=>({id,earlier:openingById.get(id)??null,current:closingById.get(id)??null})),rawPages,issues,
   inventoryEvidence:evidence,transportSafety:readers.flatMap(reader=>reader.events),sourceScopeComplete:false,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaCount:null,websiteJavaScriptExecuted:false}
  Object.defineProperty(jobs,'sourceAudit',{value:audit})
  attachInventoryEvidence(jobs,evidence)
  attachSourceObservationEvidence(jobs,{source:'aosmith',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  await withCallerSignal(()=>options.onRecords?.(structuredClone(observations)),signal)
  await withCallerSignal(()=>options.onAudit?.(structuredClone(audit)),signal)
  signal.throwIfAborted();return jobs
 }
 try{return await withCallerSignal(execute,signal)}finally{clearTimeout(timer)}
}})
