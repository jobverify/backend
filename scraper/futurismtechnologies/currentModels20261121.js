import {nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {readNativeDocument,extractActiveDescription,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {CAREERS_URL,TENANT,nativeRoleLink} from './currentProtocol20261121.js'
import {sha} from './currentTransport20261121.js'

const need=(value,message)=>{if(!value)throw Error('Futurism current native model: '+message)}
const text=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
export const same=(a,b)=>sha(stable(a))===sha(stable(b))
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key))
const rowFields='reqId statusId buName reqTitle expMin expMax location locationAddress jdDisplay approvedOn employmentType buDescription buURL totalPositions priority positionType customFields stagewiseCounts questionList formFieldDetails buHierarchy mandatorySkillList nonMandatorySkillList educationList reqPositionsBOs locationList roleId roleName designation hiringManagerName coordinatorName careerStream jobLevel locationGroup screeningMatchPercent fresher coordinatorEmployeeMobile reqCurrency skillFamily ctcBandHighEnd ctcBandLowEnd requisitionLocationGroup countryCode complianceNotices'.split(' ')
const detailFields='educationList mandatorySkillList nonMandatorySkillList jdDisplay fresher requisitionLocationGroup expMin expMax reqTitle reqId locationList statusId requisitionPublished'.split(' ')
export function readAccount(account){
 need(object(account)&&account.clientId===1107&&account.clientName==='Futurism Technologies Pvt Ltd'&&account.companyWebsite==='https://www.futurismtechnologies.com/','current declared account and own corporate backlink')
 need(object(account.tenantPreferencesMap)&&object(account.clientFlags)&&account.clientFlags.high_security===false,'anonymous current employer account')
 const config=account.tenantPreferencesMap.career_page_url
 need(object(config)&&Array.isArray(config.url)&&config.url.length===3,'current published public recruitment routes')
 for(const pageType of ['jd','application','list'])need(config.url.filter(row=>row.pageType===pageType&&row.url===CAREERS_URL).length===1,'own public '+pageType+' application route')
 return{clientId:account.clientId,clientName:account.clientName,companyWebsite:account.companyWebsite,tenant:TENANT,tenantPreferencesMap:account.tenantPreferencesMap,clientFlags:account.clientFlags??null}
}
export function readListing(envelope){
 need(keys(envelope,['requesterTitle','reqDetailsBOList','hrXmlModel'])&&Array.isArray(envelope.reqDetailsBOList)&&envelope.reqDetailsBOList.length<=1000,'whole published native listing envelope')
 const ids=new Set()
 for(const row of envelope.reqDetailsBOList){need(object(row)&&Number.isSafeInteger(row.reqId)&&row.reqId>0&&!ids.has(row.reqId),'unique current native role identifier');ids.add(row.reqId)}
 return envelope.reqDetailsBOList
}
const indiaOffice=locations=>Array.isArray(locations)&&locations.length>0&&locations.every(location=>object(location)&&text(location.office)==='India'&&text(location.address)&&[null,'India'].includes(nativeLocationCountryName(location.address)))
export const rowHasIndiaLabel=row=>text(row.location)==='India'||Array.isArray(row.locationGroup)&&row.locationGroup.some(label=>text(label)==='India')||Array.isArray(row.locationList)&&row.locationList.some(location=>text(location.office)==='India')
export const rowHasIndia=row=>row.countryCode===null&&text(row.location)==='India'&&same(row.locationGroup,['India'])&&indiaOffice(row.locationList)
function description(html){
 need(typeof html==='string'&&html.trim().length>=200&&html.length<=200000,'full authored role criteria')
 const doc=readNativeDocument(html)
 need(doc.nodes(node=>['script','style','iframe','img','object','embed','audio','video','canvas','svg','input','form'].includes(node.tag)).length===0,'criteria contain nontext or active requirements')
 const hidden=/<(?:[^>]+)\b(?:hidden|aria-hidden\s*=\s*['"]?true)|\bstyle\s*=\s*['"][^'"]*(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|clip(?:-path)?\s*:)/i
 need(!hidden.test(html),'unqualified hidden role criteria')
 // Keep the complete native HTML as the job description. Extraction is only a
 // meaningful-content check; no whitespace-stripped criteria equivalence.
 need(text(extractActiveDescription(html)).length>=150,'substantive authored criteria')
 return html
}
export function qualifyRole(row,envelope,account,{now}={}){
 need(keys(row,rowFields),'new unreviewed listing criterion field')
 need(keys(envelope,['status','data','ts','requestId','v'])&&envelope.status===200&&keys(envelope.data,['requesterTitle','activeApplicationCount','maxActiveApplication','reqDetailsBO']),'native detail response envelope')
 const detail=envelope.data.reqDetailsBO
 need(keys(detail,detailFields)&&Object.keys(detail).length===detailFields.length,'new or missing native detail criterion field')
 need(detail.reqId===row.reqId&&text(detail.reqTitle)===text(row.reqTitle),'native detail/list role identity')
 need(row.statusId===3&&detail.statusId===3&&detail.requisitionPublished===true,'active published native vacancy')
 need(rowHasIndia(row)&&indiaOffice(detail.locationList)&&same(row.locationList,detail.locationList),'explicit per-role India workplace')
 for(const field of ['expMin','expMax','fresher'])need(same(detail[field],row[field]),'list/detail '+field)
 need(Number.isFinite(detail.expMin)&&Number.isFinite(detail.expMax)&&detail.expMin>=0&&detail.expMax>=detail.expMin,'native experience bounds')
 for(const field of ['mandatorySkillList','nonMandatorySkillList','educationList']){
  need(Array.isArray(detail[field])&&detail[field].every(item=>typeof item==='string'&&text(item)),'complete native '+field)
  if(row[field]!==null&&row[field]!==undefined)need(Array.isArray(row[field])&&same(row[field],detail[field]),'supplementary list/detail '+field+' disagree')
 }
 need((row.questionList===null||Array.isArray(row.questionList)&&row.questionList.length===0)&&(row.formFieldDetails===null||Array.isArray(row.formFieldDetails)&&row.formFieldDetails.length===0),'unreconciled role-specific application questions')
 const full=description(detail.jdDisplay)
 // Inline HTML boundaries do not insert visible spaces. Preserve their literal
 // adjacency; only block elements supply separators in the rich/native text.
 const plain=value=>{
  const doc=readNativeDocument(value.replace(/^\s*[*\u2022]\s+/gm,''))
  const blocks=new Set(['p','div','br','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','table','tr','td','th','section'])
  const render=node=>{
   if(typeof node==='string')return node
   if(node.inert)return ''
   const content=node.children.map(render).join('')
   return blocks.has(node.tag)?'\n'+content+'\n':content
  }
  return decodeNativeEntities(render(doc.nodes(n=>n.tag==='root')[0])).replace(/([.!?])(?=[A-Z])/g,'$1 ').replace(/\s+/g,' ').trim()
 }
 need(plain(row.jdDisplay)===plain(full),'whole listing/detail criteria disagree')
 return{jobId:String(row.reqId),jobTitle:detail.reqTitle.trim(),company:'Futurism Technologies',location:row.location,jobLocation:row.location,country:'India',jobDescription:full,
  jobUrl:nativeRoleLink(row.reqId,'jd'),applyUrl:nativeRoleLink(row.reqId,'application'),postingDate:null,
  employmentType:text(row.employmentType)||null,experienceRequired:detail.expMin+' - '+detail.expMax+' Years',
  requiredSkills:[...detail.mandatorySkillList],preferredSkills:[...detail.nonMandatorySkillList],nativeEducationRequirements:[...detail.educationList],
  source:'futurismtechnologies',companyCareerPage:CAREERS_URL,companyDomain:'futurismtechnologies.com',atsPlatform:'mynexthire',
  nativeEmployerLabel:account.clientName,nativeLegalEmployer:null,sourceNativeEmployerEvidence:{clientId:account.clientId,tenant:TENANT,companyWebsite:account.companyWebsite,binding:'current own corporate integration and declared native account corporate backlink; legal role employer not separately published'},
  sourceNativeCountryEvidence:{method:'explicit native role location and assigned office labels',rawCountryCode:row.countryCode,location:row.location,locationGroup:row.locationGroup,assignedOffices:detail.locationList},
  sourceNativeDates:{approvedOn:row.approvedOn,approvedOnSemantics:'native approval timestamp; not asserted to be posting date',datePosted:null},
  sourceNativeRole:detail,sourceNativeListingRecord:row,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  applicationActivationEvidence:{nativePublishedApplyControl:true,roleBoundApplicationURL:true,browserExecuted:false,formSubmitted:false},
  scrapedAt:new Date(now??Date.now()).toISOString()}
}
