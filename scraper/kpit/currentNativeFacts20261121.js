import {isDeepStrictEqual} from 'node:util'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CAREERS_URL='https://www.kpit.com/careers-overview/'
export const LISTING_URL='https://www.kpit.com/job-listing/?country=India&location=&exp=&show_all=1'
const NATIVE='https://talentojo.kpit.com',ENTRY=NATIVE+'/tojo/app/job-apply/'
const COMMON=NATIVE+'/tojo/app/js/common.js?ver=1.0.3'
const CONSTANTS=NATIVE+'/tojo/app/js/constants.js',CONTROLLER=ENTRY+'outside_job_apply_controller.js?v=1.0.2'
const fail=message=>firstPartyFailure('kpit',message,{failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const one=(rows,label)=>{need(rows.length===1,'Missing/ambiguous '+label);return rows[0]}
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim()
const walk=n=>!n||typeof n!=='object'?[]:[n,...Object.values(n).flatMap(v=>Array.isArray(v)?v.flatMap(walk):walk(v))]
const member=(n,o,p)=>n?.type==='MemberExpression'&&!n.computed&&n.object?.name===o&&n.property?.name===p
const literal=(n,v)=>n?.type==='Literal'&&n.value===v
const own=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))
const sha=v=>createHash('sha256').update(v).digest('hex')
const root=d=>one(d.nodes(n=>n.tag==='root'),'HTML root')
const all=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(all)]
const authored=n=>typeof n==='string'?decodeNativeEntities(n):n.children.map(authored).join(' ')
const closed=/\b(?:(?:job|role|position|vacancy|opening)\s+(?:(?:is|was|has|have)\s+)?(?:(?:now|currently|already|temporarily)\s+)*(?:been\s+)?(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|no\s+longer\s+(?:open|available|active))|(?:applications|recruitment|hiring)\s+(?:for\s+(?:(?:this|the)\s+)?(?:job|role|position)\s+)?(?:(?:are|is|has|have)\s+)?(?:(?:now|currently|already)\s+)*(?:been\s+)?(?:closed|ended|stopped|suspended)|(?:no\s+longer|not\s+currently)\s+accepting\s+(?:new\s+)?applications)\b/i
const fields={job_role:'Role',type:'Employment type',min_experience:'Minimum experience (years)',max_experience:'Maximum experience (years)',qualification:'Qualification',qualification_specialization:'Specialization',certification:'Certification',required_skills:'Essential skills',additional_skills:'Additional skills',services_deliverables:'Services and deliverables',comments:'Additional conditions',shift_timing:'Shift',travel_required:'Travel required',expected_joining_date:'Expected joining date (as published)',no_of_positions:'Openings',campus_degree:'Campus degree',campus_stream:'Campus stream',min_salary:'Minimum salary (as published)',max_salary:'Maximum salary (as published)'}
const jobKeys=['id','organization_id','code','title','display_title','job_role','min_experience','max_experience','no_of_positions','country','state','location','type','type_id','pa_id','shift_timing','required_skills','additional_skills','description','services_deliverables','comments','qualification','qualification_specialization','certification','min_salary','max_salary','travel_required','expected_joining_date','status','created_at','updated_at','created_by','recruiter_contact','recruiter_email','recruiter_name','template','template_image','template_image_url','resume_upload_limit_exhausted','irrelevant_rejections_limit_exceeded','has_offered_candidates','is_from_uk_eu','campus_degree','campus_stream']
const tags=new Set(['root','p','div','span','strong','b','em','i','u','ul','ol','li','br','h1','h2','h3','h4','h5','h6','table','tbody','thead','tr','th','td','a','pre','code','blockquote','font','sup','sub','s','hr'])
const textValue=v=>Array.isArray(v)?v.join(', '):String(v??'')

export function readCorporate(body){
 const d=readNativeDocument(body),head=activeHead(body)
 need(!d.nodes(n=>n.tag==='base').length&&head.titles.length===1&&head.titles[0]==='Careers at KPIT - Automotive Industry Domain careers','Own career identity/base changed')
 need(d.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:site_name'&&n.attrs.content==='KPIT').length===1,'Own corporate employer identity changed')
 need(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===CAREERS_URL).length===1,'Own career canonical changed')
 const links=d.nodes(n=>n.tag==='a'&&n.attrs.href==='https://www.kpit.com/job-listing/'&&/^(?:Open Positions|View all jobs)$/.test(d.text(n)))
 need(links.length>0,'Active own native listing handoff unavailable')
 const corporateRecruitmentPageText=d.text(root(d));need(!closed.test(corporateRecruitmentPageText),'Own corporate applications are closed; availability unqualified')
 return {title:head.titles[0],canonical:CAREERS_URL,employer:'KPIT',corporateRecruitmentPageText,listingHandoffs:links.map(n=>({href:n.attrs.href,text:d.text(n)}))}
}
export function readCards(body){
 const d=readNativeDocument(body),head=activeHead(body)
 need(!d.nodes(n=>n.tag==='base').length&&head.titles.length===1&&head.titles[0]==='Job Listing - KPIT','Own listing identity/base changed')
 need(!closed.test(d.text(root(d))),'Own listing marks a position/applications closed; availability unqualified')
 const select=one(d.nodes(n=>n.tag==='select'&&n.attrs.name==='country'&&n.attrs.id==='country-select'),'native country selector')
 const selected=one(d.nodes(n=>n.tag==='option'&&Object.hasOwn(n.attrs,'selected'),select),'selected native country')
 need(selected.attrs.value==='India'&&d.text(selected)==='India','Native selected country changed')
 const filter=one(d.nodes(n=>n.tag==='form'&&n.attrs.id==='filter-form'),'native public filter')
 need((filter.attrs.method??'').toUpperCase()==='GET'&&(!filter.attrs.action||new URL(filter.attrs.action,LISTING_URL).href==='https://www.kpit.com/job-listing/'),'Native public filter method/action changed')
 const nodes=d.nodes(n=>d.hasClass(n,'search_job_box'));need(nodes.length>0&&nodes.length<=40,'Native membership empty/exceeds bounded scope')
 const seen=new Set()
 return nodes.map(node=>{
  const link=one(d.nodes(n=>n.tag==='a'&&d.hasClass(n,'job-apply'),node),'native Apply declaration')
  const m=link.attrs.href?.match(/^https:\/\/talentojo\.kpit\.com\/tojo\/app\/job-apply\/#\/Career%20Portal\/([1-9]\d{3,8})$/)
  need(m&&d.text(link)==='Apply'&&!seen.has(m[1]),'Native application account/route/duplicate identity changed');seen.add(m[1])
  const title=d.text(one(d.nodes(n=>n.tag==='h3',node),'native role title'));need(norm(title),'Empty native role title')
  need(!closed.test(d.text(node)),'Own native listing role is closed; availability unqualified')
  return {nativeID:m[1],title,url:link.attrs.href,text:d.text(node),originalNativeCard:structuredClone(node)}
 })
}
export function readNativeEntry(body){
 const d=readNativeDocument(body),head=activeHead(body)
 need(!d.nodes(n=>n.tag==='base').length&&head.titles.length===1&&head.titles[0]==='Be a Automobeliever at KPIT','Native own account title/base changed')
 const boot=one(d.nodes(n=>Object.hasOwn(n.attrs,'ng-app')||Object.hasOwn(n.attrs,'data-ng-app')),'active native Angular bootstrap');need(boot.attrs['ng-app']==='TOJO'&&!Object.hasOwn(boot.attrs,'data-ng-app'),'Native entry bootstrap module changed')
 const owner=one(d.nodes(n=>n.attrs['ng-controller']==='OutsideJobApplyController',boot),'active native controller owner');need(d.nodes(n=>Object.hasOwn(n.attrs,'ng-view'),owner).length===1,'Native controller route view changed')
 const scripts=d.nodes(n=>n.tag==='script'&&n.attrs.src&&['','text/javascript','application/javascript'].includes(n.attrs.type??'')).map(n=>new URL(n.attrs.src,ENTRY).href)
 need(scripts.filter(u=>u===COMMON).length===1&&scripts.indexOf(CONSTANTS)<scripts.indexOf(COMMON)&&scripts.indexOf(COMMON)<scripts.indexOf(CONTROLLER),'Native bootstrap declarations/order changed')
 need(scripts.filter(u=>u===CONSTANTS).length===1&&scripts.filter(u=>u===CONTROLLER).length===1,'Active native constants/controller declarations changed')
 need(!scripts.some(u=>/\/(?:constants|outside_job_apply_controller)\.js(?:[?#]|$)/.test(u)&&u!==CONSTANTS&&u!==CONTROLLER),'Conflicting native configuration/controller declaration')
 return {entryURL:ENTRY,title:head.titles[0],moduleName:'TOJO',controllerName:'OutsideJobApplyController',bootstrapProgramURL:COMMON,constantsURL:CONSTANTS,controllerURL:CONTROLLER,allDeclaredScripts:scripts,executed:false,renderedApplicationQualified:false}
}
export function readProtocol(constants,controller,entry,common){
 let configAST,controllerAST,commonAST
 try{configAST=parse(constants,{ecmaVersion:'latest'});controllerAST=parse(controller,{ecmaVersion:'latest'});commonAST=parse(common,{ecmaVersion:'latest'})}catch{throw fail('Unparseable published native service/bootstrap/consumer')}
 need(entry?.moduleName==='TOJO'&&entry?.controllerName==='OutsideJobApplyController'&&entry?.bootstrapProgramURL===COMMON,'Native entry/module/controller binding changed')
 const topDeclarations=ast=>ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations)
 const topCalls=ast=>ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression?.type==='CallExpression').map(n=>n.expression)
 const scoped=n=>!n||typeof n!=='object'||['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)?[]:[n,...Object.values(n).flatMap(v=>Array.isArray(v)?v.flatMap(scoped):scoped(v))]
 const config=walk(configAST),program=walk(controllerAST)
 const containsBase=pattern=>walk(pattern).some(n=>n.type==='Identifier'&&n.name==='service_base_url')
 const globalBase=n=>n?.type==='MemberExpression'&&['window','globalThis'].includes(n.object?.name)&&(n.computed?literal(n.property,'service_base_url'):n.property?.name==='service_base_url')
 const writesBase=n=>n.type==='VariableDeclarator'&&containsBase(n.id)||['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)&&n.params.some(containsBase)||n.type==='CatchClause'&&containsBase(n.param)||n.type==='AssignmentExpression'&&(containsBase(n.left)||globalBase(n.left))||n.type==='UpdateExpression'&&(containsBase(n.argument)||globalBase(n.argument))
 need(![...program,...walk(commonAST)].some(writesBase),'Consumed native service base is shadowed or reassigned by bootstrap/controller')
 const binding=one(topDeclarations(configAST).filter(n=>n.id?.name==='service_base_url'),'top-level native service base')
 need(literal(binding.init,NATIVE+'/service/')&&config.filter(n=>n.type==='VariableDeclarator'&&n.id?.name==='service_base_url').length===1&&!config.some(n=>n.type==='AssignmentExpression'&&n.left?.name==='service_base_url'),'Native service base binding changed')
 const bootstrap=one(topDeclarations(commonAST).filter(n=>n.id?.name==='app'),'top-level native Angular bootstrap')
 need(bootstrap.init?.type==='CallExpression'&&member(bootstrap.init.callee,'angular','module')&&bootstrap.init.arguments.length===2&&literal(bootstrap.init.arguments[0],entry.moduleName),'Native module creation does not bind active entry')
 const dependencies=bootstrap.init.arguments[1]
 need(dependencies?.type==='ArrayExpression'&&dependencies.elements.length>0&&dependencies.elements.length<20&&dependencies.elements.every(n=>n?.type==='Literal'&&typeof n.value==='string')&&dependencies.elements.some(n=>n.value==='ngRoute'),'Native public route module dependencies changed')
 const app=one(topDeclarations(controllerAST).filter(n=>n.id?.name==='app'),'top-level native controller module')
 need(app.init?.type==='CallExpression'&&member(app.init.callee,'angular','module')&&app.init.arguments.length===1&&literal(app.init.arguments[0],entry.moduleName)&&!program.some(n=>n.type==='AssignmentExpression'&&n.left?.name==='app'),'Native controller module binding changed')
 const configuration=one(topCalls(controllerAST).filter(n=>member(n.callee,'app','config')),'top-level native route configuration')
 const routeFunction=configuration.arguments[0]
 need(configuration.arguments.length===1&&routeFunction?.type==='FunctionExpression'&&routeFunction.params.length===2&&routeFunction.params[0].name==='$routeProvider'&&routeFunction.params[1].name==='$locationProvider','Native public route provider injection changed')
 const route=one(scoped(routeFunction.body).filter(n=>n.type==='CallExpression'&&member(n.callee,'$routeProvider','when')&&literal(n.arguments[0],'/:job_title/:job_id/:extra_id?')),'consumed native role route')
 need(route.arguments.length===2&&route.arguments[1]?.type==='ObjectExpression','Native role route options changed')
 const properties=route.arguments[1].properties
 need(properties.length===2&&properties.every(n=>n.type==='Property'&&!n.computed&&n.kind==='init')&&properties.some(n=>n.key.name==='controller'&&literal(n.value,entry.controllerName))&&properties.some(n=>n.key.name==='templateUrl'&&literal(n.value,'job_detail.html')),'Native route controller/template binding changed')
 const registration=one(topCalls(controllerAST).filter(n=>member(n.callee,'app','controller')&&literal(n.arguments[0],entry.controllerName)),'top-level consumed native controller registration')
 need(registration.arguments.length===2&&registration.arguments[1]?.type==='ArrayExpression','Native controller injection declaration changed')
 const injection=registration.arguments[1].elements,fn=injection.at(-1),names=injection.slice(0,-1)
 need(fn?.type==='FunctionExpression'&&!fn.async&&!fn.generator&&fn.params.length===names.length&&names.every((n,i)=>n?.type==='Literal'&&typeof n.value==='string'&&fn.params[i].type==='Identifier'&&fn.params[i].name===n.value)&&names.some(n=>n.value==='$http')&&names.some(n=>n.value==='$routeParams'),'Native actual dependency-injection/parameter binding changed')
 const body=scoped(fn.body),id=one(fn.body.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).filter(n=>n.id?.name==='job_id'),'consumed native route role identifier')
 need(member(id.init,'$routeParams','job_id')&&!body.some(n=>n.type==='AssignmentExpression'&&n.left?.name==='job_id'),'Native route identifier consumer changed')
 const calls=body.filter(n=>n.type==='CallExpression'&&member(n.callee,'$http','get')&&n.arguments.length===1&&n.arguments[0]?.type==='BinaryExpression'&&n.arguments[0].operator==='+'&&n.arguments[0].right?.name==='job_id'&&n.arguments[0].left?.type==='BinaryExpression'&&n.arguments[0].left.operator==='+'&&n.arguments[0].left.left?.name==='service_base_url'&&literal(n.arguments[0].left.right,'jobs/'))
 const get=one(calls,'consumed published read-only native role GET')
 const success=one(body.filter(n=>n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&!n.callee.computed&&n.callee.property?.name==='success'&&n.callee.object===get),'consumed native role response callback')
 need(success.arguments.length===1&&success.arguments[0].type==='FunctionExpression'&&success.arguments[0].params.length===1&&success.arguments[0].params[0].name==='data','Native role response callback changed')
 const consumer=scoped(success.arguments[0].body)
 for(const field of ['organization','job'])need(consumer.some(n=>n.type==='AssignmentExpression'&&n.operator==='='&&member(n.left,'$scope',field)&&member(n.right,'data',field)),'Native full employer/job response assignment changed')
 return {serviceBaseURL:binding.init.value,rolePathPrefix:'jobs/',method:'GET',jobIdentifier:'$routeParams.job_id',responseFields:['organization','job'],moduleName:entry.moduleName,controllerName:entry.controllerName,bootstrapProgramURL:COMMON,moduleDependencies:dependencies.elements.map(n=>n.value),injectedServices:names.map(n=>n.value),declaredTemplateURL:ENTRY+'job_detail.html',wholeConstantsSHA256:sha(constants),wholeControllerSHA256:sha(controller),wholeBootstrapProgramSHA256:sha(common),executed:false,applicationOperationQualified:false}
}
export function readRole(body,card){
 let p;try{p=parseEightfoldJson(body)}catch{throw fail('Malformed/duplicate-key full native role JSON')}
 need(own(p,['job','organization','linked_recruiters'])&&own(p.job,jobKeys)&&own(p.organization,['id','name','url','logo_url']),'Unreviewed native full role/employer schema')
 const j=p.job,o=p.organization
 need(o.id===133&&o.name==='KPIT'&&o.url==='https://www.kpit.com'&&j.organization_id==='133','Native full employer/account conflict')
 need(j.id===card.nativeID&&typeof j.code==='string'&&norm(j.code)&&typeof j.title==='string'&&norm(j.display_title||j.title)===card.title,'Native original card/role identity conflict')
 need(j.country==='India'&&Array.isArray(j.location)&&j.location.length>0&&j.location.every(v=>typeof v==='string'&&norm(v)),'Native explicit workplace country/locations unqualified')
 need(j.status==='Published'&&j.resume_upload_limit_exhausted===false&&j.irrelevant_rejections_limit_exceeded===false&&j.has_offered_candidates===false&&j.template===''&&j.template_image==='','Native current publication/application availability changed')
 for(const k of jobKeys.filter(k=>k!=='expected_joining_date'))need(Object.hasOwn(j,k),'Native role field missing: '+k)
 const arrays=['location','job_role','qualification','qualification_specialization'],numbers=['min_experience','max_experience','no_of_positions'],booleans=['resume_upload_limit_exhausted','irrelevant_rejections_limit_exceeded','has_offered_candidates','is_from_uk_eu']
 for(const [k,v]of Object.entries(j)){if(arrays.includes(k))need(Array.isArray(v)&&v.every(x=>typeof x==='string'),'Native criteria array changed');else if(numbers.includes(k))need(Number.isFinite(v)&&v>=0,'Native criteria number changed');else if(booleans.includes(k))need(typeof v==='boolean','Native availability field changed');else need(v===null||typeof v==='string','Native full criterion field type changed')}
 need(typeof j.description==='string','Missing native authored criteria')
 const d=readNativeDocument(j.description),r=root(d),nodes=all(r),criteria=d.text(r)
 need(nodes.every(n=>tags.has(n.tag)&&!n.inert&&!n.nativeTagUnqualified&&!Object.keys(n.attrs).some(k=>/^on/i.test(k)||['itemprop','itemscope','itemtype','hidden','inert','aria-hidden'].includes(k))&&!/(?:display\s*:\s*none|visibility\s*:|opacity\s*:\s*0(?:[;\s]|$)|font-size\s*:\s*0(?:[a-z%;\s]|$)|content\s*:|url\s*\(|expression\s*\()/i.test(n.attrs.style??'')),'Unreviewed authored criteria carrier/hiding')
 need(criteria.length>=200&&norm(authored(r))===criteria&&!closed.test(criteria),'Missing/hidden/closed full native criteria')
 const criterionFields=Object.fromEntries(Object.keys(fields).map(k=>[k,j[k]??null]))
 need(!closed.test(Object.values(criterionFields).map(textValue).join(' ')),'Native criteria contradict current availability')
 const links=nodes.filter(n=>n.tag==='a').map(n=>({text:d.text(n),attrs:n.attrs}))
 const holds=links.length?['linked-full-job-description-or-alternative-application-unqualified']:[]
 const explicitWorkplaceCountries=j.location.map(nativeLocationCountryName).filter(Boolean);if(explicitWorkplaceCountries.some(country=>country!==j.country))holds.push('native-country-location-conflict')
 const description=[card.title,j.location.join(', ')+', '+j.country,'Published listing: '+card.text,...Object.keys(fields).filter(k=>j[k]!=null&&textValue(j[k])).map(k=>fields[k]+': '+textValue(j[k])),criteria].join('\n\n')
 return {card,wholeNativeRecord:p,criteria,criterionFields,description,authoredRoleLinks:links,holds,sourceRoleQualified:holds.length===0}
}
export async function run(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'Original current HTTP metadata via fetchImpl required')
 const reader=createCurrentNativeReader(options,{source:'kpit',admitted:[[CAREERS_URL,'html'],[LISTING_URL,'html'],[ENTRY,'html'],[CONSTANTS,'javascript'],[CONTROLLER,'javascript'],[COMMON,'javascript']],learnedURL:(url,kind)=>kind==='json'&&/^https:\/\/talentojo\.kpit\.com\/service\/jobs\/[1-9]\d{3,8}$/.test(url)})
 const rawPublisherResponses=[]
 let opening,closing,reconciled=false
 const audit=()=>({source:'kpit',recordKind:'vacancy-rows',observedVacancyCount:opening?.cards?.length??0,observedRecordCount:opening?.cards?.length??0,nativeOpening:opening,nativeClosing:closing,rawPublisherResponses,heldRows:opening?.roles?.filter(r=>!r.sourceRoleQualified)??[],wholeNativeRoleModelsClosingReconciled:reconciled,originalResponses:reader.stats().receipts,requests:reader.stats().requests,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,activeApplyVerified:false,publicNativeApplicationShellReads:reader.stats().receipts.filter(r=>r.requestedUrl===ENTRY).length,applicationInteractions:0,applicationSubmissions:0,renderedApplicationQualified:false,configuredLegacyAlias:'https://www.kpit.com/careers',currentOwnCanonicalRead:CAREERS_URL,holds:['whole-company-inventory-and-rendered-application-operation-unknown']})
 const phase=async(target,phaseName)=>{
  const retainRead=async url=>{const response=await reader.read(url);rawPublisherResponses.push({phase:phaseName,url,status:response.status,body:response.body,originalBodySHA256:response.sha256});return response}
  const career=await retainRead(CAREERS_URL);target.corporate=readCorporate(career.body)
  const listing=await retainRead(LISTING_URL);target.cards=readCards(listing.body)
  const entry=await retainRead(ENTRY);target.entry=readNativeEntry(entry.body)
  const constants=await retainRead(CONSTANTS),common=await retainRead(COMMON),controller=await retainRead(CONTROLLER);target.protocol=readProtocol(constants.body,controller.body,target.entry,common.body)
  target.roles=[]
  for(const card of target.cards){const url=target.protocol.serviceBaseURL+target.protocol.rolePathPrefix+card.nativeID;reader.allow(url,'json');const response=await retainRead(url);target.roles.push(readRole(response.body,card))}
 }
 try{
  opening={};await phase(opening,'opening');closing={};await phase(closing,'closing')
  need(isDeepStrictEqual(opening,closing),'Full native corporate/role/employer/country/criteria/application closing models changed');reconciled=true
  const jobs=opening.roles.filter(r=>r.sourceRoleQualified).map(r=>({source:'kpit',company:'KPIT',title:r.card.title,jobId:r.card.nativeID,sourceNativeIdentifier:r.card.nativeID,requisitionId:null,sourceNativeCodeRaw:r.wholeNativeRecord.job.code,country:'India',location:r.wholeNativeRecord.job.location.join(', ')+', India',locations:r.wholeNativeRecord.job.location.map(city=>({city,country:'India'})),sourceUrl:r.card.url,link:r.card.url,applyUrl:r.card.url,jobDescription:r.description,sourceDescription:r.description,sourceNativeRecord:r.wholeNativeRecord,sourceNativeCard:r.card,sourceNativeCriterionFields:r.criterionFields,postingDate:null,closingDate:null,sourceNativeCreatedAtRaw:r.wholeNativeRecord.job.created_at,sourceNativeUpdatedAtRaw:r.wholeNativeRecord.job.updated_at,sourceNativeExpectedJoiningDateRaw:r.wholeNativeRecord.job.expected_joining_date??null,sourceDateSemanticsUnresolved:true,activeApplyVerified:false,applicationVisited:false,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}))
  const evidence=audit();need(Buffer.byteLength(JSON.stringify(evidence))<=24*1024*1024,'Native evidence byte budget exceeded')
  attachSourceObservationEvidence(jobs,{source:'kpit',recordKind:'vacancy-rows',observedVacancyCount:opening.cards.length,observedRecordCount:opening.cards.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LISTING_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-career-and-explicit-India-cards;declared-native-service-consumer;full-criteria-and-paired-models;linked-criteria-held;company-scope-and-application-operation-unknown'})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true});Object.defineProperty(jobs,'recruitmentObservations',{value:evidence,configurable:true});reader.check();options.signal?.throwIfAborted();return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:audit(),configurable:true})}catch{};options.signal?.throwIfAborted();throw error}
 finally{reader.close();options.signal?.throwIfAborted()}
}
