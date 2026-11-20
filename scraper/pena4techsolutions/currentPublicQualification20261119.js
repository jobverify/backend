import { readFileSync } from 'node:fs'
import { need, sha, stable } from './currentPublicSupport20261119.js'

export const CURRENT_PUBLIC_PROFILE=JSON.parse(readFileSync(new URL('./reviewedCurrent20261119.json',import.meta.url)))
export const CURRENT_PUBLIC_PROGRAM=CURRENT_PUBLIC_PROFILE.programs
export const CURRENT_PUBLIC_PROFILE_NAME=CURRENT_PUBLIC_PROFILE.qualificationProfile
export const CURRENT_CITY_URL='https://gateway.app.hrone.cloud/api/external/public/City/BindDropDown'
const PORTAL='https://career.hrone.cloud',GATEWAY='https://gateway.app.hrone.cloud'
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const nonempty=value=>typeof value==='string'&&value.trim().length>0
const cityKeys=['stateName','countryName','isMetro','countryCode','stateCode','activeStatus','districtCode','districtName','globalRegionCode','globalRegionName','businessRegionCode','businessRegionName','cityCode','cityName']

export function verifyCurrentPublicShell(html){
 need(typeof html==='string'&&Buffer.byteLength(html)===CURRENT_PUBLIC_PROFILE.portalShell.bytes&&sha(html)===CURRENT_PUBLIC_PROFILE.portalShell.sha256,'whole current public portal/application shell profile changed')
}

export const nativePortalMetadataURL=config=>GATEWAY+`/api/external/public/referral/CareerPortal/${encodeURIComponent(config.rqt)}/${encodeURIComponent(config.cc)}`

export function parseCurrentPortalMetadata(data,config){
 need(object(data)&&Array.isArray(data.portalDetails)&&data.portalDetails.length===1&&object(data.portalDetails[0]),'native public portal configuration changed')
 const row=data.portalDetails[0]
 need(row.isActive===true&&row.companyName==='Pena4 Tech Solutions India Pvt. Ltd.','native current employer is inactive or changed')
 need(nonempty(row.companyCode)&&typeof row.websiteName==='string'&&/^#[\da-f]{6}$/i.test(row.headerColor??'')&&/^#[\da-f]{6}$/i.test(row.buttonColor??'')&&Number.isSafeInteger(row.fontStyle)&&row.fontStyle>=8&&row.fontStyle<=40,'native public application style configuration changed')
 need(row.isConsentRequired===false&&row.consentMessage===null,'native mandatory application consent profile changed')
 // Only public employer, display and URL-builder inputs enter this model.
 // Public tenant parameters persist in native application URLs; API headers
 // and non-job candidate, employee and request-owner fields stay omitted.
 return {companyName:row.companyName,isActive:row.isActive,websiteName:row.websiteName,headerColor:row.headerColor,buttonColor:row.buttonColor,fontStyle:row.fontStyle,isConsentRequired:row.isConsentRequired,consentMessage:row.consentMessage,cityLookupUsesCompanyCode:row.companyCode!==config.dc}
}

export const nativeCityQuery=(metadata,config)=>({cityCode:'',stateCode:'',countryCode:'',cityStatus:'1',isCareerPortal:true,companyCode:metadata.cityLookupUsesCompanyCode?config.cc:'',pagination:{pageNumber:0,pageSize:9999}})

export function parseCurrentPublicCities(data){
 need(Array.isArray(data)&&data.length>0&&data.length<=9999,'native public workplace country lookup unavailable')
 const seen=new Set()
 for(const row of data){
  need(object(row)&&Object.keys(row).length===cityKeys.length&&cityKeys.every(key=>Object.hasOwn(row,key))&&Object.values(row).every(value=>value===null||['string','number','boolean'].includes(typeof value)),'native public workplace country fields changed')
  need(nonempty(row.cityCode)&&nonempty(row.cityName)&&nonempty(row.countryCode)&&nonempty(row.countryName)&&typeof row.stateName==='string'&&row.activeStatus==='1'&&!seen.has(row.cityCode),'ambiguous or duplicate native city/country identity')
  seen.add(row.cityCode)
 }
 return structuredClone(data)
}

export function nativeCurrentApplicationURL(row,config,metadata){
 if(row.jobApplicationPath!=null&&row.jobApplicationPath!=='')return null
 if(![row.encryptedPositionId,row.departmentCode,row.sourceType].every(value=>nonempty(value)&&value.length<=512&&!/[\u0000-\u001f\u007f]/.test(value)))return null
 const query=new URLSearchParams(['appId','dc','rqt','cc'].map(key=>[key,config[key]]))
 // Literal published careers-client createUrl(row): no candidate identifiers,
 // mobile numbers, emails, guessed requisitions or invented fragments.
 const suffix=new URLSearchParams({pid:row.encryptedPositionId,dptc:row.departmentCode,st:row.sourceType,fm:'CR',headerColor:metadata.headerColor,fontSize:metadata.fontStyle,buttonColor:metadata.buttonColor})
 return `${PORTAL}/apply-job?${query}&${suffix}`
}

export function qualifyCurrentPublicRole(job,row,context,config){
 const workplaces=job.nativeWorkplaceAlternatives,cities=new Map(context.cities.map(city=>[city.cityCode,city])),nativeCityRows=[]
 let countryQualified=Array.isArray(workplaces)&&workplaces.length>0&&typeof row.preferredLocation==='string'&&row.preferredLocation===workplaces.map(item=>item.text).join(',')
 if(countryQualified)for(const place of workplaces){
  const city=cities.get(String(place.id))
  if(!city||city.cityName!==place.text||city.countryName!=='India'){countryQualified=false;break}
  nativeCityRows.push(structuredClone(city))
 }
 const ownURL=nativeCurrentApplicationURL(row,config,context.metadata),roleURLQualified=typeof ownURL==='string'&&context.applicationShellSHA256===CURRENT_PUBLIC_PROFILE.portalShell.sha256
 // Criteria completeness is reported independently from the native vacancy,
 // employer, workplace and own application identity. Missing descriptions or
 // unread attachments remain explicit partial records under publication policy.
 const reasons=[...(!countryQualified?['native-whole-workplace-id-name-country-join-unqualified']:[]),...(!roleURLQualified?['native-own-application-route-unqualified']:[]),...(job.sourceEmployerBindingQualified===true?[]:['native-own-role-employer-unqualified'])]
 return {...job,
  ...(roleURLQualified?{sourceUrl:ownURL,applyUrl:ownURL,link:ownURL,sourceRoleUrlQualified:true}:{}),
  ...(countryQualified?{country:'India',countryCode:'IN',location:row.preferredLocation,locations:workplaces.map(place=>place.text),city:null}:{}),
  sourceCountryScopeUnresolved:!countryQualified,
  sourceCountryEvidence:{status:countryQualified?'literal-native-city-code-and-country-name':'native-workplace-country-unqualified',nativeWorkplaces:structuredClone(workplaces),nativePreferredLocation:row.preferredLocation??null,nativeCityRows:countryQualified?nativeCityRows:[],countryLookupRecordCount:context.cities.length},
  sourceApplicationHandoff:roleURLQualified?'published-native-role-bound-apply-job-route':null,
  sourceApplicationRouteEvidence:roleURLQualified?{kind:'whole-reviewed-native-createUrl-and-own-role-detail-binding',programmeProfile:CURRENT_PUBLIC_PROFILE_NAME,nativePositionId:String(row.positionId),nativeSourceType:row.sourceType,representativeApplicationShellVerified:true}:null,
  backendSubmissionVerified:false,applicationVisited:false,sourceQualification:{qualified:reasons.length===0,reasons,fullCriteria:job.sourceDetailComplete===true,criteriaReasons:job.nativeCriteriaQualification?.reasons??[]},sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
}

export const publicQualificationModel=context=>({metadata:context.metadata,cities:context.cities.slice().sort((a,b)=>a.cityCode.localeCompare(b.cityCode)),applicationShellSHA256:context.applicationShellSHA256})
export const reconcilePublicQualification=(opening,closing)=>need(stable(publicQualificationModel(opening))===stable(publicQualificationModel(closing)),'closing whole native workplace country/application configuration changed')
