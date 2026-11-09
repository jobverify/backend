// Independently configured Adda247 Keka board. A currently unavailable corporate
// handoff is not silently replaced with a company-wide inventory claim.
import {parse} from 'acorn'
import {structure,norm,stable,sha} from '../bizongo/publicRead.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {collectPublicSource,coverageGap,requireSource,sourceFailure} from './sourceBoundary.js'

export const NATIVE_ROOT='https://adda247.keka.com/careers/'
export const ACTIVE_URL=NATIVE_ROOT+'api/jobs/default/active'
const INFO_URL=NATIVE_ROOT+'api/organization/default/careerportalinfo',GROUP_URL=NATIVE_ROOT+'api/organization/grouplinkstatus'
const CLIENT_URL='https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js'
// Only the actual public listing functions are reviewed. Unrelated private
// application/contact components are neither invoked nor hashed as a JD gate.
const listingFunctions={loadJobsSection:'3846895fe68400b15c8b0373ceac89fa28122608b1007198b562aceeb9723826',loadData:'72c2af2ca07fa21b3526071ab2fd36b02868b40e0d4a92126c1c749b4d8cf883',bindJobs:'2a2353d3bfc55e9bc79e7dc42adec7112684c01f9858af74905e3efa83418e4c'}
const fields=new Set(['location','experience','jobType','jobNumber','salaryRange','dateOfPosting'])
const rowFields=new Set(['id','title','description','departmentIdentifier','departmentName','excerpt','jobLocations','jobType','experience','salaryRange','salaryRangeFormat','publishedOn','publishedSinceDays','skillNames','jobNumber','isRemote','closingDate','expiryDate','validThrough'])
const source='adda247',need=(value,message)=>requireSource(value,source,message)
const roleNeed=(value,kind,message)=>{if(!value)throw Object.assign(sourceFailure(source,message),{detailKind:kind})}
const ancestor=(s,node,parent)=>{for(let value=node;value;value=s.parents.get(value))if(value===parent)return true;return false}
const hasClass=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)

function inspectClient(js){
 let ast;try{ast=parse(js,{ecmaVersion:'latest'})}catch{need(false,'public listing client is no longer parseable')}
 for(const[name,expected]of Object.entries(listingFunctions)){
  const declarations=ast.body.filter(node=>node.type==='FunctionDeclaration'&&node.id?.name===name)
  need(declarations.length===1&&sha(js.slice(declarations[0].start,declarations[0].end))===expected,'public listing client changed')
 }
 return{kind:'selected-public-listing-functions-only',functions:{...listingFunctions},wholeClientSHA256:sha(js),privateApplicationProgramRequired:false}
}
function inspectShell(html){
 const s=structure(html)
 need(s.visible(node=>node.tag==='title'&&s.text(node)==='Careers at Adda247').length===1,'configured native board employer title changed')
 need(s.visible(node=>node.tag==='base'&&node.attrs.id==='baseHref'&&node.attrs.href==='/careers/').length===1,'native public API base changed')
 need(s.visible(node=>node.tag==='meta'&&node.attrs.name==='portalName'&&(node.attrs.content??'')==='').length===1,'native default portal changed')
 need(s.visible(node=>node.attrs.id==='kh-jobs-section').length===1,'current native listing renderer container missing')
 need(s.scripts.filter(node=>node.executable&&!node.visuallyInactive&&node.attrs.src===CLIENT_URL).length===1,'native public client binding changed')
 return{title:'Careers at Adda247',nativeRoot:NATIVE_ROOT,portal:'default',clientURL:CLIENT_URL}
}
function inspectInfo(info){
 need(info&&typeof info==='object'&&!Array.isArray(info)&&info.name==='Adda247'&&info.shortName==='Adda247'&&info.careersPortalDomain==='adda247.keka.com'&&info.companyWebsite===NATIVE_ROOT,'current native tenant/employer identity changed')
 need(info.jobListingSetting&&Array.isArray(info.jobListingSetting.jobFields)&&new Set(info.jobListingSetting.jobFields).size===info.jobListingSetting.jobFields.length&&info.jobListingSetting.jobFields.every(field=>fields.has(field)),'public native detail field contract changed')
 return info
}
function inspectRows(rows,allowed){
 need(Array.isArray(rows)&&rows.length<=1000,'native inventory must be the complete public array')
 const ids=new Set()
 for(const row of rows){const id=String(row?.id??'');need(/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(+id)&&!ids.has(id),'duplicate or invalid native role identity');ids.add(id);allowed.add(NATIVE_ROOT+'jobdetails/'+id)}
 return rows
}
function visibleContent(s,node){
 const allowedTags=new Set(['root','h1','h2','h3','h4','h5','h6','div','p','br','strong','b','em','i','ul','ol','li','span','a','u','s','hr','table','thead','tbody','tr','td','th'])
 const inspect=value=>{
  roleNeed(s.active(value),'unqualified-public-description','public description is hidden')
  roleNeed(allowedTags.has(value.tag),'unqualified-public-description','unreviewed element in public description')
  for(const[key,content]of Object.entries(value.attrs)){
   roleNeed(!/^on/i.test(key)&&!['hidden','inert'].includes(key)&&!(key==='aria-hidden'&&content.toLowerCase()==='true'),'unqualified-public-description','hidden/executable public description')
   if(key==='class')roleNeed(!content||/^(?:(?:job-description-container|\s)+)$/.test(content),'unqualified-public-description','unreviewed public description class')
   if(key==='style'){
    const css=content.replace(/\/\*[^]*?\*\//g,'')
    roleNeed(!/[\\@]/.test(css),'unqualified-public-description','unreviewed public description style')
    for(const declaration of css.split(';').map(value=>value.trim()).filter(Boolean)){
     const match=/^([a-z-]+)\s*:\s*(.+)$/i.exec(declaration)
     roleNeed(match,'unqualified-public-description','ambiguous public description style')
     const property=match[1].toLowerCase(),value=match[2].trim().toLowerCase()
     const spacing=/^(?:margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?)$/.test(property)&&/^(?:0(?:px)?|1\.5em)$/.test(value)
     const list=property==='list-style-type'&&['disc','decimal','circle','square'].includes(value)
     const color=property==='color'&&/^(?:rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*0\.9\))$/.test(value)
     const background=property==='background-color'&&/^(?:transparent|rgba\(255,\s*255,\s*255,\s*1\))$/.test(value)
     roleNeed(spacing||list||color||background,'unqualified-public-description','unreviewed public description visibility style')
    }
   }
  }
  for(const child of value.children)if(typeof child!=='string')inspect(child)
 }
 inspect(node)
 // Ancestor styles can hide an otherwise complete native description.
 for(let parent=s.parents.get(node);parent;parent=s.parents.get(parent))roleNeed(s.active(parent)&&!parent.attrs.style,'unqualified-public-description','unreviewed inherited public description visibility')
 return norm(s.text(node))
}
function geography(locations){
 roleNeed(Array.isArray(locations)&&locations.length>0,'unresolved-native-country','native workplace alternatives missing')
 const countries=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'}),out=[]
 for(const location of locations){
  roleNeed(location&&typeof location==='object'&&!Array.isArray(location)&&Object.keys(location).every(key=>['id','name','city','state','countryCode','countryName','locationIdentifier'].includes(key)),'unresolved-native-country','unreviewed native workplace shape')
  roleNeed(Number.isSafeInteger(location.id)&&location.id>0&&['name','city','state','countryCode','countryName','locationIdentifier'].every(key=>location[key]==null||typeof location[key]==='string'),'unresolved-native-country','native workplace identity/shape unavailable')
  const code=norm(location.countryCode).toUpperCase(),name=norm(location.countryName),label=/^[A-Z]{2}$/.test(code)?countries.of(code):null
  roleNeed(label&&name&&(label.toLowerCase()===name.toLowerCase()||code==='US'&&['usa','united states of america'].includes(name.toLowerCase())||code==='GB'&&name==='UK'),'unresolved-native-country','native country missing or conflicting')
  out.push(label)
 }
 roleNeed(new Set(out).size===1,'unresolved-native-country','conflicting native workplace country alternatives')
 return out[0]
}
function date(value,kind,now){
 if(value==null||value==='')return null
 roleNeed(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)&&Number.isFinite(Date.parse(value)),'unqualified-native-date','invalid native '+kind)
 roleNeed(new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10),'unqualified-native-date','invalid native calendar date')
 roleNeed(kind!=='publication'||Date.parse(value)<=Date.parse(now),'unqualified-native-date','future native publication')
 return value
}
function project(row,html,info,now){
 const id=String(row.id),s=structure(html),description=s.nodes.filter(node=>hasClass(node,'job-description-container'))
 roleNeed(Object.keys(row).every(key=>rowFields.has(key)),'unreviewed-public-criteria','new native criteria field requires review')
 roleNeed(description.length===1,'public-role-identity','public native description container is missing or ambiguous')
 const container=description[0],titles=s.visible(node=>node.tag==='h1'&&!ancestor(s,node,container)),title=norm(row.title)
 roleNeed(title&&titles.length===1&&norm(s.text(titles[0]))===title,'public-role-identity','own public role title mismatch')
 const identifiers=s.nodes.filter(node=>Object.hasOwn(node.attrs,'selectedjobid')).map(node=>node.attrs.selectedjobid)
 roleNeed(identifiers.length>0&&identifiers.every(value=>value===id)&&s.visible(node=>node.attrs.id==='apply-job').length===1,'public-role-identity','public native role identity changed')
 const nativeTitles=s.nodes.filter(node=>Object.hasOwn(node.attrs,'selectedjobtitle')).map(node=>norm(node.attrs.selectedjobtitle))
 roleNeed(nativeTitles.length>0&&nativeTitles.every(value=>value===title),'public-role-identity','public native client role-title binding changed')
 const headers=s.visible(node=>node.tag==='header'),orgRoot=info.careersBackgroundPath?.match(/^\/ats\/documents\/[a-f0-9-]{36}\//)?.[0]
 roleNeed(headers.length===1&&orgRoot&&/^orglogo\/[a-f0-9]+\.(?:jpeg|jpg|png|svg)$/i.test(info.logoPath)&&s.visible(node=>node.tag==='img'&&ancestor(s,node,headers[0])&&node.attrs.src===orgRoot+info.logoPath).length===1&&s.visible(node=>node.tag==='a'&&ancestor(s,node,headers[0])&&node.attrs.href===NATIVE_ROOT).length===1,'public-role-identity','public detail tenant/organization logo binding mismatch')
 roleNeed(!/\b(?:job (?:is )?(?:closed|expired|no longer)|position (?:is )?(?:closed|filled)|no longer accepting applications)\b/i.test(s.text(s.root)),'public-role-identity','public native role is closed')
 roleNeed(s.scripts.filter(node=>node.executable&&!node.visuallyInactive&&node.attrs.src===CLIENT_URL).length===1,'public-role-identity','public detail native client binding changed')
 roleNeed(!s.nodes.some(node=>node.tag==='script'&&node.attrs.type==='application/ld+json'),'unreviewed-public-criteria','new structured public criteria require review')
 const publicDescription=visibleContent(s,container),native=structure(row.description??''),nativeText=visibleContent(native,native.root)
 roleNeed(typeof row.description==='string'&&extractActiveDescription(row.description)&&/[\p{L}\p{N}]/u.test(publicDescription)&&!/^(?:please\s+)?enter\s+(?:the\s+)?job\s+description[\s.!:…-]*$/i.test(nativeText),'missing-public-description','native public description missing')
 roleNeed(nativeText===publicDescription,'unqualified-public-description','native API and complete visible public description differ')
 const outside=node=>ancestor(s,node,container)?'':node.tag==='script'||!s.active(node)?'':node.children.map(child=>typeof child==='string'?child:outside(child)).join(' ')
 roleNeed(!/\b(?:qualifications?|requirements?|eligibility|responsibilities)\b/i.test(norm(outside(s.root))),'unreviewed-public-criteria','extra public role criteria outside full description')
 roleNeed(info.jobListingSetting.jobFields.includes('location'),'unresolved-native-country','native location is not a published detail field')
 const country=geography(row.jobLocations),posted=date(row.publishedOn,'publication',now),expiries=[row.closingDate,row.expiryDate,row.validThrough].filter(value=>value!=null&&value!=='').map(value=>date(value,'expiry',now))
 roleNeed(new Set(expiries).size<=1&&(!expiries.length||Date.parse(expiries[0])>Date.parse(now)&&(!posted||Date.parse(expiries[0])>Date.parse(posted))),'unqualified-native-date','expired or conflicting native lifecycle')
 roleNeed(row.departmentName==null||typeof row.departmentName==='string','unreviewed-public-criteria','unqualified native department')
 roleNeed(row.jobType==null||[1,2].includes(row.jobType),'unreviewed-public-criteria','unreviewed native employment type')
 roleNeed(row.isRemote==null||typeof row.isRemote==='boolean','unreviewed-public-criteria','unqualified native remote field')
 roleNeed(row.experience==null||typeof row.experience==='string'||Number.isFinite(row.experience)&&row.experience>=0,'unreviewed-public-criteria','unqualified native experience')
 roleNeed(Array.isArray(row.skillNames)&&row.skillNames.every(value=>typeof value==='string'),'unreviewed-public-criteria','unqualified native skills')
 const skillLabels=s.visible(node=>node.tag==='p'&&norm(s.text(node))==='Required Skills')
 roleNeed(skillLabels.length===(row.skillNames.length?1:0),'unreviewed-public-criteria','public required-skills block changed')
 if(skillLabels.length){
  const block=s.parents.get(skillLabels[0]),skillNodes=s.nodes.filter(node=>node.tag==='span'&&ancestor(s,node,block))
  roleNeed(skillNodes.every(node=>s.active(node))&&stable(skillNodes.map(node=>norm(s.text(node))))===stable(row.skillNames.map(norm)),'unreviewed-public-criteria','native and public required skills differ')
 }
 roleNeed(row.salaryRange==null||typeof row.salaryRange==='object'&&!Array.isArray(row.salaryRange)&&Object.keys(row.salaryRange).every(key=>['minimum','maximum','currency','salaryPeriod','cultureInfo'].includes(key)),'unreviewed-public-criteria','new native compensation criteria require review')
 roleNeed(row.salaryRangeFormat==null||typeof row.salaryRangeFormat==='string','unreviewed-public-criteria','unqualified native compensation')
 const shown=field=>info.jobListingSetting.jobFields.includes(field),primary=row.jobLocations[0],locations=row.jobLocations.map(location=>[norm(location.name)||norm(location.city),country].filter(Boolean).join(', ')),url=NATIVE_ROOT+'jobdetails/'+id
 const job={source,company:'Adda247',legalEmployer:'Adda247',atsPlatform:'keka-native-public-board',companyCareerPage:'https://www.adda247.com/careers.html',companyDomain:'adda247.com',
  jobId:id,sourceJobId:id,id,requisitionId:shown('jobNumber')?norm(row.jobNumber)||null:null,title,department:norm(row.departmentName)||null,location:locations.join('; '),locations,city:norm(primary.city)||null,state:norm(primary.state)||null,country,
  sourceUrl:url,applyUrl:url,link:url,jobDescription:row.description,sourceDescription:row.description,fullPublicDescriptionText:publicDescription,nativeRow:row,nativeCountryEvidence:row.jobLocations,
  postingDate:shown('dateOfPosting')?posted:null,postedAt:shown('dateOfPosting')?posted:null,nativePublicationDate:row.publishedOn??null,nativePublicationSource:'active.publishedOn',closingDate:expiries[0]??null,sourceClosingDateIsExact:Boolean(expiries[0]?.includes('T')),
  employmentType:shown('jobType')?({1:'Part Time',2:'Full Time'}[row.jobType]??null):null,experienceRequired:shown('experience')&&row.experience!=null?String(row.experience):null,requiredSkills:[...row.skillNames],minimumQualification:null,preferredQualification:null,
  salaryRange:shown('salaryRange')?row.salaryRangeFormat??null:null,remoteStatus:row.isRemote===true?'Remote':null,nativePublicFieldVisibility:[...info.jobListingSetting.jobFields],sourceDetailComplete:true,publicRolePageFetched:true,sourceAvailabilityVerified:true,sourceActive:true,
  sourceScopeComplete:false,sourceListingComplete:false,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false,corporateHandoffVerified:false,configuredNativeScope:'independently-configured-Adda247-default-public-Keka-board',applicationActionPerformed:false,scrapedAt:now}
 return{job,country,semantic:{row,publicDescription,title,fields:info.jobListingSetting.jobFields}}
}

export const createCurrentAdda247Scraper=()=>({async run(options={}){
 const cap=options.maxJobs??0;need(Number.isSafeInteger(cap)&&cap>=0,'invalid caller maxJobs')
 const allowed=new Set([NATIVE_ROOT,INFO_URL,GROUP_URL,ACTIVE_URL,CLIENT_URL])
 return collectPublicSource(source,options,allowed,async({read,audit,stamp,receipts,signal})=>{
  const now=stamp(),detailBodies={},snapshot=async phase=>{
   const shell=inspectShell(await read(NATIVE_ROOT,{phase})),info=inspectInfo(await read(INFO_URL,{phase,kind:'json'})),group=await read(GROUP_URL,{phase,kind:'json'})
   need(group&&Object.keys(group).length===1&&group.isGroupLinked===false,'native group scope changed')
   const client=inspectClient(await read(CLIENT_URL,{phase,kind:'javascript'})),rows=inspectRows(await read(ACTIVE_URL,{phase,kind:'json'}),allowed),roles=new Map(),failures=[]
   for(const row of rows){signal.throwIfAborted();const id=String(row.id);try{const html=await read(NATIVE_ROOT+'jobdetails/'+id,{phase});detailBodies[phase]??={};detailBodies[phase][id]=html;roles.set(id,project(row,html,info,now))}catch(error){signal.throwIfAborted();failures.push({id,stage:'native-detail',kind:error.detailKind??'public-detail-unavailable',status:error.status??null})}}
   return{shell,info,group,client,rows,roles,failures}
  }
  const first=await snapshot('opening'),last=await snapshot('closing'),finalRows=inspectRows(await read(ACTIVE_URL,{phase:'final-after-closing-details',kind:'json'}),allowed),final=new Map(finalRows.map(row=>[String(row.id),row])),failures=new Map([...first.failures,...last.failures].map(row=>[row.id,row])),selected=[],foreign=[]
  for(const row of first.rows){const id=String(row.id),a=first.roles.get(id),b=last.roles.get(id);if(!a||!b)continue
   if(stable(a.semantic)!==stable(b.semantic)||stable(row)!==stable(final.get(id))){failures.set(id,{id,stage:'native-detail',kind:'role-changed-or-removed-during-closing'});continue}
   if(a.country==='India')selected.push(a.job);else foreign.push({id,country:a.country,nativeRow:row})
  }
  const closingMatches=stable(first.rows)===stable(last.rows)&&stable(last.rows)===stable(finalRows)&&stable(first.info)===stable(last.info),reasons=['current-corporate-handoff-not-revalidated;configured-native-board-only',...(failures.size?['unresolved-public-role-details']:[]),...(!closingMatches?['native-inventory-changed-during-closing']:[]),...(cap&&cap<selected.length?['caller-result-cap-after-native-verification']:[])]
  const collection={source,sourceScope:'independently-configured-employer-bound-native-board',observedListingCount:first.rows.length,observedIndiaListingCount:first.rows.filter(row=>{try{return geography(row.jobLocations)==='India'}catch{return false}}).length,nonIndiaListingCount:foreign.length,
   candidateDetails:first.rows.length,extractedDetailJobs:selected.length,excludedDetailJobs:foreign.length,jobs:selected.map(job=>({id:job.jobId})),exclusions:foreign,failures:[...failures.values()],listingPaginationComplete:true,closingInventoryMatches:closingMatches,
   corporateHandoffVerified:false,configuredNativeEmployerIdentity:first.info.name,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,reasons,verifiedAt:now,retainedResponses:receipts}
  const result=(cap?selected.slice(0,cap):selected).map(job=>({...job,nativeCollectionEvidence:collection}))
  const evidence={...coverageGap(NATIVE_ROOT,reasons.join(';')),pagesFetched:receipts.length,verifiedAt:now}
  await audit({...collection,originalNativeRows:first.rows,closingNativeRows:last.rows,finalNativeRows:finalRows,nativeOrganization:first.info,nativeGroupState:first.group,publicListingClient:first.client,originalPublicDetailBodies:detailBodies,inventoryEvidence:evidence})
  return attachSourceObservationEvidence(attachInventoryEvidence(result,evidence),{source,recordKind:'vacancy-rows',observedRecordCount:first.rows.length,observedVacancyCount:first.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 })
}})
