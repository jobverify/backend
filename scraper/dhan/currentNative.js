import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeText,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeDate} from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import {readOwnedCurrentDocument,readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {collectCurrentOriginalRecords,canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'

export const CAREERS_URL='https://dhan.co/career/',BOARD_URL='https://raise.keka.com/careers',ROOT_URL=BOARD_URL+'/'
export const TENANT='7669ff3a-2b35-4442-9bac-9f9ae4b718b3',CLIENT_URL=ROOT_URL+'api/embedjobs/js/'+TENANT
export const PORTAL_URL=ROOT_URL+'api/organization/default/careerportalinfo',GROUP_URL=ROOT_URL+'api/embedjobs/grouplinkstatus/'+TENANT,ACTIVE_URL=ROOT_URL+'api/embedjobs/default/active/'+TENANT
const failure=message=>firstPartyFailure('dhan',message,{nativeAuthorityFailure:true}),need=(ok,message)=>{if(!ok)throw failure(message)}
const sha=value=>createHash('sha256').update(value).digest('hex'),normalizeAST=ast=>JSON.stringify(ast,(key,value)=>['start','end','raw'].includes(key)?undefined:value)
const astNodes=node=>!node||typeof node!=='object'?[]:[node,...Object.values(node).flatMap(value=>Array.isArray(value)?value.flatMap(astNodes):astNodes(value))]
const publicDocumentURL=url=>{try{return new URL(url).origin==='https://raise.keka.com'&&new URL(url).href===url&&new RegExp('^https://raise\\.keka\\.com/ats/documents/'+TENANT+'/careerportal/[a-z0-9]{32}\\.html$').test(url)}catch{return false}}
const json=body=>{const parsed=readLiteralModel(body);need(parsed.validJSON===true,'Original native model is not unambiguous JSON');return parsed.value}
export function readCurrentCorporate(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Work with us and Help us Raise The Bar | Dhan',canonical:CAREERS_URL})
 const visible=readVisibleNativeDocument(html,{strict:true}),anchors=visible.nodes(node=>node.tag==='a'&&node.attrs.href===BOARD_URL)
 need(anchors.length===1&&owned.nodes.filter(node=>node.tag==='a'&&node.attrs.href===BOARD_URL).length===1,'Corporate Raise hiring handoff changed or is hidden')
 need(nativeText(visible.nodes(node=>node.tag==='body')[0]).includes('Raise Securities Private Limited'),'Corporate Dhan ownership declaration changed')
 return {corporateURL:CAREERS_URL,declaredGroupBoard:BOARD_URL,brand:'Dhan',corporateOwner:'Raise Securities Private Limited',exactBrandRoleScopeVerified:false}
}
function documentPrograms(owned,declarationHash,hashes,mask){
 const scripts=owned.nodes.filter(node=>node.tag==='script'),declarations=scripts.map(node=>({attrs:Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b))),inert:Boolean(node.inert)}))
 need(sha(JSON.stringify(declarations))===declarationHash,'Native public program declarations require review')
 const inline=scripts.filter(node=>!node.attrs.src)
 need(inline.length===hashes.length&&inline.every(node=>!node.inert&&(owned.head.children.includes(node)||owned.body.children.includes(node))),'Native inline program owner changed')
 return inline.map((node,index)=>{const ast=parse(node.raw??'',{ecmaVersion:'latest'});if(mask)mask(ast,index);need(sha(normalizeAST(ast))===hashes[index],'Native public program structure requires review');return ast})
}
export function readCurrentWrapper(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:null,canonical:BOARD_URL,eventPrograms:[]});let documentURL
 documentPrograms(owned,'1017161936df9eadafa0be89b4389c1e24943d63959944b172eee729ef677183',[
  '6a7646db8bb6b301e3d9d9a4a3d021c753aa43c87e44d00c978cf222bb0a2ae9','1047897d4c6a3a75ed31c52e5fbfef4b40f3a5d4a93ca682557f402f4ddb557c'],(ast,index)=>{
  if(index!==1)return
  const calls=astNodes(ast).filter(node=>node.type==='CallExpression'&&node.callee?.type==='Identifier'&&node.callee.name==='fetch')
  need(calls.length===1&&calls[0].arguments.length===1&&calls[0].arguments[0].type==='Literal'&&typeof calls[0].arguments[0].value==='string','Native public-document GET declaration changed')
  documentURL=new URL(calls[0].arguments[0].value,BOARD_URL).href
  need(publicDocumentURL(documentURL),'Native public-document URL is not bound to this tenant')
  calls[0].arguments[0]={type:'ReviewedLiteralData',binding:'nativePublicDocumentURL'}
 })
 return {documentURL}
}
export function readCurrentPublicDocument(html,url){
 need(publicDocumentURL(url),'Unbound native public document')
 const owned=readOwnedCurrentDocument(html,{failure,title:null,canonical:url,eventPrograms:[{tag:'p',attribute:'onclick',valueSHA256:'96a1645a146ba9b4f09368fac66b43c67fa69f5696c77b445a62a41792718d8a',inert:false}]})
 const programs=documentPrograms(owned,'bf413a48b05289a4721639a087654aa18eaf33ab9c8799c366f3c0002e7b71f3',[
  'a1c90425c8d4d004abac4733563360d8dc3ed4de3b77c02ea2325aad270a1e63','5fa50ff586734c8a537d0eb400cf40af96c357e8c11e6e52465e1cedda99c45e'])
 const assignments=astNodes(programs[0]).filter(node=>node.type==='AssignmentExpression'&&node.operator==='='&&node.left.type==='MemberExpression'&&!node.left.computed&&node.left.object.name==='window'&&node.left.property.name==='khConfig')
 need(assignments.length===1&&assignments[0].right.type==='ObjectExpression','Native config binding changed')
 const config=Object.fromEntries(assignments[0].right.properties.map(property=>{need(property.type==='Property'&&!property.computed&&property.kind==='init'&&property.value.type==='Literal'&&typeof property.value.value==='string','Nonliteral native config');return [property.key.name,property.value.value]}))
 need(config.identifier===TENANT&&config.domain===ROOT_URL&&config.targetContainer==='#khembedjobs'&&Object.keys(config).length===3,'Native tenant/config scope changed')
 const mounts=owned.nodes.filter(node=>node.attrs.id==='khembedjobs')
 need(mounts.length===1&&!mounts[0].inert,'Native embedded vacancy mount changed')
 return config
}
export function readCurrentEmbedClient(source){
 const ast=parse(source,{ecmaVersion:'latest'})
 need(sha(normalizeAST(ast))==='504d3365cf0358a3544f082fb3d4a85dfc05fe37deeff2f1aa71a677d8d307e7','Native embed-client structure requires review')
 return {normalizedASTSHA256:'504d3365cf0358a3544f082fb3d4a85dfc05fe37deeff2f1aa71a677d8d307e7',remoteProgramExecuted:false,
  endpointProvenance:'Original reviewed client has three single-argument fetch expressions composed from literal khConfig.domain/identifier and portalName default; no options or session state.',
  urls:[PORTAL_URL,GROUP_URL,ACTIVE_URL],roleURLProvenance:'Original native client composes khConfig.domain + empty portalNameUrl + jobdetails/ + job.id; source query absent.'}
}
function readPortal(body){
 const info=json(body)
 need(info?.name==='Raise holding'&&info.shortName==='Raise holding'&&info.careersPortalDomain==='raise.keka.com'&&info.companyWebsite===''&&Array.isArray(info.socialLinks)&&info.socialLinks.length===0,'Native group employer/domain identity changed')
 return info
}
function readGroupStatus(body){const result=json(body);need(result?.isGroupLinked===false&&Object.keys(result).length===1,'Native group-link declaration changed');return result}
export function readCurrentActiveRecords(body){
 const rows=json(body),ids=new Set()
 need(Array.isArray(rows)&&rows.length<=1000,'Native active record array changed')
 for(const row of rows){
  need(row&&Number.isSafeInteger(row.id)&&row.id>0&&!ids.has(row.id)&&typeof row.title==='string'&&clean(row.title)&&typeof row.description==='string'&&Array.isArray(row.jobLocations)&&row.jobLocations.length<=50,'Invalid or duplicate native vacancy')
  need(row.jobLocations.every(place=>place&&typeof place==='object'&&['name','city','state','countryCode','countryName'].every(key=>place[key]===null||typeof place[key]==='string')),'Native worksite fields changed')
  ids.add(row.id)
 }
 return rows
}
export function normalizeCurrentKekaJob(record,{portalInfo}={}){
 need(portalInfo?.name==='Raise holding'&&Number.isSafeInteger(record.id)&&record.id>0&&Array.isArray(record.jobLocations),'Native normalizer employer/record context missing')
 const worksites=record.jobLocations.map(place=>{const code=countryName(place.countryCode),name=countryName(place.countryName),conflict=Boolean(code&&name&&code!==name)
  return {native:structuredClone(place),country:conflict?null:code??name,city:clean(place.city)||null,state:clean(place.state)||null,conflict}})
 const countries=[...new Set(worksites.map(place=>place.country).filter(Boolean))],unresolved=worksites.length===0||worksites.some(place=>!place.country||place.conflict)||countries.length!==1
 const country=unresolved?null:countries[0],cities=[...new Set(worksites.map(place=>place.city).filter(Boolean))],states=[...new Set(worksites.map(place=>place.state).filter(Boolean))]
 const id=String(record.id),applyUrl=ROOT_URL+'jobdetails/'+id
 return {title:clean(record.title),company:portalInfo.name,legalEmployer:null,companyDomain:null,sourceNativeJobId:id,jobId:'dhan-'+id,requisitionId:null,
  sourceEmployerScope:'corporate-declared-group-board',sourceExactBrandRoleScopeVerified:false,sourceEmployerEvidence:{nativePortalName:portalInfo.name,corporateBrand:'Dhan',groupBoardURL:BOARD_URL},
  location:worksites.map(place=>[place.city,place.state,place.country].filter(Boolean).join(', ')).filter(Boolean).join(' | ')||null,
  country,city:cities.length===1?cities[0]:null,state:states.length===1?states[0]:null,sourceCountryScopeUnresolved:unresolved,sourceNativeCountryConflict:worksites.some(place=>place.conflict)||countries.length>1,
  sourceNativeWorksites:worksites,sourceNativeJobRecord:structuredClone(record),sourceUrl:applyUrl,applyUrl,applicationUrlIsGeneric:false,applicationVisited:false,
  sourceRoleURLProvenance:'Original reviewed embed client: literal khConfig.domain + jobdetails/ + native job.id; activation unverified',
  department:clean(record.departmentName)||null,employmentType:record.jobType===2?'Full-time':record.jobType===1?'Part-time':null,sourceNativeJobType:record.jobType??null,
  workplaceType:null,experienceRequired:clean(record.experience)||null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  postingDate:nativeDate(record.publishedOn),nativePublishedOn:record.publishedOn??null,nativePublishedOnProvenance:'Native publishedOn;first publication unverified',closingDate:null,firstPublishedAt:null,
  ...readOriginalNativeCriteria(record.description,failure),lifecycleCleanupAllowed:false}
}
async function opening(reader){
 const corporate=readCurrentCorporate((await reader.read(CAREERS_URL)).body),wrapper=readCurrentWrapper((await reader.read(BOARD_URL)).body)
 reader.allow(wrapper.documentURL,'html')
 const config=readCurrentPublicDocument((await reader.read(wrapper.documentURL)).body,wrapper.documentURL),client=readCurrentEmbedClient((await reader.read(CLIENT_URL)).body)
 const portalInfo=readPortal((await reader.read(PORTAL_URL)).body),groupStatus=readGroupStatus((await reader.read(GROUP_URL)).body),records=readCurrentActiveRecords((await reader.read(ACTIVE_URL)).body)
 return {records,portalInfo,corporate,wrapper,config,client,groupStatus,context:{portalInfo,groupStatus,config,client,sourceEmployerScope:'corporate-declared-group-board',sourceExactBrandRoleScopeVerified:false}}
}
async function closing(reader,original,observe){
 const records=readCurrentActiveRecords((await reader.read(ACTIVE_URL)).body);observe({records})
 const groupStatus=readGroupStatus((await reader.read(GROUP_URL)).body),portalInfo=readPortal((await reader.read(PORTAL_URL)).body)
 const client=readCurrentEmbedClient((await reader.read(CLIENT_URL)).body),config=readCurrentPublicDocument((await reader.read(original.wrapper.documentURL)).body,original.wrapper.documentURL)
 const wrapper=readCurrentWrapper((await reader.read(BOARD_URL)).body),corporate=readCurrentCorporate((await reader.read(CAREERS_URL)).body)
 for(const [name,value] of Object.entries({groupStatus,portalInfo,client,config,wrapper,corporate}))need(canonicalNativeRecord(value)===canonicalNativeRecord(original[name]),'Native '+name+' changed at closing')
 return {records}
}
export const runCurrentDhan=options=>collectCurrentOriginalRecords(options,{source:'dhan',company:'Dhan',atsPlatform:'keka',corporateURL:CAREERS_URL,recordKind:'vacancy-rows',
 admitted:[[CAREERS_URL,'html'],[BOARD_URL,'html'],[CLIENT_URL,'javascript'],[PORTAL_URL,'json'],[GROUP_URL,'json'],[ACTIVE_URL,'json']],learnedURL:(url,kind)=>kind==='html'&&publicDocumentURL(url),
 id:row=>String(row.id),active:()=>true,normalize:normalizeCurrentKekaJob,open:opening,close:closing})
