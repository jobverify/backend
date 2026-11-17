import {parse} from 'acorn'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE='sharekhan',HOME='https://www.sharekhan.com/',CAREERS=HOME+'careers',GENERAL=CAREERS+'/job-details'
const clone=value=>JSON.parse(JSON.stringify(value)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const one=(rows,label)=>{need(rows.length===1,'Expected one native '+label);return rows[0]}
function genericIntake(doc){
 const script=one(doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&/function submitapplicationdetails\s*\(/.test(node.raw??'')),'general application program'),ast=parse(script.raw,{ecmaVersion:'latest'}),functions=ast.body.filter(node=>node.type==='FunctionDeclaration'&&node.id.name==='submitapplicationdetails')
 const selected=one(functions,'general application function'),vars=[]
 const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&['jobtitle','jobid'].includes(node.id.name))vars.push(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)}
 walk(selected)
 const id=one(vars.filter(node=>node.id.name==='jobid'),'application job ID'),label=one(vars.filter(node=>node.id.name==='jobtitle'),'application role label')
 need(id.init?.type==='Literal'&&id.init.value===''&&label.init?.type==='Literal'&&label.init.value==='Lead Page CTA','General intake changed to an unreviewed vacancy binding')
 return {program:script.raw,nativeJobID:id.init.value,nativeJobLabel:label.init.value}
}
export async function runCurrentSharekhan(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs==null,'A cap cannot qualify unknown native inventory')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOME,'html'],[CAREERS,'html'],[GENERAL,'html']]}),observations=[]
 async function authority(){
  const home=await reader.read(HOME),homeDoc=readNativeDocument(home.body),careers=await reader.read(CAREERS),doc=readNativeDocument(careers.body)
  need(activeHead(home.body).titles.length===1&&activeHead(home.body).titles[0].includes('Sharekhan')&&homeDoc.nodes(node=>node.tag==='a'&&node.attrs.href===CAREERS&&homeDoc.text(node)==='Careers').length>0,'Native corporate employer/careers handoff changed')
  need(same(activeHead(careers.body).titles,['Explore Career Opportunities at Mirae Asset Sharekhan'])&&one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'careers canonical').attrs.href==='https://sharekhan.com/careers','Native careers employer/canonical identity changed')
  const main=one(doc.nodes(node=>node.tag==='div'&&doc.hasClass(node,'innBodyCont')),'current careers content'),handoff=one(doc.nodes(node=>node.tag==='a'&&node.attrs.href==='/careers/job-details'),'current general recruitment handoff')
  need(doc.text(handoff)==='Unable to find the right job? Click Here'&&!doc.nodes(node=>node.tag==='table'&&node.attrs.id==='tblCurrentJobList').length&&!doc.nodes(node=>node.tag==='a'&&/^\/careers\/job-details\//.test(node.attrs.href??'')).length,'Current source now exposes an unreviewed native vacancy model')
  const intake=await reader.read(GENERAL),intakeDoc=readNativeDocument(intake.body)
  need(one(intakeDoc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'general intake canonical').attrs.href===GENERAL,'General native intake URL identity changed')
  const section=one(intakeDoc.nodes(node=>node.tag==='section'&&intakeDoc.hasClass(node,'section-spacing')),'whole general intake section'),form=one(intakeDoc.nodes(node=>node.tag==='form'&&intakeDoc.hasClass(node,'careerInput'),section),'general intake form')
  need(form.attrs.method==='post','General native intake form contract changed')
  const binding=genericIntake(intakeDoc)
  return {homepageHTML:home.body,nativeCareerHTML:careers.body,nativeGeneralIntakeHTML:intake.body,wholeCareerModel:clone(main),corporateHandoffs:homeDoc.nodes(node=>node.tag==='a'&&node.attrs.href===CAREERS).map(node=>({attrs:node.attrs,text:homeDoc.text(node)})),nativeIntakeHandoff:clone(handoff),wholeIntakeSection:clone(section),nativeGeneralIntakeBinding:binding,nativeIntakeText:intakeDoc.text(section),observedBannerTitles:intakeDoc.nodes(node=>node.tag==='h2'&&intakeDoc.hasClass(node,'heading-style1'),section).map(node=>intakeDoc.text(node))}
 }
 try{
  const opening=await authority()
  observations.push({recordKind:'hiring-signal',nativeDetailURL:GENERAL,nativeOpeningModel:clone(opening.wholeIntakeSection),nativeBannerTitles:opening.observedBannerTitles,nativeApplicationJobID:'',nativeApplicationRoleLabel:'Lead Page CTA',country:null,publicationDate:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,qualificationIssues:['general-recruitment-intake-not-a-bound-vacancy','native-role-country-unpublished','company-inventory-scope-unverified']})
  const closing=await authority()
  for(const key of ['wholeCareerModel','corporateHandoffs','nativeIntakeHandoff','wholeIntakeSection','nativeGeneralIntakeBinding'])need(same(opening[key],closing[key]),'Opening/closing whole native careers/intake/criteria changed')
  observations[0].nativeClosingModel=clone(closing.wholeIntakeSection);reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-native-careers-and-general-intake-reconciled-no-bound-vacancy-model-company-inventory-unknown'})
  attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,observations,nativeOpeningAuthority:opening,nativeClosingAuthority:closing,wholeCareerOwnedModelClosingReconciled:true,entireDocumentReconciled:false,originalResponses:reader.stats().receipts,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,legacyCityCountryInferenceUsed:false,activeApplyVerified:false,applicationInteractions:0},configurable:true})
  return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,observations,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},configurable:true})}catch{}throw error}finally{reader.close()}
}
