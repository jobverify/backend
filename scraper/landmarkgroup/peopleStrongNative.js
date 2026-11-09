import { createHash } from 'node:crypto'
import { projectHTML } from '../arcelormittal/oracleNative.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import worksiteEvidence from './worksiteCountryEvidence.json' with {type:'json'}

export const PEOPLESTRONG_ORIGIN='https://careers-landmarkgroupindia.peoplestrong.com'
const BASE=PEOPLESTRONG_ORIGIN+'/api/cp/rest/altone/cp/'
const PARTS='basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'
const proof=(v,m)=>{if(!v)throw Object.assign(Error('Landmark PeopleStrong: '+m),{code:'LANDMARK_NATIVE_UNVERIFIED'})}
const norm=v=>v==null?null:String(v).replace(/\s+/g,' ').trim()||null
const sha=v=>createHash('sha256').update(v).digest('hex')
const parse=body=>{let p;try{p=JSON.parse(body)}catch{proof(false,'Invalid public JSON')};return p}
const response=body=>{const p=parse(body);proof(p.messageCode?.code===200&&p.response!=null,'Native response unsuccessful');return p.response}
const typed=(a,type)=>{const values=(a??[]).filter(x=>x.orgUnitType===type).map(x=>norm(x.orgUnitName)).filter(Boolean);proof(values.length<=1,'Ambiguous native hierarchy');return values[0]??null}
const typedMaybe=(a,type)=>{const values=(a??[]).filter(x=>x.orgUnitType===type).map(x=>norm(x.orgUnitName)).filter(Boolean);return values.length===1?values[0]:null}
const pairKey=(city,state)=>[city,state].map(v=>norm(v)?.toLowerCase()??'').join('|')
export function classifyPeopleStrongWorksite({detail,organizationRequestJobCode,workSiteHierarchy}){
 const unknown=reason=>({country:null,evidence:null,reason})
 if(!/^\d+$/.test(String(detail?.worksiteID??'')))return unknown('missing-role-worksiteID')
 if(!detail?.requisitionCode||organizationRequestJobCode!==detail.requisitionCode)return unknown('organization-request-role-identity-conflict')
 for(const key of ['country','countryCode','CountryCode','Country'])if(detail[key]!=null&&detail[key]!==''&&nativeCountryName(detail[key])!=='India')return unknown('contradictory-explicit-country')
 const types=['Work Location','Location Type','City','State'];if(!Array.isArray(workSiteHierarchy)||types.some(t=>workSiteHierarchy.filter(x=>x.orgUnitType===t).length!==1))return unknown('missing-or-ambiguous-typed-worksite-hierarchy')
 const get=t=>typedMaybe(workSiteHierarchy,t),key=pairKey(get('City'),get('State')),pair=worksiteEvidence.whitelist.find(x=>x.pairKey===key)
 if(!pair)return unknown('city-state-pair-not-whitelisted')
 const countries=workSiteHierarchy.filter(x=>x.orgUnitType==='Country');if(countries.length>1||countries.length===1&&nativeCountryName(countries[0].orgUnitName)!=='India')return unknown('contradictory-explicit-country')
 if(pair.extraGuards&&(get('Location Type')!==pair.extraGuards.locationType||!pair.extraGuards.workLocationNames.includes(get('Work Location'))))return unknown('corporate-alias-guard-failed')
 const sources=[...pair.cityStateSourceLabels,pair.stateCountrySourceLabel].map(label=>{const s=worksiteEvidence.sourceIndex[label];proof(s?.status===200&&/^[a-f0-9]{64}$/.test(s.sha256),'Invalid reviewed government geography proof');return{label,url:s.url,sha256:s.sha256}})
 return{country:'India',reason:null,evidence:{method:'exact-native-role-worksite-city-state-plus-government-country-parent',inference:true,worksiteID:String(detail.worksiteID),requisitionCode:detail.requisitionCode,organizationRequestJobCode,pairKey:key,nativeCity:get('City'),nativeState:get('State'),nativeWorkLocation:get('Work Location'),nativeLocationType:get('Location Type'),canonicalCity:pair.canonicalCity,canonicalState:pair.canonicalState,verifiedAt:worksiteEvidence.verifiedAt,sources}}
}
const nativeDate=(value,listing,label)=>{if(value==null||value===''){proof(!listing,'Missing native '+label+' date');return null}const m=String(value).match(/^(\d{4}-\d{2}-\d{2})(?: 00:00:00\.0)?$/);proof(m&&new Date(m[1]+'T00:00:00Z').toISOString().startsWith(m[1]),'Invalid native '+label+' date');proof(!listing||m[1]===listing,'Native '+label+' date conflict');return m[1]}
const codePath=code=>{proof(typeof code==='string'&&/^LAMG\/[A-Za-z0-9 &-]+\/\d+$/.test(code),'Unreviewed native requisition code');return code.replaceAll('/','_').replaceAll('&','@')}
export const buildPeopleStrongDetailUrl=code=>BASE+'job/'+encodeURIComponent(codePath(code))+'/v2?part='+PARTS+'&isReqId=false'
export const buildPeopleStrongOrgUrl=code=>BASE+'job/organizationDetails?jobCode='+encodeURIComponent(code)
export const buildPeopleStrongListUrl=offset=>{proof(Number.isSafeInteger(offset)&&offset>=0,'Invalid native offset');return BASE+'jobs/v1?offset='+offset+'&limit=45'}
export function mapPeopleStrongRole(listing,detail,org,{now=new Date().toISOString()}={}){
 const code=listing.jobCode,path=codePath(code);proof(detail.requisitionCode===code&&String(detail.requisitionId)===code.split('/').at(-1)&&norm(detail.jobTitle)===norm(listing.jobTitle),'Native detail identity conflict')
 const url=PEOPLESTRONG_ORIGIN+'/job/detail/'+path;proof(listing.jobDetailUrl===url,'Native application identity conflict')
 proof(typed(org.orgUnitHierarchy,'Group')==='Landmark Group'&&typed(org.workSiteHierarchy,'Group Name')==='Landmark Group','Native employer hierarchy identity missing')
 const brand=typed(org.orgUnitHierarchy,'Business Unit'),company=typed(org.orgUnitHierarchy,'Company Name'),locationCompany=typed(org.workSiteHierarchy,'Company'),worksite=typedMaybe(org.workSiteHierarchy,'Work Location'),city=typedMaybe(org.workSiteHierarchy,'City'),state=typedMaybe(org.workSiteHierarchy,'State')
 proof(brand&&company&&locationCompany===company,'Native role/company/worksite identity missing')
 for(const k of ['entityID','hrOrgUnitID','worksiteID'])if(listing[k]!=null)proof(String(listing[k])===String(detail[k]),'Native '+k+' identity conflict')
 // The source has no Country column. Only reviewed exact City+State pairs on
 // this job's requested typed worksite can supply an inferred country parent.
 const countryProof=classifyPeopleStrongWorksite({detail,organizationRequestJobCode:listing.jobCode,workSiteHierarchy:org.workSiteHierarchy}),country=countryProof.country,description=projectHTML(detail.jobDescription),qualifications=Array.isArray(detail.qualifications)?detail.qualifications.map(norm).filter(Boolean):[],skills=Array.isArray(detail.skills)?detail.skills.map(x=>norm(x.text)).filter(Boolean):[],languages=Array.isArray(detail.languages)?detail.languages.map(norm).filter(Boolean):[],certifications=Array.isArray(detail.certifications)?detail.certifications.map(norm).filter(Boolean):[]
 const posted=nativeDate(detail.CandidatePortalStartDate,listing.jobPostedDate,'publication'),closing=nativeDate(detail.CandidatePortalEndDate,listing.jobClosureDate,'expiry'),content=[description.text,qualifications.length?'Qualifications: '+qualifications.join('; '):null,skills.length?'Skills: '+skills.join('; '):null,languages.length?'Languages: '+languages.join('; '):null,certifications.length?'Certifications: '+certifications.join('; '):null].filter(Boolean).join('\n\n')
 const minimum=norm(detail.minimumExp),maximum=norm(detail.maximumExp),experience=minimum&&maximum?(minimum===maximum?minimum:minimum+' - '+maximum)+' years':null,additional={}
 for(const k of ['jobRole','RoleName','roleType','roleContributionType','programType','employmentTenureType','requisitionType','EducationSepecializationID','educationSepecialization','functionalDesignation','jobRoleID','JobFamilyCode','shiftFrom','shiftTo','employmentType'])if(detail[k]!=null)additional[k]=detail[k]
 const nativePublicFields={jobDescription:detail.jobDescription,qualifications:detail.qualifications??[],skills:detail.skills??[],certifications:detail.certifications??[],languages:detail.languages??[],minimumExp:detail.minimumExp??null,maximumExp:detail.maximumExp??null,CandidatePortalStartDate:detail.CandidatePortalStartDate??null,CandidatePortalEndDate:detail.CandidatePortalEndDate??null}
 return{source:'landmarkgroup',company:'Landmark Group',brand,nativeRoleCompany:company,legalEmployer:null,title:norm(detail.jobTitle),department:typed(org.orgUnitHierarchy,'Function'),jobId:code,requisitionId:String(detail.requisitionId),requisitionCode:code,sourceUrl:url,applyUrl:url,link:url,applicationIdentity:{publicJobCode:code,requisitionId:String(detail.requisitionId),entityID:norm(detail.entityID),hrOrgUnitID:norm(detail.hrOrgUnitID),worksiteID:norm(detail.worksiteID)},location:[worksite,city,state,country].filter(Boolean).join(', '),city,country,sourceCountryEvidence:countryProof.evidence,sourceCountryUnknownReason:countryProof.reason,workMode:null,workplaceType:null,employmentType:norm(detail.employmentType),experienceRequired:experience,minimumQualification:qualifications.join('; ')||null,preferredQualification:null,requiredSkills:skills,nativeSkills:detail.skills??[],qualifications,certifications,languages,sourceAdditionalCriteria:additional,postingDate:posted,postedAt:posted,closingDate:closing,sourceClosingDateIsExact:false,sourceDescription:content,jobDescription:content,nativePublicFields,nativeOrganizationHierarchy:org.orgUnitHierarchy,nativeWorksiteHierarchy:org.workSiteHierarchy,nativeRequisitionStatus:norm(detail.requisitionStatus),sourceDetailComplete:Boolean(description.text)&&description.complete,sourceDetailStatus:Boolean(description.text)&&description.complete?'complete':'partial',sourceListingComplete:false,sourceScopeComplete:false,sourceLocationCorroborationComplete:Boolean(country),scrapedAt:new Date(now).toISOString()}
}
async function verifyClient(read){
 const shell=await read(PEOPLESTRONG_ORIGIN+'/home',{allowAppShell404:true});proof(/<app-root\b/i.test(shell),'Current native app shell missing')
 const main=shell.match(/<script\b[^>]*\bsrc=["'](main-[A-Z0-9]+\.js)["']/)?.[1];proof(main,'Current public native main client missing');const js=await read(PEOPLESTRONG_ORIGIN+'/'+main)
 const jobModule=js.match(/path:"job",loadChildren:\(\)=>import\("(\.\/chunk-[A-Z0-9]+\.js)"\)/)?.[1];proof(jobModule,'Current job module not advertised')
 const imports=[...new Set([...js.matchAll(/from\s*["'](\.\/chunk-[A-Z0-9]+\.js)["']/g)].map(x=>x[1]))];let service=null
 for(const file of imports){const text=await read(new URL(file,PEOPLESTRONG_ORIGIN+'/'+main).href);if(text.includes('getjoblist(')&&text.includes('jobs/v1?offset=')){service=text;break}}
 proof(service&&['/api/cp/rest/altone/cp/','makePostReq("jobs/v1?offset=','job/organizationDetails?jobCode=','getJobDetails(','/v2?part=','&isReqId=','this.offset=0,this.limit=45'].every(x=>service.includes(x)),'Current anonymous list/detail protocol changed')
 const lazy=await read(new URL(jobModule,PEOPLESTRONG_ORIGIN+'/'+main).href);proof(lazy.includes(PARTS)&&lazy.includes('getJobDetails(')&&lazy.includes('jobDescription'),'Current full-detail request not advertised')
 const layout=await read(BASE+'layout?isPreview=false'),info=response(await read(BASE+'urlinfo'));proof(/Landmark Group/i.test(layout)&&info.url==='careers-landmarkgroupindia.peoplestrong.com','Current delegated employer identity mismatch')
 return{main,jobModule,layoutIdentity:true}
}
export async function collectLandmarkPeopleStrong({read,delegation,now}){
 proof(delegation.otherScopes.includes(PEOPLESTRONG_ORIGIN+'/home'),'India native board not currently delegated');await verifyClient(read)
 const traverse=async()=>{const records=[],pages=[];let total=null,offset=0
  for(;;){const p=parse(await read(buildPeopleStrongListUrl(offset),{method:'POST',body:'{}'}));proof(Number.isSafeInteger(p.totalRecords)&&p.totalRecords>=0&&p.totalRecords<=100000&&Array.isArray(p.response),'Native search counts missing');if(total===null)total=p.totalRecords;proof(total===p.totalRecords,'Native search total changed');proof(p.response.length<=45,'Native page exceeds advertised limit');pages.push({offset,rows:p.response.length});records.push(...p.response);if(offset>=total){proof(p.response.length===0,'Native terminal page not empty');break}offset+=45}
  return{records,pages,total}
 },initial=await traverse(),seen=new Set(),roles=[],failures=[]
 for(const row of initial.records){proof(row&&typeof row.jobCode==='string'&&!seen.has(row.jobCode),'Duplicate native requisition identity');seen.add(row.jobCode);const d=response(await read(buildPeopleStrongDetailUrl(row.jobCode))),org=response(await read(buildPeopleStrongOrgUrl(row.jobCode)));try{roles.push(mapPeopleStrongRole(row,d,org,{now}))}catch(e){failures.push({jobCode:row.jobCode,reason:e.message})}}
 const closing=await traverse(),same=sha(JSON.stringify(initial.records))===sha(JSON.stringify(closing.records)),inventoryComplete=same&&seen.size===initial.total&&roles.length===seen.size&&!failures.length,unknown=roles.filter(x=>!x.sourceLocationCorroborationComplete),partial=roles.filter(x=>!x.sourceDetailComplete),closed=roles.filter(x=>x.nativeRequisitionStatus!=='OPEN'),jobs=roles.filter(x=>x.country==='India'&&x.sourceDetailComplete&&x.nativeRequisitionStatus==='OPEN')
 return{jobs,rawCount:initial.total,complete:inventoryComplete&&!unknown.length&&!partial.length&&!closed.length,report:{surface:PEOPLESTRONG_ORIGIN+'/home',inventoryComplete,reportedTotal:initial.total,observedCount:seen.size,pages:initial.pages,closingPages:closing.pages,closingMatches:same,fullNativeDetails:roles.length,renderedFullDetails:roles.filter(x=>x.sourceDetailComplete).length,verifiedIndia:roles.filter(x=>x.country==='India').length,nativeExplicitIndia:roles.filter(x=>x.nativeWorksiteHierarchy.some(n=>n.orgUnitType==='Country'&&nativeCountryName(n.orgUnitName)==='India')).length,countryInferenceCount:roles.filter(x=>x.sourceCountryEvidence?.inference===true).length,unknownCountryCount:unknown.length,unknownCountryIds:unknown.map(x=>x.jobId),partialDetailIds:partial.map(x=>x.jobId),closedIds:closed.map(x=>x.jobId),failures,cleanupAllowed:false,verifiedZeroInventory:false,roles}}
}
