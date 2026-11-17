import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='payoda',HOME='https://www.payoda.com/',CAREERS=HOME+'careers'
const RENDERER_SHA='44961a8c65d0b32da4e4c9cf0ae277e6575f50a05795a1468793a2b5dc8e8705'
const ROLE_PROGRAM_SHA='4b1e1b4e3077419820b3dc867ff9c9550349bd021422fed36cc6032d91b05257'
const clone=value=>JSON.parse(JSON.stringify(value)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sha=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const one=(rows,label)=>{need(rows.length===1,'Expected one native '+label);return rows[0]}
const nativeClientURL=value=>{try{const url=new URL(value,HOME);return url.origin===new URL(HOME).origin&&/^\/_next\/static\/chunks\/[a-zA-Z0-9_.~-]+\.js$/.test(url.pathname)&&!url.search&&!url.hash?url.href:null}catch{return null}}
function literal(node,depth=0){
 need(depth<32&&node,'Invalid native role literal')
 if(node.type==='Literal'){need(node.value===null||['string','number','boolean'].includes(typeof node.value),'Unreviewed native role literal value');return node.value}
 if(node.type==='ArrayExpression')return node.elements.map(item=>literal(item,depth+1))
 need(node.type==='ObjectExpression','Executable native role data is not accepted')
 const value=Object.create(null)
 for(const property of node.properties){
  need(property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init','Unreviewed native role property')
  const key=property.key.type==='Identifier'?property.key.name:property.key.value
  need(typeof key==='string'&&!Object.hasOwn(value,key),'Duplicate native role property')
  Object.defineProperty(value,key,{value:literal(property.value,depth+1),enumerable:true})
 }
 return value
}
export function readCurrentPayodaRoles(program){
 const ast=parse(program,{ecmaVersion:'latest'}),registrations=[]
 const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.name==='s'&&node.arguments.length===1&&node.arguments[0].type==='ArrayExpression'&&node.arguments[0].elements.some(item=>item?.type==='Literal'&&item.value==='ROLES'))registrations.push(node.arguments[0]);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)}
 walk(ast)
 const registration=one(registrations,'ROLES registration'),at=registration.elements.findIndex(node=>node?.type==='Literal'&&node.value==='ROLES')
 need(registration.elements[at+1]?.value===0&&registration.elements[at+2]?.type==='ArrayExpression','Native role export binding changed')
 const array=registration.elements[at+2]
 // The current native literal cohort can change without freezing role IDs or
 // titles. Only the complete surrounding publisher program is reviewed here.
 need(sha(program.slice(0,array.start)+'<NATIVE_ROLES>'+program.slice(array.end))===ROLE_PROGRAM_SHA,'Whole native employer/application program changed outside its role data')
 const roles=literal(array)
 need(roles.length<=100&&new Set(roles.map(row=>row.title)).size===roles.length,'Ambiguous or excessive native role cohort')
 need(roles.every(row=>row&&typeof row.title==='string'&&row.title.trim()&&typeof row.location==='string'&&typeof row.summary==='string'&&Array.isArray(row.points)&&row.points.every(point=>typeof point==='string')&&typeof row.looking==='string'),'Incomplete native role data')
 return roles
}
export async function runCurrentPayoda(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs==null,'A cap cannot certify the observed native cohort')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOME,'html'],[CAREERS,'html']],learnedURL:(url,kind)=>kind==='javascript'&&nativeClientURL(url)===url})
 const observations=[]
 async function authority(){
  const home=await reader.read(HOME),homeDoc=readNativeDocument(home.body),careers=await reader.read(CAREERS),doc=readNativeDocument(careers.body)
  need(activeHead(home.body).titles.length===1&&activeHead(home.body).titles[0].includes('Payoda')&&homeDoc.nodes(node=>node.tag==='a'&&node.attrs.href==='/careers').length>0&&homeDoc.nodes(node=>node.tag==='img'&&node.attrs.alt==='Payoda').length>0,'Native corporate employer/careers handoff changed')
  need(same(activeHead(careers.body).titles,['Careers · Payoda'])&&one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'careers canonical').attrs.href===CAREERS,'Native careers employer identity changed')
  const records=readLiteralFlightRecords(careers.body);need(records?.size>0,'Missing current native route models')
  const imports=[...records.values()].filter(record=>/^I\[6914,/.test(record.raw)).map(record=>readLiteralModel(record.raw.slice(1)).value)
  const binding=one(imports,'careers renderer import');need(binding.length===3&&binding[2]==='default'&&Array.isArray(binding[1])&&binding[1].length===3,'Native renderer import contract changed')
  const urls=binding[1].map(nativeClientURL);need(urls.every(Boolean)&&new Set(urls).size===urls.length,'Unbound native renderer dependencies')
  need(urls.every(url=>doc.nodes(node=>node.tag==='script'&&node.attrs.src&&new URL(node.attrs.src,CAREERS).href===url).length===1),'Renderer program is not declared by current native HTML')
  const programs=[]
  for(const url of urls){reader.allow(url,'javascript');const page=await reader.read(url);programs.push({url,body:page.body,sha256:page.sha256})}
  const renderer=one(programs.filter(program=>program.sha256===RENDERER_SHA),'reviewed current renderer')
  need(renderer.body.includes('r.ROLES.map('),'Native renderer role binding changed')
  const roleProgram=one(programs.filter(program=>program.body.includes('"ROLES",0,[')),'native role data program'),roles=readCurrentPayodaRoles(roleProgram.body)
  const toggles=doc.nodes(node=>node.tag==='button'&&doc.hasClass(node,'role-toggle'))
  need(toggles.length===roles.length&&roles.every((row,index)=>one(doc.nodes(node=>doc.hasClass(node,'role-toggle__title'),toggles[index]),'SSR role title')&&doc.text(one(doc.nodes(node=>doc.hasClass(node,'role-toggle__title'),toggles[index]),'SSR role title'))===row.title&&doc.text(toggles[index]).includes(row.location)),'Whole current SSR role cohort disagrees with the declared native data')
  return {homepageHTML:home.body,nativeCareerHTML:careers.body,corporateHandoffs:homeDoc.nodes(node=>node.tag==='a'&&node.attrs.href==='/careers').map(node=>({attrs:node.attrs,text:homeDoc.text(node)})),wholeCareerModel:clone(one(doc.nodes(node=>node.tag==='main'),'careers main')),programs,roles,nativeFlightRecords:[...records]}
 }
 try{
  const opening=await authority()
  opening.roles.forEach((row,index)=>observations.push({nativeOrdinal:index,nativeOpeningRecord:clone(row),nativeDetailURL:CAREERS,country:null,publicationDate:null,applicationURL:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,qualificationIssues:['native-role-country-unpublished','role-publication-date-unpublished','active-own-application-unqualified','company-inventory-scope-unverified']}))
  const closing=await authority()
  need(same(opening.wholeCareerModel,closing.wholeCareerModel)&&same(opening.programs,closing.programs)&&same(opening.roles,closing.roles)&&same(opening.corporateHandoffs,closing.corporateHandoffs),'Opening/closing complete native careers/client/role model changed')
  observations.forEach((row,index)=>{row.nativeClosingRecord=clone(closing.roles[index])});reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-employer-declared-native-role-cohort-reconciled-country-date-own-application-and-company-scope-unqualified'})
  attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,observations,nativeOpeningAuthority:opening,nativeClosingAuthority:closing,wholeCareerOwnedModelClosingReconciled:true,entireDocumentReconciled:false,originalResponses:reader.stats().receipts,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,legacyCityCountryInferenceUsed:false,activeApplyVerified:false,applicationInteractions:0},configurable:true})
  return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,observations,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},configurable:true})}catch{}throw error}finally{reader.close()}
}
