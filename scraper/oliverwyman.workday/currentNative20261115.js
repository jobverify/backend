import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'

const {parse}=createRequire(import.meta.url)('acorn')
export const currentOliverSHA=value=>createHash('sha256').update(value).digest('hex')
const norm=value=>String(value??'').normalize('NFC').replace(/\s+/g,' ').trim()
const fail=message=>Object.assign(Error('Oliver Wyman current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw fail(message)},one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const all=node=>[node,...node.children.filter(c=>typeof c!=='string').flatMap(all)]
const tree=d=>one(d.nodes(n=>n.tag==='root'),'native root')
const member=(node,name)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.type==='Identifier'&&node.object.name==='phApp'&&node.property?.type==='Identifier'&&node.property.name===name

// Only exact active assignment object spans are projected from the publication
// context. The full original models are separately checked and retained.
export function currentOliverDocument(html){
 const d=readNativeDocument(html),scripts=d.nodes(n=>n.tag==='script'),replacements=[],apps=[],ddos=[],schemas=[],sessions=[],stateAssignments=[]
 const bannerPrefix='org.apache.sling.scripting.sightly.apps.oliverwymanv2.components.general.v3.careers__002d__banner.template__002e__html$1@'
 if(html.includes(bannerPrefix)){
  const tags=[...html.matchAll(/<sly data-sly-call="org\.apache\.sling\.scripting\.sightly\.apps\.oliverwymanv2\.components\.general\.v3\.careers__002d__banner\.template__002e__html\$1@([a-f0-9]{8})" data-sly-unwrap><\/sly>/g)]
  need(tags.length===2&&tags[0][1]===tags[1][1]&&html.split(bannerPrefix).length===3,'unqualified paired inactive banner references')
  const comments=tags.map(m=>({start:html.lastIndexOf('<!--',m.index),end:html.indexOf('-->',html.lastIndexOf('<!--',m.index))}))
  need(comments[0].start===comments[1].start&&comments.every((c,i)=>c.start>=0&&c.start<tags[i].index&&c.end>tags[i].index&&html.lastIndexOf('-->',tags[i].index)<c.start)&&html.slice(comments[0].start).startsWith('<!--\r\n<div class="component-info" data-sly-test="false">\r\n  <div class="component-info__bar">Banner - Careers</div>'),'banner references no longer belong only to their inactive original comment')
  for(const m of tags){const start=m.index+m[0].indexOf(bannerPrefix)+bannerPrefix.length;replacements.push({start,end:start+8,value:'CURRENT_INACTIVE_BANNER_INSTANCE'})}
 }
 const replace=(body,start,end,label)=>{const offset=html.indexOf(body);need(offset>=0&&html.indexOf(body,offset+body.length)===-1,'ambiguous complete original program span');replacements.push({start:offset+start,end:offset+end,value:label})}
 for(const script of scripts){
  const body=script.raw??'',type=(script.attrs.type??'').toLowerCase()
  if(type==='application/ld+json'){
   schemas.push(parseEightfoldJson(body));replace(body,0,body.length,'CURRENT_COMPLETE_NATIVE_SCHEMA_'+(schemas.length-1));continue
  }
  if(script.attrs.src||!['','text/javascript','application/javascript','module'].includes(type)||!body.includes('phApp'))continue
  let ast
  try{ast=parse(body,{ecmaVersion:'latest',sourceType:type==='module'?'module':'script'})}catch{throw fail('native application program syntax is not qualified')}
  const visit=node=>{
   if(!node||typeof node!=='object')return
   if(node.type==='VariableDeclarator'&&node.id?.name==='phApp'&&node.init?.type==='LogicalExpression'&&node.init.operator==='||'&&node.init.left?.name==='phApp'&&node.init.right?.type==='ObjectExpression')apps.push(parseEightfoldJson(body.slice(node.init.right.start,node.init.right.end)))
   if(node.type==='AssignmentExpression'&&node.operator==='='&&member(node.left,'ddo')){
    need(node.right?.type==='ObjectExpression','unqualified native job model assignment')
    ddos.push(parseEightfoldJson(body.slice(node.right.start,node.right.end)));replace(body,node.right.start,node.right.end,'CURRENT_COMPLETE_NATIVE_DDO')
   }
   if(node.type==='AssignmentExpression'&&node.operator==='='&&member(node.left,'sessionParams')){
    need(node.right?.type==='ObjectExpression','unqualified native session-parameter writer')
    const model=parseEightfoldJson(body.slice(node.right.start,node.right.end)),properties=node.right.properties.filter(p=>p.type==='Property'&&!p.computed&&(p.key.name??p.key.value)==='csrfToken'),property=one(properties,'native session token')
    need(typeof model.csrfToken==='string'&&/^[a-f0-9]{32}$/.test(model.csrfToken)&&property.value.type==='Literal'&&property.value.value===model.csrfToken,'unqualified anonymous session representation')
    sessions.push({token:model.csrfToken,parameters:model});replace(body,node.right.start,node.right.end,'CURRENT_NATIVE_ANONYMOUS_PARAMETERS')
   }
   if(node.type==='ExpressionStatement'&&node.expression?.type==='AssignmentExpression'&&['pxSegmentState','pxPageState'].some(name=>member(node.expression.left,name))){
    const name=node.expression.left.property.name
    need(node.expression.operator==='='&&node.expression.right?.type==='Literal'&&node.expression.right.value==='stranger'&&body.slice(node.start,node.end)===`phApp.${name} = 'stranger';`,'unqualified native anonymous audience state')
    stateAssignments.push(name);replace(body,node.start,node.end,'')
   }
   for(const value of Object.values(node))if(value&&typeof value==='object'){if(Array.isArray(value))value.forEach(visit);else visit(value)}
  }
  visit(ast)
 }
 need(apps.length<=1&&ddos.length<=1,'duplicate active native application or role model')
 if(apps.length){
  const session=one(sessions,'complete native anonymous session writer'),nodes=all(tree(d)),hidden=one(nodes.filter(n=>n.attrs.id==='csrfToken'),'paired native hidden session token')
  const hasStates=Object.hasOwn(session.parameters,'pxSegmentState')||Object.hasOwn(session.parameters,'pxPageState')
  need(hasStates?equal([...stateAssignments].sort(),['pxPageState','pxSegmentState'])&&session.parameters.pxSegmentState==='stranger'&&session.parameters.pxPageState==='stranger':stateAssignments.length===0,'native anonymous audience states no longer bind')
  if(Object.hasOwn(session.parameters,'phProfileId'))need(hasStates&&typeof session.parameters.phProfileId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(session.parameters.phProfileId),'unqualified native anonymous profile representation')
  need(hidden.tag==='div'&&equal(hidden.attrs,{id:'csrfToken',style:'display:none'})&&equal(hidden.children,[session.token]),'anonymous native session/hidden binding changed')
  const suffix="<div id='csrfToken' style='display:none'>"+session.token+'</div>\n'
  need(html.endsWith(suffix)&&html.split(session.token).length===3,'anonymous native session occurrence/context changed')
  const start=html.length-suffix.length+suffix.indexOf(session.token);replacements.push({start,end:start+session.token.length,value:'CURRENT_NATIVE_ANONYMOUS_SESSION'})
 }
 replacements.sort((a,b)=>b.start-a.start)
 let context=html,last=html.length
 for(const r of replacements){need(r.end<=last&&r.start<r.end,'overlapping native model contexts');context=context.slice(0,r.start)+r.value+context.slice(r.end);last=r.start}
 const resources=scripts.filter(n=>n.attrs.src).map(n=>({tag:n.tag,attrs:n.attrs,href:n.attrs.src})).concat(d.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('stylesheet')).map(n=>({tag:n.tag,attrs:n.attrs,href:n.attrs.href})))
 const sessionParameters=sessions[0]?.parameters??null,sessionSemanticParameters=sessionParameters&&Object.fromEntries(Object.entries(sessionParameters).filter(([key])=>!['csrfToken','phProfileId','pxSegmentState','pxPageState'].includes(key)).sort(([a],[b])=>a.localeCompare(b)))
 return{document:d,contextText:context,contextSHA256:currentOliverSHA(context),schemas,app:apps[0]??null,ddo:ddos[0]??null,resources,sessionParameters,sessionSemanticParameters}
}

export function currentOliverPublicationModel(value){
 const result=currentOliverModelWithoutTiming(value)
 if(result.eagerLoadRefineSearch?.data?.jobs){need(Array.isArray(result.eagerLoadRefineSearch.data.jobs),'native publication rows unavailable');result.eagerLoadRefineSearch.data.jobs='COMPLETE_UNSELECTED_NATIVE_ROWS_RETAINED_SEPARATELY'}
 return result
}

export function currentOliverModelWithoutTiming(value){
 const result=structuredClone(value)
 for(const key of ['jobDetail','eagerLoadRefineSearch']){
  const envelope=result?.[key];if(!envelope||typeof envelope!=='object')continue
  if(Object.hasOwn(envelope,'eid')){need(envelope.eid&&typeof envelope.eid==='object'&&!Array.isArray(envelope.eid)&&/^[a-f0-9]{24}$/.test(envelope.eid.eid),'unqualified native trace identity');delete envelope.eid.eid}
  if(Object.hasOwn(envelope,'sourceResponseTime')){need(Number.isSafeInteger(envelope.sourceResponseTime)&&envelope.sourceResponseTime>=0&&envelope.sourceResponseTime<=60000,'unqualified response timing');delete envelope.sourceResponseTime}
 }
 return result
}

const postings=value=>{const found=[],todo=[value];while(todo.length){const n=todo.pop();if(!n||typeof n!=='object')continue;if(n['@type']==='JobPosting')found.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')todo.push(v)}return found}
const textHTML=html=>{const d=readNativeDocument(html);return{d,text:d.text(tree(d)),nodes:all(tree(d))}}
const criterionTags=new Set(['root','div','p','span','b','strong','em','i','u','ul','ol','li','br','a','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','td','th','sup','sub','s','hr'])
const unavailable=/\b(?:(?:this|the)\s+)?(?:role|position|job|vacancy)\s+(?:(?:is|was|has|have)\s+)?(?:(?:already|now|currently)\s+)*(?:been\s+)?(?:closed|filled|withdrawn|expired|cancelled|canceled|no\s+longer\s+(?:available|open))\b|\b(?:hiring|recruitment|applications)\s+(?:has\s+|have\s+|is\s+|are\s+)?(?:been\s+)?(?:closed|ended|suspended)\b/i
export function currentOliverRole(proof,expected){
 const payload=proof.ddo?.jobDetail,job=payload?.data?.job
 need(payload?.status===200&&job&&job.business==='Oliver Wyman'&&job.jobCompanyName==='Oliver Wyman Group','original native role or employer unavailable')
 need(job.jobId===expected.jobId&&job.reqId===expected.jobId&&job.jobSeqNo===expected.jobSeqNo&&norm(job.title)===expected.title,'native original role identity changed')
 need(job.country==='India'&&job.ml_country==='India'&&job.standardisedCountry==='India','full native explicit work-country conflict')
 need(job.postingStatus==='OPEN'&&job.displayCareerSite===true&&job.skipJob===false&&job.reason==='','native publication no longer explicitly active')
 const canonical=one(proof.document.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'current role canonical').attrs.href
 need(canonical===expected.url,'native canonical identity changed')
 const posting=one(proof.schemas.flatMap(postings),'complete own native JobPosting')
 need(posting.identifier?.value===job.jobId&&norm(posting.title)===norm(job.title)&&posting.hiringOrganization?.name==='Oliver Wyman Group','typed original role/employer conflict')
 const places=Array.isArray(posting.jobLocation)?posting.jobLocation:[posting.jobLocation]
 need(places.length>0&&places.every(p=>p?.['@type']==='Place'&&p.address?.addressCountry==='India'&&typeof p.address.addressLocality==='string'&&p.address.addressLocality.trim()),'typed native work-country alternative unavailable')
 need(typeof job.description==='string'&&typeof job.descriptionRange==='string'&&job.description.includes(job.descriptionRange)&&job.descriptionRange.trim(),'whole original authored description and employer conditions required')
 const full=textHTML(job.description),schema=textHTML(decodeNativeEntities(posting.description)),range=textHTML(job.descriptionRange)
 need(full.text.length>=500&&full.text===schema.text&&full.text.includes(range.text),'complete typed/native authored criteria do not reconcile')
 need(full.nodes.every(n=>criterionTags.has(n.tag)&&!n.inert&&!n.nativeTagUnqualified&&!Object.keys(n.attrs).some(k=>/^on/i.test(k)||['hidden','inert','aria-hidden','itemprop','itemscope','itemtype'].includes(k))),'unreviewed native qualification carrier or hiding')
 need(!unavailable.test(full.text),'original criteria contradict current availability')
 const links=full.d.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({text:full.d.text(n),href:n.attrs.href}))
 need(links.every(l=>! /\.(?:pdf|docx?|xlsx?)(?:[?#]|$)|sharepoint\.com|(?:full|complete).{0,20}job\s+description/i.test(l.href+' '+l.text)),'linked complete criteria require their own qualification')
 need(job.applyUrl===expected.applyURL&&typeof job.applyUrl==='string'&&job.applyUrl.startsWith('https://mmc.wd1.myworkdayjobs.com/MMC/job/')&&job.applyUrl.endsWith('/apply')&&job.applyUrl.includes(job.jobId),'native published application identity changed')
 return{job,posting,canonical,criteria:full.text,conditions:range.text,links,originalDescriptionHTML:job.description,originalTypedDescriptionHTML:posting.description}
}

// Read original published models without executing page programs. External
// program/style declarations remain part of the full publication context;
// their downloaded bytes are not authority for this native metadata reader.
export async function runCurrentOliverWyman(options={}){
 const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url),'utf8'))
 need(equal(profile.source,'oliverwyman'),'source profile unavailable')
 options.signal?.throwIfAborted()
 need(!(options.fetchPage||options.fetchText||options.fetchJson)||options.fetchImpl,'original native response metadata required')
 const duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid native source deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native host pacing')
 const clock=typeof options.now==='function'?options.now():new Date(),observedAt=clock instanceof Date?clock.toISOString():clock
 need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid native observation clock')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(fail('native source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const receipts=[],allowed=new Set([profile.corporate]),last=new Map(),byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
 let reads=0,total=0
 const read=async(url,request={method:'GET'})=>{
  signal.throwIfAborted();need(allowed.has(url)&&Object.hasOwn(profile.responseContracts,url)&&++reads<=10,'unbound native publication or request cap')
  need(request.method==='GET'||url===profile.query.url&&equal(request,{method:'POST',body:profile.query.body}),'unqualified native public-read method/body')
  const origin=new URL(url).origin,wait=interval-(performance.now()-(last.get(origin)??-Infinity));if(wait>0)await delay(wait,undefined,{signal});last.set(origin,performance.now())
  let size=0
  const p=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,request,overflowError:fail('native streaming byte bound'),fetchImpl:async(value,init)=>{
   const headers={...init.headers};if(request.method==='POST'){headers['Content-Type']='application/json';delete headers['X-Requested-With']}
   const r=await(options.fetchImpl||globalThis.fetch)(value,{...init,headers,credentials:'omit',cache:'no-store'})
   return{status:r.status,url:r.url,headers:r.headers,body:r.body===null?null:{cancel:reason=>r.body.cancel(reason),getReader(){const reader=r.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'original native response must contain bytes');const n=byteLength.call(part.value);need(n<=4000000-size&&n<=16000000-total,'native streaming byte bound');size+=n;total+=n}return part},
    cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}}
  }})
  const expected=profile.responseContracts[url],bytes=Buffer.from(p.bodyBase64,'base64')
  receipts.push({requestedURL:url,request,...p,bytes:bytes.length,sha256:currentOliverSHA(bytes)})
  need(p.status===expected.status&&p.url===expected.finalURL,'native status/final publication identity changed')
  need(equal(Object.fromEntries(Object.keys(expected.effectiveHeaders).map(name=>[name,p.headers[name]??null])),expected.effectiveHeaders),'native effective MIME/navigation/CSP/Link/disposition context changed')
  try{return new TextDecoder('utf8',{fatal:true}).decode(bytes)}catch{throw fail('original native UTF8 unavailable')}
 }
 const document=async url=>{
  const html=await read(url),proof=currentOliverDocument(html),expected=profile.documents[url]
  need(expected&&proof.contextSHA256===expected.contextSHA256&&equal(proof.app,expected.app)&&equal(proof.schemas,expected.schemas)&&equal(proof.sessionSemanticParameters,expected.sessionSemanticParameters),'whole native original publication/context/schema/session semantics changed')
  need((proof.ddo&&currentOliverSHA(JSON.stringify(currentOliverPublicationModel(proof.ddo))))===expected.publicationModelSHA256,'complete native current employer/country/status/criterion model changed')
  return{html,proof}
 }
 const pass=async()=>{
  const corporate=await document(profile.corporate)
  need(corporate.proof.document.nodes(n=>n.tag==='a'&&n.attrs.href===profile.board&&corporate.proof.document.text(n)==='Apply Now').length>0,'own current branded delegation unavailable')
  allowed.add(profile.board);const board=await document(profile.board)
  need(equal(board.proof.ddo?.eagerLoadRefineSearch?.data?.ui_selections?.business,['Oliver Wyman']),'native requested business selection unavailable')
  need(board.proof.app?.widgetApiEndpoint===profile.query.url&&board.proof.app.refNum==='MAMCGLOBAL','current native public-read account/origin changed')
  allowed.add(profile.query.url);const query=parseEightfoldJson(await read(profile.query.url,{method:'POST',body:profile.query.body})),payload=query.eagerLoadRefineSearch
  need(payload?.status===200&&Number.isSafeInteger(payload.totalHits)&&payload.totalHits>=0&&payload.totalHits<=100000&&Number.isSafeInteger(payload.hits)&&Array.isArray(payload.data?.jobs)&&payload.hits===payload.data.jobs.length&&payload.hits<=10,'native bounded query status/count/model unavailable')
  need(equal(payload.data.ui_selections,{country:['India'],business:['Oliver Wyman']}),'original native explicit country/business scope changed')
  const selected=[]
  for(const expected of profile.roles){
   const row=one(payload.data.jobs.filter(j=>j.jobId===expected.jobId),'current original selected native query row')
   need(equal(row,profile.selectedQueryModels[expected.jobId])&&row.country==='India'&&row.reqId===expected.jobId&&row.jobSeqNo===expected.jobSeqNo&&norm(row.title)===expected.title,'full native query criteria/country/identity changed')
   allowed.add(expected.url);const page=await document(expected.url),role=currentOliverRole(page.proof,expected)
   need(role.criteria.length===expected.fullCriteriaCharacters&&currentOliverSHA(role.criteria)===expected.fullCriteriaSHA256,'full native original criteria missing')
   need(role.job.externalApply===false&&expected.observedOwnApplyURL==='https://careers.marsh.com/global/en/apply?jobSeqNo='+role.job.jobSeqNo&&expected.reviewedBrowserContext?.actualOwnApplyURL===expected.observedOwnApplyURL&&expected.reviewedBrowserContext.fullCriterionSHA256===expected.fullCriteriaSHA256&&expected.reviewedBrowserContext.sourceURL===expected.url&&expected.reviewedBrowserContext.fullCriterionOwnerVisible===true&&expected.reviewedBrowserContext.applicationInteracted===false,'actual original enabled own application binding unavailable')
   for(const value of [role.job.postedDate,role.posting.datePosted]){
    const day=typeof value==='string'&&/^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value)?.[1],stamp=day&&Date.parse(value)
    need(day&&Number.isFinite(stamp)&&new Date(day+'T00:00:00.000Z').toISOString().slice(0,10)===day&&stamp<=Date.parse(observedAt),'native publication calendar is invalid or in the future')
   }
   if(role.posting.validThrough!==undefined)need(typeof role.posting.validThrough==='string'&&Number.isFinite(Date.parse(role.posting.validThrough))&&Date.parse(role.posting.validThrough)>Date.parse(observedAt),'original native publication expired')
   selected.push({...role,originalHTML:page.html,originalFullModel:page.proof.ddo,originalSchemas:page.proof.schemas,sessionParameters:page.proof.sessionParameters,queryRow:row})
  }
  return{corporateHTML:corporate.html,brandedGlobalModel:board.proof.ddo,query,selected}
 }
 try{
  const opening=await pass(),closing=await pass()
  const closingModel=r=>({model:currentOliverModelWithoutTiming(r.originalFullModel),schemas:r.originalSchemas,queryRow:r.queryRow})
  need(equal(opening.selected.map(closingModel),closing.selected.map(closingModel)),'independent whole original native closing changed')
  signal.throwIfAborted()
  const jobs=opening.selected.map((r,index)=>{
   const expected=profile.roles[index],j=r.job,attributes={workHours:j.workHours,workFromHome:j.workFromHome,timeType:j.timeType,jobType:j.jobType,positionWorkerType:j.positionWorkerType,workerTypeCode:j.workerType}
   const description=r.criteria+'\n\nOriginal native role attributes:\n'+Object.entries(attributes).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>k+': '+v).join('\n')+'\n\nOriginal authored links:\n'+r.links.map(l=>l.text+': '+l.href).join('\n')
   return{source:profile.source,company:profile.company,companyDomain:'oliverwyman.com',companyCareerPage:profile.corporate,title:j.title,jobId:j.jobId,requisitionId:j.reqId,sourceNativeIdentifier:j.jobId,sourceNativeIdentity:{kind:'own-native-reqId-and-JobPosting-identifier',reqId:j.reqId,jobSeqNo:j.jobSeqNo},nativeLegalEmployer:j.jobCompanyName,nativeBusiness:j.business,
    sourceUrl:r.canonical,sourceCanonicalRoleURL:r.canonical,link:r.canonical,applyUrl:expected.observedOwnApplyURL,country:'India',city:j.city,location:j.location,employmentType:j.timeType,remoteStatus:j.workFromHome,jobDescription:description,sourceDescription:description,
    postingDate:null,closingDate:null,firstEverPostedAt:null,sourceDateSemanticsUnresolved:true,sourceNativeDateRepresentations:expected.nativeDateRepresentations,sourceNativeFullCriteria:r.criteria,sourceNativeEmployerConditions:r.conditions,sourceNativeAuthoredLinks:r.links,sourceNativeRoleAttributes:attributes,
    sourceNativeRecord:r.originalFullModel,sourceNativeClosingRecord:closing.selected[index].originalFullModel,sourceNativeJobPosting:r.posting,sourceNativeDescriptionHTML:r.originalDescriptionHTML,sourceNativeTypedDescriptionHTML:r.originalTypedDescriptionHTML,sourceNativeQueryRow:r.queryRow,
    sourceNativeCountryProof:{country:j.country,ml_country:j.ml_country,standardisedCountry:j.standardisedCountry,allTypedLocations:r.posting.jobLocation,allOriginalMultiLocation:j.multi_location,allOriginalStandardisedMultiLocation:j.standardised_multi_location},sourceNativePublishedApplication:{originalModelApplyURL:j.applyUrl,observedEnabledOwnApplyURL:expected.observedOwnApplyURL,externalApply:j.externalApply,reviewedBrowserContext:expected.reviewedBrowserContext,operationQualified:false},
    sourceDetailComplete:true,sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,scrapedAt:observedAt}
  })
  const selectedIDs=new Set(jobs.map(j=>j.jobId)),queryRows=opening.query.eagerLoadRefineSearch.data.jobs
  const evidence={source:profile.source,observedAt,recordKind:'vacancy-rows',observedRecordCount:queryRows.length,observedVacancyCount:queryRows.length,nativeRows:queryRows,closingNativeRows:closing.query.eagerLoadRefineSearch.data.jobs,unattributedGlobalBoardRows:opening.brandedGlobalModel.eagerLoadRefineSearch.data.jobs,
   holds:queryRows.filter(r=>!selectedIDs.has(r.jobId)).map(row=>({originalNativeRecord:row,reason:'full-own-native-role-and-original-employer-not-qualified-in-bounded-subset'})),openingModels:opening.selected.map(r=>r.originalFullModel),closingModels:closing.selected.map(r=>r.originalFullModel),originalResponses:receipts,
   independentNativeClosingReconciled:true,completeNativeCriteriaPreserved:true,allOriginalDateRepresentationsRetained:true,metadataAuthorityOnly:true,externalProgramsExecuted:false,externalResourceBytesUsedAsRoleData:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedZero:false,renderedApplicationQualified:false,applicationSubmitted:false}
  attachSourceObservationEvidence(jobs,{source:profile.source,recordKind:'vacancy-rows',observedRecordCount:queryRows.length,observedVacancyCount:queryRows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.board,firstParty:true,listingComplete:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'own current Oliver Wyman delegation+typed original India/employer/full native criteria+independent native closing;bounded subset;company totals/zero/rendered application unqualified;cleanup forbidden'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))Object.assign(error,{softFailure:true,abortRetries:true,failureKind:error.failureKind||'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceAudit:{source:profile.source,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
  throw error
 }finally{clearTimeout(timer)}
}
