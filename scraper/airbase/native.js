import {createHash} from 'node:crypto'
import {parseBoundedProgram,parseRemoteLiteral} from '../../scraper-support/utils/remoteScriptData.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {composeAbortSignals} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const HOME='https://www.airbase.com/'
export const HANDOFF='https://www.airbase.com/careers'
export const PARENT='https://www.paylocity.com/company/careers/'
export const BOARD='https://2000recruiting.paylocity.com/recruiting/jobs/All/e2bcef5a-b6e5-4c5a-8fdd-c4da179dd98c/Paylocity'
const ORIGIN='https://2000recruiting.paylocity.com',BRAND_KEY='e2bcef5a-b6e5-4c5a-8fdd-c4da179dd98c'
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const signature=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[airbase] Current native contract: '+message),{failureKind:'parser_or_contract_error',abortRetries:true})}
const one=(items,label)=>{need(items.length===1,'missing or ambiguous '+label);return items[0]}
const boundedRead=async(operation,signal)=>{
 signal.throwIfAborted()
 let listener
 try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}
 finally{signal.removeEventListener('abort',listener)}
}
const walk=(node,predicate)=>{if(!node||typeof node!=='object')return[];return[...(predicate(node)?[node]:[]),...Object.values(node).flatMap(value=>Array.isArray(value)?value.flatMap(item=>walk(item,predicate)):value&&typeof value==='object'?walk(value,predicate):[])]}
const scripts=html=>readNativeDocument(html).nodes(node=>node.tag==='script'&&!node.attrs.src&&/^(?:|text\/javascript|application\/javascript|module)$/.test(node.attrs.type||''))
const dataValue=(html,kind)=>{
 const matches=[]
 for(const script of scripts(html)){
  if(!(script.raw||'').includes(kind==='board'?'window.pageData':'"jobApplicationId"'))continue
  const program=parseBoundedProgram(script.raw)
  const nodes=walk(program,node=>node.type==='AssignmentExpression'&&node.operator==='='&&node.left.type==='MemberExpression'&&!node.left.computed&&node.left.object.name==='window'&&node.left.property.name==='pageData'&&node.right.type==='ObjectExpression').map(node=>node.right)
  for(const node of nodes)matches.push(parseRemoteLiteral(script.raw.slice(node.start,node.end)))
 }
 return one(matches,kind+' published model')
}
export const readBoard=html=>{
 const model=dataValue(html,'board')
 need(model.ModuleId==='1'&&model.ModuleTitle==='Paylocity'&&model.ShowInternal===false&&Array.isArray(model.Jobs)&&model.Jobs.length<=2000,'public parent tenant or native inventory changed')
 const ids=new Set()
 for(const row of model.Jobs){need(Number.isSafeInteger(row.JobId)&&row.JobId>0&&!ids.has(row.JobId)&&norm(row.JobTitle)&&typeof row.IsInternal==='boolean','native public role identity changed');ids.add(row.JobId)}
 return model
}
const publishedDate=value=>{
 need(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10),'native public PublishedDate is invalid')
 return new Date(value).toISOString()
}
const knownProjection=html=>{
 const document=readNativeDocument(html),root=document.nodes(node=>node.tag==='root')[0]
 const all=(node,predicate)=>typeof node==='string'?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>all(child,predicate))]
 const container=one(all(root,node=>node.attrs.id==='applicant-tracking'),'native public application container')
 need(/^\s*display\s*:\s*none\s*;?\s*$/.test(container.attrs.style||''),'native initial visibility contract changed')
 let loaders=0
 for(const script of scripts(html)){
  if(!(script.raw||'').includes("getElementById('applicant-tracking')"))continue
  const program=parseBoundedProgram(script.raw)
  const registrations=walk(program,node=>node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.name==='document'&&node.callee.property.name==='addEventListener'&&node.arguments[0]?.value==='DOMContentLoaded'&&['FunctionExpression','ArrowFunctionExpression'].includes(node.arguments[1]?.type))
  for(const registration of registrations)for(const assignment of walk(registration.arguments[1].body,node=>node.type==='AssignmentExpression'&&node.operator==='='&&node.right.value==='block')){
   const left=assignment.left,style=left.type==='MemberExpression'&&left.property.name==='display'&&left.object,call=style?.type==='MemberExpression'&&style.property.name==='style'&&style.object
   if(call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&call.callee.object.name==='document'&&call.callee.property.name==='getElementById'&&call.arguments.length===1&&call.arguments[0].value==='applicant-tracking')loaders++
  }
 }
 need(loaders===1,'native visible public detail initializer is missing or ambiguous')
 const tags=[...html.matchAll(/<div\b(?=[^>]*\bid=["']applicant-tracking["'])[^>]*>/gi)]
 need(tags.length===1,'ambiguous native public container markup')
 const opening=tags[0][0],shown=opening.replace(/\sstyle=(["'])\s*display\s*:\s*none\s*;?\s*\1/i,'')
 need(shown!==opening,'native display initializer cannot be projected')
 return readNativeDocument(html.replace(opening,shown))
}
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
const render=node=>typeof node==='string'?node:node.inert||['script','style','title'].includes(node.tag)?'':`<${node.tag}${Object.entries(node.attrs).filter(([key])=>!/^on/i.test(key)).map(([key,value])=>` ${key}="${escape(value)}"`).join('')}>${node.children.map(render).join(' ')}</${node.tag}>`
const detailSections=(html,row)=>{
 const document=knownProjection(html),scope=one(document.nodes(node=>document.hasClass(node,'job-preview-details')),'full public detail scope')
 need(document.nodes(node=>document.hasClass(node,'job-preview-title')&&document.text(node)===norm(row.JobTitle)).length===1,'visible native detail role title changed')
 const sections=[]
 for(const parent of within(scope,node=>node.children.some(child=>typeof child==='object'&&document.hasClass(child,'job-listing-header')))){
  const children=parent.children.filter(child=>typeof child==='object')
  for(let i=0;i<children.length;i++)if(document.hasClass(children[i],'job-listing-header')){
   const next=children[i+1];need(next&&!document.hasClass(next,'job-listing-header'),'public native criteria section is missing')
   sections.push({label:document.text(children[i]),text:document.text(next),html:next.children.map(render).join(' ')})
  }
 }
 need(sections.some(section=>section.label==='Description'&&extractActiveDescription(section.html)?.length>100),'full published native description missing')
 const content=sections.filter(section=>section.label!=='Job Type').map(section=>`<h3>${escape(section.label)}</h3>${section.html}`).join('\n')
 need(/\bAirbase\s+by\s+Paylocity\b/i.test(extractActiveDescription(content)||''),'own native role does not declare Airbase by Paylocity employer branding')
 return{description:content,sections,employmentType:sections.find(section=>section.label==='Job Type')?.text||null}
}
export const reviewRole=(row,detailHtml,applyHtml)=>{
 const model=dataValue(applyHtml,'application'),job=model.application?.job
 need(model.moduleNumber==='2000'&&model.moduleId===1&&model.moduleName==='Paylocity'&&model.isCorpModule===true&&model.publicLinkKey===BRAND_KEY&&model.brandingModel?.publicLinkKey===BRAND_KEY,'native application employer or tenant identity changed')
 need(model.jobId===row.JobId&&job?.jobId===row.JobId&&job.moduleId===1&&norm(model.jobTitle)===norm(row.JobTitle)&&norm(job.title)===norm(row.JobTitle)&&job.companyName==='PAYLOCITY CORPORATION','own native application role or employer identity changed')
 for(const [field,route]of[['displayUrl','Details'],['applyUrl','Apply']]){
  let url;try{url=new URL(job[field])}catch{}
  need(url?.origin===ORIGIN&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname.startsWith(`/recruiting/jobs/${route}/${row.JobId}/Paylocity/`)&&!/%(?:2f|5c)/i.test(url.pathname),'own native public role URL changed')
 }
 need(row.JobLocation?.Country==='IND'&&job.jobLocation?.country==='IND'&&job.jobLocation.locationId===row.JobLocation.LocationId&&job.jobStatus===2&&job.isInternal===false&&job.isUnlisted===false&&model.isUnlisted===false,'own native work-country, location or current status identity changed')
 const postingDate=publishedDate(row.PublishedDate)
 need(Math.floor(Date.parse(job.lastStatusToActive)/1000)===Math.floor(Date.parse(row.PublishedDate)/1000),'public PublishedDate and native publication event disagree')
 const visible=detailSections(detailHtml,row),screener=job.screener||model.screener
 need(model.hasScreener===false||screener&&Array.isArray(screener.questions)&&screener.questions.every(q=>typeof q.title==='string'&&typeof q.data==='string'&&typeof q.isRequired==='boolean'),'native public application requirements are unreviewed')
 const criteria=Object.fromEntries(Object.entries(job).filter(([key])=>!['createdUtc','lastChangedUtc','lastChangedBy','applicantCount','workflowHistoryCount'].includes(key)))
 const snapshot=signature({row,description:visible.description,employmentType:visible.employmentType,screener,customApplication:model.customJobApplication,criteria})
 return{row,model,job,...visible,postingDate,screener,snapshot}
}

export const createAirbaseNativeScraper=({fetchImpl=globalThis.fetch,now=()=>new Date()}={})=>({async run({signal,fetchPage,maxJobs=null,totalBudgetMs=120000,requestTimeoutMs=20000,onNativeAudit}={}){
 signal?.throwIfAborted();need(Number.isFinite(totalBudgetMs)&&totalBudgetMs>0&&Number.isFinite(requestTimeoutMs)&&requestTimeoutMs>0,'request budgets must be positive and finite')
 const bounded=composeAbortSignals(signal,AbortSignal.timeout(totalBudgetMs)),deadline=Date.now()+totalBudgetMs,receipts=[];let bytes=0
 const read=async(url,{handoff=false}={})=>{
  signal?.throwIfAborted();bounded.throwIfAborted();need(receipts.length<64,'native public request budget exhausted')
  const requestSignal=composeAbortSignals(bounded,AbortSignal.timeout(Math.max(1,Math.min(requestTimeoutMs,deadline-Date.now()))))
  let page
  if(fetchPage)page=await boundedRead(()=>fetchPage(url,{signal:requestSignal,redirect:'manual'}),requestSignal)
  else{const response=await fetchImpl(url,{signal:requestSignal,redirect:'manual',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; Jobverify public careers inventory)'}});page={url:response.url,status:response.status,location:response.headers.get('location'),contentType:response.headers.get('content-type'),html:await response.text()}}
  signal?.throwIfAborted();requestSignal.throwIfAborted();need(page?.url===url&&typeof page.html==='string','public native response redirected or lacks original identity')
  bytes+=Buffer.byteLength(page.html);need(Buffer.byteLength(page.html)<=2000000&&bytes<=8000000,'public native response byte budget exceeded')
  receipts.push({url,status:page.status,location:page.location||null,bodySHA256:createHash('sha256').update(page.html).digest('hex'),observedAt:new Date(now()).toISOString()})
  if(handoff){need([301,302,307,308].includes(page.status)&&page.location===PARENT,'corporate careers parent handoff changed');return page.html}
  if(page.status!==200)throw Object.assign(Error(`[airbase] Public native HTTP ${page.status} at ${url}`),{status:page.status,failureKind:[401,403,429].includes(page.status)?'blocked_or_access_denied':'upstream_unavailable',abortRetries:true})
  return page.html
 }
 const home=await read(HOME),doc=readNativeDocument(home)
 need(doc.nodes(node=>node.tag==='title'&&/Airbase.*Paylocity/.test(node.raw||'')).length===1&&doc.nodes(node=>node.tag==='a'&&node.attrs.href==='https://www.paylocity.com/').length>0,'current Airbase acquisition homepage or parent identity changed')
 await read(HANDOFF,{handoff:true})
 const opening=readBoard(await read(BOARD)),candidates=opening.Jobs.filter(row=>!row.IsInternal&&row.JobLocation?.Country==='IND'),reviews=new Map(),failures=[]
 const hydrate=async row=>reviewRole(row,await read(`${ORIGIN}/recruiting/jobs/Details/${row.JobId}`),await read(`${ORIGIN}/recruiting/jobs/Apply/${row.JobId}`))
 for(const row of candidates){try{reviews.set(row.JobId,await hydrate(row))}catch(error){signal?.throwIfAborted();bounded.throwIfAborted();if(error.failureKind==='parser_or_contract_error')throw error;failures.push({jobId:row.JobId,stage:'opening-detail',reason:error.message})}}
 const originalOwnRoleFacts=[...reviews.values()]
 const closing=readBoard(await read(BOARD)),current=new Map(closing.Jobs.map(row=>[row.JobId,row]))
 for(const row of candidates){const first=reviews.get(row.JobId),last=current.get(row.JobId);if(!first)continue;if(!last||signature(row)!==signature(last)){reviews.delete(row.JobId);failures.push({jobId:row.JobId,stage:'closing-native-record',reason:'own native record changed or disappeared'});continue}
  try{const checked=await hydrate(last);if(first.snapshot!==checked.snapshot){reviews.delete(row.JobId);failures.push({jobId:row.JobId,stage:'closing-native-criteria',reason:'own full criteria or application requirements changed'})}}catch(error){signal?.throwIfAborted();bounded.throwIfAborted();if(error.failureKind==='parser_or_contract_error')throw error;reviews.delete(row.JobId);failures.push({jobId:row.JobId,stage:'closing-detail',reason:error.message})}}
 await read(HANDOFF,{handoff:true})
 const finalParentBoard=readBoard(await read(BOARD)),finalRows=new Map(finalParentBoard.Jobs.map(row=>[row.JobId,row]))
 for(const[jobId,fact]of reviews)if(!finalRows.has(jobId)||signature(fact.row)!==signature(finalRows.get(jobId))){reviews.delete(jobId);failures.push({jobId,stage:'final-native-record',reason:'own role changed or disappeared after full closing criteria reads'})}
 const observations={parentBoardObservedCount:opening.Jobs.length,parentIndiaCandidateCount:candidates.length,qualifiedAirbaseIndiaCount:reviews.size,parentBoardStable:signature(opening)===signature(closing)&&signature(closing)===signature(finalParentBoard),originalParentBoard:opening,closingParentBoard:closing,finalParentBoard,originalOwnRoleFacts,failures,receipts,sourceScopeComplete:false,broaderMigrationScope:'Reviewed parent tenant and own Airbase-branded India roles do not establish all Airbase or Paylocity hiring channels.'}
 const all=[...reviews.values()],selected=Number.isSafeInteger(maxJobs)&&maxJobs>0?all.slice(0,maxJobs):all
 const jobs=selected.map(fact=>{const {row,job}=fact;return{source:'airbase',company:'Airbase by Paylocity',sourcePublisher:'Paylocity',legalHiringEmployer:null,title:norm(row.JobTitle),jobId:String(row.JobId),requisitionId:job.jobCode||null,country:'India',location:row.LocationName,city:norm(row.JobLocation.City).split(',')[0]||null,department:row.HiringDepartment||job.hiringDepartment||null,employmentType:fact.employmentType,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:fact.postingDate,sourcePostingDate:fact.postingDate,sourceDateEvidence:'paylocity-public-native-PublishedDate',sourceNativePublishedDate:row.PublishedDate,closingDate:null,sourceUrl:job.displayUrl,applyUrl:job.applyUrl,link:job.applyUrl,jobDescription:fact.description,sourceDescription:fact.description,sourceDetailComplete:true,sourceNativeApplicationQuestions:fact.screener?.questions||[],sourceNativeApplicationJob:job,sourceNativeApplicationModel:fact.model,sourceNativeListingRecord:row,sourceNativeInventory:observations,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date(now()).toISOString()}})
 signal?.throwIfAborted();bounded.throwIfAborted();onNativeAudit?.(observations);signal?.throwIfAborted()
 attachSourceObservationEvidence(jobs,{source:'airbase',recordKind:'mixed',observedRecordCount:opening.Jobs.length,observedVacancyCount:candidates.length,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{status:'discovery-only',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:3,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date(now()).toISOString(),reason:'current-Airbase-parent-redirect-and-own-native-India-employer-country-full-JD-and-application-requirements;broader-company-migration-scope-unresolved'+(failures.length?';native-role-criteria-unresolved':'')})
}})
