import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {inspectPublishedBataCriteria} from '../bataindia/publicCriteria.js'
import {decodeHTML} from 'entities'
import {need,sha} from './publicRead.js'

export const HOME='https://annapurnafinance.in/'
export const CAREERS='https://annapurnafinance.in/career/career-openings'
export const SHORT='https://hr1.to//8e09c5'
export const PORTAL='https://career.hrone.cloud'
export const GATEWAY='https://gateway.app.hrone.cloud'
export const LIST=GATEWAY+'/api/external/public/referral/CareerPosition/Details'
export const LABELS=GATEWAY+'/api/external/public/referral/LabelSetting'
const norm=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():'',object=v=>v&&typeof v==='object'&&!Array.isArray(v)
const positive=v=>Number.isSafeInteger(v)&&v>0,escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')

// These are the actual public program bytes used to establish this native read
// contract. A new deployment needs requalification rather than a guessed API.
export const PROGRAM=[
 {label:'main',path:'/main.e3fa9a0389ba5822.js',sha256:'4aebf4ef03b5bac04fc771cec5c053f472bafa371861f04607821da3923d9ada'},
 {label:'runtime',path:'/runtime.e1dcfa1dbf970e90.js',sha256:'ddc1d3667d9ad72ab38134d73379d0359259b2aa803ba081188e2c2dbbf9b091'},
 {label:'careers-client',path:'/1020.5da02bbdf228dacf.js',sha256:'153f719692b0bd3a3d65b804d4c9eca6950e0d20f12af7bfe7b26f0241091336'},
 {label:'detail-client',path:'/6460.1a1993033241bd99.js',sha256:'836863acc642f711dcb1b28be2daa4c2dca11d260cdd5e49c7cf846f751d48ec'},
]
function visibleLinks(html,base){
 const doc=readVisibleNativeDocument(html,{strict:true})
 return doc.nodes(n=>n.tag==='a'&&!n.inert&&typeof n.attrs.href==='string').map(n=>{try{return{url:new URL(n.attrs.href,base).href,text:doc.text(n)}}catch{return null}}).filter(Boolean)
}
export function verifyCorporateHandoff(home,careers){
 const homeDoc=readVisibleNativeDocument(home,{strict:true}),careerDoc=readVisibleNativeDocument(careers,{strict:true})
 need(/Annapurna\s+Finance/i.test(homeDoc.text(homeDoc.nodes(n=>n.tag==='root')[0]))&&visibleLinks(home,HOME).some(l=>l.url.replace(/\/$/,'')===CAREERS),'current official homepage/careers handoff unavailable')
 need(/Annapurna\s+Finance/i.test(careerDoc.text(careerDoc.nodes(n=>n.tag==='root')[0]))&&visibleLinks(careers,CAREERS).some(l=>l.url===SHORT&&/career\s*portal/i.test(l.text)),'current official career portal handoff unavailable')
}
export function portalConfiguration(value,html){
 const u=new URL(value),keys=['appId','dc','rqt','cc']
 need(u.origin===PORTAL&&u.pathname==='/career-portal'&&!u.username&&!u.password&&!u.hash&&u.searchParams.size===keys.length&&keys.every(k=>u.searchParams.getAll(k).length===1&&norm(u.searchParams.get(k)))&&u.searchParams.get('dc')==='annapurna','published public portal tenant identity changed')
 const doc=readNativeDocument(html),scripts=doc.nodes(n=>n.tag==='script'&&!n.inert&&typeof n.attrs.src==='string').map(n=>new URL(n.attrs.src,PORTAL).href)
 need(PROGRAM.slice(0,2).every(p=>scripts.includes(PORTAL+p.path)),'published public portal read program changed')
 return{appId:u.searchParams.get('appId'),dc:u.searchParams.get('dc'),rqt:u.searchParams.get('rqt'),cc:u.searchParams.get('cc')}
}
export function verifyProgram(label,body){const p=PROGRAM.find(p=>p.label===label);need(p&&sha(body)===p.sha256,'published public '+label+' program changed')}
export const headersFor=c=>({apiKey:c.appId,domainCode:c.dc,AccessMode:'W','skip-withcredentials':'false',Origin:PORTAL,Referer:PORTAL+'/'})
export const queryFor=(c,page)=>({departmentCode:'',companyCode:c.cc,careerPortalType:c.rqt,jobTitle:'',employmentType:'',seniorityName:'',jobFunction:'',company:'',businessUnitCode:'',department:'',subDepartment:'',gradeCode:'',designationCode:'',levelCode:'',branchCode:'',subBranchCode:'',regionCode:'',locationId:'',experience:'',qualification:'',skillsName:'',urgentOpening:'',jobPosted:'0',isShortUrl:false,pagination:{pageNumber:page,pageSize:15},nationality:'',preferredLocationId:''})
export const ownDetailUrl=(r,c)=>GATEWAY+'/api/external/public/referral/JobOpening/Request/Details/'+[r.encryptedPositionId,c.cc,r.sourceType].map(encodeURIComponent).join('/')
export function nativeJSON(text){try{return JSON.parse(text)}catch{need(false,'native JSON response is malformed')}}
export function parsePage(text,page){
 const rows=nativeJSON(text);need(Array.isArray(rows)&&rows.length<=15,'native pagination array unavailable or failure envelope')
 for(const r of rows){
  need(object(r)&&positive(r.positionId)&&norm(r.jobCode)&&norm(r.jobTitle)&&typeof r.encryptedPositionId==='string'&&r.encryptedPositionId.length>0&&typeof r.sourceType==='string'&&r.sourceType.length>0,'native pagination position identity unavailable')
  need(!Object.hasOwn(r,'error')&&!Object.hasOwn(r,'errors')&&!Object.hasOwn(r,'err'),'native pagination failure envelope')
  need(r.noOfOpening==null||Number.isFinite(r.noOfOpening)&&r.noOfOpening>=0,'native position quantity invalid')
  need(r.preferredLocation==null||typeof r.preferredLocation==='string','native workplace label shape unavailable')
  need(r.preferredLocationOptionId==null||Number.isSafeInteger(r.preferredLocationOptionId),'native workplace option shape unavailable')
 }
 return{rows,terminal:rows.length<15,page}
}
const STANDARD=new Map([
 ['JOB_TITLE',['jobTitle']],['FK_EMP_TYPE_ID',['employeeType']],['NO_OF_OPENING',['noOfOpening']],['FK_SENIORITY_ID',['seniorityName']],['FK_FUNCTION_ID',['functionName']],
 ['FK_PREF_LOC_OPT_ID',['preferredLocationOptionName','preferredLocationList']],['JOB_DESCRIPTION_BODY',['jobDescriptionBodyWithHtml']],['JOB_ATTACHMENT',['documentFileName']],
 ['EXPERIENCE',['experienceFrom','experienceTo']],['FK_QUALIFICATION_CODE',['qualificationList']],['SALARY',['currencyName','salaryFrom','salaryTo']],['SKILLS',['skillsName']],
 ['FK_DEPT_CODE',['department']],['FK_DESIG_CODE',['designation']],['FK_BRANCH_CODE',['branch']],
])
const ORG=['FK_COMPANY_CODE','FK_BUSI_UNIT_CODE','FK_DEPT_CODE','FK_SUB_DEPT_CODE','FK_DESIG_CODE','FK_GRADE_CODE','FK_LEVEL_CODE','FK_REGION_CODE','FK_BRANCH_CODE','FK_SUB_BRANCH_CODE']
export function parsePublicLabels(text){
 const rows=nativeJSON(text);need(Array.isArray(rows)&&rows.length<=150,'native public field labels unavailable')
 const seen=new Set()
 for(const r of rows){need(object(r)&&norm(r.fieldName)&&norm(r.displayName)&&typeof r.isCarrierPortal==='boolean'&&!seen.has(r.fieldName),'native public field label identity ambiguous');seen.add(r.fieldName)}
 return rows.filter(r=>r.isCarrierPortal).map(r=>{
  need(r.controlKey==null||typeof r.controlKey==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(r.controlKey),'native public label control shape unavailable')
  return{fieldName:r.fieldName,label:r.displayName,controlKey:r.controlKey??null}
 })
}
function renderedFields(labels){
 const orgVisible=labels.some(l=>ORG.includes(l.fieldName)),fields=[],unmapped=[]
 for(const l of labels){
  if(STANDARD.has(l.fieldName))fields.push({...l,keys:STANDARD.get(l.fieldName)})
  else if(l.fieldName.includes('JOBOPENINGFIELD')&&!orgVisible)continue
  else if(l.fieldName.includes('JOBOPENINGFIELD')&&orgVisible&&/^jobField(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)$/.test(l.controlKey??''))fields.push({...l,keys:[l.controlKey]})
  else unmapped.push(l.fieldName)
 }
 return{fields,unmapped}
}
function textValue(v){if(v==null)return'';if(Array.isArray(v))return v.map(x=>object(x)?norm(x.text):norm(x)).filter(Boolean).join(', ');return typeof v==='number'?String(v):norm(v)}
function renderedValue(key,value){
 if(value==null)return{value:null,qualified:true}
 if(['qualificationList','preferredLocationList'].includes(key)){
  if(!Array.isArray(value)||value.length>1000)return{qualified:false}
  const items=[]
  for(const item of value){
   if(!object(item)||typeof item.text!=='string'||item.text.length>10000||item.id!=null&&!['number','string'].includes(typeof item.id))return{qualified:false}
   items.push({...(item.id==null?{}:{id:item.id}),text:item.text})
  }
  return{value:items,qualified:true}
 }
 if(typeof value==='string'&&value.length<=4*1024*1024||typeof value==='number'&&Number.isFinite(value))return{value,qualified:true}
 return{qualified:false}
}
function visibleDescription(raw){
 if(typeof raw!=='string')return{qualified:false,reasons:['native-public-description-missing'],text:null}
 const html='<section>'+raw+'</section>',doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],text=doc.text(root)
 const declared=node=>typeof node==='string'?decodeHTML(node):['script','style','template','noscript','textarea'].includes(node.tag)?'':node.children.map(declared).join('')
 const fingerprint=value=>String(value??'').normalize('NFC').replace(/\s+/g,'')
 const allTextVisible=fingerprint(declared(root))===fingerprint(text)
 const proof=inspectPublishedBataCriteria(html,text)
 const nontext=doc.nodes(n=>!n.inert&&['img','svg','canvas','iframe','object','embed','audio','video'].includes(n.tag)).length>0
 const offscreen=doc.nodes(n=>!n.inert&&doc.text(n)&&offscreenStyle(n.attrs.style)).length>0
 const meaningful=/[\p{L}\p{N}]/u.test(text??'')
 return{qualified:proof.qualified&&!nontext&&!offscreen&&meaningful&&allTextVisible,reasons:[...proof.reasons,...(allTextVisible?[]:['native-full-description-contains-hidden-text']),...(offscreen?['native-full-description-contains-offscreen-criteria']:[]),...(nontext?['native-nontext-criteria-unqualified']:[]),...(meaningful?[]:['native-public-description-empty'])],text}
}
function offscreenStyle(style){
 const declarations=new Map(String(style??'').split(';').map(part=>{const at=part.indexOf(':');return at<0?null:[part.slice(0,at).trim().toLowerCase(),part.slice(at+1).replace(/\s*!important\s*$/i,'').trim().toLowerCase()]}).filter(Boolean))
 const extreme=value=>{const m=/^-([\d.]+)(px|pt|em|rem|vh|vw|%)$/.exec(value??'');return m&&Number(m[1])>=(['em','rem','vh','vw','%'].includes(m[2])?100:1000)}
 return /^(?:absolute|fixed)$/.test(declarations.get('position')??'')&&['left','top','right','bottom'].some(key=>extreme(declarations.get(key)))
  ||extreme(declarations.get('text-indent'))&&['overflow','overflow-x'].some(key=>/^(?:hidden|clip)$/.test(declarations.get(key)??''))
}
export function publicRole(row,data,labels,{now}={}){
 need(object(data)&&data.requestId===row.positionId&&data.jobCode===row.jobCode&&norm(data.jobTitle)===norm(row.jobTitle),'native own-role identity or request ID changed')
 need(!Object.hasOwn(data,'error')&&!Object.hasOwn(data,'errors')&&!Object.hasOwn(data,'err'),'native own-role failure envelope')
 const employer=norm(data.company),employerBound=employer.replace(/[^a-z]/gi,'').toLowerCase()==='annapurnafinanceprivatelimited'
 const {fields,unmapped}=renderedFields(labels),projection={},criteria=[],shapeGaps=[]
 for(const field of fields){
  for(const key of field.keys)if(Object.hasOwn(data,key)){
   const projected=renderedValue(key,data[key]);if(projected.qualified)projection[key]=projected.value;else shapeGaps.push('native-rendered-field-shape-unqualified:'+key)
  }
  const value=field.keys.map(k=>textValue(projection[k])).filter(Boolean).join(' / ')
  if(value)criteria.push({fieldName:field.fieldName,label:field.label,controlKey:field.controlKey,value})
 }
 const raw=projection.jobDescriptionBodyWithHtml,description=visibleDescription(raw),attachment=fields.some(f=>f.fieldName==='JOB_ATTACHMENT')&&Boolean(projection.documentFileName)
 const reasons=[...description.reasons,...shapeGaps,...unmapped.map(k=>'unqualified-public-field:'+k),...(employerBound?[]:['native-employer-binding-unqualified']),...(attachment?['separate-public-attachment-unqualified']:[])]
 const complete=description.qualified&&unmapped.length===0&&shapeGaps.length===0&&employerBound&&!attachment
 const body=complete?raw+'<dl>'+criteria.filter(f=>!['JOB_DESCRIPTION_BODY','JOB_ATTACHMENT'].includes(f.fieldName)).map(f=>'<dt>'+escape(f.label)+'</dt><dd>'+escape(f.value)+'</dd>').join('')+'</dl>':null
 const workplaces=Array.isArray(projection.preferredLocationList)?structuredClone(projection.preferredLocationList):[]
 // This tenant publishes city labels, not countries. Currency, organisation,
 // role title dates, candidate nationality and phone defaults are not evidence.
 return{source:'annapurnafinance',company:'Annapurna Finance',jobId:String(row.positionId),requisitionId:row.jobCode,title:row.jobTitle,
  sourceUrl:CAREERS,applyUrl:SHORT,link:CAREERS,sourceRoleUrlQualified:false,
  // Canonical geography stays empty until its country is qualified. Native
  // city labels remain below; shared city heuristics must not publish them.
  location:null,locations:[],city:null,country:null,
  nativePreferredLocation:row.preferredLocation??null,nativePreferredLocationOptionId:row.preferredLocationOptionId??null,nativeWorkplaceAlternatives:workplaces,nativeEmployer:employer,
  nativePublicJobCriteria:projection,publicCriteriaFields:criteria,nativeCriteriaQualification:{qualified:complete,reasons},
  jobDescription:body,sourceDescription:body,sourceDetailComplete:complete,sourceDetailStatus:complete?'complete':'native-public-criteria-unqualified',
  postingDate:null,postedAt:null,closingDate:null,sourcePostingDateUnknown:true,sourceDateEvidence:{status:'unpublished-native-posting-date',closingDatePublished:false},
  sourceCountryEvidence:{status:'unpublished-native-work-country',nativeWorkplaces:workplaces},
  sourceNativePositionQuantity:row.noOfOpening??null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now}
}
export const publicObservation=row=>({source:'annapurnafinance',company:'Annapurna Finance',jobId:String(row.positionId),requisitionId:row.jobCode,title:row.jobTitle,sourceUrl:CAREERS,applyUrl:SHORT,country:null,location:null,locations:[],city:null,nativePreferredLocation:row.preferredLocation??null,nativePreferredLocationOptionId:row.preferredLocationOptionId??null,sourceNativePositionQuantity:row.noOfOpening??null,postingDate:null,postedAt:null,jobDescription:null,sourceDetailComplete:false,sourceDetailStatus:'native-own-role-not-read',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
