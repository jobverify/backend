import{createHash}from'node:crypto'
import{activeHead,activeScripts,readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{readAixNativeInit}from'../bounteous/nativeScriptContract.js'
import{assertNoPositiveAixInventory,readPositiveAixPage,readPositiveAixRole}from'./positiveAix.js'
export const CURRENT_CAREERS='https://www.airindiaexpress.com/careers'
const ROOT_MODEL='https://www.airindiaexpress.com/content/airindiaexpress/en.model.json',PAGE_MODEL='https://www.airindiaexpress.com/content/airindiaexpress/en/careers.model.json'
export const AIX_BOARD='https://careers.airindia.com/aix',AIX_SEARCH=AIX_BOARD+'/search/?q=&locationsearch='
export const MERGER_STATEMENT='https://www.airindia.com/in/en/newsroom/press-release/air-india-express-aix-connect-merger.html'
const check=(ok,message)=>{if(!ok)throw Error('AirAsia India current AIX: '+message)}
function corporate(html,root,page){
 check(activeHead(html).titles.includes('Air India Express | Career Opportunities | Current Vacancies'),'current corporate careers employer identity changed')
 check(activeHead(html).metas.some(meta=>meta.property==='cq:pagemodel_root_url'&&new URL(meta.content,CURRENT_CAREERS).href===ROOT_MODEL),'current public AEM model handoff changed')
 const child=root?.[':children']?.['/content/airindiaexpress/en/careers']
 check(child?.[':path']==='/content/airindiaexpress/en/careers'&&child.title==='Air India Express | Career Opportunities | Current Vacancies','native public careers page model identity changed')
 check(page?.[':path']==='/careers'&&page.title===child.title,'current native careers page path/title changed')
 const grid=page[':items']?.root?.[':items']?.responsivegrid,order=grid?.[':itemsOrder'],items=grid?.[':items']
 check(Array.isArray(order)&&order.length>0&&order.every(key=>Object.hasOwn(items||{},key)),'current corporate active component inventory changed')
 const handoff=items?.richtext_with_share_
 check(order.includes('richtext_with_share_')&&handoff?.buttonIsRedirect===true&&handoff?.mainbuttonurl===AIX_BOARD,'current corporate AIX hiring handoff/scope changed')
 const urls=[];const walk=value=>{if(typeof value==='string'){if(/^https:\/\//.test(value)&&/career|recruit|job|hire/i.test(value))urls.push(value)}else if(value&&typeof value==='object')for(const child of Object.values(value))walk(child)}
 for(const key of order)walk(items[key])
 check(urls.length===1&&urls[0]===AIX_BOARD,'additional unqualified current corporate hiring channel')
 return{path:page[':path'],handoff:handoff.mainbuttonurl,components:order}
}
function nativeIdentity(html){
 const init=readAixNativeInit(html)
 check(init.ssoCompanyId==='airindiali'&&init.brand==='aix'&&init.siteTypeId===1&&init.categoryId===0,'current native company/AIX brand identity changed')
 const doc=readNativeDocument(html),body=doc.nodes(node=>node.tag==='body')
 check(body.length===1&&doc.hasClass(body[0],'bodyaix'),'current native AIX brand body identity changed')
 return{doc,init}
}
function board(html){
 const{doc}=nativeIdentity(html),text=doc.nodes(node=>node.tag==='body').map(doc.text).join(' ')
 check(text.includes('Air India Express is a subsidiary of Air India'),'current native board employer identity changed')
 const forms=doc.nodes(node=>node.tag==='form'&&node.attrs.role==='search')
 check(forms.length===1&&forms[0].attrs.method==='get'&&forms[0].attrs.action==='/aix/search/','native AIX public GET search handoff changed')
 const departments=[...new Set(doc.nodes(node=>node.tag==='a'&&/^\/aix\/go\/AIX-[A-Za-z-]+\/\d+\/$/.test(node.attrs.href||'')).map(node=>node.attrs.href))]
 check(departments.length===10,'native AIX department-channel inventory changed')
 const extra=doc.nodes(node=>node.tag==='a'&&/job|career|recruit|openings/i.test(doc.text(node))&&node.attrs.href).map(node=>node.attrs.href)
 check(extra.every(href=>href.startsWith('/aix/go/AIX-')),'additional unqualified native hiring channel')
 return{brand:'aix',departments,search:AIX_SEARCH}
}
function searchIdentity(html){
 const{doc,init}=nativeIdentity(html)
 for(const field of ['q','location','locationsearch','geolocation'])check(init[field]==='','native unfiltered query must remain blank: '+field)
 const forms=doc.nodes(node=>node.tag==='form'&&node.attrs.role==='search')
 check(forms.length===1&&forms[0].attrs.method==='get'&&forms[0].attrs.action==='/aix/search/','native AIX unfiltered search form changed')
 const controls=doc.nodes(node=>['input','select'].includes(node.tag)&&node.attrs.name)
 check(controls.every(node=>['createNewAlert','q','locationsearch'].includes(node.attrs.name)),'additional native search filter control changed')
 check(controls.filter(node=>node.attrs.name==='q').length===1&&controls.filter(node=>node.attrs.name==='locationsearch').length===1
  &&controls.every(node=>node.attrs.name==='createNewAlert'?node.attrs.value==='false':(node.attrs.value||'')===''),'native query/filter control conflicts with the blank search')
 return doc
}
function emptySearch(html){
 const doc=searchIdentity(html)
 assertNoPositiveAixInventory(html)
 const activeJobLinks=doc.nodes(node=>node.tag==='a'&&/(?:\/job\/|\/jobs\/)/i.test(node.attrs.href||''))
 check(!activeJobLinks.length&&!doc.nodes(node=>node.attrs['data-row-index']||doc.hasClass(node,'data-row')||doc.hasClass(node,'job-tile')).length,'positive native role inventory requires full current posting extraction')
 const nodes=doc.nodes(node=>node.attrs.id==='noresults');check(nodes.length===1,'explicit native zero result container missing')
 const text=doc.text(nodes[0]);check(/There are currently no open positions matching\s*"\s*"\./.test(text),'explicit native no-open-positions sentence missing')
 check(/The 0 most recent jobs posted by Air India Careers are listed below for your convenience\./.test(text),'native fallback zero count changed')
 check(!doc.nodes(node=>node.tag==='a'&&/startrow=/.test(node.attrs.href||'')).length,'unexpected zero-inventory pagination continuation')
 return{brand:'aix',companyToken:'airindiali',reportedTotal:0,query:{q:'',location:'',locationsearch:'',geolocation:''},explicitZero:true}
}
export async function runCurrentAix(options={}){
 const signal=AbortSignal.any([AbortSignal.timeout(Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:90000),...(options.signal?[options.signal]:[])])
 const wait=promise=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,value)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 const responses=[]
 const read=async(url,json=false)=>{
  signal.throwIfAborted();const headers={'User-Agent':'Mozilla/5.0',Accept:json?'application/json':'text/html'}
  const packet=await wait(Promise.resolve().then(async()=>{if(options.fetchPage)return options.fetchPage(url,{signal,headers});const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)]),response=await fetch(url,{signal:requestSignal,headers,redirect:'manual'}),body=await response.text();requestSignal.throwIfAborted();return{status:response.status,url:response.url,body,capturedAt:new Date().toISOString()}}));signal.throwIfAborted()
  check(packet?.status===200&&packet.url===url,'current public HTTP status/final native URL identity changed at '+url)
  check(typeof packet.body==='string'&&Buffer.byteLength(packet.body)<=2000000,'invalid or oversized current public body')
  const observed={url,finalUrl:packet.url,status:packet.status,sha256:createHash('sha256').update(packet.body).digest('hex'),capturedAt:Object.getOwnPropertyDescriptor(packet,'capturedAt')?.value||null};responses.push(observed)
  if(options.onResponse)await wait(Promise.resolve().then(()=>options.onResponse({...observed,body:packet.body})));signal.throwIfAborted()
  if(!json)return packet.body
  try{return JSON.parse(packet.body)}catch{throw Error('AirAsia India current native JSON invalid')}
 }
 const inventory=async()=>{
  const html=await read(AIX_SEARCH),doc=searchIdentity(html)
  if(!doc.nodes(node=>node.tag==='a'&&/(?:\/job\/|\/jobs\/)/i.test(node.attrs.href||'')||doc.hasClass(node,'job-tile')).length)return emptySearch(html)
  const first=readPositiveAixPage(html),rows=[...first.rows],ids=new Set(rows.map(row=>row.jobId));let next=first.nextUrl,pages=1
  while(next){check(++pages<=100,'native positive role pagination exceeds source bound');const page=readPositiveAixPage(await read(next),{start:rows.length,config:first.config})
   for(const row of page.rows){check(!ids.has(row.jobId),'duplicate native positive role identity across pages');ids.add(row.jobId);rows.push(row)}next=page.nextUrl}
  check(rows.length===first.config.total,'native positive role total does not reconcile')
  return{brand:'aix',companyToken:'airindiali',reportedTotal:first.config.total,explicitZero:false,config:first.config,rows,pages}
 }
 const scan=async()=>{const binding=corporate(await read(CURRENT_CAREERS),await read(ROOT_MODEL,true),await read(PAGE_MODEL,true)),channel=board(await read(AIX_BOARD));return{binding,channel,inventory:await inventory()}}
 const observedAt=new Date((options.now||(()=>new Date().toISOString()))()).toISOString()
 const details=async collection=>{const roles=[];for(const row of collection.rows||[])roles.push(readPositiveAixRole(await read(row.sourceUrl),row,observedAt));return roles}
 const opening=await scan(),openingRoles=await details(opening.inventory),closing=await scan(),stable=JSON.stringify(opening)===JSON.stringify(closing);check(stable,'closing current AIX hiring models changed')
 const closingRoles=await details(closing.inventory),isZero=closing.inventory.explicitZero
 if(!isZero){check(JSON.stringify(openingRoles.map(role=>role.state))===JSON.stringify(closingRoles.map(role=>role.state)),'closing current AIX full native posting details changed')
  check(JSON.stringify(await inventory())===JSON.stringify(closing.inventory),'final current AIX positive role inventory changed after details')}
 const jobs=closingRoles.flatMap(role=>role.job?[role.job]:[]),audit={source:'airasiaindia',historicalEmployer:'AirAsia India / AIX Connect',currentEmployer:'Air India Express',nativeBrand:'aix',observedListingCount:closing.inventory.reportedTotal,observedIndiaListingCount:jobs.length,
  opening,closing,closingInventoryMatches:stable,listingPaginationComplete:true,sourceScopeComplete:isZero,sourceDeclaredBoardScopeComplete:true,sourceCompanyWideScopeComplete:false,sourceLifecycleCleanupVerified:false,
  historicalContinuity:{url:MERGER_STATEMENT,publishedOn:'2024-10-01',kind:'primary-official-legal-merger-statement',scope:'AIX Connect (erstwhile AirAsia India) merged into Air India Express; does not conflate the separate Air India airline employer'},
  observations:responses,failures:[],excludedRoles:closingRoles.filter(role=>role.excluded).map(role=>({publicId:role.state.publicId,reason:role.reason})),reason:isZero
   ?'Only current corporate-declared AIX brand public unfiltered board is explicitly zero in both native reads. Other recruitment channels/company-wide absence/lifecycle cleanup remain unproved.'
   :'Current corporate-declared AIX brand pagination, role IDs, explicit employer, canonical/apply identity, typed countries and full posting details reconcile across closing reads. Company-wide scope, other channels and lifecycle cleanup remain unproved.'}
 attachInventoryEvidence(jobs,{firstParty:true,surface:AIX_SEARCH,status:isZero?'verified-empty':'coverage-gap',listingComplete:isZero,pagesFetched:responses.length,reportedTotal:isZero?0:null,indiaFacetCount:isZero?0:null,verifiedAt:new Date().toISOString(),reason:audit.reason})
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
