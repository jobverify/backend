import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { boundedDeclaredPublicRead } from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { PEOPLESTRONG_NATIVE_PARTS, buildPairListUrl, buildPairDetailUrl, buildPairOrganizationUrl, mapPeopleStrongPairRole } from '../../scraper-support/shared/peopleStrongNativePair20261027.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { parse as parseProgram } from 'acorn'

const profiles=JSON.parse(fs.readFileSync(new URL('./currentProtocolProfiles.json',import.meta.url))),source='amararajaenergymobility',origin='https://amararajacareers.peoplestrong.com',careers='https://amararaja.com/careers/',base=origin+'/api/cp/rest/altone/cp/'
const sha=v=>createHash('sha256').update(v).digest('hex'),need=(v,message)=>{if(!v)throw Object.assign(Error('Amara native: '+message),{code:'PEOPLESTRONG_NATIVE_UNVERIFIED'})}
const parse=raw=>readLiteralModel(raw).value
const response=raw=>{const p=parse(raw);need(p.messageCode?.code===200&&p.response!=null,'unsuccessful public native response');return p.response}
const code=value=>{need(typeof value==='string'&&/^P-\d+$/.test(value),'invalid public posting code');return value}
const wait=(start,signal)=>new Promise((resolve,reject)=>{
 let settled=false
 const finish=(fn,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason)
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)return abort()
 Promise.resolve().then(()=>{signal?.throwIfAborted();return start()}).then(value=>finish(resolve,value),error=>finish(reject,error))
})
function reader(options,packets){return async(url,request={method:'GET'})=>{
 const method=request.method??'GET'
 need(method==='GET'||method==='POST'&&url.startsWith(base+'jobs/v1?')&&/^offset=\d+&limit=45$/.test(url.split('?')[1])&&request.body==='{}','unreviewed public request')
 const signal=AbortSignal.any([AbortSignal.timeout(options.timeoutMs??30000),...(options.signal?[options.signal]:[])])
 const headers={Accept:'text/html,application/json,application/javascript',...(method==='POST'?{'Content-Type':'application/json'}:{})},init={method,redirect:'manual',credentials:'omit',signal,headers,...(method==='POST'?{body:'{}'}:{})},startedAt=new Date().toISOString()
 const p=await wait(()=>options.fetchPage?options.fetchPage(url,init):boundedDeclaredPublicRead(url,{request:{method,...(method==='POST'?{body:'{}'}:{})},signal,fetchImpl:(u,r)=>fetch(u,{...r,credentials:'omit',headers}),overflowError:Error('Amara native: oversized original')}),signal)
 need(p?.status===200||p?.status===404&&url===origin+'/home','HTTP '+p?.status+' at public careers stage')
 need(typeof p.url==='string'&&new URL(p.url).href===new URL(url).href,'unexpected public redirect')
 const bytes=typeof p.bodyBase64==='string'?Buffer.from(p.bodyBase64,'base64'):Buffer.from(p.body??p.html??'')
 const body=bytes.toString('utf8');need(bytes.length>0&&bytes.length<=16*1024*1024&&Buffer.from(body).equals(bytes),'missing, invalid or oversized original')
 need(!/<title[^>]*>\s*(?:just a moment|access denied|attention required)|<(?:h1|p)\b[^>]*>\s*(?:captcha challenge|verify you are human)/i.test(body),'explicit public access gate')
 packets.push({url,method,...(method==='POST'?{requestBody:'{}'}:{}),status:p.status,finalUrl:p.url,headers:p.headers??{},startedAt,capturedAt:new Date().toISOString(),bytes:bytes.length,sha256:sha(bytes),bodyBase64:bytes.toString('base64')})
 return body
}}
const identity=html=>{
 const d=readNativeDocument(html),titles=d.nodes(n=>n.tag==='title').map(n=>decodeNativeEntities(n.raw).replace(/\s+/g,' ').trim()),links=d.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>n.attrs.href)
 need(titles.length===1,'ambiguous corporate title');return{title:titles[0],links}
}
async function corporate(read){
 const company=identity(await read('https://amararaja.com/amara-raja-energy-and-mobility-ltd/'))
 need(/Amara Raja Energy\s*&\s*Mobility/i.test(company.title)&&company.links.includes('//www.amararajaeandm.com'),'current corporate employer delegation missing')
 const employer=identity(await read('https://www.amararajaeandm.com'))
 need(/Amara Raja Energy\s*&\s*Mobility Limited/i.test(employer.title),'exact employer homepage identity missing')
 const group=identity(await read(careers));need(/Amara Raja Group/i.test(group.title)&&group.links.includes(origin+'/home'),'current group native delegation missing')
 const exactEmployerDelegation=employer.links.some(h=>h===origin+'/home'||h===careers)
 return{exactEmployerDelegation,advertisedCount:null,careers,portal:origin+'/home',scopeLimitation:exactEmployerDelegation?null:'exact-employer-homepage-only-exposes-obsolete-careers-handoff'}
}
async function client(read){
 const shell=await read(origin+'/home'),d=readNativeDocument(shell),scripts=d.nodes(n=>n.tag==='script'&&/^main-[A-Z0-9]+\.js$/.test(n.attrs.src||''))
 need(d.nodes(n=>n.tag==='app-root').length===1&&scripts.length===1,'current native app shell unavailable')
 const main=scripts[0].attrs.src,js=await read(origin+'/'+main),modules=[...js.matchAll(/path:"job",loadChildren:\(\)=>import\("(\.\/chunk-[A-Z0-9]+\.js)"\)/g)]
 need(modules.length===1,'current native job module missing or ambiguous')
 const module=modules[0][1],job=await read(new URL(module,origin+'/'+main).href),profileEntry=Object.entries(profiles).find(([,p])=>p.jobSHA256===sha(job))
 need(profileEntry,'Unverified initial native filter/search body')
 const [profileName,profile]=profileEntry
 need([PEOPLESTRONG_NATIVE_PARTS,'getJobDetails(','jobDescription'].every(s=>job.includes(s)),'current full public detail protocol missing')
 let imports=[...new Set([...job.matchAll(/from\s*"(\.\/chunk-[A-Z0-9]+\.js)"/g)].map(x=>x[1]))]
 const filterVar=job.match(/this\.filterTO=new ([\w$]+)/)?.[1],reviewedImports=profile.directImports
 // This finite deployment also declares a side-effect-only helper. Its full
 // direct graph must match the reviewed original bodies before API reads.
 if(reviewedImports!==undefined){
  need(Array.isArray(reviewedImports)&&reviewedImports.length>0&&reviewedImports.length<=32
   &&reviewedImports.every(entry=>entry&&Object.keys(entry).sort().join(',')==='path,sha256'
    &&typeof entry.path==='string'&&/^\.\/chunk-[A-Z0-9]+\.js$/.test(entry.path)&&/^[a-f0-9]{64}$/.test(entry.sha256)),
  'unreviewed current direct-import profile')
  let program
  try{program=parseProgram(job,{ecmaVersion:'latest',sourceType:'module'})}catch{need(false,'current job import declarations cannot be parsed')}
  imports=program.body.filter(statement=>statement.type==='ImportDeclaration').map(statement=>statement.source.value)
  need(new Set(imports).size===imports.length&&JSON.stringify(imports)===JSON.stringify(reviewedImports.map(entry=>entry.path)),
   'current declared direct-import graph changed')
  for(const file of imports){
   const resolved=new URL(file,origin+'/'+main)
   need(resolved.origin===origin&&resolved.pathname==='/'+file.slice(2)&&!resolved.search&&!resolved.hash
    &&!resolved.username&&!resolved.password,'current direct-import authority changed')
  }
 }
 const filterImports=[...job.matchAll(/import\{([^}]+)\}from"(\.\/chunk-[A-Z0-9]+\.js)"/g)].filter(x=>x[1].split(',').some(n=>n.trim().endsWith(' as '+filterVar)))
 need(filterVar&&filterImports.length===1&&imports.length>0&&imports.length<=32,'unreviewed native filter import')
 let filter=false,service=false
 for(const[index,file]of imports.entries()){
  const body=await read(new URL(file,origin+'/'+main).href),hash=sha(body)
  if(reviewedImports)need(hash===reviewedImports[index].sha256,'unreviewed current direct-import program')
  if(file===filterImports[0][2])filter=hash===profile.filterSHA256&&/^var \w+=class\{isFiltered\(\)\{return [^{}]+\}\};export\{\w+ as a\};?$/.test(body.trim())
  if(body.includes('getjoblist(')){
   need(hash===profile.serviceSHA256,'unreviewed native service protocol')
   const pagination=profile.paginationDeclaration?[profile.paginationDeclaration]:[',ay=45,','var Xx=class{constructor(){this.offset=0,this.limit=ay,this.totalRecords=-1}}']
   service=[...pagination,'/api/cp/rest/altone/cp/','this.makePostReq("jobs/v1?offset=','getJobDetails(','/v2?part=','&isReqId=','job/organizationDetails?jobCode='].every(s=>body.includes(s))
  }
  if(filter&&service&&!reviewedImports)break
 }
 need(filter&&service,'unreviewed native filter or readonly public protocol')
 need(response(await read(base+'urlinfo')).url===new URL(origin).hostname,'native tenant identity mismatch')
 need(Array.isArray(response(await read(base+'layout?isPreview=false'))),'current public layout missing')
 return{main,jobModule:module,profile:profileName,jobSHA256:profile.jobSHA256,filterSHA256:profile.filterSHA256,serviceSHA256:profile.serviceSHA256,initialSearchBody:'{}',emptyInitialFilterVerified:true,websiteProgramExecuted:false,
  ...(reviewedImports?{declaredDirectImports:structuredClone(reviewedImports),directImportGraphQualified:true}:{})}
}

export const createAmaraNativeInventory=(defaults={})=>({async run(provided={}){
 const options={...defaults,...provided};options.signal?.throwIfAborted()
 need(!options.fetchJson||options.fetchPage,'Listing-only injection requires current fetchPage transport');need(!options.fetchText||options.fetchPage,'Legacy transport requires current fetchPage transport')
 const packets=[],read=reader(options,packets),now=new Date(typeof options.now==='function'?await wait(options.now,options.signal):options.now??Date.now()).toISOString(),delegation=await corporate(read),protocol=await client(read)
 const traverse=async()=>{
  const rows=[],pages=[];let total=null
  for(let offset=0;offset<=100035;offset+=45){
   const p=parse(await read(buildPairListUrl(source,offset),{method:'POST',body:'{}'}));need(p.messageCode?.code===200&&Number.isSafeInteger(p.totalRecords)&&p.totalRecords>=0&&p.totalRecords<=100000,'missing native search total')
   need(Array.isArray(p.response)||p.response===null,'missing native response');const a=p.response??[];need(a.length<=45,'native page overflow')
   total??=p.totalRecords;need(total===p.totalRecords,'native total changed');pages.push({offset,rows:a.length});rows.push(...a)
   if(offset>=total){need(a.length===0,'native terminal page not empty');return{rows,pages,total}}
  }need(false,'native pagination did not terminate')
 }
 const initial=await traverse(),roles=[],failures=[],seen=new Set()
 for(const row of initial.rows){
  const id=code(row?.jobCode);if(seen.has(id)){failures.push({postingId:id,reason:'duplicate-native-posting'});continue}seen.add(id)
  const detail=response(await read(buildPairDetailUrl(source,id))),organization=response(await read(buildPairOrganizationUrl(source,id)))
  try{const role=mapPeopleStrongPairRole(source,row,detail,organization,{now,organizationRequestJobCode:id});roles.push({...role,company:role.nativeRoleCompany,sourceCatalogCompany:'Amara Raja Energy & Mobility Ltd'})}catch(error){failures.push({postingId:id,reason:error.message})}
 }
 const closing=await traverse(),closingDelegation=await corporate(read),closingMatches=sha(JSON.stringify(initial.rows))===sha(JSON.stringify(closing.rows))&&initial.total===closing.total,delegationMatches=JSON.stringify(delegation)===JSON.stringify(closingDelegation)
 const nativeInventoryComplete=closingMatches&&delegationMatches&&seen.size===initial.total&&initial.rows.length===seen.size&&roles.length===seen.size&&!failures.length
 const all=roles.filter(j=>j.targetEmployer&&j.country==='India'&&j.sourceDetailComplete&&j.nativeRequisitionStatus==='OPEN'),excluded=roles.filter(j=>!j.targetEmployer),max=options.maxJobs==null||options.maxJobs===Infinity?null:options.maxJobs
 need(max===null||Number.isSafeInteger(max)&&max>=0,'invalid maxJobs')
 // Group inventory completeness cannot certify this exact employer's scope.
 const jobs=closingMatches?(max===null?all:all.slice(0,max)):[],eligibility=analyzePublishableJobs(all,{now:new Date(now)})
 for(const key of ['sourceScopeComplete','sourceListingComplete','lifecycleCleanupAllowed'])Object.defineProperty(jobs,key,{value:false})
 const report={source,status:'partial',surface:careers,protocol,delegation,delegationMatches,reportedNativeTotal:initial.total,nativeGroupReportedTotal:initial.total,derivedTargetRawJobs:null,observedNativeRecords:seen.size,pages:initial.pages,closingPages:closing.pages,closingMatches,nativeInventoryComplete,fullNativeDetails:roles.length,renderedFullDetails:roles.filter(j=>j.sourceDetailComplete).length,targetEmployerCount:roles.filter(j=>j.targetEmployer).length,excludedEmployerCount:excluded.length,excludedEmployers:excluded.map(j=>({postingId:j.jobId,nativeRoleCompany:j.nativeRoleCompany})),unknownCountryCount:roles.filter(j=>j.targetEmployer&&!j.country).length,partialDetailIds:roles.filter(j=>!j.sourceDetailComplete).map(j=>j.jobId),closedIds:roles.filter(j=>j.nativeRequisitionStatus!=='OPEN').map(j=>j.jobId),failures,observedIndiaJobs:all.length,observedEligibleJobs:eligibility.eligibleJobs.length,eligibilityFilterCounts:eligibility.filterCounts,rawJobs:null,indiaJobs:null,eligibleJobs:null,sourceScopeComplete:false,sourceListingComplete:false,cleanupAllowed:false,lifecycleCleanupAllowed:false,verifiedZeroInventory:false,limited:jobs.length!==all.length,checkedAt:now,roles,originalOpening:initial.rows,originalClosing:closing.rows,packets}
 Object.defineProperty(jobs,'sourceAudit',{value:report})
 attachInventoryEvidence(jobs,{status:'coverage-gap',surface:careers,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:packets.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'native group inventory observations; exact-employer coverage remains unqualified'})
 if(options.onReport)await wait(()=>options.onReport(report),options.signal)
 options.signal?.throwIfAborted();return jobs
}})
