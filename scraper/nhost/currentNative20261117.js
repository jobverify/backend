import {parse} from 'acorn'
import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='nhost',COMPANY='Nhost',HOMEPAGE_URL='https://nhost.io/',CAREERS_URL=HOMEPAGE_URL+'careers'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]}
const jobType=v=>Array.isArray(v)?v.some(jobType):typeof v==='string'&&/(?:^|[/#:])JobPosting$/i.test(v),hasJob=v=>!!v&&typeof v==='object'&&(jobType(v['@type'])||Object.values(v).some(hasJob))
function literal(node,depth=0){
 need(node&&depth<64,'Native literal data nesting changed')
 if(node.type==='Literal'){need(!node.regex&&(node.value===null||['string','boolean','number'].includes(typeof node.value))&&(typeof node.value!=='number'||Number.isFinite(node.value)),'Unsupported native literal value');return node.value}
 if(node.type==='UnaryExpression'){need(node.operator==='!'&&node.prefix&&node.argument.type==='Literal'&&[0,1].includes(node.argument.value),'Unsupported native literal expression');return !node.argument.value}
 if(node.type==='ArrayExpression'){need(node.elements.length<=1000,'Native literal array exceeds bound');return node.elements.map(n=>literal(n,depth+1))}
 need(node.type==='ObjectExpression','Unsupported native data expression');const result=Object.create(null)
 for(const p of node.properties){need(p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init'&&['Identifier','Literal'].includes(p.key.type),'Unsupported native data property');const key=p.key.name??p.key.value;need(typeof key==='string'&&key!=='__proto__'&&!Object.hasOwn(result,key),'Duplicate or unreviewed native data key');Object.defineProperty(result,key,{value:literal(p.value,depth+1),enumerable:true,configurable:true,writable:true})}
 return result
}
export function readCurrentNhostProgramme(programme,url){
 const ast=parse(programme,{ecmaVersion:'latest',sourceType:'script'}),push=one(ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'),'career programme registration').expression
 need(push.callee.type==='MemberExpression'&&push.callee.property.name==='push'&&push.arguments.length===1&&push.arguments[0].type==='ArrayExpression','Current native career programme registration changed')
 const modules=push.arguments[0].elements[1];need(modules?.type==='ObjectExpression','Current native career modules changed')
 const module=id=>one(modules.properties.filter(p=>p.type==='Property'&&p.key.value===id),'career module '+id).value
 const roles=module(64290),component=module(35886),entry=module(15731),moduleText=n=>programme.slice(n.start,n.end)
 need(moduleText(entry).includes('.push(["/careers",function(){return o(35886)}])')&&moduleText(component).includes('m=o(64290)')&&moduleText(component).includes('m.V_.length')&&moduleText(component).includes('m.V_.map('),'Current active career component/import/publication binding changed')
 need(roles.type==='ArrowFunctionExpression'&&roles.params.length===3&&roles.body.type==='BlockStatement'&&roles.body.body.length===3,'Current native publication module body changed')
 const declaration=roles.body.body[2];need(declaration.type==='VariableDeclaration'&&declaration.declarations.length===1,'Current native literal role declaration changed')
 const binding=declaration.declarations[0],init=binding.init,exportText=moduleText(roles.body.body[1]);need(binding.id.type==='Identifier'&&exportText==='o.d(t,{V_:()=>'+binding.id.name+'});','Current native publication export changed')
 need(init?.type==='CallExpression'&&init.callee.type==='MemberExpression'&&!init.callee.computed&&init.callee.property.name==='filter'&&init.callee.object.type==='ArrayExpression'&&init.arguments.length===1,'Current native publication filter changed')
 const filter=init.arguments[0];need(filter.type==='ArrowFunctionExpression'&&!filter.async&&filter.params.length===1&&filter.params[0].type==='Identifier'&&filter.body.type==='UnaryExpression'&&filter.body.operator==='!'&&filter.body.argument.type==='MemberExpression'&&!filter.body.argument.computed&&filter.body.argument.object.name===filter.params[0].name&&filter.body.argument.property.name==='hidden','Unreviewed native visibility filter')
 const records=literal(init.callee.object);need(records.every(r=>r&&typeof r==='object'&&typeof r.slug==='string'&&typeof r.title==='string'&&typeof r.hidden==='boolean'),'Current native hidden publication flags/data changed')
 const published=records.filter(r=>!r.hidden);need(published.length===0,'Current native visible/published role count requires vacancy acquisition review')
 return {url,wholeOriginalProgramme:programme,wholeNativeRoleRecords:records,hiddenRoleRecords:records,publishedRoleCount:published.length,nativePublicationFilter:'row => !row.hidden',entryModule:15731,componentModule:35886,dataModule:64290,dataExport:'V_',programmesExecuted:false,completeClientDependencyClosureQualified:false,hiddenRoleRecordsAreVacancies:false}
}
export function readCurrentNhostPage(html,url){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'Nhost title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href
 need(title===(url===HOMEPAGE_URL?'Postgres Backend to Build, Deploy & Scale | Nhost':'Careers and Open Positions | Nhost')&&canonical===(url===HOMEPAGE_URL?'https://nhost.io':url)&&!doc.nodes(n=>n.tag==='base').length,'Current own Nhost publisher title/canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'New authoritative native JobPosting requires vacancy review')
 const careersLinks=doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers'&&doc.text(n)==='Careers').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}));need(careersLinks.length===1,'Current own Nhost career declaration changed')
 const programmeDeclarations=doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),data=readLiteralModel(one(doc.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'),'whole native page model').raw).value
 need(data.page===(url===HOMEPAGE_URL?'/':'/careers')&&data.nextExport===true&&data.autoExport===true&&data.isFallback===false,'Current native page route/data binding changed')
 let main,open,invitation,programmeURL
 if(url===CAREERS_URL){
  main=one(doc.nodes(n=>n.tag==='main'),'complete authored career body');open=one(doc.nodes(n=>n.tag==='section'&&n.attrs.id==='open-positions',main),'whole native open positions section')
  need(doc.text(main).includes('Build the future of application development with us')&&doc.text(open).includes('0 open roles')&&!doc.nodes(n=>n.tag==='a'&&/^\/careers\//.test(n.attrs.href??''),main).length,'Current published role count/links require vacancy acquisition review')
  invitation=one(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='mailto:careers@nhost.io'&&doc.text(n)==='careers@nhost.io',open),'general candidate invitation')
  const declared=programmeDeclarations.filter(p=>/^\/_next\/static\/chunks\/pages\/careers-[a-z0-9]+\.js$/.test(p.attrs.src??''));programmeURL=new URL(one(declared,'current career programme').attrs.src,url).href
 }
 return {url,title,canonical,structured,careersLinks,wholeNativePageData:data,programmeDeclarations,programmeURL,wholeCareerDOM:main?structuredClone(main):null,wholeCareerText:main?doc.text(main):null,wholePositionsDOM:open?structuredClone(open):null,generalInvitation:invitation?{attrs:structuredClone(invitation.attrs),text:doc.text(invitation)}:null,wholeOriginalHTML:html,nativeInventoryQualified:false,remoteOrGlobalIsExplicitIndia:false}
}
export async function runCurrentNhost(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output bound; unknown inventory cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[CAREERS_URL,'html']],learnedURL:(url,kind)=>kind==='javascript'&&/^https:\/\/nhost\.io\/_next\/static\/chunks\/pages\/careers-[a-z0-9]+\.js$/.test(url)});let opening,closing
 async function authority(){const home=readCurrentNhostPage((await reader.read(HOMEPAGE_URL)).body,HOMEPAGE_URL),career=readCurrentNhostPage((await reader.read(CAREERS_URL)).body,CAREERS_URL);reader.allow(career.programmeURL,'javascript');const programme=readCurrentNhostProgramme((await reader.read(career.programmeURL)).body,career.programmeURL);return {home,career,programme}}
 const semantic=m=>({home:{title:m.home.title,canonical:m.home.canonical,structured:m.home.structured,careersLinks:m.home.careersLinks},career:{title:m.career.title,canonical:m.career.canonical,structured:m.career.structured,wholeCareerDOM:m.career.wholeCareerDOM,wholeNativePageData:m.career.wholeNativePageData,programmeURL:m.career.programmeURL},programme:m.programme})
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing full authored career/programme/hidden criteria/publication model changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:[{recordKind:'general-candidate-invitation',nativeInvitation:opening.career.generalInvitation,country:null,roleId:null,criteria:null,applyUrl:null}],country:null,
   observedCareerAndProgrammeClosingReconciled:true,entireDOMClosingReconciled:false,hiddenRoleRecordsAreActiveVacancies:false,inactiveRoleDetailRequests:0,publicApplicationEligibilityQualified:false,activeApplyVerified:false,nativeInventoryQualified:false,
   lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,companyGlobalZeroProven:false,remoteOrGlobalIsExplicitIndia:false,applicationInteractions:0,programmesExecuted:false,
   sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds:['current-native-page-displays-zero-roles-and-reviewed-module-filters-hidden-role-DTOs-out-of-publication','complete-hidden-criteria-models-are-dormant-data-not-active-vacancies-or-application-authority','generic-careers-email-is-not-an-individual-role-country-criteria-or-application-contract','unexecuted-complete-client-dependency-and-company-native-inventory-unknown']}
  need(Buffer.byteLength(JSON.stringify(audit))<=12*1024*1024,'Native output evidence byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-general-candidate-invitation-and-hidden-publication-model-retained;no-qualified-active-vacancy-and-company-India-global-inventory-unproven'});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}options.signal?.throwIfAborted();throw error}
 finally{reader.close()}
}
