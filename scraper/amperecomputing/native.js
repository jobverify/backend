import {createHash} from 'node:crypto'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseBoundedProgram,parseRemoteLiteral} from '../../scraper-support/utils/remoteScriptData.js'
import {composeAbortSignals} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const ORIGIN='https://careers.amperecomputing.com',SEARCH=ORIGIN+'/search/jobs',INDIA=SEARCH+'/in/country/india'
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const signature=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const need=(condition,message)=>{if(!condition)throw Object.assign(Error('Ampere native contract: '+message),{failureKind:'parser_or_contract_error',abortRetries:true})}
const one=(rows,label)=>{need(rows.length===1,'missing or ambiguous '+label);return rows[0]}
const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...Object.values(node).flatMap(value=>Array.isArray(value)?value.flatMap(n=>walk(n,predicate)):value&&typeof value==='object'?walk(value,predicate):[])]
const inside=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>inside(c,predicate))]
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
const render=node=>typeof node==='string'?node:node.inert||['script','style','title'].includes(node.tag)?'':`<${node.tag}${Object.entries(node.attrs).filter(([key])=>!/^on/i.test(key)).map(([key,value])=>` ${key}="${escape(value)}"`).join('')}>${node.children.map(render).join(' ')}</${node.tag}>`
const abortable=async(operation,signal)=>{
 signal.throwIfAborted();let listener
 try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener)}
}
const assignedVars=html=>{
 const found=[]
 for(const script of readNativeDocument(html).nodes(n=>n.tag==='script'&&!n.attrs.src&&(n.raw||'').includes('CareerSite.vars'))){
  for(const node of walk(parseBoundedProgram(script.raw),n=>n.type==='AssignmentExpression'&&n.operator==='='&&n.left.type==='MemberExpression'&&!n.left.computed&&n.left.object.name==='CareerSite'&&n.left.property.name==='vars'&&n.right.type==='ObjectExpression'))found.push(parseRemoteLiteral(script.raw.slice(node.right.start,node.right.end)))
 }
 return one(found,'active CareerSite.vars')
}
const confirmSurface=html=>{
 const d=readNativeDocument(html)
 need(d.nodes(n=>n.tag==='title'&&/Job Search Results|India Careers/.test(n.raw||'')).length===1,'official search identity changed')
 need(d.nodes(n=>n.tag==='a'&&n.attrs.href==='https://amperecomputing.com/').length>0||d.nodes(n=>n.tag==='a'&&n.attrs.href==='https://www.amperecomputing.com/').length>0,'current corporate employer link missing')
 need(d.nodes(n=>n.tag==='script'&&!n.attrs.src&&(n.raw||'').includes('"search_jobs_json":"/search/jobs.json"')&&(n.raw||'').includes('"root_domain":"'+ORIGIN+'"')).length===1,'active native JSON source binding changed')
 const counts=[...d.text(one(d.nodes(n=>n.tag==='body'),'body')).matchAll(/Showing\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)\s+results/g)].map(m=>Number(m[3]))
 need(counts.length>0&&new Set(counts).size===1,'visible native inventory count missing or conflicting')
 return counts[0]
}
const reviewDetail=(row,html)=>{
 const url=ORIGIN+'/jobs/'+row.id+'-'+row.permalink,d=readNativeDocument(html),vars=assignedVars(html)
 need(vars.published===true&&vars.job_present===true&&vars.job_id===row.id,'own native role status or identity changed')
 need(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===url).length===1,'own native canonical role URL changed')
 const main=one(d.nodes(n=>d.hasClass(n,'job-details__main')),'own public role detail'),title=one(inside(main,n=>n.tag==='h1'),'own role heading')
 need(d.text(title)===norm(row.title),'own visible role title disagrees with native record')
 const country=norm(row.location?.country)
 need(country==='India'&&inside(main,n=>n.tag==='li'||n.tag==='p'||n.tag==='div').some(n=>/^Location:\s*[^:]+,\s*India$/.test(d.text(n))&&d.text(n).includes(norm(row.location.locality))),'own visible work country conflicts with native typed country')
 const scope=one(inside(main,n=>d.hasClass(n,'padded-v-medium')&&d.hasClass(n,'space-medium')&&n.children.some(c=>typeof c!=='string'&&d.text(c)==='Description')),'full native description')
 const description=scope.children.map(render).join('\n')
 need(extractActiveDescription(description)?.length>100&&/\bAmpere\b/.test(extractActiveDescription(description)),'full own employer description missing')
 const applications=inside(main,n=>n.tag==='a'&&(n.attrs.href||'').startsWith('javascript: CareerSite.Apply.launchApplicantJob('))
 const anchor=one(applications,'active native public application declaration'),code=anchor.attrs.href.slice('javascript:'.length).trim(),program=parseBoundedProgram(code),call=program.body[0]?.expression
 need(program.body.length===1&&call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&call.callee.property.name==='launchApplicantJob'&&call.callee.object.type==='MemberExpression'&&call.callee.object.object.name==='CareerSite'&&call.callee.object.property.name==='Apply'&&String(call.arguments[0]?.value)===row.id&&call.arguments[1]?.type==='ObjectExpression','own native application role identity changed')
 const options=parseRemoteLiteral(code.slice(call.arguments[1].start,call.arguments[1].end))
 need(options.applyCompany==='amperecomputing'&&options.applyUrl==='https://apply.app.jobvite.com'&&Number.isSafeInteger(options.applyWorkflowId)&&options.applyWorkflowId>0,'own native application employer changed')
 return {row,vars,description,applicationOptions:options,url,snapshot:signature({row,vars,description,options})}
}

export const createAmpereNativeScraper=({fetchImpl=globalThis.fetch,now=()=>new Date().toISOString()}={})=>({async run({signal,fetchPage,fetchText,maxJobs=null,totalBudgetMs=240000,requestTimeoutMs=20000,onNativeAudit}={}){
 signal?.throwIfAborted();need(Number.isFinite(totalBudgetMs)&&totalBudgetMs>0&&Number.isFinite(requestTimeoutMs)&&requestTimeoutMs>0,'finite request budgets required')
 const bounded=composeAbortSignals(signal,AbortSignal.timeout(totalBudgetMs)),deadline=Date.now()+totalBudgetMs,receipts=[];let bytes=0
 const read=async url=>{
  signal?.throwIfAborted();bounded.throwIfAborted();need(receipts.length<96,'request budget exhausted')
  const requestSignal=composeAbortSignals(bounded,AbortSignal.timeout(Math.max(1,Math.min(requestTimeoutMs,deadline-Date.now()))))
  const page=await abortable(async()=>{
   if(fetchPage)return fetchPage(url,{signal:requestSignal})
   if(fetchText)return {url,status:200,html:await fetchText(url,{signal:requestSignal})}
   const response=await fetchImpl(url,{signal:requestSignal,headers:{Accept:'text/html,application/json','User-Agent':'Mozilla/5.0 (compatible; Jobverify public careers inventory)'},redirect:'follow'})
   return {url:response.url,status:response.status,html:await response.text()}
  },requestSignal)
  signal?.throwIfAborted();requestSignal.throwIfAborted();need(page?.url===url&&typeof page.html==='string','native response URL changed or original body missing')
  bytes+=Buffer.byteLength(page.html);need(Buffer.byteLength(page.html)<=2000000&&bytes<=20000000,'response byte budget exhausted')
  receipts.push({url,status:page.status,sha256:createHash('sha256').update(page.html).digest('hex'),observedAt:new Date(now()).toISOString()})
  if(page.status!==200)throw Object.assign(Error(`Ampere public native HTTP ${page.status} at ${url}; inventory unverified`),{status:page.status,failureKind:[401,403,429].includes(page.status)?'blocked_or_access_denied':'upstream_unavailable',abortRetries:true})
  return page.html
 }
 const inventory=async base=>{
  const rows=[],ids=new Set();let total,perPage
  for(let page=1;page<=20;page++){
   const url=base+'.json'+(page>1?'?page='+page:''),body=await read(url);let model;try{model=JSON.parse(body)}catch{}
   need(model&&model.current_page===page&&Number.isSafeInteger(model.per_page)&&model.per_page>0&&model.per_page<=200&&Number.isSafeInteger(model.total_entries)&&model.total_entries>=0&&model.total_entries<=2000&&Array.isArray(model.entries),'native pagination envelope changed')
   if(page===1){total=model.total_entries;perPage=model.per_page}else need(total===model.total_entries&&perPage===model.per_page,'native pagination total or size changed')
   need(model.entries.length===Math.min(perPage,Math.max(0,total-(page-1)*perPage)),'native page is truncated or contains excess records')
   for(const row of model.entries){need(typeof row.id==='string'&&/^\d+$/.test(row.id)&&row.talemetry_job_id===row.id&&!ids.has(row.id)&&norm(row.title)&&typeof row.permalink==='string'&&/^[a-z0-9-]+$/.test(row.permalink)&&row.location&&typeof row.location==='object','native role identity or location changed');ids.add(row.id);rows.push(row)}
   if(rows.length===total)return rows
  }
  need(false,'pagination budget exhausted')
 }
 const corporateCount=confirmSurface(await read(SEARCH)),nativeRecords=await inventory(SEARCH),indiaNativeRecords=await inventory(INDIA)
 need(corporateCount===nativeRecords.length,'corporate and native counts disagree')
 const typedIndia=nativeRecords.filter(r=>r.location.country==='India')
 need(indiaNativeRecords.every(r=>r.location.country==='India')&&signature([...typedIndia].sort((a,b)=>a.id.localeCompare(b.id)))===signature([...indiaNativeRecords].sort((a,b)=>a.id.localeCompare(b.id))),'typed native India records and exact country facet disagree')
 const reviews=new Map(),failures=[]
 const hydrate=async(rows,closing=false)=>{
  let cursor=0,stopped=false
  const settled=await Promise.allSettled(Array.from({length:Math.min(4,rows.length)},async()=>{
   try{while(!stopped&&cursor<rows.length){const row=rows[cursor++];try{const fact=reviewDetail(row,await read(ORIGIN+'/jobs/'+row.id+'-'+row.permalink));if(closing){if(reviews.get(row.id)?.snapshot!==fact.snapshot){reviews.delete(row.id);failures.push({id:row.id,reason:'closing native criteria changed'})}}else reviews.set(row.id,fact)}catch(error){signal?.throwIfAborted();bounded.throwIfAborted();if(error.failureKind==='parser_or_contract_error')throw error;reviews.delete(row.id);failures.push({id:row.id,reason:error.message,stage:closing?'closing-detail':'opening-detail'})}}}
   catch(error){stopped=true;throw error}
  }))
  signal?.throwIfAborted();bounded.throwIfAborted()
  const failed=settled.find(result=>result.status==='rejected');if(failed)throw failed.reason
 }
 await hydrate(indiaNativeRecords)
 const openingPublicDetails=[...reviews.values()]
 const closingCorporateCount=confirmSurface(await read(SEARCH)),closingNativeRecords=await inventory(SEARCH),closingIndiaNativeRecords=await inventory(INDIA)
 const closingMap=new Map(closingIndiaNativeRecords.map(r=>[r.id,r]))
 for(const row of indiaNativeRecords)if(!closingMap.has(row.id)||signature(row)!==signature(closingMap.get(row.id))){reviews.delete(row.id);failures.push({id:row.id,reason:'own closing native record changed or disappeared'})}
 await hydrate(indiaNativeRecords.filter(r=>reviews.has(r.id)),true)
 const finalNativeRecords=await inventory(SEARCH),finalIndiaNativeRecords=await inventory(INDIA),finalTypedIndia=finalNativeRecords.filter(r=>r.location.country==='India')
 need(finalIndiaNativeRecords.every(r=>r.location.country==='India')&&signature([...finalTypedIndia].sort((a,b)=>a.id.localeCompare(b.id)))===signature([...finalIndiaNativeRecords].sort((a,b)=>a.id.localeCompare(b.id))),'final typed native India records and exact country facet disagree')
 const finalIndiaMap=new Map(finalIndiaNativeRecords.map(row=>[row.id,row]))
 for(const[id,fact]of reviews)if(!finalIndiaMap.has(id)||signature(fact.row)!==signature(finalIndiaMap.get(id))){reviews.delete(id);failures.push({id,stage:'final-native-role',reason:'own role changed or disappeared after full closing public descriptions'})}
 const inventoryStable=corporateCount===closingCorporateCount&&signature(nativeRecords)===signature(closingNativeRecords)&&signature(closingNativeRecords)===signature(finalNativeRecords)&&signature(indiaNativeRecords)===signature(closingIndiaNativeRecords)&&signature(closingIndiaNativeRecords)===signature(finalIndiaNativeRecords)
 const unknownCountryRecords=nativeRecords.filter(r=>!norm(r.location.country))
 const audit={nativeRecords,indiaNativeRecords,closingNativeRecords,closingIndiaNativeRecords,finalNativeRecords,finalIndiaNativeRecords,openingPublicDetails,inventoryStable,unknownCountryRecords,failures,receipts,sourceScopeComplete:false,privateApplicationFieldsKnown:false}
 const facts=indiaNativeRecords.flatMap(row=>reviews.has(row.id)?[reviews.get(row.id)]:[])
 const publicObservations=facts.map(f=>({source:'amperecomputing',company:'Ampere Computing',title:norm(f.row.title),jobId:f.row.id,requisitionId:null,country:'India',city:norm(f.row.location.locality)||null,location:[f.row.location.locality,f.row.location.region_abbr,f.row.location.country].filter(Boolean).join(', '),sourceUrl:f.url,applyUrl:f.url,link:f.url,postingDate:null,sourcePostingDate:null,closingDate:null,employmentType:null,remoteStatus:null,department:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],jobDescription:f.description,sourceDescription:f.description,sourceNativeListingRecord:f.row,sourceNativeCareersVars:f.vars,sourceNativeApplicationOptions:f.applicationOptions,sourceDetailComplete:true,sourcePublicDescriptionComplete:true,sourcePrivateApplicationFieldsKnown:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date(now()).toISOString()}))
 // Session-only Jobvite form fields do not narrow the public role scope.
 const jobs=Number.isSafeInteger(maxJobs)&&maxJobs>0?publicObservations.slice(0,maxJobs):publicObservations
 audit.publicObservations=publicObservations
 Object.defineProperty(jobs,'sourceAudit',{value:audit})
 signal?.throwIfAborted();bounded.throwIfAborted();onNativeAudit?.(audit);signal?.throwIfAborted()
 attachSourceObservationEvidence(jobs,{source:'amperecomputing',recordKind:'vacancy-rows',observedRecordCount:nativeRecords.length,observedVacancyCount:nativeRecords.length,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{status:'discovery-only',surface:SEARCH,firstParty:true,listingComplete:false,pagesFetched:receipts.filter(r=>r.url.includes('.json')).length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date(now()).toISOString(),reason:'configured-native-Talemetry-full-pagination-and-typed-country-own-employer-full-SSR-description;original-publication-unknown;private-application-fields-unobserved;broader-company-scope-unverified'+(!inventoryStable?';closing-inventory-changed':'')})
}})
