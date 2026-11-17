import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const HOMEPAGE_URL='https://www.peerrobotics.ai/'
export const COMPANY_URL=HOMEPAGE_URL+'company'
export const CAREERS_URL='https://careers.peerrobotics.ai/'
const SOURCE='peerrobotics',EMPLOYER_ID=HOMEPAGE_URL+'#organization'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const one=(rows,label)=>{need(rows.length===1,'Expected one current native '+label);return rows[0]}
const sha=value=>createHash('sha256').update(value).digest('hex')
const programs=doc=>doc.nodes(n=>n.tag==='script').map(n=>({attributes:structuredClone(n.attrs),body:n.raw??'',bodySHA256:sha(n.raw??'')}))
function structured(doc){return doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value)}
function corporate(html,title,canonical){
 const doc=readNativeDocument(html),head=activeHead(html),root=one(doc.nodes(n=>n.tag==='html'),'corporate root')
 need(isDeepStrictEqual(head.titles,[title])&&root.attrs['data-wf-domain']==='www.peerrobotics.ai'&&!doc.nodes(n=>n.tag==='base').length,'Current corporate employer title/domain/base changed')
 need(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'corporate canonical').attrs.href===canonical,'Current corporate employer canonical changed')
 return {doc,head,structuredData:structured(doc),rootAttributes:structuredClone(root.attrs)}
}
export function readCurrentPeerEmployer(homeHTML,companyHTML){
 const home=corporate(homeHTML,'Warehouse Pallet Automation with Physical AI | Peer Robotics',HOMEPAGE_URL.slice(0,-1)),company=corporate(companyHTML,'About Peer Robotics | Intelligent Robots for Industrial Operations',COMPANY_URL)
 const employers=home.structuredData.flatMap(v=>v?.['@graph']??[v]).filter(v=>v?.['@type']==='Organization')
 need(employers.length===1&&employers[0].name==='Peer Robotics'&&employers[0]['@id']===EMPLOYER_ID&&employers[0].url===HOMEPAGE_URL,'Current own structured employer authority changed')
 const about=company.structuredData.flatMap(v=>v?.['@graph']??[v]).filter(v=>v?.['@type']==='AboutPage')
 need(about.length===1&&about[0].url===COMPANY_URL&&about[0].about?.['@id']===EMPLOYER_ID,'Current company page no longer binds the same employer')
 const companyLinks=home.doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/company'&&home.doc.text(n)==='Company')
 need(companyLinks.length>0,'Current own company navigation declaration changed')
 const section=one(company.doc.nodes(n=>n.tag==='section'&&company.doc.hasClass(n,'section-hire')),'hiring section'),handoff=one(company.doc.nodes(n=>n.tag==='a',section),'hiring handoff')
 need(handoff.attrs.href===CAREERS_URL&&company.doc.text(handoff)==='View roles','Current own active careers handoff changed')
 return {employerName:'Peer Robotics',employerID:EMPLOYER_ID,homepage:HOMEPAGE_URL,companyPage:COMPANY_URL,careersPage:CAREERS_URL,
  homeStructuredData:home.structuredData,companyStructuredData:company.structuredData,homeRootAttributes:home.rootAttributes,companyRootAttributes:company.rootAttributes,
  companyNavigation:companyLinks.map(n=>structuredClone(n)),wholeNativeHiringSection:structuredClone(section),nativeHiringText:company.doc.text(section),nativeHandoff:structuredClone(handoff)}
}
export function readCurrentPeerNotion(html){
 const doc=readNativeDocument(html),head=activeHead(html),root=one(doc.nodes(n=>n.tag==='html'),'Notion document')
 need(isDeepStrictEqual(head.titles,['Notion'])&&doc.hasClass(root,'notion-html')&&root.attrs['data-notion-html']==='web'&&!doc.nodes(n=>n.tag==='base').length,'Current own careers Notion shell identity/base changed')
 const declarations=programs(doc),events=[],boot=[]
 for(const script of declarations.filter(p=>!p.attributes.src&&p.body&&(!p.attributes.type||/^(?:text|application)\/(?:java|ecma)script$/.test(p.attributes.type)))){
  const ast=parse(script.body,{ecmaVersion:'latest'})
  const literal=node=>node.type==='UnaryExpression'&&node.operator==='!'&&node.argument.type==='Literal'&&[0,1].includes(node.argument.value)?!node.argument.value:readLiteralModel(script.body.slice(node.start,node.end)).value
  for(const statement of ast.body){
   const expressions=statement.type==='ExpressionStatement'?(statement.expression.type==='SequenceExpression'?statement.expression.expressions:[statement.expression]):[]
   for(const expression of expressions){
    if(expression.type==='AssignmentExpression'&&expression.operator==='='&&expression.left.type==='MemberExpression'&&!expression.left.computed&&expression.left.object.name==='window'&&expression.left.property.name==='__notion_boot_data')boot.push(readLiteralModel(script.body.slice(expression.right.start,expression.right.end)).value)
    if(expression.type==='CallExpression'&&expression.callee.type==='MemberExpression'&&!expression.callee.computed&&expression.callee.object.name==='__notion_html_async'&&expression.callee.property.name==='push'){
     need(expression.arguments.length===2,'Unreviewed native Notion async declaration')
     events.push(expression.arguments.map(literal))
    }
   }
  }
 }
 need(boot.length===1&&boot[0]===null,'Notion now exposes an unreviewed boot model; native inventory remains unknown')
 const redirect=one(events.filter(([name])=>name==='requiredRedirectMetadata'),'Notion page binding')[1],bootEvent=one(events.filter(([name])=>name==='bootData'),'Notion boot event')[1]
 need(bootEvent===null&&redirect&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(redirect.pageId)&&redirect.requiresRedirect===false,'Current declared Notion public page binding/boot event changed')
 const assets=declarations.filter(p=>p.attributes.src).map(p=>p.attributes.src)
 need(assets.length>0&&assets.every(src=>/^\/_assets\/[a-zA-Z0-9_-]+\.js$/.test(src)),'Current declared Notion client asset authority changed')
 return {title:head.titles[0],rootAttributes:structuredClone(root.attrs),bootData:boot[0],requiredRedirectMetadata:redirect,nativeAsyncDeclarations:events,
  programDeclarations:declarations,wholeNativeShell:structuredClone(root),rawHTML:html,bootRecordMapUnavailable:true,pageIDIsVacancyID:false,
  nativeInventoryQualified:false,publicDataRequestQualified:false,publicRoleCountryQualified:false,publicFullCriteriaQualified:false,publicApplicationEligibilityQualified:false}
}
export async function runCurrentPeer(options={}){
 options.signal?.throwIfAborted()
 need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; an unknown inventory cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[COMPANY_URL,'html'],[CAREERS_URL,'html']]});let opening,closing
 async function authority(){
  const home=await reader.read(HOMEPAGE_URL),company=await reader.read(COMPANY_URL),employer=readCurrentPeerEmployer(home.body,company.body),careers=await reader.read(CAREERS_URL),notion=readCurrentPeerNotion(careers.body)
  return {employer,notion,wholeOriginalHomeHTML:home.body,wholeOriginalCompanyHTML:company.body}
 }
 try{
  opening=await authority();closing=await authority()
  need(isDeepStrictEqual(opening.employer,closing.employer)&&isDeepStrictEqual(opening.notion,closing.notion),'Closing full native employer/handoff/Notion bootstrap changed')
  reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:[{recordKind:'hiring-signal',nativeHandoff:opening.employer.nativeHandoff,nativeHiringText:opening.employer.nativeHiringText,
   nativeCareerPageID:opening.notion.requiredRedirectMetadata.pageId,pageIDIsVacancyID:false,country:null,jobId:null,criteria:null,applyUrl:null,
   holdReasons:['own-notion-response-has-null-boot-data-no-native-role-model','public-native-data-request-not-qualified','native-role-identity-country-full-criteria-and-application-unqualified','company-inventory-unknown']}],
   wholeObservedNativeHandoffAndBootstrapClosingReconciled:true,entireCorporateDocumentClosingReconciled:false,nativeInventoryQualified:false,
   companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,sourceScopeComplete:false,activeApplyVerified:false,applicationInteractions:0,
   legacyWellfoundFallbackUsed:false,legacyCityCountryInferenceUsed:false,nativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts}
  need(Buffer.byteLength(JSON.stringify(audit))<=4*1024*1024,'Native handoff observation output byte ceiling exceeded')
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-employer-careers-handoff-and-null-Notion-bootstrap-reconciled;native-vacancy-data-country-criteria-application-and-company-inventory-unknown'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}
 finally{reader.close()}
}
